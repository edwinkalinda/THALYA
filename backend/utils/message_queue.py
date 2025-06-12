
import asyncio
from typing import Dict, Callable, Any, Optional
from datetime import datetime
import json
from dataclasses import dataclass
import logging
from config import settings

logger = logging.getLogger(__name__)

@dataclass
class QueueMessage:
    id: str
    data: Any
    timestamp: datetime
    retry_count: int = 0
    max_retries: int = settings.MAX_RETRIES

class MessageQueue:
    def __init__(self):
        self._queues: Dict[str, asyncio.Queue] = {}
        self._handlers: Dict[str, Callable] = {}
        self._processing = False
        
    async def create_queue(self, name: str, maxsize: int = 0) -> None:
        if name not in self._queues:
            self._queues[name] = asyncio.Queue(maxsize=maxsize)
            
    async def publish(self, queue_name: str, message: Any) -> bool:
        if queue_name not in self._queues:
            await self.create_queue(queue_name)
            
        try:
            msg = QueueMessage(
                id=f"{queue_name}_{datetime.now().timestamp()}",
                data=message,
                timestamp=datetime.now()
            )
            await self._queues[queue_name].put(msg)
            return True
        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            return False
            
    async def subscribe(self, queue_name: str, handler: Callable) -> None:
        self._handlers[queue_name] = handler
        if not self._processing:
            asyncio.create_task(self._process_queues())
            
    async def _process_queues(self) -> None:
        self._processing = True
        while True:
            try:
                for queue_name, queue in self._queues.items():
                    if not queue.empty() and queue_name in self._handlers:
                        msg = await queue.get()
                        try:
                            await self._handlers[queue_name](msg.data)
                            queue.task_done()
                        except Exception as e:
                            if msg.retry_count < msg.max_retries:
                                msg.retry_count += 1
                                await queue.put(msg)
                            logger.error(f"Error processing message: {e}")
                            
                await asyncio.sleep(0.1)
            except Exception as e:
                logger.error(f"Queue processing error: {e}")
                await asyncio.sleep(1)