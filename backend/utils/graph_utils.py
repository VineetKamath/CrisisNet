import pandas as pd
import numpy as np
import networkx as nx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import community.community_louvain as community_louvain
import re
from typing import Dict, List, Tuple, Optional

def preprocess_text(text: str) -> str:
    """Preprocess tweet text"""
    if pd.isna(text):
        return ""
    
    text = str(text).lower()
    # Remove URLs
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    # Remove special characters but keep spaces
    text = re.sub(r'[^a-z0-9\s]', '', text)
    # Remove extra whitespace
    text = ' '.join(text.split())
    return text

def build_tfidf_embeddings(df: pd.DataFrame) -> Tuple[np.ndarray, TfidfVectorizer]:
    """Build TF-IDF embeddings for tweets"""
    # Preprocess all texts
    processed_texts = df['text'].apply(preprocess_text).tolist()
    
    # Create TF-IDF vectorizer
    vectorizer = TfidfVectorizer(
        max_features=500,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=2
    )
    
    # Fit and transform
    tfidf_matrix = vectorizer.fit_transform(processed_texts)
    return tfidf_matrix, vectorizer

def compute_similarity_matrix(tfidf_matrix: np.ndarray, threshold: float = 0.3) -> np.ndarray:
    """Compute cosine similarity matrix and apply threshold"""
    similarity_matrix = cosine_similarity(tfidf_matrix)
    # Set diagonal to 0 (self-similarity)
    np.fill_diagonal(similarity_matrix, 0)
    # Apply threshold
    similarity_matrix[similarity_matrix < threshold] = 0
    return similarity_matrix

