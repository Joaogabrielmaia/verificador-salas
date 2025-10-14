const urlKey = "webapp_url";
const userKey = "roomcheck_user_name";

const problems = ["Projetor não liga", "Sala suja", "Ar-condicionado com defeito", "Cabo HDMI faltando", "Lâmpada queimada", "Som não funciona", "Cadeiras insuficientes", "Mesa danificada", "Internet instável", "Outro"];

let DATA = { cities: [] };
let state = { city: 0, floor: 0, room: null, tags: [], view: "rooms" };
let socket = null;
let roomStatusData = { statuses: {}, pendings: {}, resetTime: 0 };

function leftPad(n) { return n < 10 ? "0" + n : "" + n }
function nowDMYHM() { const d = new Date(); return `${leftPad(d.getDate())}-${leftPad(d.getMonth() + 1)}-${d.getFullYear()} ${leftPad(d.getHours())}:${leftPad(d.getMinutes())}` }
function toast(m) { const t = bootstrap.Toast.getOrCreateInstance(document.getElementById("appToast")); document.querySelector("#appToast .toast-body span").textContent = m; t.show() }
function initials(n) { const p = (n || "").trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?" }
function setUserUI() { const name = localStorage.getItem(userKey) || ""; document.getElementById("userAvatar").textContent = initials(name); document.getElementById("userNameLabel").textContent = name }
function ensureUser() { const name = localStorage.getItem(userKey); if (name && name.trim()) return true; bootstrap.Modal.getOrCreateInstance(document.getElementById("modalUser")).show(); return false }
function openUser() { document.getElementById("inputUserName").value = localStorage.getItem(userKey) || ""; bootstrap.Modal.getOrCreateInstance(document.getElementById("modalUser")).show() }
function saveUser() { const v = (document.getElementById("inputUserName").value || "").trim(); if (!v) { toast("Digite um nome"); return } localStorage.setItem(userKey, v); setUserUI(); bootstrap.Modal.getInstance(document.getElementById("modalUser")).hide(); toast("Identificação atualizada") }
function openSettings() { document.getElementById("webAppUrl").value = localStorage.getItem(urlKey) || ""; bootstrap.Modal.getOrCreateInstance(document.getElementById("modalSettings")).show() }
function saveSettings() { localStorage.setItem(urlKey, (document.getElementById("webAppUrl").value || "").trim()); toast("Configurações salvas") }

function normalizeSiteMap(j) {
    const out = { cities: [] };
    const cities = j?.cities || [];
    cities.forEach(c => {
        const floors = (c.floors || []).map(f => {
            const id = (f.id ?? ((f.label || "").match(/\d+/)?.[0] || "x")).toString();
            const label = f.label || (/\d+/.test(id) ? `${id}º andar` : "Outros");
            const rooms = [...new Set(f.rooms || [])];
            const printers = [...new Set(f.printers || [])];
            return { id, label, rooms, printers };
        }).sort((a, b) => { const na = parseInt(a.id, 10), nb = parseInt(b.id, 10); const ia = isNaN(na), ib = isNaN(nb); if (ia && ib) return a.label.localeCompare(b.label); if (ia) return 1; if (ib) return -1; return na - nb });
        out.cities.push({ name: c.name, floors });
    });
    DATA = out;
}

function renderCities() {
    const pc = document.getElementById("cityList"); const mb = document.getElementById("cityListMobile");
    pc.innerHTML = ""; mb.innerHTML = "";
    DATA.cities.forEach((c, i) => {
        const make = target => {
            const b = document.createElement("button");
            b.className = "btn city-item" + (i === state.city ? " active" : "");
            b.innerHTML = `<i class="bi bi-geo-alt me-2"></i>${c.name}`;
            b.onclick = () => { state.city = i; state.floor = 0; renderFloors(); renderViewTabs(); renderGrid(); renderCities(); const off = document.getElementById("offCities"); if (off && off.classList.contains("show")) bootstrap.Offcanvas.getInstance(off).hide() };
            target.appendChild(b)
        };
        make(pc); make(mb)
    })
}

function renderFloors() {
    const chips = document.getElementById("floorChips");
    chips.innerHTML = "";
    const compact = window.matchMedia("(max-width: 576px)").matches;
    const floors = DATA.cities[state.city]?.floors || [];
    floors.forEach((f, i) => {
        const b = document.createElement("button");
        b.className = "floor-chip d-inline-flex align-items-center" + (i === state.floor ? " active" : "");
        const short = f.label.replace(/\s*andar/i, "").trim();
        b.innerHTML = `<i class="bi bi-building"></i>${compact ? short : f.label}`;
        b.onclick = () => { state.floor = i; renderViewTabs(); renderGrid(); renderFloors() };
        chips.appendChild(b)
    });
    const bulk = document.createElement("button");
    bulk.id = "btnVerifyFloor";
    bulk.className = "btn btn-verify btn-sm ms-2";
    bulk.innerHTML = state.view === "rooms" ? `<i class="bi bi-check2-all"></i> Verificar andar` : `<i class="bi bi-check2-all"></i> Verificar impressoras`;
    bulk.onclick = verifyWholeScope;
    chips.appendChild(bulk)
}

function renderViewTabs() {
    let tabs = document.getElementById("viewTabs");
    if (!tabs) {
        tabs = document.createElement("div");
        tabs.id = "viewTabs";
        tabs.className = "d-flex gap-2 mb-2";
        const main = document.getElementById("roomGrid").parentElement;
        main.insertBefore(tabs, document.getElementById("roomGrid"));
    }
    tabs.innerHTML = `
    <div class="btn-group">
      <button class="btn ${state.view === 'rooms' ? 'btn-verify' : 'btn-outline-secondary'} btn-sm" id="tabRooms"><i class="bi bi-grid-3x3-gap"></i> Salas</button>
      <button class="btn ${state.view === 'printers' ? 'btn-verify' : 'btn-outline-secondary'} btn-sm" id="tabPrinters"><i class="bi bi-printer"></i> Impressoras</button>
    </div>`;
    document.getElementById("tabRooms").onclick = () => { state.view = "rooms"; renderFloors(); renderGrid() }
    document.getElementById("tabPrinters").onclick = () => { state.view = "printers"; renderFloors(); renderGrid() }
}

function statusLineHTML() { return `<div class="status-line" data-role="status"><span class="badge-dot"></span><span></span></div>` }
function next3am(ts) { const d = new Date(ts); d.setHours(6, 0, 0, 0); if (d.getTime() <= ts) { d.setDate(d.getDate() + 1) } return d.getTime() }
function makeKey(kind, name, ci = state.city, fi = state.floor) { const c = DATA.cities[ci]?.name || ""; const a = DATA.cities[ci]?.floors[fi]?.label || ""; return `${kind}|${c}|${a}|${name}` }

async function loadStatusData() {
    try {
        const response = await fetch('/api/status');
        roomStatusData = await response.json();
        return true;
    } catch (error) {
        try {
            const statuses = JSON.parse(localStorage.getItem("room_status_v1") || "{}");
            const pendings = JSON.parse(localStorage.getItem("room_pending_comments_v1") || "{}");
            roomStatusData = { statuses, pendings, resetTime: next3am(Date.now()) };
            return true;
        } catch {
            roomStatusData = { statuses: {}, pendings: {}, resetTime: next3am(Date.now()) };
            return false;
        }
    }
}

async function saveStatusToServer(id, statusData) {
    try {
        const response = await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, statusData })
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        const statuses = JSON.parse(localStorage.getItem("room_status_v1") || "{}");
        statuses[id] = statusData;
        localStorage.setItem("room_status_v1", JSON.stringify(statuses));
        return true;
    }
}

