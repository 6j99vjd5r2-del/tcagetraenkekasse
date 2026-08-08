
const STORAGE_KEY = "getraenkekasse2_data";
const INACTIVITY_SECONDS = 30;

const defaultData = {
  members: [
    { id: "M1001", name: "Daniel", code: "1001", active: true },
    { id: "M1002", name: "Anna", code: "1002", active: true },
    { id: "M1003", name: "Max Mustermann", code: "1003", active: true },
    { id: "M1004", name: "Lisa Beispiel", code: "1004", active: true }
  ],
  drinks: [
    { id: "D1", name: "Wasser", price: 1.50, active: true },
    { id: "D2", name: "Spezi", price: 2.00, active: true },
    { id: "D3", name: "Apfelschorle", price: 2.00, active: true },
    { id: "D4", name: "Bier", price: 2.50, active: true },
    { id: "D5", name: "Kaffee", price: 1.50, active: true }
  ],
  bookings: [],
  adminPin: "2468"
};

let data = loadData();
let activeMember = null;
let inactivitySecondsLeft = INACTIVITY_SECONDS;
let inactivityInterval = null;
const $ = id => document.getElementById(id);

function uid(prefix = "ID") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const loaded = saved ? JSON.parse(saved) : structuredClone(defaultData);

    loaded.members = (loaded.members || []).map((m, index) => {
      if (typeof m === "string") m = { name: m, code: String(7000 + index) };
      return {
        id: String(m.id || m.memberId || `M${String(index + 1).padStart(4,"0")}`),
        name: String(m.name || "").trim(),
        code: String(m.code || "").padStart(4,"0").slice(-4),
        active: m.active !== false
      };
    });

    loaded.drinks = (loaded.drinks || []).map((d, index) => ({
      id: String(d.id || `D${index + 1}`),
      name: String(d.name || "").trim(),
      price: Number(d.price || 0),
      active: d.active !== false
    }));

    loaded.bookings = (loaded.bookings || []).map(b => {
      const member = loaded.members.find(m => m.code === b.memberCode || m.name === b.member);
      return {
        ...b,
        id: b.id || uid("B"),
        memberId: b.memberId || member?.id || "",
        member: b.member || member?.name || "",
        memberCode: b.memberCode || member?.code || "",
        price: Number(b.price || 0),
        createdAt: b.createdAt || new Date().toISOString()
      };
    });

    loaded.adminPin = loaded.adminPin || "2468";
    return loaded;
  } catch (error) {
    console.error(error);
    return structuredClone(defaultData);
  }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function euro(v) { return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(v)); }
