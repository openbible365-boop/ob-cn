from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class VerseAnalysisResponse(BaseModel):
    verse_ref: str
    content: str
    source: str  # "db" or "gemini"
    
    model_config = {
        "from_attributes": True
    }
