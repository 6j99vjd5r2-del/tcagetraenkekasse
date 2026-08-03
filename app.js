
const STORAGE_KEY = "getraenkekasse2_data";

const defaultData = {
  members: [
    { name: "Daniel", code: "1001" },
    { name: "Anna", code: "1002" },
    { name: "Max Mustermann", code: "1003" },
    { name: "Lisa Beispiel", code: "1004" }
  ],
  drinks: [
    { name: "Wasser", price: 1.50 },
    { name: "Spezi", price: 2.00 },
    { name: "Apfelschorle", price: 2.00 },
    { name: "Bier", price: 2.50 },
    { name: "Kaffee", price: 1.50 }
  ],
  bookings: [],
  adminPin: "2468"
};

let data = loadData();
let activeMember = null;

const INACTIVITY_SECONDS = 10;
let inactivitySecondsLeft = INACTIVITY_SECONDS;
let inactivityInterval = null;

const $ = (id) => document.getElementById(id);

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const loaded = saved ? JSON.parse(saved) : structuredClone(defaultData);

    // Migration der ersten Version: Namen ohne Code werden in Mitgliederobjekte umgewandelt.
    if (Array.isArray(loaded.members) && loaded.members.some(m => typeof m === "string")) {
      loaded.members = loaded.members.map((member, index) =>
        typeof member === "string"
          ? { name: member, code: String(7000 + index).slice(-4) }
          : member
      );
    }
    return loaded;
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function euro(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function dateTime(iso) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

function startInactivityTimer() {
  stopInactivityTimer();
  inactivitySecondsLeft = INACTIVITY_SECONDS;
  updateSessionInfo();

  inactivityInterval = setInterval(() => {
    inactivitySecondsLeft -= 1;
    updateSessionInfo();

    if (inactivitySecondsLeft <= 0) {
      logoutMember(true);
    }
  }, 1000);
}

function resetInactivityTimer() {
  if (!activeMember) return;
  inactivitySecondsLeft = INACTIVITY_SECONDS;
  updateSessionInfo();
}

function stopInactivityTimer() {
  if (inactivityInterval) {
    clearInterval(inactivityInterval);
    inactivityInterval = null;
  }
}

function updateSessionInfo() {
  const el = $("sessionInfo");
  if (!el) return;
  el.textContent = `Automatische Abmeldung in ${inactivitySecondsLeft} Sekunde${inactivitySecondsLeft === 1 ? "" : "n"}`;
  el.classList.toggle("warning", inactivitySecondsLeft <= 3);
}

function loginMember() {
  const code = $("memberCode").value.trim();
  if (!/^\d{4}$/.test(code)) {
    toast("Bitte einen 4-stelligen Code eingeben.");
    return;
  }

  const member = data.members.find(m => m.code === code);
  if (!member) {
    $("memberCode").value = "";
    toast("Code nicht gefunden.");
    return;
  }

  activeMember = member;
  $("memberCode").value = "";
  $("loginCard").hidden = true;
  $("bookingCard").hidden = false;
  $("selectedMember").textContent = `Angemeldet: ${member.name}`;
  renderDrinks();
  startInactivityTimer();
}

function logoutMember(automatic = false) {
  stopInactivityTimer();
  activeMember = null;
  $("bookingCard").hidden = true;
  $("loginCard").hidden = false;
  $("memberCode").value = "";
  $("memberCode").focus();
  if (automatic) toast("Automatisch abgemeldet.");
}

function renderDrinks() {
  $("drinkGrid").innerHTML = data.drinks
    .slice().sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((drink, index) => `
      <button class="tile drink-tile" data-drink-index="${index}">
        ${escapeHtml(drink.name)}
        <span>${euro(drink.price)}</span>
      </button>
    `).join("");

  const sortedDrinks = data.drinks.slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
  document.querySelectorAll("[data-drink-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!activeMember) {
        toast("Bitte zuerst anmelden.");
        return;
      }

      const drink = sortedDrinks[Number(btn.dataset.drinkIndex)];
      data.bookings.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        member: activeMember.name,
        memberCode: activeMember.code,
        drink: drink.name,
        price: Number(drink.price),
        createdAt: new Date().toISOString()
      });
      saveData();
      renderRecent();
      toast(`${drink.name} für ${activeMember.name} gebucht`);
      resetInactivityTimer();
    });
  });
}

