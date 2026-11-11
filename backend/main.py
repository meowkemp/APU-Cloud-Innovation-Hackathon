"""SpaceFinder API and same-origin frontend."""
import os
import re
from random import Random
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .chatbot.mock_data import ROOMS

ROOT = Path(__file__).resolve().parents[1]
DB = Path(os.getenv("SPACEFINDER_DB", ROOT / "backend" / "bookings.sqlite3"))
CAMPUS = timezone(timedelta(hours=8))
CLOCK = r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$"
ROOMS_BY_ID = {room["room_id"]: room for room in ROOMS}
COURSES = ("Project Management", "Algorithmics", "User Experience",
           "Text Analytics", "Computer Vision", "Database Systems")

app = FastAPI(title="SpaceFinder")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "SPACEFINDER_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500"
    ).split(","),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-User-Id"],
)


class ApiError(Exception):
    def __init__(self, status, code, message, **extra):
        self.status = status
        self.body = {"code": code, "message": message, **extra}


@app.exception_handler(ApiError)
async def api_error(request: Request, error: ApiError):
    return JSONResponse(error.body, status_code=error.status)


@app.exception_handler(RequestValidationError)
async def bad_request(request: Request, error: RequestValidationError):
    return JSONResponse(
        {"code": "BAD_INPUT", "message": "Check the supplied room, date, time or form fields."},
        status_code=400,
    )


def student(x_user_id: Annotated[str | None, Header()] = None):
    if not x_user_id or not re.fullmatch(r"[Tt][Pp][0-9]{6}", x_user_id):
        raise ApiError(401, "UNKNOWN_USER", "Enter TP followed by six digits, for example TP012345.")
    return x_user_id.upper()


Student = Annotated[str, Depends(student)]


class BookingInput(BaseModel):
    roomId: str
    date: date
    start: str = Field(pattern=CLOCK)
    end: str = Field(pattern=CLOCK)
    name: str = Field(min_length=1, max_length=100)
    size: int = Field(ge=1, le=20, strict=True)


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    now: datetime | None = None