async function savePendingToServer(id, comment) {
    try {
        const response = await fetch('/api/status/pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, comment })
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        const pendings = JSON.parse(localStorage.getItem("room_pending_comments_v1") || "{}");
        if (!pendings[id]) pendings[id] = [];
        pendings[id].push(comment);
        localStorage.setItem("room_pending_comments_v1", JSON.stringify(pendings));
        return true;
    }
}

async function clearPendingFromServer(id) {
    try {
        const response = await fetch(`/api/status/pending/${id}`, { method: 'DELETE' });
        const result = await response.json();
        return result.success;
    } catch (error) {
        const pendings = JSON.parse(localStorage.getItem("room_pending_comments_v1") || "{}");
        if (pendings[id]) { delete pendings[id]; localStorage.setItem("room_pending_comments_v1", JSON.stringify(pendings)); }
        return true;
    }
}

function getStatuses() { return roomStatusData.statuses; }
function getStatusId(id) { return roomStatusData.statuses[id] || null; }
function getPendings() { return roomStatusData.pendings; }
function pendingCountId(id) { return (roomStatusData.pendings[id] || []).length; }
function pendingJoinId(id) { return (roomStatusData.pendings[id] || []).join(" | "); }

async function setStatusId(id, obj) {
    roomStatusData.statuses[id] = obj;
    await saveStatusToServer(id, obj);
}

async function addPendingId(id, txt) {
    if (!txt) return;
    if (!roomStatusData.pendings[id]) roomStatusData.pendings[id] = [];
    roomStatusData.pendings[id].push(txt);
    await savePendingToServer(id, txt);
}

async function clearPendingId(id) {
    if (roomStatusData.pendings[id]) {
        delete roomStatusData.pendings[id];
        await clearPendingFromServer(id);
    }
}

function renderGrid() { document.getElementById("roomGrid").innerHTML = ""; state.view === "rooms" ? renderRooms() : renderPrinters() }

function renderRooms() {
    const grid = document.getElementById("roomGrid");
    const floors = DATA.cities[state.city]?.floors || []; const rooms = floors[state.floor]?.rooms || [];
    rooms.forEach(r => {
        const id = makeKey("SALA", r);
        const count = pendingCountId(id);
        const badge = count ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark">${count}</span>` : "";
        const col = document.createElement("div"); col.className = "card-col";
        col.innerHTML = `<div class="room-card">
      <div class="d-flex align-items-center justify-content-between">
        <h6 class="room-title"><span class="badge rounded-pill">Sala</span> ${r}</h6>
        <button class="btn btn-sm btn-outline-secondary position-relative" data-id="${id}" data-name="${r}" data-action="comment"><i class="bi bi-chat-square-text"></i>${badge}</button>
      </div>
      <div class="room-divider"></div>
      <div class="mt-auto d-flex gap-2">
        <button class="btn btn-verify px-3" data-id="${id}" data-name="${r}" data-action="ok"><i class="bi bi-check2-circle"></i> Verificar</button>
        <button class="btn btn-attn px-3" data-id="${id}" data-name="${r}" data-action="attn"><i class="bi bi-exclamation-triangle-fill"></i> Atenção</button>
      </div>
      ${statusLineHTML()}
    </div>`;
        grid.appendChild(col);
        const st = getStatusId(id);
        if (st) { const t = st.status === "Verificada" ? `Verificada por ${st.quem} às ${st.timestamp}` : `Atenção por ${st.quem} às ${st.timestamp}${st.problema ? ` • ${st.problema}` : ""}${st.comentarios ? ` • ${st.comentarios}` : ""}`; updateCardStatusById(id, t, st.status === "Verificada" ? "ok" : "attn") }
    });
    grid.querySelectorAll("button[data-action]").forEach(b => b.addEventListener("click", onAction))
}

function renderPrinters() {
    const grid = document.getElementById("roomGrid");
    const floors = DATA.cities[state.city]?.floors || []; const list = floors[state.floor]?.printers || [];
    list.forEach(p => {
        const id = makeKey("IMP", p);
        const count = pendingCountId(id);
        const badge = count ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark">${count}</span>` : "";
        const col = document.createElement("div"); col.className = "card-col";
        col.innerHTML = `<div class="room-card">
      <div class="d-flex align-items-center justify-content-between">
        <h6 class="room-title"><span class="badge rounded-pill"><i class="bi bi-printer"></i></span> ${p}</h6>
        <button class="btn btn-sm btn-outline-secondary position-relative" data-id="${id}" data-name="${p}" data-action="comment"><i class="bi bi-chat-square-text"></i>${badge}</button>
      </div>
      <div class="room-divider"></div>
      <div class="mt-auto d-flex gap-2">
        <button class="btn btn-verify px-3" data-id="${id}" data-name="${p}" data-action="ok"><i class="bi bi-check2-circle"></i> Verificar</button>
        <button class="btn btn-attn px-3" data-id="${id}" data-name="${p}" data-action="attn"><i class="bi bi-exclamation-triangle-fill"></i> Atenção</button>
      </div>
      ${statusLineHTML()}
    </div>`;
        grid.appendChild(col);
        const st = getStatusId(id);
        if (st) { const t = st.status === "Verificada" ? `Verificada por ${st.quem} às ${st.timestamp}` : `Atenção por ${st.quem} às ${st.timestamp}${st.problema ? ` • ${st.problema}` : ""}${st.comentarios ? ` • ${st.comentarios}` : ""}`; updateCardStatusById(id, t, st.status === "Verificada" ? "ok" : "attn") }
    });
    grid.querySelectorAll("button[data-action]").forEach(b => b.addEventListener("click", onAction))
}

function updateCardStatusById(id, text, type) {
    const btn = document.querySelector(`[data-id="${CSS.escape(id)}"][data-action]`);
    if (!btn) return;
    const card = btn.closest(".room-card");
    const s = card.querySelector('[data-role="status"] span:last-child');
    const dot = card.querySelector('[data-role="status"] .badge-dot');
    s.textContent = text; dot.style.background = type === "ok" ? "#16a34a" : "#f59e0b"
}
function refreshCommentBadgeById(id) {
    const btn = document.querySelector(`button[data-action="comment"][data-id="${CSS.escape(id)}"]`);
    if (!btn) return; const old = btn.querySelector(".badge"); if (old) old.remove();
    const c = pendingCountId(id); if (c) { const span = document.createElement("span"); span.className = "position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark"; span.textContent = c; btn.appendChild(span) }
}

async function onAction(e) {
    const btn = e.currentTarget; const action = btn.dataset.action; const id = btn.dataset.id; const nameRes = btn.dataset.name;
    if (action === "comment") { openCommentId(id); return }
    if (!ensureUser()) return;
    if (action === "ok") {
        const name = localStorage.getItem(userKey) || "";
        const comentarios = pendingJoinId(id);
        const payload = { timestamp: nowDMYHM(), quem: name, cidade: DATA.cities[state.city].name, andar: DATA.cities[state.city].floors[state.floor].label, sala: nameRes, status: "Verificada", problema: "", comentarios, tipo: state.view === "printers" ? "Impressora" : "Sala" };
        sendToSheet(payload).then(() => { });
        await setStatusId(id, { ...payload });
        await clearPendingId(id); refreshCommentBadgeById(id);
        updateCardStatusById(id, `Verificada por ${name} às ${payload.timestamp}${comentarios ? ` • ${comentarios}` : ""}`, "ok")
    } else if (action === "attn") {
        state.room = { id, name: nameRes, kind: state.view === "printers" ? "Impressora" : "Sala" };
        openAttnModal()
    }
}

async function openCommentId(id) {
    if (!ensureUser()) return;
    Swal.fire({ title: "Adicionar comentário", input: "textarea", inputLabel: "Sua observação", inputPlaceholder: "Escreva aqui...", showCancelButton: true, confirmButtonText: "Salvar" }).then(async res => { const txt = (res.value || "").trim(); if (!txt) return; await addPendingId(id, txt); refreshCommentBadgeById(id); toast("Comentário salvo (pendente)") })
}

function openAttnModal() {
    state.tags = []; const grid = document.getElementById("attnButtons"); const tagsBox = document.getElementById("attnTags"); const free = document.getElementById("attnFree");
    const iconMap = { "Projetor não liga": "bi-collection-play", "Sala suja": "bi-trash", "Ar-condicionado com defeito": "bi-snow", "Cabo HDMI faltando": "bi-plug", "Lâmpada queimada": "bi-lightbulb-off", "Som não funciona": "bi-volume-mute", "Cadeiras insuficientes": "bi-people", "Mesa danificada": "bi-table", "Internet instável": "bi-wifi-off", "Outro": "bi-three-dots" };
    grid.innerHTML = ""; problems.forEach(p => { const btn = document.createElement("button"); btn.type = "button"; btn.className = "problem-btn"; btn.dataset.val = p; btn.innerHTML = `<div style="margin-right: 1.1rem"><i class="bi ${iconMap[p] || "bi-exclamation-circle"}"></i></div><span class="pb-label">${p}</span>`; btn.onclick = () => toggleTag(p); grid.appendChild(btn) });
    tagsBox.innerHTML = ""; free.value = "";
    function toggleTag(v) { const i = state.tags.indexOf(v); if (i === -1) state.tags.push(v); else state.tags.splice(i, 1); renderTags(); syncButtons() }
    function addFree(v) { if (!v) return; if (!state.tags.includes(v)) state.tags.push(v); renderTags(); syncButtons() }
    function renderTags() { tagsBox.innerHTML = ""; state.tags.forEach(t => { const chip = document.createElement("span"); chip.className = "tag"; chip.innerHTML = `${t}<i class="bi bi-x-lg"></i>`; chip.querySelector("i").onclick = () => { state.tags = state.tags.filter(x => x !== t); renderTags(); syncButtons() }; tagsBox.appendChild(chip) }) }
    function syncButtons() { grid.querySelectorAll(".problem-btn").forEach(b => { b.classList.toggle("active", state.tags.includes(b.dataset.val)) }) }
    free.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); const v = free.value.trim(); if (v) { addFree(v); free.value = "" } } };
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAttn")).show()
}

