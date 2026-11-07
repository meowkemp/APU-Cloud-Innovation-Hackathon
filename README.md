# SpaceFinder

SpaceFinder is a free classroom finder for students. It shows which rooms are empty so a group can find somewhere to study and book it. The campus has blocks B, D and E, each with levels 4, 5 and 6. Every level has 10 classrooms, and level 6 also has 10 tech labs. A room ID like `E-04-03` means block E, level 4, classroom 3, and tech labs look like `E-06-L01`.

## Booking rules

- A booking lasts at most 1 hour.
- Each user can make at most 2 bookings per day.
- Rooms with a class in session or booked by another user cannot be booked, and the user sees a pop-up explaining why.

## What the app does

- Students sign in with their student ID.
- They filter by block (B, D, E), level (4 to 6), room type, start time and duration, and see which rooms are free, in class, taken by someone else, or booked by themselves.
- Each room card has a small timeline of the day. Clicking a room opens a booking dialog.
- If a room has a class or is already booked, a pop-up explains why and offers the next free slot.
- Bookings are listed on the side and can be cancelled.
- An AI assistant (the "Ask SpaceFinder" button) answers questions like "free room for 6 people in block E at 2pm" and links each suggested room to its booking dialog.
- Light and dark themes, and a layout that works on phones.

## Project layout

```
spacefinder/
  README.md               this file
  .gitignore
  requirements.txt        Python packages for the backend and chatbot
  docs/API.md             the contract between frontend and backend
  frontend/               vanilla HTML, CSS and JS, no build step
    index.html
    css/style.css         all styling
    js/config.js          switch between mock data and the real API
    js/api.js             the only file that fetches data
    js/app.js             room finder and booking UI
    js/chat.js            chatbot UI
  backend/                backend team works here
    README.md
    chatbot/              Gemini assistant (Python)
      gemini_service.py   turns a question into filters, then writes the answer
      mock_data.py        fake room database for testing the chatbot
      try_answer.py       dev script to check Gemini end to end
      .env.example        copy to .env and add your key
      README.md           how to expose it as POST /api/chat
```

## How the two sides stay separate

The frontend and backend only meet at the API described in `docs/API.md`. The frontend never reads backend code, and the backend never needs to touch anything inside `frontend/`.

Backend people can build and test against that document alone. Frontend people can keep working before the backend exists because `frontend/js/config.js` has `USE_MOCK: true`, which serves realistic fake data from inside the browser. When the backend is ready, set it to `false` and make sure `API_BASE` points at the server. No other frontend change is needed.

If either side needs to change the contract, edit `docs/API.md` in the same pull request and tell the other side.

## Running the app

You need a modern browser. For the backend and chatbot you also need Python 3.10 or newer, and Node is only needed for the optional `npx serve` command.

### 1. Frontend only (demo mode)

This is the quickest way to see the app and needs nothing installed. Everything is fake data in the browser, including the chatbot.

1. Make sure `frontend/js/config.js` has `USE_MOCK: true`.
2. Open `frontend/index.html` in a browser, or serve the folder.

```
cd frontend
npx serve . -l 5500
```

Then visit `http://localhost:5500`. Port 5500 is used on purpose, because the backend uses 3000 and `npx serve` would otherwise grab it. VS Code's Live Server extension also works.

The first screen asks for a student ID. In demo mode any ID with 4 to 15 letters or numbers works, such as `TP012345`. Bookings are saved in your own browser only and are kept per ID, so signing in with a different ID in the same browser behaves like a different student. Teammates will not see each other's bookings until the real backend is connected.

### 2. With the real backend

1. Start the backend on port 3000 (see the backend README and the chatbot setup below).
2. In `frontend/js/config.js`, set `USE_MOCK: false` and check that `API_BASE` matches the server address, for example `http://localhost:3000/api`.
3. Serve the frontend as above and reload.
4. If the page says it can't reach the server, check that the backend is running, that the port matches, and that CORS allows your frontend address including the `X-User-Id` header.

To let a teammate on the same Wi-Fi use your running backend, replace `localhost` with your computer's local IP address in `API_BASE`.

### 3. Chatbot setup (backend team)

Check your Python version with `python --version`. Use 3.10 or newer, and 3.11 or 3.12 is the safest choice. The virtual environment lines are optional but recommended, and on Windows Command Prompt use `copy` instead of `cp`.

```
# run these from the repo root (the folder with requirements.txt)
python -m venv .venv
.venv\Scripts\activate          # Mac or Linux  source .venv/bin/activate
pip install -r requirements.txt
cp backend/chatbot/.env.example backend/chatbot/.env
```

Add your Gemini API key to `backend/chatbot/.env`. Never commit that file, since `.gitignore` already excludes it. To check Gemini works, run `python try_answer.py` from inside `backend/chatbot/`, and avoid running it too often because the free tier has a quota. Full details are in `backend/chatbot/README.md`.

### Quick troubleshooting

