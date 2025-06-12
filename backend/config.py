from typing import Optional
from pydantic import BaseSettings, SecretStr, validator
import multiprocessing

class Settings(BaseSettings):
    GEMINI_API_KEY: SecretStr
    TWILIO_ACCOUNT_SID: SecretStr
    TWILIO_AUTH_TOKEN: SecretStr
    REDIS_URL: str = "redis://localhost"
    SENTRY_DSN: SecretStr
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "*"
    LOG_LEVEL: str = "INFO"
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # Performance settings
    MAX_WORKERS: int = 4
    CHUNK_SIZE: int = 4096  # Updated chunk size
    WEBSOCKET_TIMEOUT: int = 60
    MAX_PAYLOAD_SIZE: int = 1024 * 1024 * 5  # 5MB
    CACHE_TTL: int = 3600
    SAMPLE_RATE: int = 16000  # Added sample rate
    
    # Performance tuning
    AUDIO_BUFFER_SIZE: int = 10
    AUDIO_MAX_BUFFER_BYTES: int = 1024 * 1024  # 1MB
    HEALTH_CHECK_INTERVAL: int = 60
    CPU_THRESHOLD: int = 80
    MEMORY_THRESHOLD: int = 80
    CONNECTION_WARN_THRESHOLD: float = 0.8
    
    # Connection pools
    DB_POOL_SIZE: int = 20
    REDIS_POOL_SIZE: int = 20
    HTTP_POOL_SIZE: int = 100
    MAX_CONNECTIONS: int = 100  # Added max connections
    
    # Connection pool settings
    POOL_CLEANUP_INTERVAL: int = 300  # 5 minutes
    POOL_MAX_AGE: int = 3600  # 1 hour
    POOL_MIN_SIZE: int = 5
    BACKOFF_MAX_TRIES: int = 3
    BACKOFF_MAX_TIME: int = 30
    BACKOFF_FACTOR: int = 2
    
    PORT: int = 8000
    MAX_RETRIES: int = 3  # Added max retries
    TIMEOUT: int = 30  # Added timeout
    
    # Message Queue settings
    QUEUE_MAX_SIZE: int = 1000
    QUEUE_PROCESSING_INTERVAL: float = 0.1
    QUEUE_BATCH_SIZE: int = 100
    QUEUE_MAX_RETRIES: int = 3
    QUEUE_RETRY_DELAY: int = 5
    
    # Enhanced Performance Tuning
    THREAD_POOL_SIZE: int = multiprocessing.cpu_count() * 2
    PROCESS_POOL_SIZE: int = max(2, multiprocessing.cpu_count() - 1)
    IO_POOL_SIZE: int = 100
    
    # Monitoring thresholds
    MEMORY_CRITICAL: int = 90
    CPU_CRITICAL: int = 90
    DISK_CRITICAL: int = 90
    
    @validator('PORT')
    def validate_port(cls, v):
        if not (1024 <= v <= 65535):
            raise ValueError('Port must be between 1024 and 65535')
        return v

    @validator('MAX_WORKERS')
    def validate_workers(cls, v):
        cpu_count = multiprocessing.cpu_count()
        recommended = min(v, cpu_count * 2)
        return recommended
    
    @validator('AUDIO_BUFFER_SIZE')
    def validate_buffer_size(cls, v):
        if not (1 <= v <= 100):
            raise ValueError('Buffer size must be between 1 and 100')
        return v
    
    @validator('POOL_MAX_AGE')
    def validate_pool_age(cls, v):
        if v < 300:  # minimum 5 minutes
            raise ValueError('Pool max age must be at least 300 seconds')
        return v
    
    @validator('QUEUE_MAX_SIZE')
    def validate_queue_size(cls, v):
        if not (100 <= v <= 10000):
            raise ValueError('Queue size must be between 100 and 10000')
        return v
        
    @validator('QUEUE_PROCESSING_INTERVAL')
    def validate_processing_interval(cls, v):
        if not (0.01 <= v <= 1.0):
            raise ValueError('Processing interval must be between 0.01 and 1.0 seconds')
        return v
    
    class Config:
        env_file = ".env"

settings = Settings()