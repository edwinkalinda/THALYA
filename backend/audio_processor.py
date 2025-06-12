from functools import lru_cache
import numpy as np
from scipy import signal
import wave
import io
import logging
from typing import Optional

class AudioProcessor:
    CHUNK_SIZE = 1024 * 16  # 16KB chunks
    DTYPE = np.float32  # Specify dtype for better performance

    @staticmethod
    @lru_cache(maxsize=1000)
    def _calculate_normalization_factor(audio_hash: str) -> float:
        # Placeholder for normalization factor calculation
        pass

    @classmethod
    def normalize_audio(cls, audio_data: bytes, target_sample_rate: int = 16000) -> bytes:
        try:
            # Process in chunks to reduce memory usage
            chunks = []
            for i in range(0, len(audio_data), cls.CHUNK_SIZE):
                chunk = audio_data[i:i + cls.CHUNK_SIZE]
                # Process chunk
                chunks.append(cls._process_chunk(chunk, target_sample_rate))
            
            return b''.join(chunks)
        except Exception as e:
            logging.error(f"Audio normalization error: {e}")
            raise

    @classmethod
    def _process_chunk(cls, chunk: bytes, target_sample_rate: int) -> bytes:
        # Use vectorized operations
        audio = np.frombuffer(chunk, dtype=np.int16).astype(cls.DTYPE)
        max_val = np.abs(audio).max() or 1  # Avoid division by zero
        audio = (audio / max_val * 32767).astype(np.int16)
        
        # Pre-allocate buffer
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(target_sample_rate)
            wav.writeframes(audio.tobytes())
            
        return buffer.getvalue()

    @staticmethod
    def detect_speech(audio_data: bytes, threshold: float = 0.1) -> bool:
        audio = np.frombuffer(audio_data, dtype=np.int16)
        audio = audio / 32768.0  # Normalize to [-1, 1]
        rms = np.sqrt(np.mean(np.square(audio)))
        return rms > threshold
