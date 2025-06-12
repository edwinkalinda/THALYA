import base64
import json
import logging
import os
import wave
import audioop
import numpy as np
from scipy import signal
from google.cloud import speech_v1
from google.cloud import texttospeech
from quart import Quart, request, jsonify, websocket
from quart_cors import cors
from dotenv import load_dotenv
from twilio.twiml.voice_response import VoiceResponse, Connect
from google.generativeai.types import HarmCategory, HarmBlockThreshold 
import google.generativeai as genai
import httpx
from firebase_admin import credentials, firestore, initialize_app
from typing import Optional, List, Dict, Any, Union
import asyncio
from functools import lru_cache, wraps
from async_lru import alru_cache
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
import aioredis
from aioredis import Redis
from datetime import datetime
from twilio.rest import Client
import requests
from pydantic import ValidationError, BaseModel
from validators import ChatRequest, AudioConfig, WebSocketConfig
from config import settings
from middleware import SecurityMiddleware, MonitoringMiddleware
import backoff
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
import uvloop
import orjson
import time
from asyncio import Queue

# Add missing validator classes
class ChatRequest(BaseModel):
    history: List[Dict[str, Any]]
    
class AudioConfig(BaseModel):
    sample_rate: int = 16000
    channels: int = 1
    format: str = "wav"
    
class WebSocketConfig(BaseModel):
    business_id: str
    mode: str = "realtime"

# Add missing settings class
class Settings(BaseModel):
    GEMINI_API_KEY: str
    PORT: int = 5000
    MAX_WORKERS: int = 4
    CHUNK_SIZE: int = 1024
    HTTP_POOL_SIZE: int = 100
    REDIS_URL: str
    SENTRY_DSN: str
    ENVIRONMENT: str = "development"

# --- Configuration Initiale ---
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables from .env file
GEMINI_API_KEY = settings.GEMINI_API_KEY.get_secret_value()
TWILIO_ACCOUNT_SID = settings.TWILIO_ACCOUNT_SID.get_secret_value()
TWILIO_AUTH_TOKEN = settings.TWILIO_AUTH_TOKEN.get_secret_value()

# Initialize Sentry before other configurations
sentry_sdk.init(
    dsn=settings.SENTRY_DSN.get_secret_value(),
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0,
    environment=settings.ENVIRONMENT
)

app = Quart(__name__)
# En production, restreignez l'origine au domaine de votre frontend
app = cors(app, allow_origin="*")

# Security Middleware
app = SecurityMiddleware(app)

# Remove redis-rate-limit import and replace with custom implementation
class RateLimiter:
    def __init__(self, redis: Redis, key_prefix: str = "rate_limit:", limit: int = 100, window: int = 60):
        self.redis = redis
        self.key_prefix = key_prefix
        self.limit = limit
        self.window = window

    async def is_allowed(self, key: str, scope: dict) -> bool:
        current = datetime.now().timestamp()
        key = f"{self.key_prefix}{key}:{scope['path']}"
        
        async with self.redis.pipeline() as pipe:
            try:
                # Clean old requests and add new one
                await pipe.zremrangebyscore(key, 0, current - self.window)
                await pipe.zadd(key, {str(current): current})
                await pipe.zcard(key)
                await pipe.expire(key, self.window)
                results = await pipe.execute()
                return results[2] <= self.limit
            except Exception as e:
                logging.error(f"Rate limiter error: {e}")
                return True  # Allow on error

# Update Redis initialization
redis = aioredis.from_url(
    settings.REDIS_URL.get_secret_value(),
    encoding='utf-8',
    decode_responses=True
)

rate_limiter = RateLimiter(
    redis=redis,
    limit=100,  # requests
    window=60   # seconds
)

# Example usage in route
@app.route("/twilio-voice", methods=["POST"])
async def twilio_voice():
    if not await rate_limiter.is_allowed(request.remote_addr, request.scope):
        return jsonify({"error": "Rate limit exceeded"}), 429
        
    # ...existing route code...

# --- Initialisation du SDK Admin Firebase ---
try:
    cred = credentials.Certificate("firebase-service-account.json")
    initialize_app(cred)
    db = firestore.client()
    logging.info("Firebase connecté avec succès.")
except Exception as e:
    logging.error(f"Impossible d'initialiser Firebase. Erreur : {e}")
    db = None