function dateTime(iso) {
  return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
}
function dateOnly(iso) { return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(iso)); }
function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),1900);
}
function normalizeBool(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return !["0","false","nein","no","inaktiv"].includes(v);
}
function parsePrice(value) {
  const cleaned = String(value ?? "").replace(/[€\s]/g,"").replace(",",".");
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : NaN;
}
function csvEscape(value) { return `"${String(value ?? "").replaceAll('"','""')}"`; }
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function startInactivityTimer() {
  stopInactivityTimer(); inactivitySecondsLeft = INACTIVITY_SECONDS; updateSessionInfo();
  inactivityInterval = setInterval(()=>{
    inactivitySecondsLeft--; updateSessionInfo();
    if (inactivitySecondsLeft <= 0) logoutMember(true);
  },1000);
}
function resetInactivityTimer() {
  if (!activeMember) return;
  inactivitySecondsLeft = INACTIVITY_SECONDS; updateSessionInfo();
}
function stopInactivityTimer() {
  if (inactivityInterval) clearInterval(inactivityInterval);
  inactivityInterval = null;
}
function updateSessionInfo() {
  const el = $("sessionInfo"); if (!el) return;
  el.textContent = `${inactivitySecondsLeft} Sekunde${inactivitySecondsLeft===1?"":"n"}`;
  
}
function loginMember() {
  const code = $("memberCode").value.trim();

  if (!/^\d{4}$/.test(code)) {
    toast("Bitte einen 4-stelligen Code eingeben.");
    return;
  }

  const member = data.members.find(m => m.code === code && m.active);

  if (!member) {
    $("memberCode").value = "";
    toast("Code nicht gefunden oder Mitglied inaktiv.");
    return;
  }

  activeMember = member;

  $("memberCode").value = "";
  $("memberCode").blur();

  $("loginPanel").hidden = true;
  $("memberPanel").hidden = false;
  $("bookingPanel").hidden = false;

  $("memberName").textContent = member.name;
  $("memberId").textContent = member.id;
  $("welcomeText").textContent = `Willkommen ${member.name}!`;

  renderDrinks();
  renderRecent();
  updateMemberMonthTotal();
  startInactivityTimer();
}
function logoutMember(auto=false) {
  stopInactivityTimer();
  activeMember = null;

  $("memberName").textContent = "";
  $("memberId").textContent = "";
  $("welcomeText").textContent = "Willkommen!";
  $("memberMonthTotal").textContent = euro(0);
  $("drinkGrid").innerHTML = "";
  $("recentBookings").innerHTML = "";
  $("sessionInfo").textContent = `${INACTIVITY_SECONDS} Sekunden`;

  $("memberPanel").hidden = true;
  $("bookingPanel").hidden = true;
  $("loginPanel").hidden = false;

  $("memberCode").value = "";
  $("memberCode").focus();

  if (auto) toast("Automatisch abgemeldet.");
}

function drinkEmoji(name) {
  const n = String(name).toLowerCase();
  if (n.includes("wasser")) return "💧";
  if (n.includes("spezi") || n.includes("cola")) return "🥤";
  if (n.includes("bier") || n.includes("helles") || n.includes("radler")) return "🍺";
  if (n.includes("wein")) return "🍷";
  if (n.includes("kaffee")) return "☕";
  if (n.includes("tee")) return "🍵";
  if (n.includes("apfel")) return "🍏";
  if (n.includes("limo") || n.includes("zitr")) return "🍋";
  return "🥤";
}

function renderDrinks() {
  if (!activeMember) {
    $("drinkGrid").innerHTML = "";
    return;
  }
  const drinks = data.drinks.filter(d=>d.active).sort((a,b)=>a.name.localeCompare(b.name,"de"));
  $("drinkGrid").innerHTML = drinks.map(d=>`
    <button class="drink-card" data-drink="${escapeHtml(d.id)}" type="button">
      <span class="drink-emoji">${drinkEmoji(d.name)}</span>
      <span><span class="drink-name">${escapeHtml(d.name)}</span><span class="drink-price">${euro(d.price)}</span></span>
      <span class="plus-badge">+</span>
    </button>`).join("") || `<p class="hint">Keine aktiven Getränke vorhanden.</p>`;
  document.querySelectorAll("[data-drink]").forEach(btn=>btn.addEventListener("click",()=>{
    if(!activeMember) return toast("Bitte zuerst anmelden.");
    const drink=data.drinks.find(d=>d.id===btn.dataset.drink);
    const booking = {id:uid("B"),memberId:activeMember.id,member:activeMember.name,memberCode:activeMember.code,drinkId:drink.id,drink:drink.name,price:Number(drink.price),createdAt:new Date().toISOString()};
    data.bookings.push(booking);
    saveData();
    renderRecent();
    renderReports();
    updateMemberMonthTotal();
    toast(`${drink.name} gebucht`);
    resetInactivityTimer();
  }));
}
function renderRecent() {
  if (!activeMember) {
    $("recentBookings").innerHTML = "";
    return;
  }
  const recent = data.bookings
    .filter(b => (b.memberId && b.memberId === activeMember.id) || (!b.memberId && b.member === activeMember.name))
    .slice().reverse().slice(0, 15);

  $("recentBookings").innerHTML = recent.length ? `
    <table class="recent-table">
      <thead><tr><th>Datum / Uhrzeit</th><th>Getränk</th><th>Preis</th><th></th></tr></thead>
      <tbody>${recent.map(b => `
        <tr>
          <td>${dateTime(b.createdAt)}</td>
          <td>${escapeHtml(b.drink)}</td>
          <td>${euro(b.price)}</td>
          <td><button type="button" class="booking-delete-button" data-delete-booking="${escapeHtml(b.id)}">Löschen</button></td>
        </tr>`).join("")}</tbody>
    </table>` : `<p class="hint" style="padding:16px">Noch keine Buchungen vorhanden.</p>`;

  document.querySelectorAll("[data-delete-booking]").forEach(button => {
    button.addEventListener("click", () => deleteMemberBooking(button.dataset.deleteBooking));
  });
}

