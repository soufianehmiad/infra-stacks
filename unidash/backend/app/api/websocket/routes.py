"""
WebSocket API routes.

Handles WebSocket connections for real-time updates.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from fastapi.exceptions import HTTPException
from ...core.security import verify_token
from .manager import manager, handle_websocket_message

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token for authentication"),
):
    """
    WebSocket endpoint for real-time communication.

    Requires valid JWT access token as query parameter.

    Protocol:
    - Client sends: {"type": "ping", "timestamp": "..."}
    - Server responds: {"type": "pong", "timestamp": "..."}
    - Server pushes: service updates, metrics, notifications

    Args:
        websocket: WebSocket connection
        token: JWT access token (query parameter)
    """
    # Authenticate user from token
    try:
        user_id = verify_token(token, token_type="access")
    except HTTPException:
        # Invalid token - close connection
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    # Register connection
    await manager.connect(websocket, user_id)

    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "timestamp": websocket.scope.get("timestamp", ""),
            "data": {
                "user_id": user_id,
                "message": "Connected to UniDash WebSocket",
            },
        })

        # Listen for messages
        while True:
            # Receive message from client
            data = await websocket.receive_json()

            # Handle message
            await handle_websocket_message(websocket, user_id, data)

    except WebSocketDisconnect:
        # Client disconnected normally
        await manager.disconnect(websocket, user_id)

    except Exception as e:
        # Unexpected error
        print(f"WebSocket error for user {user_id}: {e}")
        await manager.disconnect(websocket, user_id)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Internal error")