@contextmanager
def database():
    connection = sqlite3.connect(DB, timeout=15)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS bookings (
                    id TEXT PRIMARY KEY, room_id TEXT NOT NULL, day TEXT NOT NULL,
                    start TEXT NOT NULL, end TEXT NOT NULL, name TEXT NOT NULL,
                    size INTEGER NOT NULL, student TEXT NOT NULL
                )
            """)
            connection.execute("CREATE INDEX IF NOT EXISTS bookings_day ON bookings(day)")
            yield connection
    finally:
        connection.close()


def bookable_day(day, today):
    first = today
    if today.weekday() >= 5:
        first += timedelta(days=7 - today.weekday())
    last = first + timedelta(days=4 - first.weekday())
    return first <= day <= last


def timetable(room_id, day):
    """Stable sample classes for each room and weekday date."""
    if day.weekday() >= 5:
        return []
    rng = Random(f"{room_id}:{day.isoformat()}")
    slots = rng.sample((8, 10, 12, 14, 16), k=rng.choice((1, 2, 3)))
    return [
        {
            "start": f"{hour:02d}:00",
            "end": f"{hour + 1:02d}:30",
            "type": "class",
            "label": rng.choice(COURSES),
        }
        for hour in sorted(slots)
    ]


def day_bookings(connection, day):
    return connection.execute(
        "SELECT * FROM bookings WHERE day = ? ORDER BY start, id", (day.isoformat(),)
    ).fetchall()


def booking_json(row):
    return {
        "id": row["id"], "roomId": row["room_id"], "start": row["start"],
        "end": row["end"], "name": row["name"], "size": row["size"],
    }


def events_for(room_id, day, bookings, user):
    events = timetable(room_id, day)
    for row in bookings:
        if row["room_id"] == room_id:
            event = {"start": row["start"], "end": row["end"], "type": "booking",
                     "label": "Booked by another student"}
            if row["student"] == user:
                event.update(mine=True, bookingId=row["id"], label="Your booking")
            events.append(event)
    return sorted(events, key=lambda event: event["start"])


def overlaps(event, start, end):
    return event["start"] < end and start < event["end"]


def minutes(clock):
    hours, mins = map(int, clock.split(":"))
    return hours * 60 + mins


@app.get("/api/rooms")
def list_rooms(block: Literal["B", "D", "E"], level: int, date: date, user: Student):
    if level not in (4, 5, 6):
        raise ApiError(400, "BAD_INPUT", "Choose level 4, 5 or 6.")
    with database() as connection:
        bookings = day_bookings(connection, date)
    return [
        {"id": room_id, "type": "lab" if room["room_type"] == "tech_lab" else "classroom",
         "block": block, "level": level, "events": events_for(room_id, date, bookings, user)}
        for room_id, room in ROOMS_BY_ID.items()
        if room["block"] == block and room["level"] == level
    ]


@app.get("/api/bookings/mine")
def my_bookings(date: date, user: Student):
    with database() as connection:
        return [booking_json(row) for row in day_bookings(connection, date) if row["student"] == user]


@app.post("/api/bookings", status_code=201)
def create_booking(body: BookingInput, user: Student):
    if not bookable_day(body.date, datetime.now(CAMPUS).date()):
        raise ApiError(409, "OUTSIDE_BOOKING_WEEK", "Choose a date in the available Monday-Friday booking window.")
    if body.roomId not in ROOMS_BY_ID or not body.name.strip() or body.end <= body.start:
        raise ApiError(400, "BAD_INPUT", "Choose a valid room, name and time range.")
    if minutes(body.end) - minutes(body.start) > 60:
        raise ApiError(409, "MAX_DURATION", "Bookings can last at most 60 minutes.")
    if body.start < "08:00" or body.end > "18:00":
        raise ApiError(409, "OUTSIDE_HOURS", "Rooms can be booked from 08:00 to 18:00.")

    with database() as connection:
        # Acquire the write lock before checking availability or the daily limit.
        connection.execute("BEGIN IMMEDIATE")
        bookings = day_bookings(connection, body.date)
        if sum(row["student"] == user for row in bookings) >= 2:
            raise ApiError(409, "DAILY_LIMIT", "You can have at most 2 bookings per day.")
        for event in events_for(body.roomId, body.date, bookings, user):
            if overlaps(event, body.start, body.end):
                is_class = event["type"] == "class"
                raise ApiError(
                    409, "CLASS_IN_SESSION" if is_class else "ROOM_OCCUPIED",
                    "A class is scheduled for this slot." if is_class else "This slot is already booked.",
                    conflict={key: event[key] for key in ("start", "end", "label")},
                )
        row = {
            "id": f"bk_{uuid4().hex}", "room_id": body.roomId, "day": body.date.isoformat(),
            "start": body.start, "end": body.end, "name": body.name.strip(),
            "size": body.size, "student": user,
        }
        connection.execute("""
            INSERT INTO bookings (id, room_id, day, start, end, name, size, student)
            VALUES (:id, :room_id, :day, :start, :end, :name, :size, :student)
        """, row)
    return booking_json(row)


@app.delete("/api/bookings/{booking_id}", status_code=204)
def cancel_booking(booking_id: str, user: Student):
    with database() as connection:
        deleted = connection.execute(
            "DELETE FROM bookings WHERE id = ? AND student = ?", (booking_id, user)
        )
        if not deleted.rowcount:
            raise ApiError(404, "BOOKING_NOT_FOUND", "This booking could not be found.")
    return Response(status_code=204)


@app.post("/api/chat")
def chat(body: ChatInput, user: Student):
    from google.genai.errors import APIError
    from httpx import HTTPError

    from .chatbot.gemini_service import extract_query

    now = body.now or datetime.now(CAMPUS)
    if now.tzinfo is not None:
        now = now.astimezone(CAMPUS)
    try:
        query = extract_query(body.message, now.isoformat())
        if query is None:
            raise RuntimeError("Empty Gemini result")
    except (APIError, HTTPError, RuntimeError, ValueError):
        raise ApiError(503, "AI_UNAVAILABLE", "The assistant is unavailable. Try again shortly.")

    if query.intent == "other":
        return {"reply": "I can help you find available campus rooms.", "rooms": []}

    day = query.date or now.date()
    today = datetime.now(CAMPUS).date()
    if not bookable_day(day, today):
        return {"reply": "Choose a date in the available Monday-Friday booking window.", "rooms": []}
    start = query.start_time or (max("08:00", now.strftime("%H:%M")) if day == today else "08:00")
    if not re.fullmatch(CLOCK, start):
        return {"reply": "Please specify a start time between 08:00 and 18:00.", "rooms": []}
    default_end = min(minutes(start) + 60, 18 * 60)
    end = query.end_time or f"{default_end // 60:02d}:{default_end % 60:02d}"
    if not re.fullmatch(CLOCK, end) or not ("08:00" <= start < end <= "18:00"):
        return {"reply": "Choose a time range between 08:00 and 18:00.", "rooms": []}
    if minutes(end) - minutes(start) > 60:
        return {"reply": "Choose a time range of up to 60 minutes.", "rooms": []}

    with database() as connection:
        bookings = day_bookings(connection, day)
    options = []
    for room_id, room in ROOMS_BY_ID.items():
        if query.room_id and query.room_id.upper() != room_id:
            continue
        if any(getattr(query, key) is not None and getattr(query, key) != room[key]
               for key in ("block", "level", "room_type")):
            continue
        if room["capacity"] < (query.min_capacity or 0):
            continue
        if not set(query.facilities).issubset(room["facilities"]):
            continue
        events = events_for(room_id, day, bookings, user)
        if any(overlaps(event, start, end) for event in events):
            continue
        free_until = min((event["start"] for event in events if event["start"] >= end), default="18:00")
        options.append((room, free_until))
    options.sort(key=lambda option: option[0]["capacity"])
    options = options[:5]
    if not options:
        return {"reply": "No rooms match that slot. Try another time, block or group size.", "rooms": []}
    lines = [f"Available on {day} from {start}:"]
    for room, free_until in options:
        facilities = ", ".join(room["facilities"]).replace("_", " ")
        lines.append(f"{room['room_id']} ({room['capacity']} seats, {facilities}) - free until {free_until}")
    if query.quiet:
        lines.append("Noise levels are unavailable.")
    lines.append("Bookings last up to 1 hour. Use the booking dialog to confirm your slot.")
    return {"reply": "\n".join(lines), "rooms": [room["room_id"] for room, _ in options]}


app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
