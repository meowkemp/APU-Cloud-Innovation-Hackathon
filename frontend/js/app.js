// UI only. All data comes from window.RoomApi (see api.js). Do not call fetch here.
(() => {
  "use strict";
  const R = window.CONFIG.RULES, api = window.RoomApi, OPEN = R.OPEN_MIN, CLOSE = R.CLOSE_MIN;
  const $ = s => document.querySelector(s), pad = n => String(n).padStart(2, "0"), fmt = m => pad(m / 60 | 0) + ":" + pad(m % 60);
  const hit = (a, b, c, d) => a < d && c < b;
  const durLabel = m => m === 60 ? "1h" : m + " min";
  // Shift UTC to Malaysia time so the calendar uses campus dates on every device.
  const campusNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const [firstDay, lastDay] = window.CONFIG.bookingWindow(campusNow);
  const datePicker = $("#fdate");
  const dateLabel = new Intl.DateTimeFormat("en-MY", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC"
  });
  for (const day = new Date(firstDay); day.toISOString().slice(0, 10) <= lastDay; day.setUTCDate(day.getUTCDate() + 1)) {
    const value = day.toISOString().slice(0, 10);
    datePicker.add(new Option(dateLabel.format(day), value));
  }
  datePicker.value = firstDay;
  const n0 = campusNow.getUTCHours() * 60 + campusNow.getUTCMinutes();
  const S = { b: "E", l: 4, t: "all", s: Math.min(Math.max(Math.ceil(n0 / 30) * 30, OPEN), CLOSE - R.MAX_SESSION_MIN),
    d: R.MAX_SESSION_MIN, date: firstDay };
  let floor = [], mine = [], cur, ds, dd, dlgErr = null, sz = 4, nm = "";
  try { nm = localStorage.getItem("spacefinder.name") || ""; } catch (e) {}
  const clash = (r, s, e) => r.events.find(v => hit(v.s, v.e, s, e));
  const nextFree = (r, from, d) => { for (let s = from; s + d <= CLOSE; s += 30) if (!clash(r, s, s + d)) return s; };
  const durOpts = () => { const o = []; for (let m = 30; m <= R.MAX_SESSION_MIN; m += 30) o.push(m); return o; };
  const left = () => R.MAX_BOOKINGS_PER_DAY - mine.length;
  $("#rules").innerHTML = `Rules: <b>${durLabel(R.MAX_SESSION_MIN)}</b> max per session · <b>${R.MAX_BOOKINGS_PER_DAY}</b> bookings per day · <b>20</b> people max per booking · 08:00–18:00 · Monday–Friday only.`;

  let refreshId = 0;
  async function refresh() {
    const id = ++refreshId;
    floor = []; mine = [];
    $("#mine").textContent = "";
    $("#stats").textContent = "";
    $("#grid").innerHTML = `<p class="muted">Loading rooms…</p>`;
    try {
      const result = await Promise.all([api.getRooms({ block: S.b, level: S.l, date: S.date }), api.getMyBookings({ date: S.date })]);
      if (id !== refreshId) return;
      [floor, mine] = result;
      draw();
    } catch (err) {
      if (id !== refreshId) return;
      if (err.status === 401) { api.session.logout(); showLogin(); $("#liErr").textContent = "That ID was not recognised."; return; }
      $("#grid").innerHTML = `<p class="muted">Couldn’t reach the server. Check config.js.</p>`; }
  }
  function seg(el, items, cur, fn, refetch) {
    el.innerHTML = "";
    items.forEach(([v, lab]) => {
      const b = document.createElement("button"); b.className = "chip"; b.textContent = lab; b.setAttribute("aria-pressed", String(v === cur));
      b.onclick = () => { fn(v); refetch ? refresh() : draw(); }; el.append(b);
    });
  }
  function draw() {
    seg($("#fb"), ["B", "D", "E"].map(b => [b, b]), S.b, v => S.b = v, 1);
    seg($("#fl"), [4, 5, 6].map(l => [l, "L" + l]), S.l, v => S.l = v, 1);
    $("#ftw").style.display = S.l === 6 ? "" : "none"; if (S.l !== 6) S.t = "all";
    seg($("#ft"), [["all", "All"], ["room", "Classrooms"], ["lab", "Tech labs"]], S.t, v => S.t = v);
    $("#fs").innerHTML = ""; for (let m = OPEN; m + S.d <= CLOSE; m += 30) $("#fs").add(new Option(fmt(m), m, false, m === S.s));
    $("#fd").innerHTML = ""; durOpts().forEach(m => $("#fd").add(new Option(durLabel(m), m, false, m === S.d)));
    const list = floor.filter(r => S.t === "all" || r.k === S.t), e = S.s + S.d, pc = x => (x - OPEN) / (CLOSE - OPEN) * 100;
    let free = 0; $("#grid").innerHTML = "";
    list.forEach(r => {
      const c = clash(r, S.s, e), st = c ? c.t : "free"; if (st === "free") free++;
      const b = document.createElement("button"); b.className = `box room ${st}`;
      b.innerHTML = `<span class="tag mono">${{ free: "FREE", class: "CLASS", taken: "TAKEN", mine: "YOURS" }[st]}</span><div class="id mono">${r.id}</div>
      <small>${r.k === "lab" ? "Tech lab" : "Classroom"}</small><div class="bar">${r.events.map(v => `<i class="${v.t[0]}" style="left:${pc(v.s)}%;width:${pc(v.e) - pc(v.s)}%"></i>`).join("")}<b style="left:${pc(S.s)}%;width:${pc(e) - pc(S.s)}%"></b></div>`;
      b.onclick = () => { cur = r; ds = S.s; dd = S.d; dlgErr = null; drawDlg(); $("#dlg").showModal(); }; $("#grid").append(b);
    });
    $("#stats").innerHTML = `<span class="pill" style="background:var(--free);color:#1b1a2e">${free} free</span><span class="pill">${list.length - free} busy</span><span class="pill mono">${fmt(S.s)}–${fmt(e)}</span><span class="pill">${left()} of ${R.MAX_BOOKINGS_PER_DAY} bookings left for this date</span>`;
    const ms = [...mine].sort((a, b) => a.s - b.s);
    $("#mine").innerHTML = ms.length ? ms.map(m => `<div class="bk"><div><b class="mono">${m.roomId}</b><br><span class="muted mono">${fmt(m.s)}–${fmt(m.e)}</span></div><button class="x" data-id="${m.id}">✕</button></div>`).join("") : `<p class="muted">Nothing yet. Pick a green room.</p>`;
    document.querySelectorAll("#mine .x").forEach(b => b.onclick = async () => { try { await api.cancelBooking(b.dataset.id); toast("Booking cancelled"); refresh(); } catch (e) { toast(e.message); } });
  }
  datePicker.onchange = () => {
    if (!datePicker.reportValidity()) { datePicker.value = S.date; return; }
    S.date = datePicker.value;
    S.s = OPEN;
    refresh();
  };
  $("#fs").onchange = e => { S.s = +e.target.value; draw(); };
  $("#fd").onchange = e => { S.d = +e.target.value; S.s = Math.min(S.s, CLOSE - S.d); draw(); };

  // Pop-up. Same alert for a client-side preview conflict and for an error returned by the server.
  const alertHTML = (t, label, s, e) => ({
    class: `<div class="alert class"><b>Hold up, there’s a class here.</b><br>${label} runs ${s}–${e}.</div>`,
    taken: `<div class="alert taken"><b>Someone got here first.</b><br>This room is booked by another student ${s}–${e}.</div>`,
    mine: `<div class="alert mine"><b>You already have this one.</b><br>Your booking: ${s}–${e}.</div>` }[t]);
  function errHTML(err) {
    if (err.code === "CLASS_IN_SESSION" && err.conflict) return alertHTML("class", err.conflict.label, err.conflict.start, err.conflict.end);
    if (err.code === "ROOM_OCCUPIED" && err.conflict) return alertHTML("taken", "", err.conflict.start, err.conflict.end);
    return `<div class="alert warn"><b>Can’t book that.</b><br>${err.message}</div>`;
  }
  function drawDlg() {
    const r = cur, c = clash(r, ds, ds + dd), nf = c && c.t !== "mine" ? nextFree(r, ds, dd) : null;
    let h = `<h2 class="mono">${r.id}</h2><p class="muted" style="margin:2px 0 0">${r.k === "lab" ? "Tech lab" : "Classroom"} · Block ${r.b}, Level ${r.l} · ${S.date}</p>`;
    if (dlgErr) h += errHTML(dlgErr);
    if (c) {
      h += alertHTML(c.t, c.label, fmt(c.s), fmt(c.e));
      if (c.t === "mine") h += `<button class="go alt" id="cx">Cancel my booking</button>`;
      else h += nf != null ? `<button class="go" id="nf">Next free: ${fmt(nf)}–${fmt(nf + dd)} →</button>` : `<p class="muted">No free slot of that length left for this date.</p>`;
    } else if (left() <= 0) {
      h += `<div class="alert warn"><b>Daily limit reached.</b><br>You’ve used all ${R.MAX_BOOKINGS_PER_DAY} bookings for this date.</div>`;
    } else {
      h += `<div class="row"><div><label>Start</label><select id="ds"></select></div><div><label>Duration</label><select id="dd"></select></div></div>
      <div class="row"><div><label>Your name</label><input id="nm" placeholder="e.g. Jun" value="${nm.replace(/"/g, "&quot;")}"></div><div><label for="sz">People</label><input id="sz" type="number" min="1" max="20" step="1" required value="${sz}" aria-describedby="sz-limit"><small id="sz-limit" class="muted">Maximum 20 people per booking.</small></div></div>
      <button class="go" id="bk">Book ${fmt(ds)}–${fmt(ds + dd)}</button>`;
    }
    h += `<button class="go alt" style="box-shadow:none;border-style:dashed" id="cl">Close</button>`;
    $("#dlg").innerHTML = h; $("#cl").onclick = () => $("#dlg").close();
    if ($("#ds")) {
      for (let m = OPEN; m + dd <= CLOSE; m += 30) $("#ds").add(new Option(fmt(m), m, false, m === ds));
      durOpts().forEach(m => $("#dd").add(new Option(durLabel(m), m, false, m === dd)));
      $("#ds").onchange = e => { keep(); ds = +e.target.value; dlgErr = null; drawDlg(); };
      $("#dd").onchange = e => { keep(); dd = +e.target.value; ds = Math.min(ds, CLOSE - dd); dlgErr = null; drawDlg(); };
      $("#bk").onclick = async () => {
        if (!$("#sz").reportValidity()) return;
        keep(); if (!nm.trim()) { $("#nm").focus(); toast("Add your name first"); return; }
        try { localStorage.setItem("spacefinder.name", nm); } catch (e) {}
        try { await api.createBooking({ roomId: r.id, date: S.date, s: ds, e: ds + dd, name: nm, size: sz });
          $("#dlg").close(); toast(`Booked ${r.id} · ${fmt(ds)}–${fmt(ds + dd)} 🎉`); refresh();
        } catch (err) { dlgErr = err; drawDlg(); }
      };
    }
    if ($("#nf")) $("#nf").onclick = () => { ds = nf; dlgErr = null; drawDlg(); };
    if ($("#cx")) $("#cx").onclick = async () => { try { await api.cancelBooking(c.bookingId); $("#dlg").close(); toast("Booking cancelled"); refresh(); } catch (e) { toast(e.message); } };
  }
  const keep = () => { if ($("#nm")) nm = $("#nm").value; if ($("#sz")) sz = +$("#sz").value || 1; };
  let tt; function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("on"), 2400); }
  $("#theme").onclick = () => { const d = document.documentElement, dark = d.dataset.theme ? d.dataset.theme === "dark" : matchMedia("(prefers-color-scheme:dark)").matches; d.dataset.theme = dark ? "light" : "dark"; };
  // Used by the chatbot: jump to a room and open its booking dialog.
  async function openRoomById(id) {
    const p = id.split("-"); S.b = p[0]; S.l = +p[1]; S.t = "all";
    await refresh(); const r = floor.find(x => x.id === id);
    if (r) { cur = r; ds = S.s; dd = S.d; dlgErr = null; drawDlg(); $("#dlg").showModal(); }
  }
  window.SpaceFinder = { openRoomById };

  // Login gate. The student ID is stored by api.js and sent to the backend as X-User-Id.
  function showLogin() { $("#login").hidden = false; $("#who").hidden = $("#logout").hidden = true; $("#liId").focus(); }
  function enter() { $("#login").hidden = true; $("#who").hidden = $("#logout").hidden = false; $("#who").textContent = api.session.user(); refresh(); }
  $("#liGo").onclick = () => {
    const v = $("#liId").value.trim().toUpperCase();
    if (!new RegExp(window.CONFIG.STUDENT_ID_PATTERN).test(v)) { $("#liErr").textContent = "Enter TP followed by six digits, for example TP012345."; return; }
    $("#liErr").textContent = ""; api.session.login(v); enter();
  };
  $("#liId").onkeydown = e => { if (e.key === "Enter") $("#liGo").click(); };
  $("#logout").onclick = () => { api.session.logout(); location.reload(); }; // reload also clears the chat and any open state
  if (new RegExp(window.CONFIG.STUDENT_ID_PATTERN).test(api.session.user())) enter();
  else { api.session.logout(); showLogin(); }
})();
