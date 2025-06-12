import time
from functools import wraps, lru_cache
from quart import request, current_app
import logging
from time import perf_counter
from typing import Dict, Any
import orjson

def require_api_key():
    def decorator(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            api_key = request.headers.get('X-API-Key')
            if not api_key or api_key != current_app.config['API_KEY']:
                return {'error': 'Invalid API key'}, 401
            return await f(*args, **kwargs)
        return decorated_function
    return decorator

async def log_request_info(request):
    logging.info(f"""
    Request: {request.method} {request.url}
    Headers: {dict(request.headers)}
    Remote IP: {request.headers.get('X-Forwarded-For', request.remote_addr)}
    """)

class SecurityMiddleware:
    def __init__(self, app):
        self.app = app
        self.blocked_ips = set()
        self.request_logs = {}
        self.suspicious_patterns = [
            r'../','exec\(', 'eval\(', r'(?:union|select|insert|delete|drop)\s+(?:from|into|table)',
        ]

    def is_suspicious(self, client_ip: str) -> bool:
        return (
            client_ip in self.blocked_ips or
            self.request_logs.get(client_ip, 0) > 1000
        )

    async def reject_request(self, send):
        await send({
            "type": "http.response.start",
            "status": 403,
            "headers": [(b"content-type", b"application/json")]
        })
        await send({
            "type": "http.response.body",
            "body": b'{"error": "Access denied"}'
        })

class MonitoringMiddleware:
    async def __call__(self, scope, receive, send):
        start_time = time.time()
        await self.app(scope, receive, send)
        duration = time.time() - start_time
        
        if scope["type"] == "http":
            path = scope["path"]
            method = scope["method"]
            logging.info(f"Request {method} {path} took {duration:.2f}s")

class PerformanceMiddleware:
    def __init__(self, app):
        self.app = app
        self._requests: Dict[str, Any] = {}
        
    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
            
        start = perf_counter()
        
        # Track concurrent requests
        path = scope.get("path", "unknown")
        self._requests[path] = self._requests.get(path, 0) + 1
        
        try:
            return await self.app(scope, receive, send)
        finally:
            duration = perf_counter() - start
            self._requests[path] -= 1
            
            # Log slow requests
            if duration > 1.0:  # 1 second threshold
                logging.warning(f"Slow request: {path} took {duration:.2f}s")

class CacheMiddleware:
    def __init__(self, app, max_size=1000):
        self.app = app
        self._cache = {}
        self._max_size = max_size
    
    @lru_cache(maxsize=1000)
    def _generate_cache_key(self, scope):
        return f"{scope['method']}:{scope['path']}:{scope.get('query_string', b'')}"
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in ("GET", "HEAD"):
            return await self.app(scope, receive, send)
            
        cache_key = self._generate_cache_key(scope)
        
        # Implement LRU cache cleanup
        if len(self._cache) >= self._max_size:
            self._cache.pop(next(iter(self._cache)))

class OptimizedMiddlewareChain:
    def __init__(self, app, middlewares):
        self.app = app
        self.middlewares = middlewares
    
    async def __call__(self, scope, receive, send):
        handler = self.app
        for middleware in reversed(self.middlewares):
            handler = middleware(handler)
        return await handler(scope, receive, send)
