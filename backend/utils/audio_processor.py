import numpy as np
from typing import List, Optional
import threading
from scipy import signal
import io
import wave
import gc
from weakref import WeakSet
import concurrent.futures
from .message_queue import MessageQueue
import asyncio
import logging

logger = logging.getLogger(__name__)

class AudioProcessor:
    _instances = WeakSet()
    
    def __init__(self, sample_rate: int = 16000, buffer_size: int = 10):
        self.sample_rate = sample_rate
        self.buffer = []
        self._lock = threading.Lock()
        self.buffer_size = buffer_size
        self._total_bytes = 0
        self.MAX_BUFFER_BYTES = 1024 * 1024  # 1MB limit
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self._instances.add(self)
        self.message_queue = MessageQueue()
        self._setup_queue()
        
    def _setup_queue(self):
        asyncio.create_task(self._init_queue())
        
    async def _init_queue(self):
        await self.message_queue.create_queue('audio_processing')
        await self.message_queue.subscribe('audio_processing', self._process_queued_audio)
        
    async def _process_queued_audio(self, audio_data: bytes):
        try:
            result = await self._process_audio(audio_data)
            if result:
                await self.message_queue.publish('audio_processed', result)
        except Exception as e:
            logger.error(f"Queue audio processing error: {e}")
    
    @classmethod
    async def cleanup_all(cls):
        for instance in cls._instances:
            await instance.cleanup()
        gc.collect()
    
    async def cleanup(self):
        with self._lock:
            self.buffer.clear()
            self._total_bytes = 0
        self._executor.shutdown(wait=False)
        
    def _check_buffer_limit(self, size: int) -> bool:
        return (self._total_bytes + size) <= self.MAX_BUFFER_BYTES
        
    def normalize_audio(self, audio_data: bytes, target_sample_rate: int) -> Optional[bytes]:
        try:
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            if len(audio_array) == 0:
                return None
                
            # Apply noise reduction
            normalized = signal.medfilt(audio_array, kernel_size=3)
            normalized = np.int16(normalized / np.max(np.abs(normalized)) * 32767)
            
            # Resample if needed
            if self.sample_rate != target_sample_rate:
                duration = len(normalized) / self.sample_rate
                target_length = int(duration * target_sample_rate)
                normalized = signal.resample(normalized, target_length)
            
            return normalized.tobytes()
        except Exception as e:
            print(f"Audio normalization error: {e}")
            return None
            
    async def process_chunk(self, chunk: bytes) -> Optional[bytes]:
        if not chunk or not self._check_buffer_limit(len(chunk)):
            return None
            
        with self._lock:
            self.buffer.append(chunk)
            self._total_bytes += len(chunk)
            
            if len(self.buffer) >= self.buffer_size:
                combined = b''.join(self.buffer)
                self.buffer.clear()
                self._total_bytes = 0
                try:
                    return await self._process_audio(combined)
                finally:
                    if self._total_bytes > self.MAX_BUFFER_BYTES * 0.8:
                        await self.cleanup()
                
        return None
        
    async def _process_audio(self, audio_data: bytes) -> Optional[bytes]:
        return self.normalize_audio(audio_data, self.sample_rate)