function deleteMemberBooking(bookingId) {
  if (!activeMember) return toast("Bitte zuerst anmelden.");
  const booking = data.bookings.find(b => b.id === bookingId);
  if (!booking) return renderRecent();

  const ownBooking = (booking.memberId && booking.memberId === activeMember.id) ||
                     (!booking.memberId && booking.member === activeMember.name);
  if (!ownBooking) return toast("Diese Buchung kann nicht gelöscht werden.");

  if (!confirm(`${booking.drink} vom ${dateTime(booking.createdAt)} für ${euro(booking.price)} wirklich löschen?`)) {
    resetInactivityTimer();
    return;
  }
  data.bookings = data.bookings.filter(b => b.id !== bookingId);
  saveData();
  renderRecent();
  renderReports();
  updateMemberMonthTotal();
  resetInactivityTimer();
  toast("Buchung gelöscht.");
}

function updateMemberMonthTotal() {
  if (!activeMember) return;
  const month = currentMonthValue();
  const total = data.bookings
    .filter(b => b.createdAt.slice(0,7) === month)
    .filter(b => (b.memberId && b.memberId === activeMember.id) || (!b.memberId && b.member === activeMember.name))
    .reduce((sum,b) => sum + Number(b.price), 0);
  $("memberMonthTotal").textContent = euro(total);
}







function updateMemberMonthTotal() {
  if (!activeMember) return;
  const month = currentMonthValue();
  const total = data.bookings
    .filter(b => b.createdAt.slice(0,7) === month)
    .filter(b => (b.memberId && b.memberId === activeMember.id) || (!b.memberId && b.member === activeMember.name))
    .reduce((sum,b) => sum + Number(b.price), 0);
  $("memberMonthTotal").textContent = euro(total);
}

function updateMemberMonthTotal() {
  if (!activeMember) return;
  const month = currentMonthValue();
  const total = data.bookings
    .filter(b => b.createdAt.slice(0,7) === month)
    .filter(b => (b.memberId && b.memberId === activeMember.id) || (!b.memberId && b.member === activeMember.name))
    .reduce((sum,b) => sum + Number(b.price), 0);
  $("memberMonthTotal").textContent = euro(total);
}

