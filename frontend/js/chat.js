// Chatbot UI. Talks to the backend only through window.RoomApi.chat (see api.js and docs/API.md).
(() => {
  "use strict";
  const api = window.RoomApi, $ = s => document.querySelector(s);
  const panel = $("#chat"), fab = $("#chatFab"), M = $("#chatM"), IN = $("#chatIn"), GO = $("#chatGo"), SUG = $("#chatS");
  const SUGGESTIONS = ["Free room for 6 people in block E at 2pm", "Tech lab with computers", "Free classroom on level 5 now", "Can I book E-04-03 at 3pm?"];
  let busy = false, greeted = false;

  function scroll() { M.scrollTop = M.scrollHeight; }
  function add(text, who) {
    const d = document.createElement("div"); d.className = "msg " + who; d.textContent = text; // textContent on purpose, never innerHTML
    M.append(d); scroll(); return d;
  }
  function roomChips(ids) {
    if (!ids || !ids.length) return;
    const w = document.createElement("div"); w.className = "chips";
    ids.forEach(id => {
      const b = document.createElement("button"); b.className = "chip mono"; b.textContent = id + " →";
      b.onclick = () => window.SpaceFinder.openRoomById(id); w.append(b);
    });
    M.append(w); scroll();
  }
  async function send(text) {
    text = (text || "").trim(); if (!text || busy) return;
    busy = true; GO.disabled = true; IN.value = ""; SUG.hidden = true;
    add(text, "me"); const bubble = add("Thinking…", "bot");
    try {
      const res = await api.chat({ message: text });
      bubble.textContent = res.reply || "Sorry, I didn’t get an answer."; roomChips(res.rooms);
    } catch (err) {
      bubble.textContent = err.status === 503 || err.status === 429 ? "The assistant is busy right now. Try again in a moment." : "Couldn’t reach the assistant. Is the backend running?";
    } finally { busy = false; GO.disabled = false; IN.focus(); }
  }
  function open() {
    panel.hidden = false; fab.hidden = true;
    if (!greeted) { greeted = true; add("Hi! Ask me for a free room, like “free room for 6 people in block E at 2pm”. I can only help with finding and booking rooms.", "bot"); }
    IN.focus();
  }
  function close() { panel.hidden = true; fab.hidden = false; }

  SUGGESTIONS.forEach(t => { const b = document.createElement("button"); b.className = "chip"; b.textContent = t; b.onclick = () => send(t); SUG.append(b); });
  fab.onclick = open; $("#chatX").onclick = close;
  GO.onclick = () => send(IN.value);
  IN.onkeydown = e => { if (e.key === "Enter") send(IN.value); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden && !$("#dlg").open) close(); });
})();
