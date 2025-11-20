from typing import Set
from fastapi import WebSocket
import asyncio


class LiveUpdateManager:
    """Manage websocket connections for live updates."""

    def __init__(self):
        self.connections: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            if websocket in self.connections:
                self.connections.remove(websocket)

    async def broadcast(self, message):
        dead = []
        async with self.lock:
            for connection in self.connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead.append(connection)
            for connection in dead:
                self.connections.remove(connection)


