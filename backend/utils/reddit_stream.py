import asyncio
import os
from typing import Callable, Dict, Optional, List
import praw
from datetime import datetime, timezone

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

DEFAULT_SUBREDDITS = [
    "news",
    "worldnews",
    "weather",
    "environment",
    "PublicSafety",
    "EmergencyManagement",
    "disaster",
]


class RedditStreamService:
    """Poll Reddit for disaster signals."""

    def __init__(self):
        self.client_id = os.getenv("REDDIT_CLIENT_ID")
        self.client_secret = os.getenv("REDDIT_CLIENT_SECRET")
        self.user_agent = os.getenv("REDDIT_USER_AGENT", "crisisnet.bot/1.0")

        self.running = False
        self.task: Optional[asyncio.Task] = None
        self.callback: Optional[Callable[[Dict], None]] = None
        self.seen_ids = set()
        self.poll_interval = 30  # seconds
        self.subreddits = os.getenv("REDDIT_SUBREDDITS", ",".join(DEFAULT_SUBREDDITS)).split(",")
        self.reddit = None

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.user_agent)

    def init_client(self):
        if not self.is_configured():
            raise ValueError("Reddit credentials missing. Set REDDIT_CLIENT_ID/SECRET/USER_AGENT.")
        if self.reddit is None:
            self.reddit = praw.Reddit(
                client_id=self.client_id,
                client_secret=self.client_secret,
                user_agent=self.user_agent,
            )

    async def start(self, callback: Callable[[Dict], None]):
        if self.running:
            return
        self.init_client()
        self.callback = callback
        self.running = True
        self.task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None

    async def _poll_loop(self):
        try:
            while self.running:
                try:
                    posts = await asyncio.to_thread(self._fetch_recent_posts)
                    for post in posts:
                        await self._handle_post(post)
                except Exception as exc:
                    print(f"Reddit stream error: {exc}")
                await asyncio.sleep(self.poll_interval)
        finally:
            self.running = False

    def _fetch_recent_posts(self) -> List[Dict]:
        submissions = []
        subreddit = self.reddit.subreddit("+".join(self.subreddits))
        for submission in subreddit.new(limit=50):
            if submission.id in self.seen_ids:
                continue
            text_content = f"{submission.title}\n{submission.selftext or ''}".lower()
            if any(keyword in text_content for keyword in DISASTER_KEYWORDS):
                submissions.append(submission)
                self.seen_ids.add(submission.id)
        # limit seen set
        if len(self.seen_ids) > 5000:
            self.seen_ids = set(list(self.seen_ids)[-1000:])
        return submissions

    async def _handle_post(self, submission):
        data = await asyncio.to_thread(self._transform_submission, submission)
        if data and self.callback:
            await self.callback(data)

    def _transform_submission(self, submission) -> Optional[Dict]:
        text = f"{submission.title}\n{submission.selftext or ''}".strip()
        if not text:
            return None

        sentiment_analyzer = _get_sentiment_analyzer()
        sentiment = sentiment_analyzer.polarity_scores(text)

        event = {
            "id": submission.id,
            "source": "reddit",
            "subreddit": submission.subreddit.display_name,
            "title": submission.title[:140],
            "text": text[:1000],
            "url": submission.url,
            "created_at": datetime.fromtimestamp(
                submission.created_utc, tz=timezone.utc
            ).isoformat(),
            "sentiment": sentiment,
            "upvotes": submission.score,
            "permalink": f"https://reddit.com{submission.permalink}",
        }

        # Attempt to detect keyword and location
        processed_text = preprocess_text(text)
        tokens = processed_text.split()
        keywords = [token for token in tokens if token in DISASTER_KEYWORDS]
        event["keywords"] = list(dict.fromkeys(keywords))[:5]

        # attempt geocode by scanning text for known places (basic)
        location = self._extract_location(submission)
        if location:
            coords = geocode_location(location)
            if coords:
                event["location"] = location
                event["lat"] = coords["lat"]
                event["lon"] = coords["lon"]

        return event

    def _extract_location(self, submission) -> Optional[str]:
        # Use flair if available
        if submission.link_flair_text:
            flair = submission.link_flair_text.strip()
            if flair and len(flair) > 2:
                return flair

        title = submission.title
        # naive extraction: look for capitalized words pairs
        words = title.split()
        for i in range(len(words) - 1):
            first, second = words[i], words[i + 1]
            if first.istitle() and second.istitle():
                candidate = f"{first} {second}"
                coords = geocode_location(candidate)
                if coords:
                    return candidate
        for word in words:
            if word.istitle():
                coords = geocode_location(word)
                if coords:
                    return word
        return None


