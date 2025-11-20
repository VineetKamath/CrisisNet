from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
import pandas as pd
import os
import json
from pathlib import Path
from typing import Dict, List
from collections import Counter
from utils.graph_utils import (
    build_graph,
    compute_centrality_metrics,
    detect_communities,
    get_top_influencers,
    compute_graph_metrics,
    compute_path_lengths,
    compute_edge_path_info,
)
from utils.reddit_stream import RedditStreamService
from utils.live_manager import LiveUpdateManager
from models import AnalysisState

router = APIRouter()

# Global state (will be injected from main.py)
analysis_state: AnalysisState = None

MAX_LIVE_EVENTS = 200


def _build_live_summary() -> Dict:
    events = analysis_state.live_events
    total = len(events)
    if total == 0:
        return {
            "total_events": 0,
            "avg_sentiment": 0,
            "top_locations": [],
            "top_keywords": [],
            "last_event": None,
        }

    sentiment_values = [
        e.get("sentiment", {}).get("compound")
        for e in events
        if e.get("sentiment", {}).get("compound") is not None
    ]
    avg_sentiment = sum(sentiment_values) / len(sentiment_values) if sentiment_values else 0

    location_counter = Counter(
        e["location"] for e in events if e.get("location")
    )
    keyword_counter = Counter(
        kw for e in events for kw in e.get("keywords", [])
    )

    top_locations = []
    for loc, count in location_counter.most_common(5):
        sample = next((e for e in events if e.get("location") == loc and e.get("lat")), None)
        top_locations.append(
            {
                "location": loc,
                "count": count,
                "lat": sample.get("lat") if sample else None,
                "lon": sample.get("lon") if sample else None,
            }
        )

    summary = {
        "total_events": total,
        "avg_sentiment": avg_sentiment,
        "top_locations": top_locations,
        "top_keywords": [kw for kw, _ in keyword_counter.most_common(5)],
        "last_event": events[-1],
    }
    return summary


async def handle_live_event(event: Dict):
    analysis_state.live_events.append(event)
    if len(analysis_state.live_events) > MAX_LIVE_EVENTS:
        analysis_state.live_events = analysis_state.live_events[-MAX_LIVE_EVENTS:]
    summary = _build_live_summary()
    analysis_state.live_summary = summary

    if analysis_state.live_manager:
        await analysis_state.live_manager.broadcast(
            {
                "type": "event",
                "event": event,
                "summary": summary,
                "running": analysis_state.live_running,
            }
        )

