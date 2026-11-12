# SpaceFinder — Smart Classroom & Tech Lab Booking

An AI-assisted room booking web app built for the **APU Cloud Innovation Hackathon**, designed to help students quickly find and book free classrooms and tech labs across Blocks B, D and E.

## 🎥 Demo Video

<!-- TODO: paste your demo link here -->
https://youtu.be/YOUR_VIDEO_LINK

## Pitch Deck



## Project Overview

SpaceFinder enables students to:

- 🏫 **Find free rooms** in real time across 90 classrooms and 30 tech labs
- 📅 **Book a room** for group study, with booking rules enforced by the server
- 🤖 **Ask in plain English** (e.g. "Any free room for 6 people in block E at 2pm?") and get answers from **Google Gemini**
- 🗂️ **Manage bookings** — view and cancel your own bookings at any time

## Project Structure

```
APU-Cloud-Innovation-Hackathon/
├── README.md
├── requirements.txt
├── backend/
│   ├── main.py                 ← FastAPI app: rooms, bookings, chat (also serves the frontend)
│   ├── bookings.sqlite3        ← SQLite database (created automatically, not committed)
│   ├── README.md               ← Detailed backend notes
│   └── chatbot/
│       ├── gemini_service.py   ← Gemini client + fallback model
│       ├── mock_data.py        ← Room catalogue (classrooms and labs)
│       ├── try_answer.py       ← Standalone script to test Gemini
│       ├── .env.example        ← Copy to .env and add your API key
│       └── README.md           ← Chatbot notes
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js              ← UI logic
│       ├── api.js              ← API calls (real or mock)
│       ├── chat.js             ← Ask SpaceFinder chat
│       └── config.js           ← API address, mock mode and booking rules
└── docs/
    └── API.md                  ← API contract between frontend and backend
```

## Architecture

```
Browser (HTML / CSS / JS)
        │  X-User-Id header
        ▼
FastAPI backend  ──►  SQLite (bookings)
        │
        └──►  Gemini API (interprets chat questions; the key stays on the server)
```

The backend serves both the API and the frontend from the same port, so no separate frontend server is needed. Gemini only interprets the question. The answer itself is built from the same timetable and bookings that drive the room grid, so replies always match what you see on screen.

## Setup

> Run all commands from the **project root folder**. Requires **Python 3.10 or newer** (tested on 3.13).

### 1. Install dependencies

Optional but recommended: create a virtual environment first.

Windows (PowerShell):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Mac/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

### 2. Set your Gemini API key (for Ask SpaceFinder)

Get a free key from [Google AI Studio](https://aistudio.google.com/), then copy the example file:

Windows (PowerShell):

```powershell
Copy-Item backend\chatbot\.env.example backend\chatbot\.env
```

Mac/Linux:

```bash
cp backend/chatbot/.env.example backend/chatbot/.env
```

Open `backend/chatbot/.env` and set `GEMINI_API_KEY`. Never commit this file. You can also set `GEMINI_API_KEY` as a normal environment variable instead.

> Booking works without a key. Only the Ask SpaceFinder chat needs it.

### 3. Run the app

```bash
python -m uvicorn backend.main:app --port 3000
```

Open **http://localhost:3000** and sign in with a demo student ID such as `TP012345` (`TP` followed by exactly six digits).

To share a demo on a trusted Wi-Fi network, add `--host 0.0.0.0` and give teammates your computer's IP address and port 3000.

### Browser-only demo (no backend)

Set `USE_MOCK: true` in `frontend/js/config.js` and open `frontend/index.html`. This uses fake in-browser data and does not need Python or a Gemini key.

## Features

| Feature | What it does |
|---|---|
| 🔐 Student ID login | Sign in with a student ID (`TP` + 6 digits). The ID identifies your bookings across browsers and devices |
| 🏫 Room Grid | Filter by date, block (B, D, E), level, type, start time and duration to see which rooms are free |
| 📅 Booking | Book a room with your name and group size (1–20). The server checks every rule before confirming |
| 🗂️ My Bookings | See and cancel your own bookings. Cancelling frees the room slot and your daily allowance |
| 🤖 Ask SpaceFinder | Ask in plain English. Gemini interprets the question and the reply suggests rooms you can open straight into the booking dialog |
| 🌗 Light/dark theme | Toggle the theme from the header |

## Booking Rules

The server enforces these rules (the frontend only previews them):

| Rule | Value |
|---|---|
| Max length of one booking | 60 minutes |
| Max bookings per student per day | 2 |
| Bookable hours | 08:00 – 18:00 |
| Bookable dates | Today through Friday on weekdays. The upcoming Monday–Friday on weekends (Malaysia time) |
| Room has a scheduled class | Not bookable |
| Room already booked | Not bookable (no overlaps) |

Full request and response examples are in [`docs/API.md`](docs/API.md).

## Configuration

| Setting | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `backend/chatbot/.env` or environment | Enables Ask SpaceFinder |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | `backend/chatbot/.env` | Primary and backup Gemini models |
| `SPACEFINDER_DB` | environment | Use a different SQLite file path (parent folder must exist and be writable) |
| `SPACEFINDER_ORIGINS` | environment | Comma-separated list of allowed CORS origins (defaults to port 5500 on localhost) |
| `API_BASE` | `frontend/js/config.js` | Full API address if the frontend runs on a separate server |

## Tech Stack

- **Backend:** Python, FastAPI, Uvicorn, Pydantic, SQLite
- **AI:** Google Gemini (`google-genai`)
- **Frontend:** HTML, CSS, vanilla JavaScript

## Known Limitations (Demo)

- Room capacities, facilities and weekday class timetables are **generated demo data**, not real APU data.
- Identity is a typed student ID with **no password**. Anyone entering the same ID shares access to that student's bookings. Please use **fictional IDs**.
- If Gemini is unavailable or its quota is used up, the chat returns a friendly "try again" message and booking still works.
- All server processes must use the same local SQLite file.

## Team

Women in STEM

### Team Members

- Liew Jia Xin
- Hang Xiu Jun
- Kishanea A/P Jeyakumar
- Nicole Vrinda De Silva
- Dharrsini A/P Jayagandan