async function confirmAttn() {
    if (!state.room) return;
    const name = localStorage.getItem(userKey) || ""; const txt = state.tags.join(" | "); const comentarios = pendingJoinId(state.room.id);
    const payload = { timestamp: nowDMYHM(), quem: name, cidade: DATA.cities[state.city].name, andar: DATA.cities[state.city].floors[state.floor].label, sala: state.room.name, status: "Atenção", problema: txt, comentarios, tipo: state.room.kind };
    sendToSheet(payload).then(() => { });
    await setStatusId(state.room.id, { ...payload });
    await clearPendingId(state.room.id); refreshCommentBadgeById(state.room.id);
    updateCardStatusById(state.room.id, `Atenção por ${name} às ${payload.timestamp}${txt ? ` • ${txt}` : ""}${comentarios ? ` • ${comentarios}` : ""}`, "attn");
    bootstrap.Modal.getInstance(document.getElementById("modalAttn")).hide(); state.room = null; state.tags = []
}

function sendToSheet(payload) {
    const url = localStorage.getItem(urlKey) || "";
    if (!url) { toast("Configure a URL do Apps Script"); return Promise.resolve(false) }
    const body = new URLSearchParams(); body.append("payload", JSON.stringify(payload));
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
        .then(async r => { const txt = await r.text(); try { const j = JSON.parse(txt); if (j.ok) return true; toast("Erro do servidor"); return false } catch { toast("Resposta inesperada"); return false } })
        .catch(() => { toast("Falha ao enviar"); return false })
}

