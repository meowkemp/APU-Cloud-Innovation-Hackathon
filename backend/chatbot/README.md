# Ask SpaceFinder

The backend exposes `POST /api/chat`. See [backend setup](../README.md) to configure the Gemini key and start the server. The route interprets a question with Gemini and checks the live timetable and booking database. It returns plain text plus up to five room IDs. If Gemini is unavailable or its quota is exhausted, the route returns `503 AI_UNAVAILABLE`.

The standalone `try_answer.py` script still uses the sample chatbot data for experimenting with Gemini independently of the server.
