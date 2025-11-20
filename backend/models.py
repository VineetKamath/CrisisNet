from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
import pandas as pd

class AnalysisState:
    """Global state to store analysis results"""
    def __init__(self):
        self.df: Optional[pd.DataFrame] = None
        self.graph_data: Optional[Dict] = None
        self.metrics: Optional[Dict] = None
        self.summary: Optional[str] = None
        self.top_influencers: Optional[List[Dict]] = None
        self.communities: Optional[Dict] = None
        self.geo_data: Optional[Dict] = None
        self.text_insights: Optional[Dict] = None
        self.alerts: Optional[Dict] = None
        self.timeline: Optional[Dict] = None
        self.live_events: List[Dict] = []
        self.live_summary: Optional[Dict] = None
        self.live_running: bool = False
        self.live_manager = None
        self.reddit_stream = None
        
    def reset(self, clear_df: bool = False):
        """Reset analysis outputs. Set clear_df=True to drop the uploaded data."""
        if clear_df:
            self.df = None
        self.graph_data = None
        self.metrics = None
        self.summary = None
        self.top_influencers = None
        self.communities = None
        self.geo_data = None
        self.text_insights = None
        self.alerts = None
        self.timeline = None
        self.live_events = []
        self.live_summary = None
        self.live_running = False

class GraphNode(BaseModel):
    id: str
    label: str
    keyword: Optional[str] = None
    location: Optional[str] = None
    target: Optional[int] = None
    community: Optional[int] = None
    degree_centrality: Optional[float] = None
    betweenness_centrality: Optional[float] = None
    eigenvector_centrality: Optional[float] = None
    clustering_coefficient: Optional[float] = None

class GraphEdge(BaseModel):
    source: str
    target: str
    weight: float
    type: str  # "similarity" or "shared"

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class MetricsResponse(BaseModel):
    total_tweets: int
    disaster_tweets: int
    non_disaster_tweets: int
    num_communities: int
    average_degree: float
    graph_density: float
    top_keyword: str
    top_influencers: List[Dict[str, Any]]

class SummaryResponse(BaseModel):
    summary: str
    insights: List[str]

