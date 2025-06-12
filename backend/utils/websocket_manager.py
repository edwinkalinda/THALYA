from typing import Dict, Set, Optional
import asyncio
import json
from dataclasses import dataclass
from datetime import datetime
import logging
from .message_queue import MessageQueue

logger = logging.getLogger(__name__)

@dataclass
class WebSocketConnection:
    id: str
    connected_at: datetime
    last_ping: datetime
    ping_interval: float = 30.0
    
class WebSocketManager:
    def __init__(self):
        self.connections: Dict[str, WebSocketConnection] = {}
        self.groups: Dict[str, Set[str]] = {}
        self.message_queue = MessageQueue()
        asyncio.create_task(self._setup_queues())
        
    async def register(self, conn_id: str, websocket) -> WebSocketConnection:
        connection = WebSocketConnection(
            id=conn_id,
            connected_at=datetime.now(),
            last_ping=datetime.now()
        )
        self.connections[conn_id] = connection
        
        asyncio.create_task(self._ping_connection(conn_id, websocket))
        return connection
        
    async def _ping_connection(self, conn_id: str, websocket):
        while conn_id in self.connections:
            try:
                await websocket.send_json({'type': 'ping'})
                await asyncio.sleep(self.connections[conn_id].ping_interval)
            except Exception:
                await self.unregister(conn_id)
                break
                
    async def unregister(self, conn_id: str):
        if conn_id in self.connections:
            del self.connections[conn_id]
            logger.info(f"Connection {conn_id} unregistered")
            
    async def send_to_connection(self, conn_id: str, message: Dict):
        if conn_id in self.connections:
            try:
                await self.connections[conn_id].websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message to {conn_id}: {e}")
                await self.unregister(conn_id)
                
    async def broadcast(self, group: str, message: Dict):
        if group in self.groups:
            for conn_id in self.groups[group]:
                await self.send_to_connection(conn_id, message)
                
    def add_to_group(self, conn_id: str, group: str):
        if group not in self.groups:
            self.groups[group] = set()
        self.groups[group].add(conn_id)
        
    def remove_from_group(self, conn_id: str, group: str):
        if group in self.groups and conn_id in self.groups[group]:
            self.groups[group].remove(conn_id)
            if not self.groups[group]:
                del self.groups[group]
                
    async def _setup_queues(self):
        await self.message_queue.create_queue('websocket_events')
        await self.message_queue.subscribe('websocket_events', self._handle_event)
        
    async def _handle_event(self, event_data: Dict):
        event_type = event_data.get('type')
        if event_type == 'broadcast':
            await self.broadcast(event_data['group'], event_data['message'])
        elif event_type == 'direct':
            await self.send_to_connection(event_data['conn_id'], event_data['message'])