function renderAdmin() {
  renderAdminMembers(); renderAdminDrinks(); renderReports();
}
function renderAdminMembers() {
  const members=[...data.members].sort((a,b)=>a.name.localeCompare(b.name,"de"));
  $("adminMembers").innerHTML=`
    <div class="admin-grid-header members-header">
      <span>ID</span><span>Name</span><span>Code</span><span>Aktiv</span><span class="actions-head">Aktionen</span>
    </div>
    ${members.map((m,i)=>`
      <div class="member-admin-row">
        <input data-m-id="${i}" value="${escapeHtml(m.id)}" aria-label="Mitglieder-ID">
        <input class="wide" data-m-name="${i}" value="${escapeHtml(m.name)}" aria-label="Name">
        <input data-m-code="${i}" value="${escapeHtml(m.code)}" inputmode="numeric" maxlength="4" aria-label="Code">
        <input data-m-active="${i}" type="checkbox" ${m.active?"checked":""} aria-label="Aktiv">
        <div class="row-actions">
          <button type="button" class="small" data-save-member="${i}">Speichern</button>
          <button type="button" class="small danger" data-delete-member="${i}">Löschen</button>
        </div>
      </div>`).join("")}`;
  document.querySelectorAll("[data-save-member]").forEach(btn=>btn.addEventListener("click",()=>{
    const i=Number(btn.dataset.saveMember), old=members[i];
    const id=document.querySelector(`[data-m-id="${i}"]`).value.trim();
    const name=document.querySelector(`[data-m-name="${i}"]`).value.trim();
    const code=document.querySelector(`[data-m-code="${i}"]`).value.trim();
    const active=document.querySelector(`[data-m-active="${i}"]`).checked;
    if(!id||!name||!/^\d{4}$/.test(code)) return toast("ID, Name und 4-stelligen Code prüfen.");
    if(data.members.some(m=>m!==old&&(m.id===id||m.code===code))) return toast("ID oder Code ist bereits vergeben.");
    Object.assign(old,{id,name,code,active}); saveData(); renderAdminMembers(); toast("Mitglied gespeichert.");
  }));
  document.querySelectorAll("[data-delete-member]").forEach(btn=>btn.addEventListener("click",()=>{
    const m=members[Number(btn.dataset.deleteMember)];
    if(confirm(`${m.name} wirklich löschen? Bestehende Buchungen bleiben erhalten.`)){
      data.members=data.members.filter(x=>x!==m); saveData(); renderAdminMembers(); toast("Mitglied gelöscht.");
    }
  }));
}
function renderAdminDrinks() {
  const drinks=[...data.drinks].sort((a,b)=>a.name.localeCompare(b.name,"de"));
  $("adminDrinks").innerHTML=`
    <div class="admin-grid-header drinks-header">
      <span>Getränk</span><span>Preis</span><span>Aktiv</span><span class="actions-head">Aktionen</span>
    </div>
    ${drinks.map((d,i)=>`
      <div class="drink-admin-row">
        <input class="wide" data-d-name="${i}" value="${escapeHtml(d.name)}" aria-label="Getränk">
        <input data-d-price="${i}" type="number" min="0" step="0.10" value="${Number(d.price).toFixed(2)}" aria-label="Preis">
        <input data-d-active="${i}" type="checkbox" ${d.active?"checked":""} aria-label="Aktiv">
        <div class="row-actions">
          <button type="button" class="small" data-save-drink="${i}">Speichern</button>
          <button type="button" class="small danger" data-delete-drink="${i}">Löschen</button>
        </div>
      </div>`).join("")}`;
  document.querySelectorAll("[data-save-drink]").forEach(btn=>btn.addEventListener("click",()=>{
    const i=Number(btn.dataset.saveDrink), old=drinks[i];
    const name=document.querySelector(`[data-d-name="${i}"]`).value.trim();
    const price=Number(document.querySelector(`[data-d-price="${i}"]`).value);
    const active=document.querySelector(`[data-d-active="${i}"]`).checked;
    if(!name||!Number.isFinite(price)||price<0) return toast("Getränk und Preis prüfen.");
    Object.assign(old,{name,price,active}); saveData(); renderAdminDrinks(); renderDrinks(); toast("Getränk gespeichert.");
  }));
  document.querySelectorAll("[data-delete-drink]").forEach(btn=>btn.addEventListener("click",()=>{
    const d=drinks[Number(btn.dataset.deleteDrink)];
    if(confirm(`${d.name} wirklich löschen? Bestehende Buchungen bleiben erhalten.`)){
      data.drinks=data.drinks.filter(x=>x!==d); saveData(); renderAdminDrinks(); renderDrinks(); toast("Getränk gelöscht.");
    }
  }));
}