async function verifyWholeScope() {
    if (!ensureUser()) return;
    const cityObj = DATA.cities[state.city]; const floorObj = cityObj?.floors[state.floor]; if (!floorObj) return;
    const list = state.view === "printers" ? (floorObj.printers || []) : (floorObj.rooms || []);
    const kind = state.view === "printers" ? "Impressora" : "Sala";
    const items = list.map(name => ({ id: makeKey(state.view === "printers" ? "IMP" : "SALA", name), name }));
    const blocked = items.filter(it => (getStatusId(it.id)?.status === "Atenção"));
    const okItems = items.filter(it => !(getStatusId(it.id)?.status === "Atenção"));
    if (okItems.length === 0) { toast("Nada para verificar aqui"); return }
    const html = `<div class="text-start"><div><strong>Será marcado como verificado:</strong> ${okItems.length} ${kind.toLowerCase()}(s)</div>${blocked.length ? `<div class="mt-1 text-muted small">Ignorando em Atenção: ${blocked.length}</div>` : ""}</div>`;
    const confirm = await Swal.fire({ title: "Confirmar verificação?", html, icon: "question", showCancelButton: true, confirmButtonText: "Sim, verificar", cancelButtonText: "Cancelar" }); if (!confirm.isConfirmed) return;
    const name = localStorage.getItem(userKey) || ""; const city = cityObj.name; const andar = floorObj.label;
    const tasks = [];
    okItems.forEach(it => { const comentarios = pendingJoinId(it.id); const payload = { timestamp: nowDMYHM(), quem: name, cidade: city, andar, sala: it.name, status: "Verificada", problema: "", comentarios, tipo: kind }; tasks.push(sendToSheet(payload)); setStatusId(it.id, { ...payload }); clearPendingId(it.id); refreshCommentBadgeById(it.id); updateCardStatusById(it.id, `Verificada por ${name} às ${payload.timestamp}${comentarios ? ` • ${comentarios}` : ""}`, "ok") });
    await Promise.all(tasks);
    toast(`${okItems.length} ${kind.toLowerCase()}(s) verificada(s)`)
}


