const NAME = "Rilla_AI";
const IMG = "https://res.cloudinary.com/dqqyvozdw/image/upload/v1795019598/ytkzz1bnbdeeisalvkv7.png";
const SUGGESTIONS = [
  ["fa-bug", "Help me debug this error in my code"],
  ["fa-code", "Explain how loops work with a simple example"],
  ["fa-lightbulb", "Explain recursion like I'm a beginner"],
  ["fa-graduation-cap", "Review my code and suggest improvements"],
];
const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const AV = `<img class="av" src="${IMG}" alt="${NAME}">`;
let chats = [], cur = null, busy = false;
try { chats = JSON.parse(localStorage.getItem("rilla_chats") || "[]"); } catch { chats = []; }
const save = () => { try { localStorage.setItem("rilla_chats", JSON.stringify(chats)); } catch {} };
const chat = () => chats.find((c) => c.id === cur);

/* image fallback */
function fb(img) {
  const s = document.createElement("span");
  s.className = img.className; s.textContent = NAME[0];
  img.replaceWith(s);
}
document.addEventListener("error", (e) => { if (e.target.tagName === "IMG" && e.target.classList.contains("av")) fb(e.target); }, true);
document.querySelectorAll("img.av").forEach((i) => { if (i.complete && !i.naturalWidth) fb(i); });

/* formatting */
function fmt(t) {
  const blocks = [];
  t = t.replace(/```([\w+#-]*)[^\S\n]*\n?([\s\S]*?)```/g, (_, l, c) => {
    blocks.push(`<div class="cb"><div class="ch"><span>${esc(l || "code")}</span><button class="cc"><i class="fa-regular fa-copy"></i> Copy code</button></div><pre><code>${esc(c.replace(/\n$/, ""))}</code></pre></div>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  t = esc(t);
  const inl = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  let out = "", list = null, m;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const ln of t.split("\n")) {
    if ((m = ln.match(/^#{1,4}\s+(.*)/))) { close(); out += `<h4>${inl(m[1])}</h4>`; }
    else if ((m = ln.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { close(); out += "<ul>"; list = "ul"; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out += "<ol>"; list = "ol"; } out += `<li>${inl(m[1])}</li>`; }
    else if (!ln.trim()) close();
    else if (/^\u0000\d+\u0000$/.test(ln.trim())) { close(); out += ln.trim(); }
    else { close(); out += `<p>${inl(ln)}</p>`; }
  }
  close();
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
}

/* rendering */
function botRow(m, i, isErr) {
  const d = document.createElement("div");
  d.className = "row bot" + (isErr ? " err" : "");
  const bar = isErr ? "" : `<div class="bar"><button class="cp" title="Copy"><i class="fa-regular fa-copy"></i></button><span>${m.time || ""}</span>
    <button class="vote ${m.fb === "up" ? "on" : ""}" data-i="${i}" data-v="up" title="Good"><i class="fa-regular fa-thumbs-up"></i></button>
    <button class="vote ${m.fb === "down" ? "on" : ""}" data-i="${i}" data-v="down" title="Bad"><i class="fa-regular fa-thumbs-down"></i></button></div>`;
  d.innerHTML = `${AV}<div class="body"><div class="txt">${fmt(m.content)}</div>${bar}</div>`;
  d._raw = m.content;
  return d;
}
function render() {
  const box = $("msgs"), c = chat();
  box.innerHTML = "";
  if (!c || !c.messages.length) {
    box.innerHTML = `<div class="welcome"><img class="av" src="${IMG}" alt="${NAME}"><h1>Hi, I'm ${NAME} 👋</h1>
      <p>I help students with coding and debugging. Paste your code or ask a question to get started.</p>
      <div class="cards">${SUGGESTIONS.map((s) => `<button class="sug" data-t="${s[1]}"><i class="fa-solid ${s[0]}"></i>${s[1]}</button>`).join("")}</div></div>`;
  } else {
    c.messages.forEach((m, i) => {
      if (m.role === "user") { const d = document.createElement("div"); d.className = "row user"; d.innerHTML = `<div class="bub">${esc(m.content).replace(/\n/g, "<br>")}</div>`; box.appendChild(d); }
      else box.appendChild(botRow(m, i));
    });
  }
  scroll(); renderList();
}
const scroll = () => { const c = $("chat"); c.scrollTop = c.scrollHeight; };
function renderList() {
  $("list").innerHTML = chats.map((c) => `<div class="item ${c.id === cur ? "on" : ""}" data-id="${c.id}"><i class="fa-regular fa-message"></i><span>${esc(c.title)}</span><button class="del" data-del="${c.id}" title="Delete"><i class="fa-solid fa-trash-can"></i></button></div>`).join("");
}
function newChat() { cur = null; render(); closeSide(); $("input").focus(); }
const closeSide = () => { $("side").classList.remove("open"); $("ov").classList.remove("open"); };

/* sending */
async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true;
  let c = chat();
  if (!c) { c = { id: Date.now().toString(36), title: text.slice(0, 32), messages: [] }; chats.unshift(c); cur = c.id; }
  c.messages.push({ role: "user", content: text });
  save(); render();
  $("input").value = ""; grow();
  const t = document.createElement("div");
  t.className = "row bot"; t.innerHTML = `${AV}<div class="dots"><i></i><i></i><i></i></div>`;
  $("msgs").appendChild(t); scroll();
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: c.messages.map(({ role, content }) => ({ role, content })) }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.reply) throw new Error(d.error || "Request failed");
    c.messages.push({ role: "assistant", content: d.reply, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
    save(); render();
  } catch (e) {
    t.remove();
    $("msgs").appendChild(botRow({ content: "Sorry, something went wrong: " + (e.message || "network error") + ". Please try again." }, 0, true));
    scroll();
  }
  busy = false;
}

/* input */
const grow = () => { const i = $("input"); i.style.height = "auto"; i.style.height = Math.min(i.scrollHeight, 160) + "px"; $("send").disabled = !i.value.trim(); };
$("input").addEventListener("input", grow);
$("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover:hover)").matches) { e.preventDefault(); send($("input").value); }
});
$("send").onclick = () => send($("input").value);
$("newChat").onclick = newChat;
$("menu").onclick = () => { $("side").classList.add("open"); $("ov").classList.add("open"); };
$("ov").onclick = closeSide;

/* delegated clicks */
document.addEventListener("click", (e) => {
  const q = (s) => e.target.closest(s);
  let el;
  if ((el = q(".sug"))) return send(el.dataset.t);
  if ((el = q(".del"))) {
    e.stopPropagation(); const id = el.dataset.del;
    chats = chats.filter((c) => c.id !== id); if (cur === id) cur = null; save(); return render();
  }
  if ((el = q(".item"))) { cur = el.dataset.id; render(); return closeSide(); }
  if ((el = q(".cc"))) {
    navigator.clipboard.writeText(el.closest(".cb").querySelector("code").textContent).catch(() => {});
    el.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; return setTimeout(() => (el.innerHTML = '<i class="fa-regular fa-copy"></i> Copy code'), 1500);
  }
  if ((el = q(".cp"))) {
    navigator.clipboard.writeText(el.closest(".row")._raw).catch(() => {});
    el.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; return setTimeout(() => (el.innerHTML = '<i class="fa-regular fa-copy"></i>'), 1500);
  }
  if ((el = q(".vote"))) {
    const m = chat().messages[+el.dataset.i], v = el.dataset.v;
    m.fb = m.fb === v ? null : v; save();
    const bar = el.parentElement;
    bar.querySelectorAll(".vote").forEach((b) => b.classList.toggle("on", m.fb === b.dataset.v));
  }
});

render();
