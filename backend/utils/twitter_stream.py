import asyncio
import os
from datetime import datetime, timezone
from typing import Callable, Dict, Optional, List

import requests

from .graph_utils import preprocess_text
from .geo_utils import geocode_location
from .text_insights import _get_sentiment_analyzer

DISASTER_KEYWORDS = [
    "flood",
    "earthquake",
    "wildfire",
    "hurricane",
    "storm",
    "tornado",
    "fire",
    "tsunami",
    "landslide",
    "eruption",
    "explosion",
    "evacuation",
    "emergency",
    "collapse",
]


class TwitterStreamService:
    """
    Poll Twitter recent search API for disaster signals.

    Notes:
        - Uses the Twitter API v2 recent search endpoint.
        - Requires a Bearer token with appropriate access.
        - Environment variables:
            TWITTER_BEARER_TOKEN  - required
            TWITTER_QUERY         - optional override for search query
    """

    def __init__(self):
        self.bearer_token = os.getenv("TWITTER_BEARER_TOKEN")
        # Allow custom query; otherwise default to disaster keywords
        self.query = os.getenv(
            "TWITTER_QUERY",
            "(" + " OR ".join(DISASTER_KEYWORDS) + ") lang:en -is:retweet",
        )

        self.running = False
        self.task: Optional[asyncio.Task] = None
        self.callback: Optional[Callable[[Dict], None]] = None
        self.seen_ids = set()
        self.poll_interval = 30  # seconds
        self.session: Optional[requests.Session] = None
        self.since_id: Optional[str] = None

    def is_configured(self) -> bool:
        return bool(self.bearer_token)

    def init_client(self):
        if not self.is_configured():
            raise ValueError(
                "Twitter credentials missing. Set TWITTER_BEARER_TOKEN (and optional TWITTER_QUERY)."
            )
        if self.session is None:
            session = requests.Session()
            session.headers.update(
                {
                    "Authorization": f"Bearer {self.bearer_token}",
                    "User-Agent": "crisisnet-twitter-stream/1.0",
                }
            )
            self.session = session

    async def start(self, callback: Callable[[Dict], None]):
        """Start polling loop."""
        if self.running:
            return
        self.init_client()
        self.callback = callback
        self.running = True
        self.task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        """Stop polling loop."""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None

    async def _poll_loop(self):
        """Background loop: poll Twitter at fixed interval."""
        try:
            while self.running:
                try:
                    tweets = await asyncio.to_thread(self._fetch_recent_tweets)
                    for tweet, includes in tweets:
                        event = self._transform_tweet(tweet, includes)
                        if event and self.callback:
                            # callback is async
                            await self.callback(event)
                except Exception as exc:
                    print(f"Twitter stream error: {exc}")

                await asyncio.sleep(self.poll_interval)
        finally:
            self.running = False

    def _fetch_recent_tweets(self) -> List[Dict]:
        """Call Twitter recent search API and return new tweets."""
        if not self.session:
            return []

        url = "https://api.twitter.com/2/tweets/search/recent"
        params = {
            "query": self.query,
            "max_results": 50,
            "tweet.fields": "created_at,lang,geo,public_metrics",
            "expansions": "geo.place_id,author_id",
            "place.fields": "full_name,country",
        }
        if self.since_id:
            params["since_id"] = self.since_id

        resp = self.session.get(url, params=params, timeout=10)
        if resp.status_code != 200:
            print(f"Twitter API error: {resp.status_code} {resp.text}")
            return []

        data = resp.json()
        tweets = data.get("data", []) or []
        includes = data.get("includes", {})

        if tweets:
            # Track highest ID to avoid duplicates on next poll
            self.since_id = tweets[0]["id"]

        results: List[Dict] = []
        for tweet in tweets:
            if tweet["id"] in self.seen_ids:
                continue
            self.seen_ids.add(tweet["id"])
            results.append((tweet, includes))

        # Limit seen set size
        if len(self.seen_ids) > 5000:
            self.seen_ids = set(list(self.seen_ids)[-1000:])

        return results

    def _transform_tweet(self, tweet: Dict, includes: Dict) -> Optional[Dict]:
        """Normalize tweet into the live event schema used by the dashboard."""
        text = tweet.get("text", "").strip()
        if not text:
            return None

        sentiment_analyzer = _get_sentiment_analyzer()
        sentiment = sentiment_analyzer.polarity_scores(text)

        created_at_raw = tweet.get("created_at")
        try:
            if created_at_raw:
                created_at = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
            else:
                created_at = datetime.now(timezone.utc)
        except Exception:
            created_at = datetime.now(timezone.utc)

        event: Dict = {
            "id": tweet["id"],
            "source": "twitter",
            "title": text[:140],
            "text": text[:1000],
            "url": f"https://twitter.com/i/web/status/{tweet['id']}",
            "created_at": created_at.isoformat(),
            "sentiment": sentiment,
            "upvotes": tweet.get("public_metrics", {}).get("like_count", 0),
            "permalink": f"https://twitter.com/i/web/status/{tweet['id']}",
        }

        # Extract keywords based on disaster terms
        processed_text = preprocess_text(text)
        tokens = processed_text.split()
        keywords = [token for token in tokens if token in DISASTER_KEYWORDS]
        event["keywords"] = list(dict.fromkeys(keywords))[:5]

        # Try to resolve a location via place information + geocoding
        place_name = self._extract_place_name(tweet, includes)
        if place_name:
            coords = geocode_location(place_name)
            if coords:
                event["location"] = place_name
                event["lat"] = coords["lat"]
                event["lon"] = coords["lon"]

        return event

    @staticmethod
    def _extract_place_name(tweet: Dict, includes: Dict) -> Optional[str]:
        """Map tweet.geo.place_id to a human-readable place name."""
        geo = tweet.get("geo") or {}
        place_id = geo.get("place_id")
        if not place_id:
            return None

        places = includes.get("places") or []
        for place in places:
            if place.get("id") == place_id:
                # Prefer full_name, fall back to country
                return place.get("full_name") or place.get("country")
        return None