function renderRecent() {
  const recent = [...data.bookings].reverse().slice(0, 8);
  $("recentBookings").innerHTML = recent.length
    ? recent.map(b => `
      <div class="recent-row">
        <strong>${escapeHtml(b.member)} · ${escapeHtml(b.drink)}</strong>
        <span>${euro(b.price)}</span>
        <span class="time">${dateTime(b.createdAt)}</span>
      </div>
    `).join("")
    : `<p class="hint">Noch keine Buchungen vorhanden.</p>`;
}

function renderAdmin() {
  const sortedMembers = data.members.slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
  $("adminMembers").innerHTML = sortedMembers.map((member, index) => `
    <div class="list-row">
      <span>${escapeHtml(member.name)} · <span class="member-code">${escapeHtml(member.code)}</span></span>
      <button type="button" class="small danger" data-remove-member="${index}">Löschen</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-remove-member]").forEach(btn => {
    btn.addEventListener("click", () => {
      const member = sortedMembers[Number(btn.dataset.removeMember)];
      if (confirm(`${member.name} wirklich löschen?`)) {
        data.members = data.members.filter(m => !(m.name === member.name && m.code === member.code));
        if (activeMember?.code === member.code) logoutMember();
        saveData();
        refreshAll();
      }
    });
  });

  const sortedDrinks = data.drinks.slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
  $("adminDrinks").innerHTML = sortedDrinks.map((drink, index) => `
    <div class="list-row">
      <span>${escapeHtml(drink.name)} · ${euro(drink.price)}</span>
      <button type="button" class="small danger" data-remove-drink="${index}">Löschen</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-remove-drink]").forEach(btn => {
    btn.addEventListener("click", () => {
      const drink = sortedDrinks[Number(btn.dataset.removeDrink)];
      if (confirm(`${drink.name} wirklich löschen?`)) {
        data.drinks = data.drinks.filter(d => !(d.name === drink.name && d.price === drink.price));
        saveData();
        refreshAll();
      }
    });
  });

  renderReports();
}

