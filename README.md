# SpaceFinder

SpaceFinder is a campus room finder and booking app built for the **APU Cloud Innovation Hackathon**. Students can check when classrooms and tech labs are free, reserve a time for their group, and ask Google Gemini to help find a suitable room.

## 🎥 Demo Video
```
https://drive.google.com/drive/folders/1s8xHHRRGwLA6KctSAlR8juae8i84gXU4?usp=sharing
```

## Project Overview

SpaceFinder helps students find a place to meet between classes or plan a group session later in the week. The prototype covers **90 classrooms and 30 tech labs** across Blocks **B, D and E**, on Levels **4, 5 and 6**. The room catalogue and class timetable are sample data for the hackathon.

## Features

| Feature | What it does |
|---|---|
| Student ID entry | Enter `TP` followed by six digits, such as `TP012345`. The same ID shows the same bookings on any browser or device. |
| Room finder | Filter by date, block, level, room type, start time, and duration. The grid shows whether each room is free, in class, taken, or booked by you. |
| Advance booking | Choose a date in the available Monday–Friday window. The room grid and **My bookings** follow the selected date. |
| Class conflict alerts | Open a room marked **CLASS** to see the class and its time. SpaceFinder offers the next free slot when one fits your selected duration. |
| Booking and cancellation | Reserve a slot for your group or cancel it from **My bookings**. SQLite saves bookings across server restarts. |
| Ask SpaceFinder | Ask a question such as "Find a free room for six people in Block E at 2 pm." Gemini interprets the request, and SpaceFinder checks its timetable and bookings for matches. |
| Light/dark theme | Toggle the theme from the page header. |

## Booking Rules

The server enforces these rules. The frontend only previews them.

| Rule | Limit |
|---|---|
| Available dates | Today through Friday on weekdays. On Saturday and Sunday, the upcoming Monday–Friday window opens. Dates use Malaysia time. |
| Campus hours | **8:00 am–6:00 pm**. All sessions must end by 6:00 pm. |
| Duration | Up to **1 hour** per booking. |
| Group size | **1–20 people** per booking. |
| Daily limit | **2 active bookings** per student per date. Cancelling restores one booking allowance for that date. |
| Room conflicts | A booking cannot overlap a scheduled class or another booking. |

## Tech Stack

- **Backend:** Python, FastAPI, Uvicorn, Pydantic, SQLite
- **AI:** Google Gemini (`google-genai`)
- **Frontend:** HTML, CSS, vanilla JavaScript

## Project Structure

```text
APU-Cloud-Innovation-Hackathon-main/
├── README.md
├── requirements.txt
├── frontend/
│   ├── index.html               # SpaceFinder web page
│   ├── css/
│   │   └── style.css            # Layout and themes
│   └── js/
│       ├── app.js               # Room filters, booking form and sign-in
│       ├── api.js               # API requests and mock mode
│       ├── chat.js              # Ask SpaceFinder interface
│       └── config.js            # API settings and booking window
├── backend/
│   ├── main.py                  # FastAPI, timetable and booking logic
│   ├── README.md                # Backend setup and configuration
│   └── chatbot/
│       ├── .env.example         # Template for local Gemini settings
│       ├── gemini_service.py    # Gemini request and question parsing
│       ├── mock_data.py         # Sample room inventory and chatbot test data
│       └── try_answer.py        # Standalone Gemini test
└── docs/
    └── API.md                   # API contract
```

## Setup

### 1. Install dependencies

Install Python 3.10 or newer (tested on 3.13). Open a terminal in the project folder that contains `requirements.txt`. A virtual environment is optional but recommended.

**Windows (PowerShell):**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

**Mac/Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

### 2. Configure Google Gemini

This step enables **Ask SpaceFinder**. Room search through the filters and booking work without a Gemini key.

1. Sign in to [Google AI Studio](https://aistudio.google.com/apikey) and create or copy a Gemini API key.
2. Copy `backend/chatbot/.env.example` to `backend/chatbot/.env`.
3. Open the new `.env` file and enter your key.

```dotenv
GEMINI_API_KEY=your-api-key-here
```

Keep your real key in the local `.env` file, which Git ignores. Never put it in `.env.example`. If the server is already running, restart it after changing the key.

### 3. Run the app

```bash
python -m uvicorn backend.main:app --port 3000
```

Open [SpaceFinder on port 3000](http://127.0.0.1:3000/) and sign in with `TP012345`. Uvicorn serves both the website and the API through the same port.

To share a demo on a trusted Wi-Fi network, add `--host 0.0.0.0` and give teammates your computer's IP address and port 3000.

### Browser-only demo (no backend)

Set `USE_MOCK: true` in `frontend/js/config.js` and open `frontend/index.html`. This uses fake in-browser data and needs no Python or Gemini key.

## Configuration

| Setting | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `backend/chatbot/.env` or environment | Enables Ask SpaceFinder |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | `backend/chatbot/.env` | Primary and backup Gemini models |
| `SPACEFINDER_DB` | environment | Use a different SQLite file path (the parent folder must exist and be writable) |
| `SPACEFINDER_ORIGINS` | environment | Comma-separated list of allowed CORS origins (defaults to port 5500 on localhost) |
| `API_BASE` | `frontend/js/config.js` | Full API address if the frontend runs on a separate server |

## Hackathon Demo

1. Sign in as `TP012345` and choose an available date.
2. Pick a block and time. Open a room marked **CLASS** to see the conflict and try **Next free** when the button appears.
3. Reserve a free slot for six people and confirm it appears under **My bookings** for the selected date.
4. Open **Ask SpaceFinder** and ask for a room for six in Block E at 2 pm. Choose a room suggestion and confirm the date and time in the booking form before submitting.

## How It Works

The browser calls the **FastAPI** backend to load room availability and manage bookings. FastAPI checks the sample class timetable and **SQLite** reservations before saving a booking. It checks availability and saves the reservation in a single transaction to prevent double bookings.

The **Google Gemini API** turns room questions into search filters. SpaceFinder checks its own data for matching rooms, and the student confirms any reservation in the booking form. The Gemini key stays on the server and never reaches the browser.

See the [API contract](docs/API.md) for endpoints, request formats, and error codes. See the [backend guide](backend/README.md) for configuration options.

## Demo Data and Limitations

- SpaceFinder generates a sample weekday timetable. A campus pilot would need the official APU timetable and verified campus sign-in.
- The prototype uses the student ID as the booking identity, with no password. Anyone who enters the same ID shares that student's bookings, so use fictional IDs during demos.
- If Gemini is unavailable or its quota is used up, Ask SpaceFinder shows a "try again" message. Booking still works.
- The server stores reservations in `backend/bookings.sqlite3`. All server processes must use the same local database file.
- To carry your local setup into a newly extracted copy, move or copy your `.env` and SQLite database to the matching locations while the server is stopped.

## Team

Women in STEM

### Team Members

- Liew Jia Xin
- Hang Xiu Jun
- Kishanea A/P Jeyakumar
- Nicole Vrinda De Silva
- Dharrsini A/P Jayagandan
