"""
WebSocket connection manager.

Handles WebSocket connections, broadcasting, and per-user messaging.
"""
import json
import asyncio
from datetime import datetime
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from ...models.websocket import WSMessage


class ConnectionManager:
    """
    Manage WebSocket connections.

    Maintains active connections per user and broadcasts messages.
    """

    def __init__(self):
        # Map of user_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str):
        """
        Register new WebSocket connection.

        Args:
            websocket: WebSocket connection
            user_id: User ID owning this connection
        """
        await websocket.accept()

        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)

        print(f"✓ WebSocket connected: user={user_id}, total={self.get_connection_count()}")

    async def disconnect(self, websocket: WebSocket, user_id: str):
        """
        Unregister WebSocket connection.

        Args:
            websocket: WebSocket connection
            user_id: User ID owning this connection
        """
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)

                # Clean up empty sets
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

        print(f"✗ WebSocket disconnected: user={user_id}, total={self.get_connection_count()}")

    async def send_personal_message(self, message: dict, user_id: str):
        """
        Send message to all connections of a specific user.

        Args:
            message: Message dictionary to send
            user_id: Target user ID
        """
        if user_id not in self.active_connections:
            return

        # Get snapshot of connections to avoid modification during iteration
        connections = list(self.active_connections[user_id])

        # Send to all user connections
        for connection in connections:
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                # Connection closed during send
                await self.disconnect(connection, user_id)
            except Exception as e:
                print(f"Error sending personal message to user {user_id}: {e}")
                await self.disconnect(connection, user_id)

    async def broadcast(self, message: dict, exclude_user: str | None = None):
        """
        Broadcast message to all connected users.

        Args:
            message: Message dictionary to broadcast
            exclude_user: Optional user ID to exclude from broadcast
        """
        # Get all connections
        all_connections = []
        for user_id, connections in self.active_connections.items():
            if exclude_user and user_id == exclude_user:
                continue
            all_connections.extend([(conn, user_id) for conn in connections])

        # Broadcast to all
        for connection, user_id in all_connections:
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                await self.disconnect(connection, user_id)
            except Exception as e:
                print(f"Error broadcasting to user {user_id}: {e}")
                await self.disconnect(connection, user_id)

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return sum(len(connections) for connections in self.active_connections.values())

    def get_user_count(self) -> int:
        """Get number of unique connected users."""
        return len(self.active_connections)

    def is_user_connected(self, user_id: str) -> bool:
        """Check if user has any active connections."""
        return user_id in self.active_connections


# Global connection manager instance
manager = ConnectionManager()


async def handle_websocket_message(websocket: WebSocket, user_id: str, data: dict):
    """
    Handle incoming WebSocket message.

    Args:
        websocket: WebSocket connection
        user_id: User ID
        data: Message data
    """
    message_type = data.get("type")

    if message_type == "ping":
        # Respond to ping with pong
        await websocket.send_json({
            "type": "pong",
            "timestamp": datetime.utcnow().isoformat(),
        })

    elif message_type == "subscribe":
        # Subscribe to specific events
        # TODO: Implement subscription management
        await websocket.send_json({
            "type": "subscribed",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {"subscriptions": data.get("data", {}).get("events", [])},
        })

    elif message_type == "unsubscribe":
        # Unsubscribe from events
        # TODO: Implement subscription management
        await websocket.send_json({
            "type": "unsubscribed",
            "timestamp": datetime.utcnow().isoformat(),
        })

    else:
        # Unknown message type
        await websocket.send_json({
            "type": "error",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {"message": f"Unknown message type: {message_type}"},
        })
