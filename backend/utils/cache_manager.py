from typing import Any, Optional
import time
from functools import wraps
from redis import asyncio as aioredis
from config import settings
from .message_queue import MessageQueue
import asyncio

class CacheManager:
    def __init__(self):
        self.redis = aioredis.from_url(settings.REDIS_URL)
        self.message_queue = MessageQueue()
        self._setup_queue()
        
    def _setup_queue(self):
        asyncio.create_task(self._init_queue())
        
    async def _init_queue(self):
        await self.message_queue.create_queue('cache_events')
        await self.message_queue.subscribe('cache_events', self._handle_cache_event)
        
    async def _handle_cache_event(self, event: dict):
        if event['type'] == 'invalidate':
            await self.redis.delete(event['key'])
        elif event['type'] == 'clear_pattern':
            pattern = event['pattern']
            keys = await self.redis.keys(pattern)
            if keys:
                await self.redis.delete(*keys)
                
    async def invalidate(self, key: str):
        await self.redis.delete(key)
        await self.message_queue.publish('cache_events', {
            'type': 'invalidate',
            'key': key
        })
        
    async def clear_pattern(self, pattern: str):
        await self.message_queue.publish('cache_events', {
            'type': 'clear_pattern',
            'pattern': pattern
        })
        
    async def get(self, key: str) -> Optional[Any]:
        value = await self.redis.get(key)
        return value.decode() if value else None
        
    async def set(self, key: str, value: Any, ttl: int = None):
        await self.redis.set(key, value, ex=ttl or settings.CACHE_TTL)
        
    def cached(self, prefix: str, ttl: Optional[int] = None):
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                key = f"{prefix}:{args}:{kwargs}"
                cached_value = await self.get(key)
                
                if cached_value:
                    return cached_value
                    
                result = await func(*args, **kwargs)
                await self.set(key, result, ttl)
                return result
            return wrapper
        return decorator