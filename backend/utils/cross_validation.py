"""
Phase 2: Cross-Validation & Credibility

For each cluster of tweets, check if there is a matching official alert in the same
time window and geographic region. Boost credibility scores for tweets and influencers
that align with official data, and flag those that contradict it for manual review.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd
from math import radians, cos, sin, asin, sqrt

from .geo_utils import geocode_location


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on Earth (in km)."""
    R = 6371  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return R * c


def _parse_time(iso_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO time string to datetime object."""
    if not iso_str:
        return None
    try:
        if 'T' in iso_str:
            return datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return datetime.fromisoformat(iso_str)
    except Exception:
        return None


def _time_overlap(
    start1: Optional[datetime],
    end1: Optional[datetime],
    start2: Optional[datetime],
    end2: Optional[datetime],
    window_hours: int = 24
) -> bool:
    """
    Check if two time windows overlap (within a tolerance window).
    
    If times are None, we assume they're "current" and check if they're within
    the window_hours tolerance.
    """
    now = datetime.now(timezone.utc)
    
    # Normalize None times to "now"
    if start1 is None:
        start1 = now
    if end1 is None:
        end1 = now
    if start2 is None:
        start2 = now
    if end2 is None:
        end2 = now
    
    # Check if windows overlap or are within tolerance
    window_delta = timedelta(hours=window_hours)
    
    # Check if any part of the windows overlap
    if start1 <= end2 and start2 <= end1:
        return True
    
    # Check if they're within the tolerance window
    if abs((start1 - start2).total_seconds()) <= window_delta.total_seconds():
        return True
    
    return False


def _match_alert_to_cluster(
    cluster_location: str,
    cluster_keywords: List[str],
    gov_alerts: List[Dict],
    max_distance_km: float = 50.0
) -> Optional[Dict]:
    """
    Find the best matching government alert for a tweet cluster.
    
    Returns the matching alert if found, None otherwise.
    """
    cluster_coords = geocode_location(cluster_location)
    if not cluster_coords:
        return None
    
    best_match = None
    best_score = 0.0
    
    for alert in gov_alerts:
        alert_lat = alert.get("lat")
        alert_lon = alert.get("lon")
        if alert_lat is None or alert_lon is None:
            continue
        
        # Geographic distance
        distance = _haversine_distance(
            cluster_coords["lat"],
            cluster_coords["lon"],
            alert_lat,
            alert_lon
        )
        
        if distance > max_distance_km:
            continue
        
        # Keyword matching (check if alert event matches cluster keywords)
        alert_event = str(alert.get("event", "")).lower()
        keyword_match = any(
            kw.lower() in alert_event or alert_event in kw.lower()
            for kw in cluster_keywords
        )
        
        # Calculate match score (distance + keyword match)
        distance_score = max(0, 1.0 - (distance / max_distance_km))
        keyword_score = 1.0 if keyword_match else 0.5
        match_score = 0.6 * distance_score + 0.4 * keyword_score
        
        if match_score > best_score:
            best_score = match_score
            best_match = alert
    
    return best_match if best_score >= 0.3 else None


def compute_cross_validation(
    df: pd.DataFrame,
    communities: Dict[str, int],
    gov_alerts: Optional[Dict],
    alerts: Optional[List[Dict]]
) -> Dict:
    """
    Phase 2: Cross-validate tweet clusters with government alerts.
    
    For each community/cluster:
    1. Find matching government alert (by location + time)
    2. Calculate alignment score
    3. Adjust credibility/alert scores based on alignment
    4. Flag contradictions for manual review
    """
    if df is None or df.empty or not communities:
        return {
            "cross_validation": {},
            "adjusted_alerts": alerts.get("alerts", []) if alerts else [],
            "summary": {
                "aligned_clusters": 0,
                "contradicted_clusters": 0,
                "no_match_clusters": 0,
            }
        }
    
    gov_alert_list = gov_alerts.get("alerts", []) if gov_alerts else []
    if not gov_alert_list:
        return {
            "cross_validation": {},
            "adjusted_alerts": alerts.get("alerts", []) if alerts else [],
            "summary": {
                "aligned_clusters": 0,
                "contradicted_clusters": 0,
                "no_match_clusters": len(set(communities.values())),
            }
        }
    
    # Group tweets by community
    community_data = {}
    for node_id, comm_id in communities.items():
        if comm_id not in community_data:
            community_data[comm_id] = {
                "tweets": [],
                "locations": set(),
                "keywords": set(),
                "disaster_count": 0,
            }
        
        # Try to match node_id with df["id"] - handle both string and int IDs
        try:
            # Try as int first
            node_id_int = int(node_id)
            row = df[df["id"] == node_id_int]
        except (ValueError, TypeError):
            # If conversion fails, try as string
            row = df[df["id"].astype(str) == str(node_id)]
        
        if not row.empty:
            row = row.iloc[0]
            community_data[comm_id]["tweets"].append(node_id)
            if pd.notna(row.get("location")):
                community_data[comm_id]["locations"].add(str(row["location"]))
            if pd.notna(row.get("keyword")):
                community_data[comm_id]["keywords"].add(str(row["keyword"]))
            if row.get("target", 0) == 1:
                community_data[comm_id]["disaster_count"] += 1
    
    # Cross-validate each community
    cross_validation_results = {}
    adjusted_alerts = []
    alert_map = {}
    
    if alerts and isinstance(alerts, dict):
        adjusted_alerts = alerts.get("alerts", []).copy() if alerts.get("alerts") else []
        alert_map = {str(a.get("id", "")): i for i, a in enumerate(adjusted_alerts) if a.get("id") is not None}
    
    aligned_count = 0
    contradicted_count = 0
    no_match_count = 0
    
    for comm_id, comm_info in community_data.items():
        if not comm_info["locations"]:
            no_match_count += 1
            continue
        
        # Use the most common location for matching
        locations_list = list(comm_info["locations"])
        primary_location = locations_list[0] if locations_list else None
        keywords_list = list(comm_info["keywords"])
        
        if not primary_location:
            no_match_count += 1
            continue
        
        # Find matching government alert
        matching_alert = _match_alert_to_cluster(
            primary_location,
            keywords_list,
            gov_alert_list
        )
        
        if not matching_alert:
            no_match_count += 1
            cross_validation_results[comm_id] = {
                "status": "no_match",
                "location": primary_location,
                "matching_alert": None,
                "alignment_score": 0.0,
            }
            continue
        
        # Calculate alignment
        # Alignment is based on:
        # 1. Geographic proximity (already matched)
        # 2. Disaster classification match (cluster has disasters + alert exists)
        # 3. Severity consistency
        
        has_disasters = comm_info["disaster_count"] > 0
        alert_severity = matching_alert.get("severity", "normal")
        severity_rank = {"normal": 0, "elevated": 1, "high": 2, "critical": 3}
        alert_rank = severity_rank.get(alert_severity, 0)
        
        # If cluster has disasters and alert exists, that's alignment
        if has_disasters and alert_rank > 0:
            alignment_score = 0.8 + (alert_rank * 0.05)  # 0.8-0.95
            status = "aligned"
            aligned_count += 1
        elif has_disasters and alert_rank == 0:
            # Cluster says disaster but alert says normal - contradiction
            alignment_score = -0.3
            status = "contradicted"
            contradicted_count += 1
        elif not has_disasters and alert_rank > 0:
            # Cluster says no disaster but alert exists - potential contradiction
            alignment_score = -0.2
            status = "contradicted"
            contradicted_count += 1
        else:
            # Both normal - neutral
            alignment_score = 0.0
            status = "neutral"
            no_match_count += 1
        
        cross_validation_results[comm_id] = {
            "status": status,
            "location": primary_location,
            "matching_alert": {
                "event": matching_alert.get("event"),
                "severity": matching_alert.get("severity"),
                "provider": matching_alert.get("provider"),
            },
            "alignment_score": alignment_score,
            "cluster_disaster_count": comm_info["disaster_count"],
            "cluster_size": len(comm_info["tweets"]),
        }
        
        # Adjust alert scores for tweets in this community
        for tweet_id in comm_info["tweets"]:
            tweet_id_str = str(tweet_id)
            if tweet_id_str in alert_map:
                try:
                    idx = alert_map[tweet_id_str]
                    if idx < len(adjusted_alerts):
                        original_score = adjusted_alerts[idx].get("alert_score", 0.0)
                        
                        # Apply alignment boost/penalty
                        # Boost aligned clusters, penalize contradicted ones
                        if alignment_score > 0:
                            # Boost: add up to 0.15 to score
                            boost = min(0.15, alignment_score * 0.2)
                            adjusted_alerts[idx]["alert_score"] = min(1.0, original_score + boost)
                            adjusted_alerts[idx]["gov_alignment"] = "aligned"
                            adjusted_alerts[idx]["gov_boost"] = boost
                        elif alignment_score < 0:
                            # Penalty: reduce score
                            penalty = abs(alignment_score) * 0.15
                            adjusted_alerts[idx]["alert_score"] = max(0.0, original_score - penalty)
                            adjusted_alerts[idx]["gov_alignment"] = "contradicted"
                            adjusted_alerts[idx]["gov_penalty"] = penalty
                        else:
                            adjusted_alerts[idx]["gov_alignment"] = "neutral"
                except (KeyError, IndexError, TypeError) as e:
                    # Skip if alert not found or error accessing
                    continue
    
    # Re-sort adjusted alerts
    adjusted_alerts.sort(key=lambda x: x["alert_score"], reverse=True)
    
    return {
        "cross_validation": cross_validation_results,
        "adjusted_alerts": adjusted_alerts[:25],  # Top 25
        "summary": {
            "aligned_clusters": aligned_count,
            "contradicted_clusters": contradicted_count,
            "no_match_clusters": no_match_count,
            "total_clusters": len(community_data),
        }
    }

