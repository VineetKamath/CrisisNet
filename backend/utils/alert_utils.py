from typing import Dict, List
import pandas as pd


def _severity_label(score: float) -> str:
    if score >= 0.8:
        return "critical"
    if score >= 0.6:
        return "high"
    if score >= 0.4:
        return "elevated"
    return "normal"


def compute_alert_scores(
    df: pd.DataFrame,
    centrality_metrics: Dict[str, Dict[str, float]],
    sentiment_map: Dict[str, Dict],
    topic_map: Dict[str, Dict],
    communities: Dict[str, int],
) -> Dict:
    """Combine centrality, sentiment, and topic confidence into alert scores."""
    if df is None or df.empty:
        return {"alerts": [], "summary": {}}

    alerts: List[Dict] = []

    for _, row in df.iterrows():
        node_id = str(row["id"])
        degree = centrality_metrics["degree"].get(node_id, 0)
        betweenness = centrality_metrics["betweenness"].get(node_id, 0)
        eigen = centrality_metrics["eigenvector"].get(node_id, 0)
        clustering = centrality_metrics["clustering"].get(node_id, 0)

        centrality_score = 0.45 * degree + 0.35 * betweenness + 0.2 * eigen

        sentiment_info = sentiment_map.get(node_id, {"compound": 0, "label": "neutral"})
        compound = sentiment_info.get("compound", 0)
        sentiment_risk = 1 - ((compound + 1) / 2)
        if row.get("target", 0) == 1:
            sentiment_risk *= 1.1

        topic_info = topic_map.get(node_id, {})
        topic_confidence = topic_info.get("confidence", 0)

        raw_score = (
            0.5 * centrality_score
            + 0.3 * sentiment_risk
            + 0.2 * topic_confidence
        )
        alert_score = max(0.0, min(1.0, raw_score))

        alerts.append(
            {
                "id": node_id,
                "text": str(row["text"])[:200] if pd.notna(row["text"]) else "",
                "keyword": str(row["keyword"]) if pd.notna(row["keyword"]) else "",
                "location": str(row["location"]) if pd.notna(row["location"]) else "",
                "target": int(row["target"]) if pd.notna(row["target"]) else 0,
                "community": int(communities.get(node_id, -1)),
                "alert_score": alert_score,
                "centrality_score": centrality_score,
                "sentiment_risk": sentiment_risk,
                "topic_confidence": topic_confidence,
                "sentiment_label": sentiment_info.get("label", "neutral"),
                "severity": _severity_label(alert_score),
            }
        )

    alerts.sort(key=lambda x: x["alert_score"], reverse=True)

    summary = {
        "average_alert_score": float(
            sum(alert["alert_score"] for alert in alerts) / len(alerts)
        ) if alerts else 0,
        "critical_alerts": len([a for a in alerts if a["alert_score"] >= 0.8]),
        "high_alerts": len([a for a in alerts if 0.6 <= a["alert_score"] < 0.8]),
        "elevated_alerts": len([a for a in alerts if 0.4 <= a["alert_score"] < 0.6]),
    }

    return {"alerts": alerts[:25], "summary": summary}