function currentMonthValue() {
  const now=new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
}
function monthBookings() {
  const value=$("reportMonth").value || currentMonthValue();
  return data.bookings.filter(b=>b.createdAt.slice(0,7)===value);
}
function renderReports() {
  if(!$("reportMonth").value) $("reportMonth").value=currentMonthValue();
  const bookings=monthBookings();
  const total=bookings.reduce((s,b)=>s+Number(b.price),0);
  const memberIds=new Set(bookings.map(b=>b.memberId||b.member));
  const drinks=new Set(bookings.map(b=>b.drink));
  $("summary").innerHTML=`
    <div class="kpis">
      <div class="kpi">Buchungen<strong>${bookings.length}</strong></div>
      <div class="kpi">Mitglieder<strong>${memberIds.size}</strong></div>
      <div class="kpi">Getränkearten<strong>${drinks.size}</strong></div>
      <div class="kpi">Gesamtbetrag<strong>${euro(total)}</strong></div>
    </div>`;
  $("bookingTable").innerHTML=bookings.length?`
    <div class="table-wrap"><table>
      <thead><tr><th>Datum</th><th>Mitglieder-ID</th><th>Name</th><th>Getränk</th><th>Anzahl</th><th>Einzelpreis</th><th>Gesamt</th></tr></thead>
      <tbody>${aggregateMonthlyRows(bookings).map(r=>`
        <tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.memberId)}</td><td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.drink)}</td><td>${r.count}</td><td>${euro(r.unitPrice)}</td><td>${euro(r.total)}</td></tr>`).join("")}</tbody>
    </table></div>`:`<p class="hint">Für diesen Monat liegen keine Buchungen vor.</p>`;
}
function aggregateMonthlyRows(bookings) {
  const map=new Map();
  bookings.forEach(b=>{
    const date=dateOnly(b.createdAt);
    const key=[date,b.memberId||"",b.member,b.drink,Number(b.price).toFixed(2)].join("|");
    if(!map.has(key)) map.set(key,{date,isoDate:b.createdAt.slice(0,10),memberId:b.memberId||"",name:b.member,drink:b.drink,count:0,unitPrice:Number(b.price),total:0});
    const row=map.get(key); row.count++; row.total+=Number(b.price);
  });
  return [...map.values()].sort((a,b)=>a.isoDate.localeCompare(b.isoDate)||a.name.localeCompare(b.name,"de")||a.drink.localeCompare(b.drink,"de"));
}

