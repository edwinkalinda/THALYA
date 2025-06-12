import asyncio
from typing import Dict, Callable, Any, Optional
import logging
from datetime import datetime
from .message_queue import MessageQueue

logger = logging.getLogger(__name__)

class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, asyncio.Task] = {}
        self.last_run: Dict[str, datetime] = {}
        self.message_queue = MessageQueue()
        asyncio.create_task(self._setup_task_queue())
        
    async def start_task(self, name: str, coro: Callable, *args, **kwargs) -> None:
        if name in self.tasks and not self.tasks[name].done():
            logger.warning(f"Task {name} is already running")
            return
            
        task = asyncio.create_task(self._run_task(name, coro, *args, **kwargs))
        self.tasks[name] = task
        self.last_run[name] = datetime.now()
        
    async def _run_task(self, name: str, coro: Callable, *args, **kwargs) -> None:
        try:
            await coro(*args, **kwargs)
        except Exception as e:
            logger.error(f"Task {name} failed: {str(e)}")
        finally:
            if name in self.tasks:
                del self.tasks[name]
                
    async def stop_task(self, name: str) -> None:
        if name in self.tasks:
            self.tasks[name].cancel()
            try:
                await self.tasks[name]
            except asyncio.CancelledError:
                pass
            del self.tasks[name]
            
    async def _setup_task_queue(self):
        await self.message_queue.create_queue('task_events')
        await self.message_queue.subscribe('task_events', self._handle_task_event)
        
    async def _handle_task_event(self, event_data: Dict):
        if event_data.get('action') == 'start':
            await self.start_task(
                event_data['name'],
                event_data['coro'],
                *event_data.get('args', []),
                **event_data.get('kwargs', {})
            )