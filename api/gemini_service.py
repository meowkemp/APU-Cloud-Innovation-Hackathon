#Holds Gemini client, backup model

import os
from typing import Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import Optional, Literal
from pydantic import BaseModel, Field
import time
from google.genai import errors

FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")

def call_gemini(contents, config, retries=3):
    """Try the main model with retries, then fall back to a backup model."""
    for model in (MODEL, FALLBACK_MODEL):
        for attempt in range(retries):
            try:
                return client.models.generate_content(
                    model=model, contents=contents, config=config
                )
            except errors.ServerError:
                time.sleep(2 ** attempt)  # wait 1s, 2s, 4s
    raise RuntimeError("Gemini is unavailable right now")

load_dotenv()
client = genai.Client()
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

LAYOUT = """Campus layout:
- Blocks: A, B, C. Each block has levels 4, 5, 6. Each level has 10 classrooms.
- Level 6 of every block also has 10 tech labs.
- Room IDs: classrooms like A-6-10 (Block A, level 6, room 10);
  tech labs like Tech Lab A-6-10.
- Reply in plain text with no markdown (no asterisks or bullet symbols). Use one line per room, like:
  B-4-1 (40 seats, power outlet, whiteboard) - free until 17:00
- Start directly with the answer, with no greeting.
- Remind the student that each booking is limited to 1 hour, and that bookings are confirmed by the system.
Booking rules: max 2 bookings per student per day, each booking max 1 hour.
Rooms with an ongoing class or an existing booking cannot be booked."""

class RoomQuery(BaseModel):
    intent: Literal["find_free_room", "book_room", "other"] = Field(
        description="find_free_room to search, book_room to reserve a specific room, other if unrelated"
    )
    block: Optional[Literal["A", "B", "C"]] = Field(None, description="Block letter, or null")
    level: Optional[int] = Field(None, description="Level 4, 5 or 6, or null")
    room_type: Optional[Literal["classroom", "tech_lab"]] = None
    room_id: Optional[str] = Field(None, description="Exact room label like A-6-10 or Tech Lab A-6-10, or null")
    start_time: Optional[str] = Field(None, description="Time only, 24-hour HH:MM. No date.")
    end_time: Optional[str] = Field(None, description="Time only, 24-hour HH:MM, or null")
    min_capacity: Optional[int] = None
    facilities: list[str] = Field(default_factory=list, description="e.g. projector, power_outlet, whiteboard")
    quiet: bool = False

def extract_query(question: str, now_iso: str) -> RoomQuery:
    prompt = f"""{LAYOUT}

Current date/time: {now_iso}
Convert the student's question into search filters.
Resolve words like "now" or "later" using the current time.
If something isn't mentioned, leave it null.

Question: {question}"""
    resp = call_gemini(
    prompt,
    types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=RoomQuery,
        temperature=0,
        ),
    )
    return resp.parsed

SYSTEM = f"""You are the campus Free Classroom Finder assistant.
{LAYOUT}

Rules:
- Use ONLY the room data provided. Never invent rooms, times or facilities.
- If the list is empty, say no rooms match and suggest changing the time, block, or capacity.
- Keep answers short and friendly: room ID, capacity, facilities, and how long it stays free.
- If asked about something unrelated to campus rooms, say you can only help with finding and booking rooms."""

def write_answer(question: str, rooms: list[dict]) -> str:
    resp = call_gemini(
        f"Question: {question}\n\nAvailable rooms (JSON):\n{rooms}",
        types.GenerateContentConfig(system_instruction=SYSTEM, temperature=0.3),
    )
    return resp.text