def init_state(state: AnalysisState):
    """Initialize the global analysis state"""
    global analysis_state
    analysis_state = state
    if analysis_state.live_manager is None:
        analysis_state.live_manager = LiveUpdateManager()
    if analysis_state.reddit_stream is None:
        analysis_state.reddit_stream = RedditStreamService()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and parse CSV file"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        # Read CSV
        contents = await file.read()
        df = pd.read_csv(pd.io.common.BytesIO(contents))
        
        # Validate required columns
        required_cols = ['id', 'keyword', 'location', 'text', 'target']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {missing_cols}"
            )
        
        # Store in state
        analysis_state.df = df
        # Reset other analysis results (keep df)
        analysis_state.graph_data = None
        analysis_state.metrics = None
        analysis_state.summary = None
        analysis_state.top_influencers = None
        analysis_state.communities = None
        analysis_state.geo_data = None
        analysis_state.text_insights = None
        analysis_state.alerts = None
        analysis_state.timeline = None
        
        # Return dataset stats
        return {
            "message": "File uploaded successfully",
            "total_rows": len(df),
            "unique_keywords": df['keyword'].nunique(),
            "unique_locations": df['location'].nunique(),
            "disaster_tweets": int(df['target'].sum()),
            "non_disaster_tweets": int((df['target'] == 0).sum())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.get("/analyze")
async def analyze():
    """Build graph and compute SNA metrics"""
    if analysis_state.df is None:
        raise HTTPException(status_code=400, detail="No data uploaded. Please upload a CSV file first.")
    
    try:
        df = analysis_state.df
        
        # Build graph
        G = build_graph(df, similarity_threshold=0.3)
        
        # Compute metrics
        centrality_metrics = compute_centrality_metrics(G)
        communities = detect_communities(G)
        graph_metrics = compute_graph_metrics(G)
        top_influencers = get_top_influencers(G, centrality_metrics, communities, df, top_n=10)
        
        # Text analytics (lazy import)
        from utils.text_insights import analyze_topics_and_sentiment
        from utils.geo_utils import compute_geo_insights
        from utils.timeline_utils import build_time_series
        from utils.alert_utils import compute_alert_scores
        
        text_insights = analyze_topics_and_sentiment(df)

        # Store results
        analysis_state.graph_data = {
            'graph': G,
            'centrality': centrality_metrics,
            'communities': communities
        }
        analysis_state.top_influencers = top_influencers
        analysis_state.communities = communities
        analysis_state.text_insights = text_insights
        analysis_state.geo_data = compute_geo_insights(df, text_insights.get('tweet_sentiments'))
        analysis_state.timeline = build_time_series(df)
        analysis_state.alerts = compute_alert_scores(
            df,
            centrality_metrics,
            text_insights.get('tweet_sentiments', {}),
            text_insights.get('tweet_topics', {}),
            communities
        )
        
        # Compute summary metrics
        num_communities = len(set(communities.values()))
        top_keyword = df['keyword'].mode().iloc[0] if len(df['keyword'].mode()) > 0 else "N/A"
        
        analysis_state.metrics = {
            'total_tweets': len(df),
            'disaster_tweets': int(df['target'].sum()),
            'non_disaster_tweets': int((df['target'] == 0).sum()),
            'num_communities': num_communities,
            'average_degree': graph_metrics['average_degree'],
            'graph_density': graph_metrics['density'],
            'average_path_length': graph_metrics.get('average_path_length', 0),
            'diameter': graph_metrics.get('diameter', 0),
            'radius': graph_metrics.get('radius', 0),
            'average_clustering': graph_metrics.get('average_clustering', 0),
            'num_components': graph_metrics.get('num_components', 0),
            'top_keyword': str(top_keyword) if pd.notna(top_keyword) else "N/A"
        }
        
        # Generate summary text
        summary = generate_summary(analysis_state.metrics, top_influencers, communities, df)
        analysis_state.summary = summary
        
        return {
            "message": "Analysis complete",
            "metrics": analysis_state.metrics,
            "top_influencers_count": len(top_influencers)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during analysis: {str(e)}")

@router.get("/graph")
async def get_graph():
    """Get graph data as JSON (nodes and edges)"""
    if analysis_state.graph_data is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    
    try:
        G = analysis_state.graph_data['graph']
        centrality = analysis_state.graph_data['centrality']
        communities = analysis_state.graph_data['communities']
        df = analysis_state.df
        
        # Compute edge path information
        edge_path_info = compute_edge_path_info(G)
        
        # Build nodes with additional metrics
        nodes = []
        for node_id in G.nodes():
            tweet_row = df[df['id'].astype(str) == node_id]
            if not tweet_row.empty:
                row = tweet_row.iloc[0]
                # Compute degree (number of connections)
                degree = G.degree(node_id)
                
                # Compute path lengths from this node
                path_lengths = compute_path_lengths(G, node_id)
                avg_path_length = sum(path_lengths.values()) / len(path_lengths) if path_lengths else 0
                
                nodes.append({
                    'id': node_id,
                    'label': str(row['text'])[:50] + "..." if len(str(row['text'])) > 50 else str(row['text']),
                    'keyword': str(row['keyword']) if pd.notna(row['keyword']) else "",
                    'location': str(row['location']) if pd.notna(row['location']) else "",
                    'target': int(row['target']) if pd.notna(row['target']) else 0,
                    'community': int(communities.get(node_id, -1)),
                    'degree': int(degree),  # Actual degree (number of connections)
                    'degree_centrality': float(centrality['degree'].get(node_id, 0)),
                    'betweenness_centrality': float(centrality['betweenness'].get(node_id, 0)),
                    'eigenvector_centrality': float(centrality['eigenvector'].get(node_id, 0)),
                    'clustering_coefficient': float(centrality['clustering'].get(node_id, 0)),
                    'average_path_length': float(avg_path_length),
                    'text': str(row['text']) if pd.notna(row['text']) else ""
                })
        
        # Build edges with additional information
        edges = []
        for source, target, data in G.edges(data=True):
            edge_key = f"{source}-{target}"
            path_info = edge_path_info.get(edge_key, {'path_length': 1, 'is_direct': True})
            
            edges.append({
                'source': str(source),
                'target': str(target),
                'weight': float(data.get('weight', 0.5)),
                'type': str(data.get('type', 'similarity')),
                'path_length': int(path_info.get('path_length', 1)),
                'is_direct': bool(path_info.get('is_direct', True))
            })
        
        return {
            'nodes': nodes,
            'edges': edges
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving graph: {str(e)}")

@router.get("/summary")
async def get_summary():
    """Get textual insights and summary"""
    if analysis_state.summary is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    
    try:
        metrics = analysis_state.metrics
        top_influencers = analysis_state.top_influencers
        communities = analysis_state.communities
        
        insights = []
        
        # Community insights
        if top_influencers:
            for inf in top_influencers[:5]:
                insights.append(
                    f"Tweet {inf['id']} is a key informer in community {inf['community']} "
                    f"with combined centrality score of {inf['combined_score']:.3f}"
                )
        
        # Keyword insights
        if metrics:
            insights.append(
                f"The most common disaster keyword is '{metrics['top_keyword']}'"
            )
            insights.append(
                f"Network contains {metrics['num_communities']} distinct information communities"
            )
        
        return {
            'summary': analysis_state.summary,
            'insights': insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving summary: {str(e)}")

@router.get("/geo-insights")
async def get_geo_insights():
    """Return geospatial hotspot insights"""
    if analysis_state.geo_data is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    return analysis_state.geo_data

@router.get("/text-insights")
async def get_text_insights():
    """Return topic modeling and sentiment results"""
    if analysis_state.text_insights is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    return analysis_state.text_insights

@router.get("/alerts")
async def get_alerts():
    """Return alert scoring results"""
    if analysis_state.alerts is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    return analysis_state.alerts

@router.get("/timeline")
async def get_timeline():
    """Return temporal trend data"""
    if analysis_state.timeline is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    return analysis_state.timeline

@router.post("/live/start")
async def start_live_stream():
    """Start Reddit-based live monitoring"""
    if analysis_state.reddit_stream is None:
        analysis_state.reddit_stream = RedditStreamService()

    service = analysis_state.reddit_stream

    if not service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Reddit credentials missing. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT.",
        )

    if analysis_state.live_running:
        return {"message": "Live stream already running"}

    await service.start(handle_live_event)
    analysis_state.live_running = True
    return {"message": "Live monitoring activated"}


@router.post("/live/stop")
async def stop_live_stream():
    """Stop live monitoring"""
    if analysis_state.reddit_stream:
        await analysis_state.reddit_stream.stop()
    analysis_state.live_running = False
    return {"message": "Live monitoring stopped"}


@router.get("/live/status")
async def live_status():
    """Get live monitoring status"""
    service = analysis_state.reddit_stream
    configured = service.is_configured() if service else False
    return {
        "running": analysis_state.live_running,
        "configured": configured,
        "total_events": len(analysis_state.live_events),
        "summary": analysis_state.live_summary,
    }


@router.websocket("/ws/live")
async def live_updates_ws(websocket: WebSocket):
    """WebSocket endpoint for live updates"""
    if analysis_state.live_manager is None:
        analysis_state.live_manager = LiveUpdateManager()

    await analysis_state.live_manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "type": "bootstrap",
                "events": analysis_state.live_events,
                "summary": analysis_state.live_summary,
                "running": analysis_state.live_running,
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await analysis_state.live_manager.disconnect(websocket)

@router.get("/metrics")
async def get_metrics():
    """Get all computed metrics"""
    if analysis_state.metrics is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    
    return {
        'metrics': analysis_state.metrics,
        'top_influencers': analysis_state.top_influencers
    }

@router.get("/download")
async def download_results(format: str = "csv"):
    """Download analysis results as CSV or JSON"""
    if analysis_state.metrics is None:
        raise HTTPException(status_code=400, detail="No analysis performed. Please run /analyze first.")
    
    try:
        if format == "csv":
            # Create results DataFrame
            results_data = []
            if analysis_state.top_influencers:
                for inf in analysis_state.top_influencers:
                    results_data.append({
                        'tweet_id': inf['id'],
                        'combined_score': inf['combined_score'],
                        'degree_centrality': inf['degree_centrality'],
                        'betweenness_centrality': inf['betweenness_centrality'],
                        'eigenvector_centrality': inf['eigenvector_centrality'],
                        'clustering_coefficient': inf['clustering_coefficient'],
                        'community': inf['community'],
                        'keyword': inf['keyword'],
                        'location': inf['location'],
                        'target': inf['target']
                    })
            
            df_results = pd.DataFrame(results_data)
            output_path = "results.csv"
            df_results.to_csv(output_path, index=False)
            
            return FileResponse(
                output_path,
                media_type='text/csv',
                filename="crisisnet_results.csv"
            )
        else:
            # Return JSON
            return JSONResponse({
                'metrics': analysis_state.metrics,
                'top_influencers': analysis_state.top_influencers,
                'summary': analysis_state.summary
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating download: {str(e)}")

def generate_summary(metrics: Dict, top_influencers: List[Dict], 
                    communities: Dict, df: pd.DataFrame) -> str:
    """Generate natural language summary"""
    summary_parts = []
    
    summary_parts.append(
        f"CrisisNet analyzed {metrics['total_tweets']} tweets, identifying "
        f"{metrics['disaster_tweets']} disaster-related and "
        f"{metrics['non_disaster_tweets']} non-disaster tweets."
    )
    
    summary_parts.append(
        f"The social network contains {metrics['num_communities']} distinct information "
        f"communities with an average degree of {metrics['average_degree']:.2f} and "
        f"graph density of {metrics['graph_density']:.4f}."
    )

    summary_parts.append(
        f"Information typically travels {metrics.get('average_path_length', 0):.2f} hops "
        f"with a network diameter of {int(metrics.get('diameter', 0))} and "
        f"average clustering coefficient of {metrics.get('average_clustering', 0):.2f}."
    )
    
    if top_influencers:
        top = top_influencers[0]
        summary_parts.append(
            f"Tweet {top['id']} emerged as the most influential node with a combined "
            f"centrality score of {top['combined_score']:.3f}, belonging to community {top['community']}."
        )
    
    summary_parts.append(
        f"The most frequently discussed keyword is '{metrics['top_keyword']}', indicating "
        f"the primary focus of crisis communication in this dataset."
    )
    
    return " ".join(summary_parts)

