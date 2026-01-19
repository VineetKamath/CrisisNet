from typing import Dict, Optional, List
import os
import pandas as pd
import hashlib

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
    "delhi": (28.6139, 77.2090),
    "mumbai": (19.0760, 72.8777),
    "bangalore": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "kerala": (10.8505, 76.2711),
    "punjab": (31.1471, 75.3412),
    "gujarat": (22.2587, 71.1924),
    "maharashtra": (19.7515, 75.7139),
    "telangana": (17.1232, 79.2088),
    "sydney": (-33.8688, 151.2093),
    "melbourne": (-37.8136, 144.9631),
    "queensland": (-20.9176, 142.7028),
    "singapore": (1.3521, 103.8198),
    "dubai": (25.2048, 55.2708),
    "riyadh": (24.7136, 46.6753),
    "doha": (25.2854, 51.5310),
    "abu dhabi": (24.4539, 54.3773),
    "istanbul": (41.0082, 28.9784),
    "paris": (48.8566, 2.3522),
    "madrid": (40.4168, -3.7038),
    "rome": (41.9028, 12.4964),
    "berlin": (52.5200, 13.4050),
    "moscow": (55.7558, 37.6173),
    "toronto": (43.6532, -79.3832),
    "vancouver": (49.2827, -123.1207),
    "montreal": (45.5017, -73.5673),
    "mexico city": (19.4326, -99.1332),
    "sao paulo": (-23.5558, -46.6396),
    "buenos aires": (-34.6037, -58.3816),
    "lagos": (6.5244, 3.3792),
    "nairobi": (-1.2921, 36.8219),
    "cape town": (-33.9249, 18.4241),
    "cairo": (30.0444, 31.2357),
    "manila": (14.5995, 120.9842),
    "jakarta": (-6.2088, 106.8456),
    "bangkok": (13.7563, 100.5018),
    "seoul": (37.5665, 126.9780),
    "beijing": (39.9042, 116.4074),
    "shanghai": (31.2304, 121.4737),
    "hong kong": (22.3193, 114.1694),
    "los angeles": (34.0522, -118.2437),
    "san francisco": (37.7749, -122.4194),
    "chicago": (41.8781, -87.6298),
    "miami": (25.7617, -80.1918),
    "washington": (38.9072, -77.0369),
    "boston": (42.3601, -71.0589),
    "usa": (37.0902, -95.7129),
    "united states": (37.0902, -95.7129),
    "america": (37.0902, -95.7129),
    "india": (20.5937, 78.9629),
    "china": (35.8617, 104.1954),
    "australia": (-25.2744, 133.7751),
    "canada": (56.1304, -106.3468),
    "brazil": (-14.2350, -51.9253),
    "argentina": (-38.4161, -63.6167),
    "south africa": (-30.5595, 22.9375),
    "uae": (23.4241, 53.8478),
    "united arab emirates": (23.4241, 53.8478),
    "qatar": (25.3548, 51.1839),
    "saudi arabia": (23.8859, 45.0792),
    "germany": (51.1657, 10.4515),
    "france": (46.2276, 2.2137),
    "italy": (41.8719, 12.5674),
    "spain": (40.4637, -3.7492),
    "turkey": (38.9637, 35.2433),
    "russia": (61.5240, 105.3188),
    "mexico": (23.6345, -102.5528),
    "indonesia": (-0.7893, 113.9213),
    "philippines": (12.8797, 121.7740),
    "thailand": (15.8700, 100.9925),
    "pakistan": (30.3753, 69.3451),
    "bangladesh": (23.6850, 90.3563),
    "sri lanka": (7.8731, 80.7718),
    "nepal": (28.3949, 84.1240),
    "bhutan": (27.5142, 90.4336)
}

GEOCODE_CACHE: Dict[str, Dict[str, float]] = {}

ENABLE_REMOTE_GEOCODER = os.getenv("ENABLE_REMOTE_GEOCODER", "true").lower() == "true"
MAX_REMOTE_LOOKUPS = int(os.getenv("MAX_REMOTE_GEOCODER_LOOKUPS", "75"))
REMOTE_LOOKUP_COUNT = 0
_geolocator = Nominatim(user_agent="crisisnet_geocoder") if (Nominatim and ENABLE_REMOTE_GEOCODER) else None


def geocode_location(location: str) -> Optional[Dict[str, float]]:
    """Geocode a textual location to latitude/longitude."""
    if not location or not isinstance(location, str):
        return None

    global REMOTE_LOOKUP_COUNT
    key = location.strip().lower()
    if not key:
        return None

    if key in GEOCODE_CACHE:
        return GEOCODE_CACHE[key]

    if key in DEFAULT_COORDS:
        lat, lon = DEFAULT_COORDS[key]
        GEOCODE_CACHE[key] = {"lat": lat, "lon": lon}
        return GEOCODE_CACHE[key]

    if _geolocator and REMOTE_LOOKUP_COUNT < MAX_REMOTE_LOOKUPS:
        try:
            result = _geolocator.geocode(location, timeout=5)
            if result:
                coords = {"lat": float(result.latitude), "lon": float(result.longitude)}
                GEOCODE_CACHE[key] = coords
                REMOTE_LOOKUP_COUNT += 1
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


