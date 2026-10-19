from fastapi import APIRouter, HTTPException, Query, Path
from typing import Any, Dict, List
import json
import os
from backend.core.config import settings

router = APIRouter(prefix="/api/commentary", tags=["Commentary"])

COMMENTARY_DIR = os.path.join(os.getcwd(), "data", "commentary")

@router.get("/jingdu/{book}/{chapter}", response_model=Dict[str, Any])
async def get_jingdu_commentary(
    book: str = Path(..., description="Book abbreviation or ID (e.g., 1 for Genesis)"),
    chapter: str = Path(..., description="Chapter number")
) -> Any:
    """
    Retrieve Jingdu commentary for a specific book and chapter.
    """
    # Using book ID directly as that's how we saved the JSON files
    json_path = os.path.join(COMMENTARY_DIR, "jingdu", f"{book}.json")
    
    if not os.path.exists(json_path):
        return {"book": book, "chapter": chapter, "commentary": []}
        
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            book_data = json.load(f)
            
        chapter_str = str(chapter)
        if chapter_str in book_data:
            return {"book": book, "chapter": chapter, "commentary": book_data[chapter_str]}
        else:
            return {"book": book, "chapter": chapter, "commentary": []}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read commentary: {str(e)}")
