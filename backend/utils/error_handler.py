from functools import wraps
import logging
from typing import Callable, Type, Union, Tuple
import traceback
from contextlib import contextmanager
import asyncio
from datetime import datetime
from .message_queue import MessageQueue

logger = logging.getLogger(__name__)

class RetryableError(Exception):
    pass

class ErrorHandler:
    def __init__(self):
        self.message_queue = MessageQueue()
        self._setup_queue()
        
    def _setup_queue(self):
        asyncio.create_task(self._init_queue())
        
    async def _init_queue(self):
        await self.message_queue.create_queue('error_events')
        
    async def report_error(self, error: Exception, context: dict = None):
        await self.message_queue.publish('error_events', {
            'error': str(error),
            'traceback': traceback.format_exc(),
            'context': context,
            'timestamp': datetime.now().isoformat()
        })

error_handler = ErrorHandler()

def handle_errors(retries: int = 3, 
                  exceptions: Tuple[Type[Exception], ...] = (RetryableError,)):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(retries):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_error = e
                    logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")
                    if attempt < retries - 1:
                        continue
                    raise last_error
                except Exception as e:
                    await error_handler.report_error(e, {'args': args, 'kwargs': kwargs})
                    logger.error(f"Unhandled error: {str(e)}\n{traceback.format_exc()}")
                    raise
        return wrapper
    return decorator