function detectDelimiter(line) { return (line.match(/;/g)||[]).length >= (line.match(/,/g)||[]).length ? ";" : ","; }
function parseCsv(text) {
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(l=>l.trim()!=="");
  if(!lines.length) return [];
  const delimiter=detectDelimiter(lines[0]), rows=[];
  for(const line of lines){
    const row=[]; let value="", quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'&&quoted&&line[i+1]==='"'){value+='"';i++;}
      else if(ch==='"'){quoted=!quoted;}
      else if(ch===delimiter&&!quoted){row.push(value.trim());value="";}
      else value+=ch;
    }
    row.push(value.trim()); rows.push(row);
  }
  return rows;
}
function headerIndex(headers, aliases) {
  const normalized=headers.map(h=>h.toLowerCase().replace(/[\s_-]/g,""));
  return normalized.findIndex(h=>aliases.some(a=>h===a));
}
async function readFileText(input) {
  const file=input.files?.[0]; if(!file) throw new Error("Bitte zuerst eine CSV-Datei auswählen.");
  return await file.text();
}
async function importMembers() {
  try{
    const rows=parseCsv(await readFileText($("memberCsvFile"))); if(rows.length<2) throw new Error("CSV enthält keine Daten.");
    const h=rows[0], idI=headerIndex(h,["mitgliederid","mitgliedid","id"]), nameI=headerIndex(h,["name","mitglied","mitgliedsname"]),
      codeI=headerIndex(h,["code","pin","mitgliedercode"]), activeI=headerIndex(h,["aktiv","active","status"]);
    if(idI<0||nameI<0||codeI<0) throw new Error("Benötigte Spalten: Mitglieder-ID, Name und Code.");
    const imported=[];
    for(const r of rows.slice(1)){
      const id=String(r[idI]||"").trim(), name=String(r[nameI]||"").trim(), code=String(r[codeI]||"").trim();
      if(!id&&!name&&!code) continue;
      if(!id||!name||!/^\d{4}$/.test(code)) throw new Error(`Ungültige Zeile: ${r.join(" | ")}`);
      imported.push({id,name,code,active:activeI<0?true:normalizeBool(r[activeI])});
    }
    const duplicateId=new Set(), duplicateCode=new Set();
    for(const m of imported){
      if(duplicateId.has(m.id)||duplicateCode.has(m.code)) throw new Error("CSV enthält doppelte IDs oder Codes.");
      duplicateId.add(m.id); duplicateCode.add(m.code);
    }
    const replace=confirm(`Es wurden ${imported.length} Mitglieder erkannt.\n\nOK = bestehende Mitgliederliste ersetzen\nAbbrechen = nach ID aktualisieren/ergänzen`);
    if(replace) data.members=imported;
    else imported.forEach(m=>{const old=data.members.find(x=>x.id===m.id); old?Object.assign(old,m):data.members.push(m);});
    saveData(); renderAdminMembers(); $("memberCsvFile").value=""; toast(`${imported.length} Mitglieder importiert.`);
  }catch(e){toast(e.message);}
}
async function importDrinks() {
  try{
    const rows=parseCsv(await readFileText($("drinkCsvFile"))); if(rows.length<2) throw new Error("CSV enthält keine Daten.");
    const h=rows[0], nameI=headerIndex(h,["getränk","getraenk","name","produkt"]), priceI=headerIndex(h,["preis","price"]),
      activeI=headerIndex(h,["aktiv","active","status"]);
    if(nameI<0||priceI<0) throw new Error("Benötigte Spalten: Getränk und Preis.");
    const imported=[];
    for(const r of rows.slice(1)){
      const name=String(r[nameI]||"").trim(), price=parsePrice(r[priceI]);
      if(!name&&String(r[priceI]||"").trim()==="") continue;
      if(!name||!Number.isFinite(price)||price<0) throw new Error(`Ungültige Zeile: ${r.join(" | ")}`);
      imported.push({id:uid("D"),name,price,active:activeI<0?true:normalizeBool(r[activeI])});
    }
    const replace=confirm(`Es wurden ${imported.length} Getränke erkannt.\n\nOK = bestehende Getränkeliste ersetzen\nAbbrechen = nach Name aktualisieren/ergänzen`);
    if(replace) data.drinks=imported;
    else imported.forEach(d=>{const old=data.drinks.find(x=>x.name.toLowerCase()===d.name.toLowerCase()); old?Object.assign(old,{price:d.price,active:d.active}):data.drinks.push(d);});
    saveData(); renderAdminDrinks(); renderDrinks(); $("drinkCsvFile").value=""; toast(`${imported.length} Getränke importiert.`);
  }catch(e){toast(e.message);}
}

function downloadCsvTemplate(type) {
  const text=type==="members"
    ? "Mitglieder-ID;Name;Code;Aktiv\nM1001;Max Mustermann;1001;Ja\nM1002;Erika Beispiel;1002;Ja\n"
    : "Getränk;Preis;Aktiv\nWasser;1,50;Ja\nSpezi;2,00;Ja\n";
  downloadBlob(new Blob(["\uFEFF"+text],{type:"text/csv;charset=utf-8"}),type==="members"?"Vorlage_Mitglieder.csv":"Vorlage_Getraenke.csv");
}
function exportMonthlyCsv() {
  const rows=aggregateMonthlyRows(monthBookings());
  const header=["Datum","Mitglieder-ID","Name","Getränk","Anzahl","Einzelpreis","Gesamtbetrag"];
  const csv=[header,...rows.map(r=>[r.date,r.memberId,r.name,r.drink,r.count,r.unitPrice.toFixed(2).replace(".",","),r.total.toFixed(2).replace(".",",")])]
    .map(row=>row.map(csvEscape).join(";")).join("\n");
  downloadBlob(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),`Monatsabschluss_${$("reportMonth").value}.csv`);
}

