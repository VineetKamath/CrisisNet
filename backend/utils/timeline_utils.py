from typing import Dict, List
import pandas as pd


def _select_timestamp_column(df: pd.DataFrame) -> str:
    for candidate in ["timestamp", "created_at", "time", "date"]:
        if candidate in df.columns:
            return candidate
    return ""


def build_time_series(df: pd.DataFrame, freq: str = "D") -> Dict:
    """Build temporal aggregates for disaster vs non-disaster tweets."""
    if df is None or df.empty:
        return {"timeline": [], "has_real_timestamp": False, "frequency": freq}

    timestamp_col = _select_timestamp_column(df)
    has_real_timestamp = bool(timestamp_col)

    if has_real_timestamp:
        timestamps = pd.to_datetime(df[timestamp_col], errors="coerce")
    else:
        timestamps = pd.date_range(end=pd.Timestamp.now(), periods=len(df))

    timeline_df = df.copy()
    timeline_df["_timeline"] = timestamps
    timeline_df = timeline_df.dropna(subset=["_timeline"])

    if timeline_df.empty:
        return {"timeline": [], "has_real_timestamp": False, "frequency": freq}

    timeline_df = timeline_df.sort_values("_timeline")
    timeline_df.set_index("_timeline", inplace=True)

    aggregated = timeline_df.resample(freq).agg(
        total_tweets=("target", "count"),
        disaster_tweets=("target", "sum"),
    )
    aggregated["non_disaster_tweets"] = aggregated["total_tweets"] - aggregated["disaster_tweets"]
    aggregated = aggregated.reset_index()

    timeline_points: List[Dict] = []
    for _, row in aggregated.iterrows():
        timeline_points.append(
            {
                "timestamp": row["_timeline"].isoformat(),
                "total": int(row["total_tweets"]),
                "disaster": int(row["disaster_tweets"]),
                "non_disaster": int(row["non_disaster_tweets"]),
            }
        )

    return {
        "timeline": timeline_points,
        "has_real_timestamp": has_real_timestamp,
        "frequency": freq,
    }


