# Backend guide

This folder is for the backend team. The stack and structure are up to you, but the notes below assume Python with FastAPI because the chatbot code in `chatbot/` is already Python.

## Where things stand

The frontend, the chatbot logic and the API contract (`../docs/API.md`) exist. There is no server yet, so nothing listens for requests. The frontend only works today because `USE_MOCK: true` in `frontend/js/config.js` fakes the server inside the browser. The job of this folder is to build the real server so that flag can be switched off.

## What needs to be built

1. **`main.py`** creates the FastAPI app, turns on CORS (including the `X-User-Id` header) and registers the routes below. This is the file that gets started.
2. **Room and timetable data.** Room IDs can be generated from the campus rules (blocks B, D, E, levels 4 to 6, 10 classrooms per level, plus 10 tech labs on level 6). IDs look like `E-04-03` and `E-06-L01`. The class timetable has to come from somewhere, for example a `data/timetable.json` that the team fills in.
3. **Booking storage.** An in-memory list or a small SQLite file is enough for a hackathon.
4. **The five routes** described in `../docs/API.md`.
   - `GET /api/rooms`
   - `GET /api/bookings/mine`
   - `POST /api/bookings`
   - `DELETE /api/bookings/{id}`
   - `POST /api/chat`
5. **A booking checker.** One function that applies every rule and returns the documented error code, used by `POST /bookings`.
   - 1 hour maximum per booking (`MAX_DURATION`)
   - 2 bookings per user per day (`DAILY_LIMIT`)
   - bookable only from 08:00 to 20:00 (`OUTSIDE_HOURS`)
   - no overlap with a class (`CLASS_IN_SESSION`) or another booking (`ROOM_OCCUPIED`)
6. **Connect the chatbot to the real data.** `chatbot/mock_data.py` is a fake database. `/chat` should search the same rooms and bookings as the other routes so the bot never suggests a room that the booking grid shows as taken.
7. **Dependencies.** `fastapi` and `uvicorn` are listed in `requirements.txt` at the repo root, so one install covers everything. Add any new packages there.

A suggested layout is below.

```
backend/
  main.py             app, CORS and routes
  rules.py            booking validation
  store.py            rooms, timetable and bookings
  data/timetable.json class schedule per room
  chatbot/            already here (Gemini logic)
```

8. **User identity.** The frontend login screen sends the student ID in the `X-User-Id` header. Save it with every booking and use it for the 2 per day limit, for `mine` and for cancelling. Return `401 UNKNOWN_USER` for IDs you do not accept, or accept any ID for the demo. Details are in the Identity section of `../docs/API.md`.

## Setup

Everyone should use Python 3.10 or newer, and 3.11 or 3.12 is the safest choice. Check yours with `python --version`.

```
# run these from the repo root (the folder with requirements.txt)
python -m venv .venv
.venv\Scripts\activate          # Mac or Linux  source .venv/bin/activate
pip install -r requirements.txt
cp backend/chatbot/.env.example backend/chatbot/.env
```

Add the Gemini API key to `backend/chatbot/.env`. Never commit that file. To check that Gemini works, run `python try_answer.py` from inside `chatbot/`, and avoid running it often because the free tier has a quota.

## Starting the server

FastAPI apps are launched with uvicorn. With the virtual environment active, run this from inside `backend/` so that `from chatbot.gemini_service import ...` resolves.

```
uvicorn main:app --reload --port 3000
```

Port 3000 matches `API_BASE` in the frontend config. If you use another port, tell the frontend team. If you would rather type `python main.py`, add this to the bottom of `main.py`.

```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", port=3000, reload=True)
```

Once it is running, open `http://localhost:3000/docs`. FastAPI generates a page there where every route can be tested without the frontend.

## Connecting the frontend

1. In `frontend/js/config.js`, set `USE_MOCK: false`.
2. Make sure `API_BASE` is `http://localhost:3000/api`.
3. Serve the frontend (see the main README) and reload the page.

If the page cannot reach the server, check that the backend is running, that the port matches and that CORS allows the frontend address (for example `http://localhost:5500`).

## Chatbot notes

The chatbot route snippet, the quota error note and the model name check are in `chatbot/README.md`. The short version is that quota errors are a different error type from the ones `call_gemini` retries, so catch them in the route and return the same 503 response described in `../docs/API.md`.

## Done checklist

- [ ] `main.py` starts with uvicorn and `/docs` loads
- [ ] Rooms and timetable data exist for blocks B, D and E
- [ ] All five routes follow `../docs/API.md`
- [ ] Booking rules are enforced on the server with the right error codes
- [ ] Bookings are saved per `X-User-Id` and the daily limit uses it
- [ ] CORS works from the frontend address
- [ ] `/chat` uses the real room data and handles Gemini errors
- [ ] The frontend works with `USE_MOCK: false`
