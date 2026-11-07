// The only file you should need to edit to connect the frontend to the real backend.
window.CONFIG = {
  USE_MOCK: true,                    // true = fake in-browser data, false = call the real API
  API_BASE: "http://localhost:3000/api",
  // Login screen. The student ID the user types is sent to the backend as the X-User-Id header.
  STUDENT_ID_PATTERN: "^[A-Za-z0-9]{4,15}$",   // loosen or tighten to match real student IDs
  // Must match the backend. The server is the source of truth, these only drive the UI.
  RULES: {
    MAX_SESSION_MIN: 60,             // max length of one booking
    MAX_BOOKINGS_PER_DAY: 2,         // per user, per day
    OPEN_MIN: 8 * 60,                // 08:00
    CLOSE_MIN: 20 * 60               // 20:00
  }
};