- A blank room grid with an error message means the frontend can't reach the backend. Check `config.js`, the port and CORS.
- The chat says the assistant is busy, which usually means a Gemini error or quota limit on the server.
- Old demo bookings behave strangely, so clear the site's local storage in the browser.
- Stuck on the login screen means the ID did not match the pattern in `frontend/js/config.js` (`STUDENT_ID_PATTERN`), or the backend returned `401 UNKNOWN_USER`.

## The chatbot

Students can open the "Ask SpaceFinder" button to ask questions like "free room for 6 people in block E at 2pm". The flow is simple.

1. The browser sends the question to `POST /api/chat`.
2. The backend asks Gemini to turn it into filters, finds matching rooms, then asks Gemini to write a short plain text answer.
3. The reply comes back with a list of room IDs, and the UI shows each one as a button that opens that room's booking dialog.

The chatbot only suggests rooms. Real bookings always go through `POST /api/bookings`, so all the booking rules stay in one place. The Gemini key lives only on the server in `backend/chatbot/.env`, never in the frontend. With `USE_MOCK: true` the chat UI replies with fake answers built from the mock timetable, so frontend work does not need a Gemini key or quota.

## For backend people

Everything backend goes in `backend/`. The stack, folder structure and any extra files are up to you. Read `docs/API.md` first. A few things worth knowing.

- The server must enforce the booking rules itself. The frontend only previews them.
- Return the error codes listed in `docs/API.md` so the right pop-up appears.
- Allow CORS from the frontend origin, including the `X-User-Id` header.
- Use the same room ID format and the same 08:00 to 20:00 hours.
- The chatbot code in `backend/chatbot/` is ready to plug in. See its README for the one route you need to add.
- Class timetables are not provided, so seed them from a file or table of your own. Booking checks must consider both timetable classes and existing bookings.

## For frontend people

- Keep all data access inside `js/api.js`. If a screen needs new data, add a function there and document the endpoint in `docs/API.md`.
- Rule values live in `js/config.js` and must match the backend.
- The look is a neo-brutalist theme with light and dark modes. Colors are CSS variables at the top of `css/style.css`.

## What still needs to be done

Tick these off as the team goes. Anyone can edit this list in a small pull request.

### Backend team
- [ ] Pick a stack and set up the server in `backend/`, listening on port 3000 (or tell the frontend team the port)
- [ ] Create the room data for blocks B, D and E (levels 4 to 6, 10 classrooms per level, plus 10 tech labs on level 6) using the ID format in this README
- [ ] Add the class timetable for each room, since none is provided
- [ ] Build `GET /rooms`, `GET /bookings/mine`, `POST /bookings` and `DELETE /bookings/:id` exactly as written in `docs/API.md`
- [ ] Enforce the booking rules on the server (1 hour max, 2 bookings per user per day, 08:00 to 20:00, no overlap with classes or other bookings) and return the documented error codes
- [ ] Enable CORS for the frontend address, including the `X-User-Id` header
- [ ] Use the student ID from the `X-User-Id` header as the user. Save it with each booking, use it for the 2 per day limit and `mine`, and optionally return `401 UNKNOWN_USER` for IDs you do not accept (see the Identity section of `docs/API.md`)
- [ ] Optional if there is time, add real passwords or tokens. This needs a login endpoint added to `docs/API.md` first

### Chatbot owner
- [ ] Add the `/api/chat` route. The code in `backend/chatbot/` is not a server yet, and the chatbot README has a ready FastAPI snippet. FastAPI defaults to port 8000, so run it with `--port 3000` or change `API_BASE` in the frontend config.
- [ ] Handle Gemini quota errors. `call_gemini` only retries server errors, but quota hits are a different error type and will crash the route. The snippet's 503 handler only catches `RuntimeError`, so it needs a small extra `except` for quota errors that also returns the same 503 response.
- [ ] Double-check the model name `gemini-3.5-flash`, because it was not verified to exist. The fallback is `gemini-2.5-flash`.
- [ ] Replace `mock_data.py` with the real room data. It is a separate fake database from the frontend's mock, so the chatbot's answers will only match the booking grid once both read from the real database.
- [ ] Make sure the chatbot's reply stays plain text, because the UI shows it as is

### Frontend (Jun)
- [ ] Switch `USE_MOCK` to `false` and test against the real backend once it is up
- [ ] Add a date picker (the API already accepts a `date`)
- [ ] Test on a phone, including the chat window
- [x] Student ID login screen (done, it sends the ID as `X-User-Id`)
- [ ] If the backend adds passwords or tokens, update the login screen and `api.js` to match
- [ ] Polish and prepare the demo flow

### Everyone
- [ ] Agree on any change to `docs/API.md` before coding it, and update that file in the same pull request
- [ ] Do a full end to end test before the demo (search, book, hit the limit, try a room with a class, ask the chatbot)

## Team workflow

- Work on feature branches and open pull requests into `main`.
- Frontend changes stay in `frontend/` and backend changes stay in `backend/`, so merge conflicts should be rare.
- Anything shared (README, `docs/`) should be edited in a small, focused pull request.
