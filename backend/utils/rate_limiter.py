from typing import Optional
import time
import asyncio
from dataclasses import dataclass
from config import settings
from .message_queue import MessageQueue
import logging

logger = logging.getLogger(__name__)

@dataclass
class RateLimit:
    requests: int
    window: int
    remaining: int
    reset_at: float

class RateLimiter:
    def __init__(self):
        self._rate_limits = {}
        self.message_queue = MessageQueue()
        self._setup_queue()
        
    def _setup_queue(self):
        asyncio.create_task(self._init_queue())
        
    async def _init_queue(self):
        await self.message_queue.create_queue('rate_limits')
        await self.message_queue.subscribe('rate_limits', self._handle_limit_update)
        
    async def _handle_limit_update(self, data: dict):
        key = data.get('key')
        if key and key in self._rate_limits:
            self._rate_limits[key].remaining = data['remaining']
            self._rate_limits[key].reset_at = data['reset_at']
            
    async def check_rate_limit(self, key: str) -> Optional[RateLimit]:
        now = time.time()
        
        if key not in self._rate_limits:
            self._rate_limits[key] = RateLimit(
                requests=settings.RATE_LIMIT_REQUESTS,
                window=settings.RATE_LIMIT_WINDOW,
                remaining=settings.RATE_LIMIT_REQUESTS,
                reset_at=now + settings.RATE_LIMIT_WINDOW
            )
            
        limit = self._rate_limits[key]
        
        if now > limit.reset_at:
            limit.remaining = limit.requests
            limit.reset_at = now + limit.window
            
        if limit.remaining > 0:
            limit.remaining -= 1
            await self.message_queue.publish('rate_limits', {
                'key': key,
                'remaining': limit.remaining,
                'reset_at': limit.reset_at
            })
            return None
            
        return limit