# --- Configuration de l'API Gemini ---
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro')
except KeyError:
    logging.error("FATAL : GEMINI_API_KEY non trouvé")
    exit(1)

@backoff.on_exception(
    backoff.expo,
    (httpx.RequestError, TimeoutError),
    max_tries=3
)
async def make_api_request(url, data):
    async with httpx.AsyncClient() as client:
        return await client.post(url, json=data, timeout=10.0)

# --- WebSocket Handler ---
class AudioSession:
    def __init__(self, business_id):
        self.business_id = business_id
        self.model = genai.GenerativeModel('gemini-pro')
        self.chat = self.model.start_chat(context=self.generate_system_prompt(business_id))
        self.speech_client = speech_v1.SpeechClient()
        self.tts_client = texttospeech.TextToSpeechClient()
        self.buffer = []
        self.processing = False
        self._active = True

    def generate_system_prompt(self, business_id: str) -> str:
        return f"You are an AI assistant helping with business {business_id}. Be professional and helpful."

    async def cleanup(self):
        self._active = False
        self.buffer.clear()
        self.processing = False

    async def process_audio_chunk(self, audio_data):
        try:
            if not self._active:
                return None
                
            audio_config = AudioConfig(
                sample_rate=16000,
                channels=1,
                format="wav"
            )
            
            # Define or import AudioProcessor to avoid undefined error
            # Define a placeholder AudioProcessor class if the module is missing
            class AudioProcessor:
                @staticmethod
                def normalize_audio(audio_data, target_sample_rate):
                    # Example normalization logic
                    return audio_data

                @staticmethod
                def detect_speech(audio_data):
                    # Example speech detection logic
                    return True
            
            processed_audio = AudioProcessor.normalize_audio(
                audio_data, 
                target_sample_rate=audio_config.sample_rate
            )
            
            if not AudioProcessor.detect_speech(processed_audio):
                return None
                
            return await self.process_voice(processed_audio)
        except Exception as e:
            logging.error(f"Audio processing error: {e}")
            return None

class ConnectionPools:
    def __init__(self):
        self.speech_client_pool = []
        self.tts_client_pool = []
        self.max_pool_size = settings.MAX_WORKERS
        self.queue = Queue()

    async def get_speech_client(self):
        if not self.speech_client_pool:
            return speech_v1.SpeechClient()
        return await self.queue.get()

    async def release_speech_client(self, client):
        await self.queue.put(client)

pools = ConnectionPools()

class OptimizedAudioSession(AudioSession):
    def __init__(self, business_id):
        super().__init__(business_id)
        self._cache = {}
        self._last_processed = 0
        self._buffer_size = settings.CHUNK_SIZE
        self._queue = Queue(maxsize=10)  # Limit queue size
    
    async def process_audio_chunk(self, audio_data):
        # Add buffering
        if self._queue.full():
            _ = await self._queue.get()  # Remove oldest
        await self._queue.put(audio_data)
        
        # Process in batches
        if self._queue.qsize() >= 3:  # Process when we have 3 chunks
            chunks = []
            while not self._queue.empty():
                chunks.append(await self._queue.get())
            return await self._process_batch(chunks)

@app.websocket('/twilio-stream')
async def twilio_stream():
    business_id = request.args.get('business_id', 'default')
    audio_session = AudioSession(business_id)
    
    try:
        while True:
            message = await websocket.receive()
            if message.get('type') == 'websocket.disconnect':
                break
                
            audio_data = base64.b64decode(message.get('audio', ''))
            if not audio_data:
                continue
                
            response_audio = await audio_session.process_audio_chunk(audio_data)
            if response_audio:
                await websocket.send({
                    'audio': base64.b64encode(response_audio).decode('utf-8')
                })
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
    finally:
        await audio_session.cleanup()

