from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd
import requests

from .geo_utils import geocode_location


OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"


def _classify_severity_from_weathercode(code: int, precipitation: float, wind_gust: float) -> str:
    """
    Map Open-Meteo weather code + intensity to a severity level.

    This uses real forecast data (weathercode, precipitation, wind gusts) and
    classifies conditions into normal / elevated / high / critical.
    """
    # Thunderstorm / severe convective weather
    if code in {95, 96, 99}:
        return "critical"

    # Heavy precipitation / storms
    if code in {82, 85, 86}:
        return "high"

    # Strong wind gusts
    if wind_gust >= 20:  # m/s (~72 km/h)
        return "high"
    if wind_gust >= 15:
        return "elevated"

    # Moderate to heavy precipitation
    if precipitation >= 20:  # mm in 1h
        return "high"
    if precipitation >= 5:
        return "elevated"

    # Remaining weather codes – treat 60+ as elevated (rain/snow)
    if code >= 60:
        return "elevated"

    return "normal"


def _event_name_from_weathercode(code: int) -> str:
    """Human-readable event name from Open-Meteo weather code."""
    mapping = {
        0: "Clear Weather",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Fog Alert",
        48: "Rime Fog Alert",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        61: "Light Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        66: "Light Freezing Rain",
        67: "Heavy Freezing Rain",
        71: "Slight Snowfall",
        73: "Moderate Snowfall",
        75: "Heavy Snowfall",
        77: "Snow Grains",
        80: "Slight Rain Showers",
        81: "Moderate Rain Showers",
        82: "Violent Rain Showers",
        85: "Slight Snow Showers",
        86: "Heavy Snow Showers",
        95: "Thunderstorm",
        96: "Thunderstorm with Hail",
        99: "Severe Thunderstorm with Hail",
    }
    return mapping.get(code, "Weather Alert")


def _fetch_openmeteo_alert_for_coord(lat: float, lon: float, location_name: str) -> Optional[Dict]:
    """
    Call Open-Meteo forecast API for a coordinate and derive a hazard-style alert.

    We look at the next 24 hours of hourly forecast, detect hazardous conditions,
    and if found, create a single summarized alert for that location.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "weathercode,precipitation,windgusts_10m",
        "forecast_days": 1,
        "timezone": "UTC",
    }

    try:
        resp = requests.get(OPEN_METEO_BASE_URL, params=params, timeout=8)
    except Exception as exc:
        print(f"Open-Meteo request failed for {lat},{lon}: {exc}")
        return None

    if resp.status_code != 200:
        print(f"Open-Meteo API error {resp.status_code}: {resp.text}")
        return None

    data = resp.json()
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    codes = hourly.get("weathercode") or []
    precips = hourly.get("precipitation") or []
    gusts = hourly.get("windgusts_10m") or []

    if not times or not codes:
        return None

    # Find the most severe condition in the next 24 hours
    best_idx = None
    best_severity_rank = -1
    severity_order = {"normal": 0, "elevated": 1, "high": 2, "critical": 3}

    for i in range(min(len(times), len(codes))):
        code = int(codes[i])
        precip = float(precips[i]) if i < len(precips) and precips[i] is not None else 0.0
        gust = float(gusts[i]) if i < len(gusts) and gusts[i] is not None else 0.0

        severity = _classify_severity_from_weathercode(code, precip, gust)
        rank = severity_order.get(severity, 0)
        if rank > best_severity_rank:
            best_severity_rank = rank
            best_idx = i

    if best_idx is None or best_severity_rank <= 0:
        # No elevated / high / critical conditions – skip alert
        return None

    code = int(codes[best_idx])
    precip = float(precips[best_idx]) if best_idx < len(precips) and precips[best_idx] is not None else 0.0
    gust = float(gusts[best_idx]) if best_idx < len(gusts) and gusts[best_idx] is not None else 0.0
    severity = _classify_severity_from_weathercode(code, precip, gust)
    event_name = _event_name_from_weathercode(code)
    start_time = times[best_idx]

    # Use a simple 6-hour window starting at the hazardous hour
    # We keep times as ISO strings from Open-Meteo
    description_parts = [
        f"Forecasted {event_name.lower()} for {location_name} based on Open-Meteo data.",
    ]
    if precip > 0:
        description_parts.append(f"Precipitation intensity around {precip:.1f} mm/h.")
    if gust > 0:
        description_parts.append(f"Wind gusts up to {gust:.1f} m/s.")

    description = " ".join(description_parts)

    return {
        "source": "open-meteo",
        "provider": "Open-Meteo Forecast Service",
        "event": event_name,
        "description": description,
        "severity": severity,
        "start_time": start_time,
        "end_time": None,
        "lat": float(lat),
        "lon": float(lon),
        "location_name": location_name,
    }


def compute_gov_alerts(df: Optional[pd.DataFrame]) -> Dict:
    """
    Phase 1: Fetch real weather / hazard signals using a free Open-Meteo API.

    Real integration plan:
    - Use locations from the dataset (tweet locations / hotspots)
    - Geocode them to lat/lon (using existing geo_utils)
    - Call Open-Meteo forecast API (no API key required)
    - Derive hazard-style alerts from weather codes, precipitation and wind gusts
    - Normalize everything to the common alert format used by the frontend
    """
    if df is None or df.empty:
        return {
            "alerts": [],
            "summary": {},
            "enabled": True,
            "source": "open-meteo",
        }

    if "location" not in df.columns:
        return {
            "alerts": [],
            "summary": {"total_alerts": 0, "affected_locations": 0},
            "enabled": True,
            "source": "open-meteo",
        }

    alerts: List[Dict] = []

    # Limit number of distinct locations to avoid excessive API calls
    locations = (
        df["location"]
        .dropna()
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
        .dropna()
        .unique()
        .tolist()
    )
    locations = locations[:15]

    seen_coords = set()

    for loc in locations:
        coords = geocode_location(loc)
        if not coords:
            continue

        key = (round(coords["lat"], 3), round(coords["lon"], 3))
        if key in seen_coords:
            continue
        seen_coords.add(key)

        alert = _fetch_openmeteo_alert_for_coord(coords["lat"], coords["lon"], loc)
        if alert:
            alerts.append(alert)

    if not alerts:
        return {
            "alerts": [],
            "summary": {
                "total_alerts": 0,
                "affected_locations": 0,
            },
            "enabled": True,
            "source": "open-meteo",
        }

    affected_locations = len({a["location_name"] for a in alerts if a.get("location_name")})

    summary = {
        "total_alerts": len(alerts),
        "affected_locations": affected_locations,
    }

    return {
        "alerts": alerts,
        "summary": summary,
        "enabled": True,
        "source": "open-meteo",
    }


