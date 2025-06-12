from typing import Dict, Optional, List
import asyncio
from datetime import datetime, timedelta
import psutil
import logging
import backoff
from contextlib import asynccontextmanager
from .message_queue import MessageQueue

class ConnectionManager:
    def __init__(self, max_connections: int = 100):
        self.active_connections: Dict[str, dict] = {}
        self.max_connections = max_connections
        self.health_metrics = {
            'cpu_usage': 0,
            'memory_usage': 0,
            'connection_count': 0
        }
        self._connection_pools = {}
        self._backoff_config = {
            'max_tries': 3,
            'max_time': 30,
            'factor': 2
        }
        self._setup_logging()
        self.message_queue = MessageQueue()
        asyncio.create_task(self._setup_queue())
        
    def _setup_logging(self):
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        
    async def _setup_queue(self):
        await self.message_queue.create_queue('connection_events')
        await self.message_queue.subscribe('connection_events', self._handle_connection_event)
        
    async def _handle_connection_event(self, event: dict):
        if event['type'] == 'cleanup':
            await self.cleanup_inactive(event.get('timeout', 30))
        elif event['type'] == 'disconnect':
            await self.disconnect(event['client_id'])
            
    async def _publish_connection_event(self, event_type: str, data: dict):
        await self.message_queue.publish('connection_events', {
            'type': event_type,
            **data
        })
        
    async def get_health_metrics(self) -> dict:
        self.health_metrics.update({
            'cpu_usage': psutil.cpu_percent(),
            'memory_usage': psutil.virtual_memory().percent,
            'connection_count': len(self.active_connections)
        })
        return self.health_metrics
        
    async def connect(self, client_id: str, session: any) -> bool:
        metrics = await self.get_health_metrics()
        if metrics['cpu_usage'] > 80 or metrics['memory_usage'] > 80:
            self.logger.warning("Resource usage too high, rejecting connection")
            return False
            
        if len(self.active_connections) >= self.max_connections:
            return False
            
        self.active_connections[client_id] = {
            'session': session,
            'connected_at': datetime.now(),
            'last_activity': datetime.now()
        }
        return True
        
    async def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            
    def update_activity(self, client_id: str):
        if client_id in self.active_connections:
            self.active_connections[client_id]['last_activity'] = datetime.now()
            
    async def cleanup_inactive(self, timeout_minutes: int = 30):
        while True:
            try:
                now = datetime.now()
                timeout = timedelta(minutes=timeout_minutes)
                
                for client_id, data in list(self.active_connections.items()):
                    if now - data['last_activity'] > timeout:
                        await self.disconnect(client_id)
                        
                metrics = await self.get_health_metrics()
                if metrics['connection_count'] > self.max_connections * 0.8:
                    self.logger.warning("High connection load detected")
            except Exception as e:
                self.logger.error(f"Cleanup error: {e}")
            finally:
                await asyncio.sleep(60)  # Check every minute

    @asynccontextmanager
    async def get_connection(self, pool_name: str):
        if pool_name not in self._connection_pools:
            self._connection_pools[pool_name] = []
        
        try:
            conn = await self._get_connection_with_backoff(pool_name)
            yield conn
        finally:
            await self._release_connection(pool_name, conn)
            
    @backoff.on_exception(
        backoff.expo,
        Exception,
        max_tries=3
    )
    async def _get_connection_with_backoff(self, pool_name: str):
        pool = self._connection_pools[pool_name]
        if not pool:
            conn = await self._create_connection(pool_name)
            return conn
        return pool.pop()
        
    async def _release_connection(self, pool_name: str, conn):
        if conn and len(self._connection_pools[pool_name]) < self.max_connections:
            self._connection_pools[pool_name].append(conn)