document.getElementById("btnOpenSettings").addEventListener("click", openSettings);
document.getElementById("btnOpenSettingsSm").addEventListener("click", openSettings);
document.getElementById("btnSaveSettings").addEventListener("click", saveSettings);
document.getElementById("btnPickUser").addEventListener("click", openUser);
document.getElementById("btnSaveUser").addEventListener("click", saveUser);
document.getElementById("btnConfirmAttn").addEventListener("click", confirmAttn);
window.addEventListener("resize", () => { renderFloors() });

window.addEventListener("load", async () => {
    await loadSiteMap();
    await loadStatusData();
    renderCities();
    renderFloors();
    renderViewTabs();
    renderGrid();
    setUserUI();
});

async function loadSiteMap() {
    let ok = false;
    try {
        const response = await fetch('/api/data');
        if (response.ok) {
            const data = await response.json();
            normalizeSiteMap(data);
            ok = true;
            if (!socket) {
                socket = io();
                socket.on('data_updated', (newData) => {
                    const prevCity = DATA.cities[state.city]?.name;
                    const prevFloor = DATA.cities[state.city]?.floors[state.floor]?.label;
                    normalizeSiteMap(newData);
                    state.city = Math.max(0, DATA.cities.findIndex(c => c.name === prevCity));
                    const fl = DATA.cities[state.city]?.floors || [];
                    state.floor = Math.max(0, fl.findIndex(f => f.label === prevFloor));
                    renderCities();
                    renderFloors();
                    renderViewTabs();
                    renderGrid();
                    toast("Dados atualizados em tempo real!");
                });
                socket.on('status_data', (data) => {
                    roomStatusData = data;
                    renderGrid();
                });
                socket.on('status_updated', ({ id, status }) => {
                    roomStatusData.statuses[id] = status;
                    updateCardStatusById(id, status.status === "Verificada" ? `Verificada por ${status.quem} às ${status.timestamp}${status.comentarios ? ` • ${status.comentarios}` : ""}` : `Atenção por ${status.quem} às ${status.timestamp}${status.problema ? ` • ${status.problema}` : ""}${status.comentarios ? ` • ${status.comentarios}` : ""}`, status.status === "Verificada" ? "ok" : "attn");
                });
                socket.on('pending_updated', ({ id, pendings }) => {
                    roomStatusData.pendings[id] = pendings;
                    refreshCommentBadgeById(id);
                });
                socket.on('pending_cleared', ({ id }) => {
                    if (roomStatusData.pendings[id]) { delete roomStatusData.pendings[id]; }
                    refreshCommentBadgeById(id);
                });
            }
        }
    } catch (e) { }
    if (!ok) {
        try {
            const base = (localStorage.getItem("webapp_url") || "").trim();
            if (base) {
                const url = base + (base.includes("?") ? "&" : "?") + "action=get_site_map";
                const r = await fetch(url, { cache: "no-store" });
                if (r.ok) {
                    const j = await r.json();
                    const data = j.site_map || j;
                    if (data && Array.isArray(data.cities)) { normalizeSiteMap(data); ok = true; }
                }
            }
        } catch (e) { }
    }
    if (!ok) {
        try {
            const r = await fetch("site_map.json", { cache: "no-store" });
            if (r.ok) {
                const j = await r.json();
                if (j && Array.isArray(j.cities)) { normalizeSiteMap(j); ok = true; }
            }
        } catch (e) { }
    }
    if (!ok) { DATA = { cities: [] }; toast("Não foi possível carregar o mapa."); }
    return ok;
}

