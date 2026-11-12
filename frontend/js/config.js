// The only file you should need to edit to connect the frontend to the real backend.
window.CONFIG = {
  USE_MOCK: false,                    // true = fake in-browser data, false = call the real API
  API_BASE: "/api",
  // Login screen. The student ID the user types is sent to the backend as the X-User-Id header.
  STUDENT_ID_PATTERN: "^TP[0-9]{6}$",   // TP followed by exactly six digits
  bookingWindow(campusNow = new Date(Date.now() + 8 * 60 * 60 * 1000)) {
    const first = new Date(campusNow);
    const weekday = (first.getUTCDay() + 6) % 7;
    if (weekday > 4) first.setUTCDate(first.getUTCDate() + 7 - weekday);
    const last = new Date(first);
    last.setUTCDate(last.getUTCDate() + 4 - (first.getUTCDay() + 6) % 7);
    return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
  },
  // Must match the backend. The server is the source of truth, these only drive the UI.
  RULES: {
    MAX_SESSION_MIN: 60,             // max length of one booking
    MAX_BOOKINGS_PER_DAY: 2,         // per user, per day
    OPEN_MIN: 8 * 60,                // 08:00
    CLOSE_MIN: 18 * 60               // 18:00
  }
};
