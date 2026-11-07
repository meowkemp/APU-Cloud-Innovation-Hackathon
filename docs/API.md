# SpaceFinder API contract

This is the agreement between frontend and backend. As long as both sides follow it, neither team needs to touch the other's code.

- Base URL: `http://localhost:3000/api` (change in `frontend/js/config.js`)
- All bodies are JSON. Times are 24h `"HH:MM"` strings and dates are `"YYYY-MM-DD"`, all in campus local time.
- The frontend has a login screen that asks for a student ID (letters and numbers, 4 to 15 characters, upper-cased). That ID is sent as the `X-User-Id` header on every request and is the user's identity. There is no password and no login endpoint for now, so the backend simply trusts the header. See the Identity section below.
- Room IDs look like `E-04-03` (block E, level 4, classroom 3). Tech labs look like `E-06-L01` and only exist on level 6.

## Business rules (the server must enforce these)

| Rule | Value | Error code |
|---|---|---|
| Max length of one booking | 60 minutes | `MAX_DURATION` |
| Max bookings per user per day | 2 | `DAILY_LIMIT` |
| Bookable hours | 08:00 to 20:00 | `OUTSIDE_HOURS` |
| Room has a scheduled class in that slot | not bookable | `CLASS_IN_SESSION` |
| Room already booked by someone else | not bookable | `ROOM_OCCUPIED` |

The frontend shows pop-ups for these, but it only previews them. The server decides, so two students booking at the same moment cannot both succeed.

## Identity

- Save every booking together with the `X-User-Id` it came from. Use that same value to decide which bookings are the caller's own (`mine: true`, `GET /bookings/mine`), to enforce the 2 per day limit, and to allow only the owner to cancel.
- If a request arrives without the header, or with an ID the server does not accept, return `401` with `{ "code": "UNKNOWN_USER", "message": "..." }`. The frontend then clears the saved ID and shows the login screen again with an error. Accepting any ID is fine for the demo.
- A student can sign in from any browser or device by typing the same ID and will see the same bookings.
- Passwords or tokens are not part of this contract yet. If the team adds them, document the new login endpoint here first so frontend and backend change together.

## Endpoints

### GET /rooms?block=E&level=4&date=2026-11-06

Returns every room on that floor with the day's events. Class events and other users' bookings are both included so the UI can draw the timeline.

```json
[
  {
    "id": "E-04-03",
    "type": "classroom",
    "block": "E",
    "level": 4,
    "events": [
      { "start": "09:00", "end": "11:00", "type": "class", "label": "Data Structures" },
      { "start": "14:00", "end": "15:00", "type": "booking", "label": "Booked by another student" },
      { "start": "16:00", "end": "17:00", "type": "booking", "mine": true, "bookingId": "bk_123", "label": "Your booking" }
    ]
  }
]
```

`type` is `"classroom"` or `"lab"`. Do not send other students' names. Set `mine: true` and `bookingId` only on the caller's own bookings.

### GET /bookings/mine?date=2026-11-06

```json
[ { "id": "bk_123", "roomId": "E-04-03", "start": "16:00", "end": "17:00", "name": "Jun", "size": 4 } ]
```

### POST /bookings

Request

```json
{ "roomId": "E-04-03", "date": "2026-11-06", "start": "16:00", "end": "17:00", "name": "Jun", "size": 4 }
```

`201 Created` returns the booking object. On failure return `409` (or `400` for bad input) with the shape below.

```json
{
  "code": "CLASS_IN_SESSION",
  "message": "Room is not available.",
  "conflict": { "start": "09:00", "end": "11:00", "label": "Data Structures" }
}
```

`conflict` is only needed for `CLASS_IN_SESSION` and `ROOM_OCCUPIED`. The frontend shows `message` for every other code.

### DELETE /bookings/:id

Returns `204 No Content`. Users may only cancel their own bookings.

### POST /chat

The AI assistant. The frontend sends the student's question and the server answers in plain text. The server does the Gemini calls, so the API key never reaches the browser.

Request

```json
{ "message": "Any free room for 6 people in block E at 2pm?", "now": "2026-11-06T13:20:00" }
```

`now` is the student's local time without a timezone. Use it to resolve words like "now" and "later". It is optional, so fall back to the server clock.

`200 OK`

```json
{ "reply": "E-04-06 (30 seats, projector) - free until 17:00\nEach booking is limited to 1 hour, and bookings are confirmed by the system.", "rooms": ["E-04-06", "E-05-08"] }
```

`reply` must be plain text with no markdown, because the UI shows it as is. `rooms` lists room IDs the answer mentions (up to about 5, can be empty). The UI turns each one into a button that opens that room's booking dialog. The chatbot only suggests rooms. Bookings are still made through `POST /bookings`.

If Gemini is down or out of quota, return `503` with `{ "code": "AI_UNAVAILABLE", "message": "..." }`. The UI shows a friendly "try again" message.

## CORS

During development the frontend runs on a different origin (for example `http://localhost:5500`), so the backend needs to allow it and the `X-User-Id` header.