/* Minimaler, offlinefähiger XLSX-Writer: erzeugt eine echte Excel-Datei ohne externe Bibliothek. */
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function concatBytes(parts){const len=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function zipStore(files){
  const enc=new TextEncoder(), locals=[], centrals=[]; let offset=0;
  for(const f of files){
    const name=enc.encode(f.name), body=typeof f.data==="string"?enc.encode(f.data):f.data, crc=crc32(body);
    const local=concatBytes([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(body.length),u32(body.length),u16(name.length),u16(0),name,body]);
    locals.push(local);
    const central=concatBytes([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(body.length),u32(body.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    centrals.push(central); offset+=local.length;
  }
  const centralBytes=concatBytes(centrals), localBytes=concatBytes(locals);
  const end=concatBytes([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBytes.length),u32(localBytes.length),u16(0)]);
  return new Blob([localBytes,centralBytes,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function xmlEsc(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]));}
function colName(n){let s="";while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function cellXml(value,row,col,style=0,type=null){
  const ref=`${colName(col)}${row}`;
  if(type==="n") return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xmlEsc(value)}</t></is></c>`;
}
function exportMonthlyXlsx(){
  const month=$("reportMonth").value||currentMonthValue(), bookings=monthBookings(), rows=aggregateMonthlyRows(bookings);
  const total=rows.reduce((s,r)=>s+r.total,0);
  const sheetRows=[];
  sheetRows.push(`<row r="1" ht="28" customHeight="1">${cellXml(`Getränkekasse – Monatsabschluss ${month}`,1,1,1)}</row>`);
  sheetRows.push(`<row r="2">${cellXml("Erstellt am",2,1,2)}${cellXml(dateTime(new Date().toISOString()),2,2,0)}</row>`);
  sheetRows.push(`<row r="3">${cellXml("Gesamtbetrag",3,1,2)}${cellXml(total,3,2,3,"n")}</row>`);
  const headers=["Datum","Mitglieder-ID","Name","Getränk","Anzahl","Einzelpreis","Gesamtbetrag"];
  sheetRows.push(`<row r="5">${headers.map((h,i)=>cellXml(h,5,i+1,2)).join("")}</row>`);
  rows.forEach((r,i)=>{
    const row=i+6;
    sheetRows.push(`<row r="${row}">${cellXml(r.date,row,1)}${cellXml(r.memberId,row,2)}${cellXml(r.name,row,3)}${cellXml(r.drink,row,4)}${cellXml(r.count,row,5,0,"n")}${cellXml(r.unitPrice,row,6,3,"n")}${cellXml(r.total,row,7,3,"n")}</row>`);
  });
  const last=Math.max(5,rows.length+5);
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:G${last}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="2" width="17" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/><col min="4" max="4" width="22" customWidth="1"/><col min="5" max="5" width="10" customWidth="1"/><col min="6" max="7" width="15" customWidth="1"/></cols>
<sheetData>${sheetRows.join("")}</sheetData>
<autoFilter ref="A5:G${last}"/>
</worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 [$€-407]"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173F2F"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFDCE4E0"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const files=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Monatsabschluss" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/worksheets/sheet1.xml",data:sheet},
    {name:"xl/styles.xml",data:styles}
  ];
  downloadBlob(zipStore(files),`Monatsabschluss_${month}.xlsx`);
}

function exportBackup() {
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),`Getraenkekasse_Backup_${new Date().toISOString().slice(0,10)}.json`);
}
async function restoreBackup() {
  try{
    const file=$("restoreFile").files?.[0]; if(!file) throw new Error("Bitte Sicherungsdatei auswählen.");
    const restored=JSON.parse(await file.text());
    if(!Array.isArray(restored.members)||!Array.isArray(restored.drinks)||!Array.isArray(restored.bookings)) throw new Error("Ungültige Sicherungsdatei.");
    if(!confirm("Aktuelle Daten vollständig durch die Sicherung ersetzen?")) return;
    data=restored; saveData(); refreshAll(); toast("Sicherung eingespielt.");
  }catch(e){toast(e.message);}
}

$("memberLoginBtn").addEventListener("click",loginMember);
$("memberCode").addEventListener("keydown",e=>{if(e.key==="Enter")loginMember();});
$("logoutBtn").addEventListener("click",()=>logoutMember(false));
["pointerdown","keydown","touchstart"].forEach(name=>document.addEventListener(name,()=>{if(activeMember)resetInactivityTimer();},{passive:true}));
$("adminBtn").addEventListener("click",()=>{$("pinArea").hidden=false;$("adminArea").hidden=true;$("pinInput").value="";$("adminDialog").showModal();});
$("pinSubmit").addEventListener("click",()=>{if($("pinInput").value===data.adminPin){$("pinArea").hidden=true;$("adminArea").hidden=false;renderAdmin();}else toast("PIN ist nicht korrekt.");});
$("addMemberBtn").addEventListener("click",()=>{
  const id=$("newMemberId").value.trim(),name=$("newMemberName").value.trim(),code=$("newMemberCode").value.trim();
  if(!id||!name||!/^\d{4}$/.test(code))return toast("ID, Name und 4-stelligen Code eingeben.");
  if(data.members.some(m=>m.id===id||m.code===code))return toast("ID oder Code ist bereits vergeben.");
  data.members.push({id,name,code,active:true});["newMemberId","newMemberName","newMemberCode"].forEach(x=>$(x).value="");saveData();renderAdminMembers();toast("Mitglied hinzugefügt.");
});
$("addDrinkBtn").addEventListener("click",()=>{
  const name=$("newDrinkName").value.trim(),price=Number($("newDrinkPrice").value);
  if(!name||!Number.isFinite(price)||price<0)return toast("Getränk und gültigen Preis eingeben.");
  data.drinks.push({id:uid("D"),name,price,active:true});$("newDrinkName").value="";$("newDrinkPrice").value="";saveData();renderAdminDrinks();renderDrinks();toast("Getränk hinzugefügt.");
});
$("savePinBtn").addEventListener("click",()=>{
  const pin=$("newPin").value.trim();if(!/^\d{4,8}$/.test(pin))return toast("PIN muss 4 bis 8 Ziffern haben.");
  data.adminPin=pin;$("newPin").value="";saveData();toast("PIN gespeichert.");
});
$("importMembersBtn").addEventListener("click",importMembers);
$("importDrinksBtn").addEventListener("click",importDrinks);
$("memberTemplateBtn").addEventListener("click",()=>downloadCsvTemplate("members"));
$("drinkTemplateBtn").addEventListener("click",()=>downloadCsvTemplate("drinks"));
$("reportMonth").addEventListener("change",renderReports);
$("exportExcelBtn").addEventListener("click",exportMonthlyXlsx);
$("exportCsvBtn").addEventListener("click",exportMonthlyCsv);
$("clearMonthBtn").addEventListener("click",()=>{
  const month=$("reportMonth").value, count=monthBookings().length;
  if(count&&confirm(`${count} Buchungen für ${month} dauerhaft löschen?`)){data.bookings=data.bookings.filter(b=>b.createdAt.slice(0,7)!==month);saveData();renderReports();renderRecent();toast("Monat gelöscht.");}
});
$("backupBtn").addEventListener("click",exportBackup);
$("restoreBtn").addEventListener("click",restoreBackup);
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach(p=>p.hidden=true);$(`tab-${btn.dataset.tab}`).hidden=false;
}));
function refreshAll(){renderDrinks();renderRecent();renderAdmin();if(activeMember)updateMemberMonthTotal();}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(console.error));
$("reportMonth").value = currentMonthValue();
refreshAll();

// Beim Laden niemals Daten eines vorherigen Nutzers anzeigen.
activeMember = null;
$("memberPanel").hidden = true;
$("bookingPanel").hidden = true;
$("loginPanel").hidden = false;
$("memberName").textContent = "";
$("memberId").textContent = "";
$("memberMonthTotal").textContent = euro(0);
$("drinkGrid").innerHTML = "";
$("recentBookings").innerHTML = "";
$("memberCode").value = "";
$("memberCode").focus();
