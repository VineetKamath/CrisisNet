from typing import Dict, Optional, List
import pandas as pd

try:
    from geopy.geocoders import Nominatim
except Exception:  # pragma: no cover - geopy optional at runtime
    Nominatim = None

DEFAULT_COORDS = {
    "new york": (40.7128, -74.0060),
    "london": (51.5074, -0.1278),
    "california": (36.7783, -119.4179),
    "texas": (31.9686, -99.9018),
    "japan": (36.2048, 138.2529),
    "tokyo": (35.6762, 139.6503),
}

GEOCODE_CACHE: Dict[str, Dict[str, float]] = {}

_geolocator = Nominatim(user_agent="crisisnet_geocoder") if Nominatim else None


def geocode_location(location: str) -> Optional[Dict[str, float]]:
    """Geocode a textual location to latitude/longitude."""
    if not location or not isinstance(location, str):
        return None

    key = location.strip().lower()
    if not key:
        return None

    if key in GEOCODE_CACHE:
        return GEOCODE_CACHE[key]

    if key in DEFAULT_COORDS:
        lat, lon = DEFAULT_COORDS[key]
        GEOCODE_CACHE[key] = {"lat": lat, "lon": lon}
        return GEOCODE_CACHE[key]

    if _geolocator:
        try:
            result = _geolocator.geocode(location, timeout=5)
            if result:
                coords = {"lat": float(result.latitude), "lon": float(result.longitude)}
                GEOCODE_CACHE[key] = coords
                return coords
        except Exception:
            pass

    return None


def compute_geo_insights(
    df: pd.DataFrame,
    sentiment_map: Optional[Dict[str, Dict]] = None,
) -> Dict:
    """Aggregate geographic insights per location."""
    if df is None or "location" not in df.columns:
        return {"locations": [], "summary": {}}

    locations_data: List[Dict] = []

    for location, group in df.groupby("location"):
        if pd.isna(location):
            continue

        coords = geocode_location(str(location))
        if not coords:
            continue

        total = len(group)
        disaster = int(group["target"].sum()) if "target" in group.columns else 0
        non_disaster = total - disaster

        keywords = (
            group["keyword"]
            .dropna()
            .astype(str)
            .value_counts()
            .head(3)
            .index.tolist()
        )

        avg_sentiment = None
        if sentiment_map:
            sentiment_values = [
                sentiment_map.get(str(row_id), {}).get("compound")
                for row_id in group["id"].astype(str)
                if sentiment_map.get(str(row_id)) is not None
            ]
            if sentiment_values:
                avg_sentiment = sum(sentiment_values) / len(sentiment_values)

        locations_data.append(
            {
                "location": str(location),
                "lat": coords["lat"],
                "lon": coords["lon"],
                "total_tweets": int(total),
                "disaster_tweets": int(disaster),
                "non_disaster_tweets": int(non_disaster),
                "top_keywords": keywords,
                "average_sentiment": float(avg_sentiment) if avg_sentiment is not None else None,
                "disaster_ratio": float(disaster / total) if total else 0,
            }
        )

    if not locations_data:
        return {"locations": [], "summary": {}}

    # Determine summary hotspots
    highest_volume = max(locations_data, key=lambda x: x["total_tweets"])
    highest_risk = max(locations_data, key=lambda x: x["disaster_ratio"])

    summary = {
        "total_geocoded_locations": len(locations_data),
        "highest_activity_location": {
            "location": highest_volume["location"],
            "total_tweets": highest_volume["total_tweets"],
        },
        "highest_risk_location": {
            "location": highest_risk["location"],
            "disaster_ratio": highest_risk["disaster_ratio"],
        },
    }

    locations_data.sort(key=lambda x: x["total_tweets"], reverse=True)

    return {"locations": locations_data, "summary": summary}


