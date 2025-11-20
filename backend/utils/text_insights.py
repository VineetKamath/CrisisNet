import pandas as pd
from typing import Dict, List, Optional
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation

from .graph_utils import preprocess_text

# Lazy import for sentiment analyzer
_sentiment_analyzer = None

def _get_sentiment_analyzer():
    """Get or create sentiment analyzer instance"""
    global _sentiment_analyzer
    if _sentiment_analyzer is None:
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        except ImportError:
            try:
                from vaderSentiment import SentimentIntensityAnalyzer
            except ImportError:
                raise ImportError(
                    "vaderSentiment package not found. Please install it with: pip install vaderSentiment"
                )
        _sentiment_analyzer = SentimentIntensityAnalyzer()
    return _sentiment_analyzer


def _build_topic_model(processed_texts: List[str], num_topics: int = 4, max_features: int = 500):
    """
    Train an LDA model on processed texts.
    Returns (model, feature_names, topic_matrix) or (None, [], None) if insufficient data.
    """
    if len(processed_texts) < 2:
        return None, [], None

    vectorizer = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        token_pattern=r"(?u)\b\w+\b",
        min_df=1,
    )

    doc_term_matrix = vectorizer.fit_transform(processed_texts)
    if doc_term_matrix.shape[0] < num_topics:
        num_topics = max(2, doc_term_matrix.shape[0])

    if doc_term_matrix.shape[0] == 0 or doc_term_matrix.shape[1] == 0:
        return None, [], None

    lda_model = LatentDirichletAllocation(
        n_components=num_topics,
        random_state=42,
        learning_method="batch",
    )
    topic_matrix = lda_model.fit_transform(doc_term_matrix)
    feature_names = vectorizer.get_feature_names_out()
    return lda_model, feature_names, topic_matrix


def analyze_topics_and_sentiment(df: pd.DataFrame, num_topics: int = 4) -> Dict:
    """
    Analyze dataset text to extract LDA topics and VADER sentiment scores.
    Returns a dictionary with topics, sentiments, and per-tweet mappings.
    """
    if df is None or df.empty:
        return {
            "topics": [],
            "tweet_topics": {},
            "tweet_sentiments": {},
            "sentiment_summary": {
                "average_compound": 0,
                "positive": 0,
                "negative": 0,
                "neutral": 0,
            },
        }

    texts = df["text"].fillna("").astype(str).tolist()
    processed = [preprocess_text(t) for t in texts]

    lda_model, feature_names, topic_matrix = _build_topic_model(processed, num_topics=num_topics)

    topics: List[Dict] = []
    tweet_topics: Dict[str, Dict] = {}

    if lda_model is not None and topic_matrix is not None:
        for topic_idx, topic in enumerate(lda_model.components_):
            top_indices = topic.argsort()[:-11:-1]
            keywords = [feature_names[i] for i in top_indices]
            topics.append(
                {
                    "topic_id": int(topic_idx),
                    "keywords": keywords,
                    "weight": float(topic.sum()),
                }
            )

        for i, node_id in enumerate(df["id"].astype(str).tolist()):
            distribution = topic_matrix[i]
            dominant_topic = int(distribution.argmax())
            confidence = float(distribution.max())
            tweet_topics[node_id] = {
                "topic_id": dominant_topic,
                "distribution": distribution.tolist(),
                "confidence": confidence,
            }

        # Attach representative examples to each topic
        for topic in topics:
            topic_id = topic["topic_id"]
            best_example = None
            best_confidence = 0
            for node_id, info in tweet_topics.items():
                if info["topic_id"] == topic_id and info["confidence"] > best_confidence:
                    best_confidence = info["confidence"]
                    text = df[df["id"].astype(str) == node_id]["text"].iloc[0]
                    best_example = str(text)[:200]
            topic["representative_text"] = best_example or ""
            topic["average_confidence"] = (
                float(
                    sum(info["confidence"] for info in tweet_topics.values() if info["topic_id"] == topic_id)
                )
                / max(1, sum(1 for info in tweet_topics.values() if info["topic_id"] == topic_id))
            )
    else:
        # Fallback: use most common keywords as pseudo-topics
        keyword_counts = (
            pd.Series(processed)
            .apply(lambda x: x.split())
            .explode()
            .value_counts()
            .head(num_topics)
        )
        for idx, (word, count) in enumerate(keyword_counts.items()):
            topics.append(
                {
                    "topic_id": idx,
                    "keywords": [word],
                    "weight": float(count),
                    "representative_text": "",
                    "average_confidence": 0,
                }
            )

    # Sentiment analysis
    tweet_sentiments: Dict[str, Dict] = {}
    sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
    compound_scores: List[float] = []

    for node_id, text in zip(df["id"].astype(str), texts):
        analyzer = _get_sentiment_analyzer()
        scores = analyzer.polarity_scores(text)
        compound = scores.get("compound", 0)
        if compound >= 0.05:
            label = "positive"
        elif compound <= -0.05:
            label = "negative"
        else:
            label = "neutral"

        sentiment_counts[label] += 1
        compound_scores.append(compound)
        tweet_sentiments[node_id] = {
            "compound": float(compound),
            "positive": float(scores.get("pos", 0)),
            "neutral": float(scores.get("neu", 0)),
            "negative": float(scores.get("neg", 0)),
            "label": label,
        }

    sentiment_summary = {
        "average_compound": float(sum(compound_scores) / len(compound_scores)) if compound_scores else 0,
        "positive": sentiment_counts["positive"],
        "negative": sentiment_counts["negative"],
        "neutral": sentiment_counts["neutral"],
    }

    return {
        "topics": topics,
        "tweet_topics": tweet_topics,
        "tweet_sentiments": tweet_sentiments,
        "sentiment_summary": sentiment_summary,
    }