const AUTO_REFRESH_MS = 5 * 60 * 1000;
let _lastSiteMapHash = "";

async function tryAutoRefreshSiteMap() {
    if (document.querySelector(".modal.show")) return;
    const url = (localStorage.getItem(urlKey) || "").trim();
    if (!url) return;
    try {
        const res = await fetch(url + "?action=get_site_map", { cache: "no-store" });
        const j = await res.json();
        if (!j.ok || !j.site_map) return;
        const newData = j.site_map;
        const newHash = JSON.stringify(newData);
        if (newHash !== _lastSiteMapHash) {
            const prevCity = DATA.cities[state.city]?.name;
            const prevFloor = DATA.cities[state.city]?.floors[state.floor]?.label;
            DATA = newData;
            state.city = Math.max(0, DATA.cities.findIndex(c => c.name === prevCity));
            if (state.city < 0) state.city = 0;
            const fl = DATA.cities[state.city]?.floors || [];
            state.floor = Math.max(0, fl.findIndex(f => f.label === prevFloor));
            if (state.floor < 0) state.floor = 0;
            renderCities();
            renderFloors();
            if (typeof renderViewTabs === "function") renderViewTabs();
            renderGrid?.();
            toast("Mapa atualizado");
            _lastSiteMapHash = newHash;
        }
    } catch { }
}

function initAutoMapRefresh() {
    try { _lastSiteMapHash = JSON.stringify(DATA); } catch { _lastSiteMapHash = ""; }
    setInterval(tryAutoRefreshSiteMap, AUTO_REFRESH_MS);
}

initAutoMapRefresh();