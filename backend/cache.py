import aioredis
from functools import wraps
import json
from typing import Optional, Callable, Any
import orjson

class RedisCache:
    def __init__(self, redis_url: str, pool_size: int = 20):
        self.redis = aioredis.from_url(
            redis_url,
            encoding='utf-8',
            decode_responses=True,
            max_connections=pool_size
        )
        self._serialize = orjson.dumps
        self._deserialize = orjson.loads

    async def get(self, key: str) -> Optional[str]:
        return await self.redis.get(key)

    async def set(self, key: str, value: str, expire: int = 3600):
        await self.redis.set(key, value, ex=expire)

    async def get_many(self, keys: list) -> dict:
        """Batch get operation"""
        values = await self.redis.mget(keys)
        return {k: self._deserialize(v) for k, v in zip(keys, values) if v is not None}

    def cached(self, prefix: str, ttl: int = 3600):
        def decorator(f: Callable) -> Callable:
            @wraps(f)
            async def wrapper(*args, **kwargs) -> Any:
                key = f"{prefix}:{json.dumps(args)}:{json.dumps(kwargs)}"
                cached_value = await self.get(key)
                
                if cached_value:
                    return json.loads(cached_value)
                
                result = await f(*args, **kwargs)
                await self.set(key, json.dumps(result), ttl)
                return result
            return wrapper
        return decorator