class VoiceChatSession:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-pro')
        self.chat = self.model.start_chat(context="You are a helpful AI assistant conducting a live conversation to gather business information. Be conversational and natural.")
        self.speech_client = speech_v1.SpeechClient()
        self.tts_client = texttospeech.TextToSpeechClient()
        self._buffer = []

    async def cleanup(self):
        """Clean up resources when session ends"""
        self._buffer.clear()
        self.chat = None
        
    async def process_voice(self, audio_data: bytes) -> dict:
        try:
            # Convert audio to text
            response = await self.speech_client.recognize(
                config=speech_v1.RecognitionConfig(
                    encoding=speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
                    sample_rate_hertz=16000,
                    language_code="fr-FR",
                    enable_automatic_punctuation=True,
                ),
                audio=speech_v1.RecognitionAudio(content=audio_data)
            )
            
            if not response.results:
                return None

            transcript = response.results[0].alternatives[0].transcript

            # Get AI response
            ai_response = await self.chat.send_message(transcript)
            
            # Convert response to speech
            synthesis_input = texttospeech.SynthesisInput(text=ai_response.text)
            voice = texttospeech.VoiceSelectionParams(
                language_code="fr-FR",
                name="fr-FR-Wavenet-C",
            )
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                speaking_rate=1.0,
            )

            response = await self.tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )

            return {
                'transcript': transcript,
                'response': ai_response.text,
                'audio': base64.b64encode(response.audio_content).decode('utf-8')
            }
        except Exception as e:
            logging.error(f"Voice processing error: {e}")
            return None

@app.websocket('/voice-chat')
async def voice_chat():
    session = None
    try:
        config = WebSocketConfig(**request.args)
        session = VoiceChatSession()
        while True:
            data = await websocket.receive_json()
            audio_data = np.array(data['audio'], dtype=np.float32).tobytes()
            
            result = await session.process_voice(audio_data)
            if result:
                await websocket.send_json(result)
    except ValidationError as e:
        await websocket.send_json({"error": "Invalid configuration", "details": str(e)})
        return
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        await websocket.send_json({"error": "Internal server error"})
    finally:
        if session:
            await session.cleanup()

# --- API Routes ---
def require_api_key(f):
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        api_key = request.headers.get("X-API-KEY")
        if api_key != GEMINI_API_KEY:
            return jsonify({"error": "Unauthorized"}), 401
        return await f(*args, **kwargs)
    return decorated_function

@app.route('/api/onboarding-chat', methods=['POST'])
@require_api_key
async def onboarding_chat():
    try:
        data = await request.get_json()
        chat_request = ChatRequest(**data)
        
        if not await rate_limiter.is_allowed(request.remote_addr, request.scope):
            return jsonify({"error": "Rate limit exceeded"}), 429
            
        response = await model.chat(chat_request.history)
        return jsonify({"reply": response.text})
    except ValidationError as e:
        logging.warning(f"Validation error: {e}")
        return jsonify({"error": "Invalid request format", "details": e.errors()}), 400
    except Exception as e:
        logging.error(f"Chat error: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

# --- Health Check ---
@app.route("/health")
async def health_check():
    status = {
        "status": "healthy",
        "redis": await redis.ping(),
        "firebase": db is not None,
        "gemini": model is not None
    }
    return jsonify(status)

@app.route("/health/live")
async def liveness():
    return jsonify({"status": "alive"})

@app.route("/health/ready")
async def readiness():
    try:
        # Check all dependencies
        redis_ok = await redis.ping()
        db_ok = db is not None
        model_ok = model is not None
        
        if all([redis_ok, db_ok, model_ok]):
            return jsonify({"status": "ready"})
        return jsonify({"status": "not ready"}), 503
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return jsonify({"status": "error"}), 503

# Use uvloop for better async performance
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

# Connection pools
http_client = httpx.AsyncClient(
    limits=httpx.Limits(
        max_keepalive_connections=settings.HTTP_POOL_SIZE,
        max_connections=settings.HTTP_POOL_SIZE
    ),
    timeout=30.0
)

# Thread pool for CPU-bound tasks
thread_pool = ThreadPoolExecutor(
    max_workers=settings.MAX_WORKERS,
    thread_name_prefix="worker"
)

@asynccontextmanager
async def get_session():
    try:
        yield http_client
    finally:
        pass  # Connection handled by pool

app.json_encoder = orjson.dumps  # Faster JSON serialization
app.json_decoder = orjson.loads  # Faster JSON deserialization

# Cleanup
@app.before_serving
async def startup():
    # Initialize connections
    pass

@app.after_serving
async def shutdown():
    await http_client.aclose()
    thread_pool.shutdown(wait=True)

if __name__ == '__main__':
    port = int(settings.PORT)
    app.run(host='0.0.0.0', port=port)