function renderReports() {
  const totals = {};
  data.bookings.forEach(b => {
    totals[b.member] ??= { count: 0, sum: 0 };
    totals[b.member].count += 1;
    totals[b.member].sum += Number(b.price);
  });

  const totalSum = data.bookings.reduce((s, b) => s + Number(b.price), 0);
  $("summary").innerHTML = `
    <p><strong>Gesamt:</strong> ${data.bookings.length} Buchungen · ${euro(totalSum)}</p>
    ${Object.entries(totals).length ? `
      <table>
        <thead><tr><th>Mitglied</th><th>Anzahl</th><th>Summe</th></tr></thead>
        <tbody>
          ${Object.entries(totals)
            .sort((a,b)=>a[0].localeCompare(b[0],"de"))
            .map(([member, v]) => `<tr><td>${escapeHtml(member)}</td><td>${v.count}</td><td>${euro(v.sum)}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    ` : `<p class="hint">Noch keine Buchungen vorhanden.</p>`}
  `;

  const rows = [...data.bookings].reverse();
  $("bookingTable").innerHTML = rows.length ? `
    <h3>Einzelbuchungen</h3>
    <table>
      <thead><tr><th>Zeit</th><th>Mitglied</th><th>Getränk</th><th>Preis</th><th></th></tr></thead>
      <tbody>
        ${rows.map(b => `
          <tr>
            <td>${dateTime(b.createdAt)}</td>
            <td>${escapeHtml(b.member)}</td>
            <td>${escapeHtml(b.drink)}</td>
            <td>${euro(b.price)}</td>
            <td><button type="button" class="small danger" data-delete-booking="${b.id}">×</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "";

  document.querySelectorAll("[data-delete-booking]").forEach(btn => {
    btn.addEventListener("click", () => {
      data.bookings = data.bookings.filter(b => b.id !== btn.dataset.deleteBooking);
      saveData();
      refreshAll();
    });
  });
}

function refreshAll() {
  renderDrinks();
  renderRecent();
  renderAdmin();
}

$("memberLoginBtn").addEventListener("click", loginMember);
$("memberCode").addEventListener("keydown", event => {
  if (event.key === "Enter") loginMember();
});
$("logoutBtn").addEventListener("click", () => logoutMember(false));

["pointerdown", "keydown", "touchstart"].forEach(eventName => {
  document.addEventListener(eventName, () => {
    if (activeMember) resetInactivityTimer();
  }, { passive: true });
});

$("adminBtn").addEventListener("click", () => {
  $("pinArea").hidden = false;
  $("adminArea").hidden = true;
  $("pinInput").value = "";
  $("adminDialog").showModal();
});

$("pinSubmit").addEventListener("click", () => {
  if ($("pinInput").value === data.adminPin) {
    $("pinArea").hidden = true;
    $("adminArea").hidden = false;
    renderAdmin();
  } else {
    toast("PIN ist nicht korrekt.");
  }
});

$("addMemberBtn").addEventListener("click", () => {
  const name = $("newMemberName").value.trim();
  const code = $("newMemberCode").value.trim();

  if (!name || !/^\d{4}$/.test(code)) {
    toast("Bitte Namen und einen 4-stelligen Code eingeben.");
    return;
  }
  if (data.members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    toast("Mitglied existiert bereits.");
    return;
  }
  if (data.members.some(m => m.code === code)) {
    toast("Dieser Code ist bereits vergeben.");
    return;
  }

  data.members.push({ name, code });
  $("newMemberName").value = "";
  $("newMemberCode").value = "";
  saveData();
  refreshAll();
});

$("addDrinkBtn").addEventListener("click", () => {
  const name = $("newDrinkName").value.trim();
  const price = Number($("newDrinkPrice").value);
  if (!name || Number.isNaN(price) || price < 0) {
    toast("Bitte Getränk und gültigen Preis eingeben.");
    return;
  }
  data.drinks.push({ name, price });
  $("newDrinkName").value = "";
  $("newDrinkPrice").value = "";
  saveData();
  refreshAll();
});

$("savePinBtn").addEventListener("click", () => {
  const pin = $("newPin").value.trim();
  if (!/^\d{4,8}$/.test(pin)) {
    toast("PIN muss aus 4 bis 8 Ziffern bestehen.");
    return;
  }
  data.adminPin = pin;
  $("newPin").value = "";
  saveData();
  toast("PIN gespeichert.");
});

$("exportBtn").addEventListener("click", () => {
  const header = ["Datum", "Uhrzeit", "Mitglied", "Mitgliedscode", "Getränk", "Preis"];
  const lines = data.bookings.map(b => {
    const d = new Date(b.createdAt);
    return [
      d.toLocaleDateString("de-DE"),
      d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      b.member,
      b.memberCode || "",
      b.drink,
      Number(b.price).toFixed(2).replace(".", ",")
    ];
  });
  const csv = [header, ...lines]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `getraenkekasse_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

$("clearBookingsBtn").addEventListener("click", () => {
  if (confirm("Wirklich alle Buchungen dauerhaft löschen?")) {
    data.bookings = [];
    saveData();
    refreshAll();
  }
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.hidden = true);
    $(`tab-${btn.dataset.tab}`).hidden = false;
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

refreshAll();
$("memberCode").focus();