def build_graph(df: pd.DataFrame, similarity_threshold: float = 0.3) -> nx.Graph:
    """
    Build NetworkX graph from tweets
    Nodes: tweets
    Edges: semantic similarity > threshold OR shared keyword/location
    """
    G = nx.Graph()
    
    # Add nodes with attributes
    for idx, row in df.iterrows():
        node_id = str(row['id'])
        G.add_node(node_id, 
                  keyword=str(row['keyword']) if pd.notna(row['keyword']) else "",
                  location=str(row['location']) if pd.notna(row['location']) else "",
                  target=int(row['target']) if pd.notna(row['target']) else 0,
                  text=str(row['text'])[:100] if pd.notna(row['text']) else "")  # First 100 chars
    
    # Build TF-IDF embeddings
    print("Building TF-IDF embeddings...")
    tfidf_matrix, _ = build_tfidf_embeddings(df)
    
    # Compute similarity matrix
    print("Computing similarity matrix...")
    similarity_matrix = compute_similarity_matrix(tfidf_matrix, similarity_threshold)
    
    # Add edges based on semantic similarity
    print("Adding similarity edges...")
    n = len(df)
    for i in range(n):
        for j in range(i + 1, n):
            if similarity_matrix[i, j] > 0:
                node_i = str(df.iloc[i]['id'])
                node_j = str(df.iloc[j]['id'])
                G.add_edge(node_i, node_j, 
                          weight=float(similarity_matrix[i, j]),
                          type='similarity')
    
    # Add edges based on shared keyword
    print("Adding shared keyword edges...")
    keyword_groups = df.groupby('keyword')
    for keyword, group in keyword_groups:
        if pd.notna(keyword) and len(group) > 1:
            node_ids = group['id'].astype(str).tolist()
            for i, node_i in enumerate(node_ids):
                for node_j in node_ids[i+1:]:
                    if not G.has_edge(node_i, node_j):
                        G.add_edge(node_i, node_j, weight=0.5, type='shared_keyword')
    
    # Add edges based on shared location
    print("Adding shared location edges...")
    location_groups = df.groupby('location')
    for location, group in location_groups:
        if pd.notna(location) and len(group) > 1:
            node_ids = group['id'].astype(str).tolist()
            for i, node_i in enumerate(node_ids):
                for node_j in node_ids[i+1:]:
                    if not G.has_edge(node_i, node_j):
                        G.add_edge(node_i, node_j, weight=0.3, type='shared_location')
    
    print(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G

def compute_centrality_metrics(G: nx.Graph) -> Dict[str, Dict[str, float]]:
    """Compute all centrality metrics"""
    print("Computing centrality metrics...")
    
    metrics = {
        'degree': nx.degree_centrality(G),
        'betweenness': nx.betweenness_centrality(G, k=min(100, len(G.nodes()))),
        'eigenvector': nx.eigenvector_centrality(G, max_iter=1000, tol=1e-6) if len(G.nodes()) > 0 else {},
        'clustering': nx.clustering(G)
    }
    
    return metrics

def detect_communities(G: nx.Graph) -> Dict[str, int]:
    """Detect communities using Louvain method"""
    print("Detecting communities...")
    if len(G.nodes()) == 0:
        return {}
    
    partition = community_louvain.best_partition(G)
    return partition

def get_top_influencers(G: nx.Graph, metrics: Dict[str, Dict[str, float]], 
                       communities: Dict[str, int], df: pd.DataFrame, top_n: int = 10) -> List[Dict]:
    """Get top influencers based on combined centrality scores"""
    influencers = []
    
    for node_id in G.nodes():
        degree = metrics['degree'].get(node_id, 0)
        betweenness = metrics['betweenness'].get(node_id, 0)
        eigenvector = metrics['eigenvector'].get(node_id, 0)
        
        # Combined score (weighted average)
        combined_score = (degree * 0.4 + betweenness * 0.3 + eigenvector * 0.3)
        
        # Get tweet info
        tweet_row = df[df['id'].astype(str) == node_id]
        if not tweet_row.empty:
            influencers.append({
                'id': node_id,
                'combined_score': float(combined_score),
                'degree_centrality': float(degree),
                'betweenness_centrality': float(betweenness),
                'eigenvector_centrality': float(eigenvector),
                'clustering_coefficient': float(metrics['clustering'].get(node_id, 0)),
                'community': int(communities.get(node_id, -1)),
                'keyword': str(tweet_row.iloc[0]['keyword']) if pd.notna(tweet_row.iloc[0]['keyword']) else "",
                'location': str(tweet_row.iloc[0]['location']) if pd.notna(tweet_row.iloc[0]['location']) else "",
                'text': str(tweet_row.iloc[0]['text'])[:150] if pd.notna(tweet_row.iloc[0]['text']) else "",
                'target': int(tweet_row.iloc[0]['target']) if pd.notna(tweet_row.iloc[0]['target']) else 0
            })
    
    # Sort by combined score and return top N
    influencers.sort(key=lambda x: x['combined_score'], reverse=True)
    return influencers[:top_n]

def compute_graph_metrics(G: nx.Graph) -> Dict:
    """Compute overall graph metrics"""
    if len(G.nodes()) == 0:
        return {
            'average_degree': 0,
            'density': 0,
            'num_components': 0,
            'average_path_length': 0,
            'diameter': 0,
            'radius': 0,
            'average_clustering': 0
        }
    
    degrees = [G.degree(n) for n in G.nodes()]
    avg_degree = sum(degrees) / len(degrees) if len(degrees) > 0 else 0
    
    metrics = {
        'average_degree': float(avg_degree),
        'density': float(nx.density(G)),
        'num_components': nx.number_connected_components(G),
        'average_clustering': float(nx.average_clustering(G))
    }
    
    # Compute path-related metrics for largest connected component
    if nx.is_connected(G):
        metrics['average_path_length'] = float(nx.average_shortest_path_length(G))
        metrics['diameter'] = nx.diameter(G)
        metrics['radius'] = nx.radius(G)
    else:
        # Compute for largest connected component
        largest_cc = max(nx.connected_components(G), key=len)
        if len(largest_cc) > 1:
            subgraph = G.subgraph(largest_cc)
            metrics['average_path_length'] = float(nx.average_shortest_path_length(subgraph))
            metrics['diameter'] = nx.diameter(subgraph)
            metrics['radius'] = nx.radius(subgraph)
        else:
            metrics['average_path_length'] = 0
            metrics['diameter'] = 0
            metrics['radius'] = 0
    
    return metrics

def compute_path_lengths(G: nx.Graph, node_id: str) -> Dict[str, int]:
    """Compute shortest path lengths from a node to all other nodes"""
    if node_id not in G:
        return {}
    
    try:
        lengths = nx.single_source_shortest_path_length(G, node_id)
        return {str(k): int(v) for k, v in lengths.items()}
    except:
        return {}

def compute_edge_path_info(G: nx.Graph) -> Dict[str, Dict]:
    """Compute path information for edges (shortest path length between nodes)"""
    edge_info = {}
    
    for source, target in G.edges():
        edge_key = f"{source}-{target}"
        try:
            if nx.has_path(G, source, target):
                path_length = nx.shortest_path_length(G, source, target)
                edge_info[edge_key] = {
                    'path_length': path_length,
                    'is_direct': path_length == 1
                }
        except:
            edge_info[edge_key] = {
                'path_length': 1,
                'is_direct': True
            }
    
    return edge_info

