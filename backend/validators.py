from pydantic import BaseModel, Field, validator, constr
from typing import List, Optional
import re
from functools import lru_cache

@lru_cache(maxsize=128)
def compile_regex(pattern: str) -> re.Pattern:
    return re.compile(pattern)

class ChatMessage(BaseModel):
    role: str = Field(..., regex="^(user|assistant)$", description="Role must be either 'user' or 'assistant'")
    content: str = Field(..., min_length=1, max_length=32768, description="Message content cannot be empty")

    @validator('content')
    def validate_content(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Content cannot be empty or just whitespace")
        return v
