// Data layer. app.js talks ONLY to window.RoomApi and never to fetch/localStorage directly.
// The wire format is documented in docs/API.md. Times on the wire are "HH:MM" strings.
(() => {
  const { USE_MOCK, API_BASE, RULES } = window.CONFIG;
  const toMin = t => { const [h, m] = t.split(":"); return +h * 60 + +m; };
  const toHM = m => String(m / 60 | 0).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  // Identity comes from the login screen (student ID). It is sent to the backend as X-User-Id.
  const userId = () => store.get("spacefinder.uid", "");

  const localISO = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

  // Convert wire format to what the UI uses (minutes, and event type class/taken/mine).
  const normRoom = r => ({ id: r.id, k: r.type === "lab" ? "lab" : "room", b: r.block, l: r.level,
    events: r.events.map(e => ({ s: toMin(e.start), e: toMin(e.end), label: e.label, bookingId: e.bookingId,
      t: e.type === "class" ? "class" : e.mine ? "mine" : "taken" })) });
  const normBooking = b => ({ id: b.id, roomId: b.roomId, s: toMin(b.start), e: toMin(b.end), name: b.name, size: b.size });

  // ---------- REAL BACKEND ----------
  async function http(path, opts = {}) {
    const res = await fetch(API_BASE + path, { ...opts, headers: { "Content-Type": "application/json", "X-User-Id": userId() } });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error((body && body.message) || "Request failed"), { code: body && body.code, conflict: body && body.conflict, status: res.status });
    return body;
  }
  const real = {
    getRooms: ({ block, level, date }) => http(`/rooms?block=${block}&level=${level}&date=${date}`),
    getMyBookings: ({ date }) => http(`/bookings/mine?date=${date}`),
    createBooking: b => http("/bookings", { method: "POST", body: JSON.stringify(b) }),
    cancelBooking: id => http(`/bookings/${id}`, { method: "DELETE" }),
    chat: b => http("/chat", { method: "POST", body: JSON.stringify(b) })
  };

  // ---------- MOCK (fake data so the UI works with no backend) ----------
  const COURSES = ["Data Structures", "Calculus II", "Intro to AI", "Database Systems", "Web Dev", "Networks", "Software Eng", "Linear Algebra", "OS Concepts", "HCI Studio"];
  const pad = n => String(n).padStart(2, "0");
  const overlap = (a, b, c, d) => a < d && c < b;
  const roomIds = (b, l) => {
    const out = []; for (let n = 1; n <= 10; n++) out.push({ id: `${b}-${pad(l)}-${pad(n)}`, type: "classroom" });
    if (l === 6) for (let n = 1; n <= 10; n++) out.push({ id: `${b}-06-L${pad(n)}`, type: "lab" });
    return out;
  };
  const seeded = (id, date) => {
    let s = 0; for (const ch of id + date) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const ev = [], add = (type, label) => {
      for (let i = 0; i < 8; i++) {
        const st = RULES.OPEN_MIN + 30 * Math.floor(rnd() * 20), d = type === "class" ? (rnd() < .5 ? 90 : 120) : 60;
        if (st + d <= RULES.CLOSE_MIN && !ev.some(e => overlap(e.s, e.e, st, st + d))) { ev.push({ s: st, e: st + d, type, label }); return; }
      }
    };
    const nc = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < nc; i++) add("class", COURSES[Math.floor(rnd() * COURSES.length)]);
    if (rnd() < .55) add("booking", "Booked by another student");
    return ev.map(e => ({ start: toHM(e.s), end: toHM(e.e), type: e.type, label: e.label }));
  };
  const allBk = () => store.get("spacefinder.mock.bookings", []);          // every booking made in this browser
  const myBk = () => allBk().filter(b => b.uid === userId());              // only the logged in user's
  const fail = (code, message, conflict) => Promise.reject(Object.assign(new Error(message), { code, conflict, status: 409 }));
  const mock = {
    getRooms: async ({ block, level, date }) => roomIds(block, level).map(r => ({ ...r, block, level,
      events: [...seeded(r.id, date), ...allBk().filter(b => b.roomId === r.id && b.date === date).map(b => b.uid === userId() ? { start: b.start, end: b.end, type: "booking", mine: true, bookingId: b.id, label: "Your booking" } : { start: b.start, end: b.end, type: "booking", label: "Booked by another student" })] })),
    getMyBookings: async ({ date }) => myBk().filter(b => b.date === date),
    createBooking: async b => {
      const s = toMin(b.start), e = toMin(b.end), mineToday = myBk().filter(x => x.date === b.date);
      if (e - s > RULES.MAX_SESSION_MIN) return fail("MAX_DURATION", `Bookings are limited to ${RULES.MAX_SESSION_MIN} minutes.`);
      if (s < RULES.OPEN_MIN || e > RULES.CLOSE_MIN) return fail("OUTSIDE_HOURS", "Rooms are open 08:00 to 20:00.");
      if (mineToday.length >= RULES.MAX_BOOKINGS_PER_DAY) return fail("DAILY_LIMIT", `You can book at most ${RULES.MAX_BOOKINGS_PER_DAY} sessions per day.`);
      const hit = [...seeded(b.roomId, b.date), ...allBk().filter(x => x.roomId === b.roomId && x.date === b.date)].find(v => overlap(toMin(v.start), toMin(v.end), s, e));
      if (hit) return fail(hit.type === "class" ? "CLASS_IN_SESSION" : "ROOM_OCCUPIED", "Room is not available.", { start: hit.start, end: hit.end, label: hit.label });
      const rec = { id: "bk_" + Date.now(), uid: userId(), ...b }; store.set("spacefinder.mock.bookings", [...allBk(), rec]); return rec;
    },
    cancelBooking: async id => { store.set("spacefinder.mock.bookings", allBk().filter(b => !(b.id === id && b.uid === userId()))); return null; },
    // Fake assistant so the chat UI works without the Gemini backend.
    chat: async ({ message }) => {
      await new Promise(r => setTimeout(r, 700));
      const m = message.toLowerCase();
      if (!/(room|lab|free|book|class|study|seat|space|quiet)/.test(m)) return { reply: "I can only help with finding and booking rooms.", rooms: [] };
      const blk = (m.match(/block\s*([bde])\b/) || [])[1], lab = /\blab/.test(m), t = m.match(/(\d{1,2})\s*(am|pm)/), n = new Date();
      let s = t ? (+t[1] % 12 + (t[2] === "pm" ? 12 : 0)) * 60 : n.getHours() * 60 + n.getMinutes();
      s = Math.min(Math.max(Math.ceil(s / 30) * 30, RULES.OPEN_MIN), RULES.CLOSE_MIN - 60);
      const date = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`, found = [];
      for (const b of blk ? [blk.toUpperCase()] : ["B", "D", "E"]) for (const l of [4, 5, 6]) for (const r of roomIds(b, l)) {
        if (lab !== (r.type === "lab")) continue;
        const ev = [...seeded(r.id, date), ...allBk().filter(x => x.roomId === r.id && x.date === date)];
        if (!ev.some(v => overlap(toMin(v.start), toMin(v.end), s, s + 60))) found.push(r.id);
      }
      const pick = found.slice(0, 4), tail = "Each booking is limited to 1 hour, and bookings are confirmed by the system.";
      return { reply: pick.length ? pick.map(id => `${id} - free ${toHM(s)} to ${toHM(s + 60)}`).join("\n") + "\n" + tail : "No rooms match that time. Try another time or block.", rooms: pick };
    }
  };

  const impl = USE_MOCK ? mock : real;
  window.RoomApi = {
    session: { user: userId, login: id => store.set("spacefinder.uid", id.trim().toUpperCase()), logout: () => store.set("spacefinder.uid", "") },
    getRooms: async p => (await impl.getRooms(p)).map(normRoom),
    getMyBookings: async p => (await impl.getMyBookings(p)).map(normBooking),
    createBooking: ({ roomId, date, s, e, name, size }) => impl.createBooking({ roomId, date, start: toHM(s), end: toHM(e), name, size }),
    cancelBooking: id => impl.cancelBooking(id),
    // Sends the browser's local time so "now" and "later" resolve correctly for the student.
    chat: ({ message }) => impl.chat({ message, now: localISO() })
  };
})();
