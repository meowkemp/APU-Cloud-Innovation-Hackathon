# Chatbot (Gemini)

This folder holds the AI assistant logic. It is not a server by itself, so it needs one route to be reachable from the frontend.

## Setup

```
# run these from the repo root (the folder with requirements.txt)
python -m venv .venv
.venv\Scripts\activate        # on Mac or Linux use  source .venv/bin/activate
pip install -r requirements.txt
cp backend/chatbot/.env.example backend/chatbot/.env   # then add your Gemini key
```

To check Gemini works end to end, run `python try_answer.py` from inside `chatbot/`. Go easy on it, because the free tier has a quota.

## What the files do

- `gemini_service.py` has `extract_query` (question to filters) and `write_answer` (rooms to a short reply). It retries on server errors and falls back to a backup model.
- `mock_data.py` has `fake_find_free_rooms`, a stand-in for the real database. Replace it with a real query once the booking data exists. Room IDs use the project format, such as `E-04-03` and `E-06-L01`.

## Connecting it to the frontend

Add this route to your server (adapt freely). It follows the `POST /chat` section of `../../docs/API.md`.

```python
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from chatbot.gemini_service import extract_query, write_answer
from chatbot.mock_data import fake_find_free_rooms

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])  # tighten for production

class ChatIn(BaseModel):
    message: str
    now: str | None = None

@app.post("/api/chat")
def chat(body: ChatIn):
    try:
        f = extract_query(body.message, body.now or datetime.now().isoformat())
        rooms = fake_find_free_rooms(f)[:5] if f.intent != "other" else []
        return {"reply": write_answer(body.message, rooms), "rooms": [r["room_id"] for r in rooms]}
    except RuntimeError:
        return JSONResponse(status_code=503, content={"code": "AI_UNAVAILABLE", "message": "Assistant is busy"})
```

Run it with `uvicorn main:app --port 3000` from `backend/`, or use another port and update `API_BASE` in the frontend config.

## Things to know

- Gemini quota errors are a different error type from the server errors that `call_gemini` retries, so a quota hit currently raises straight through. Catch it in the route and return the same 503.
- Confirm the model names in `.env` against what your key can access.
- The prompt in `LAYOUT` hard-codes the campus layout and booking rules. Keep it in sync with `docs/API.md` if the rules change.
