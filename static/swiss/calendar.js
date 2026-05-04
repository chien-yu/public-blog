const state = {
  data: null,
  selectedRole: "dad",
};

const $ = (selector) => document.querySelector(selector);

function updateNetworkStatus() {
  const status = $("#networkStatus");
  const online = navigator.onLine;
  status.textContent = online ? "線上" : "離線";
  status.className = `status ${online ? "online" : "offline"}`;
}

function getRole() {
  return state.data.roles.find((role) => role.id === state.selectedRole) || state.data.roles[0];
}

function appliesTo(day, role) {
  const participants = day.participants || [];
  return participants.includes("all") || participants.includes(role.id) || participants.includes(role.groupId);
}

function getRoleValue(map, role) {
  if (!map) return null;
  return map[role.id] || map[role.groupId] || map.all || null;
}

function getLodging(day, role) {
  const lodgingId = getRoleValue(day.lodging, role);
  return lodgingId ? state.data.lodgings[lodgingId] : null;
}

function getMovements(day, role) {
  return (day.movements || []).filter((movement) => {
    const audience = movement.audience || ["all"];
    return audience.includes("all") || audience.includes(role.id) || audience.includes(role.groupId);
  });
}

function parseDate(day) {
  const [year, month, date] = day.id.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(key) {
  const [year, month] = key.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function renderRoles() {
  $("#rolePicker").innerHTML = state.data.roles.map((role) => `
    <button
      type="button"
      class="${role.id === state.selectedRole ? "active" : ""}"
      data-role-id="${role.id}"
      role="tab"
      aria-selected="${role.id === state.selectedRole}"
    >
      <span>${role.label}</span>
      <small>${role.groupLabel}</small>
    </button>
  `).join("");
}

function renderLodging(lodging, id) {
  if (!lodging) return `<div class="calendar-lodging muted">住宿待確認</div>`;
  const mapLink = lodging.mapUrl
    ? `<a href="${lodging.mapUrl}" target="_blank" rel="noopener">Google Map</a>`
    : `<span>地圖待補</span>`;

  return `
    <div class="calendar-lodging">
      <button class="lodging-button compact" type="button" aria-expanded="false" aria-controls="${id}">
        <span>住宿</span>
        <strong>${lodging.name}</strong>
      </button>
      <div class="lodging-detail" id="${id}" hidden>
        <dl>
          <div>
            <dt>英文 / 備註</dt>
            <dd>${lodging.nameEn || "待補"}</dd>
          </div>
          <div>
            <dt>訂房</dt>
            <dd>${lodging.booking || "待補"}</dd>
          </div>
          <div>
            <dt>地圖</dt>
            <dd>${mapLink}</dd>
          </div>
        </dl>
      </div>
    </div>
  `;
}

function renderDay(day, role) {
  const date = parseDate(day);
  const lodging = getLodging(day, role);
  const movements = getMovements(day, role);
  const lodgingDetailId = `calendar-lodging-${day.id}`;

  return `
    <article class="calendar-day">
      <div class="calendar-date">
        <strong>${date.getDate()}</strong>
        <span>${day.weekday || ""}</span>
      </div>
      <div class="calendar-day-body">
        ${day.dayLabel ? `<p class="event-kicker">${day.dayLabel}</p>` : ""}
        <h3>${day.title}</h3>
        <p>${day.location || ""}</p>
        ${movements.length ? `
          <ul class="calendar-movements">
            ${movements.slice(0, 2).map((movement) => `
              <li><time>${movement.time || "待確認"}</time>${movement.title}</li>
            `).join("")}
          </ul>
        ` : ""}
        ${renderLodging(lodging, lodgingDetailId)}
      </div>
    </article>
  `;
}

function renderMonth(key, days, role) {
  return `
    <section class="calendar-month" aria-labelledby="month-${key}">
      <h2 id="month-${key}">${monthTitle(key)}</h2>
      <div class="calendar-grid">
        ${days.map((day) => renderDay(day, role)).join("")}
      </div>
    </section>
  `;
}

function render() {
  if (!state.data) return;
  const role = getRole();
  const days = state.data.days.filter((day) => appliesTo(day, role));
  const groups = new Map();

  for (const day of days) {
    const key = monthKey(parseDate(day));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(day);
  }

  $("#calendarEyebrow").textContent = role.groupLabel;
  $("#calendarTitle").textContent = `${role.label} 的旅行月曆`;
  $("#calendarSummary").textContent = role.summary;
  $("#calendarRange").textContent = `${days[0]?.date || ""} - ${days.at(-1)?.date || ""}`;

  renderRoles();
  $("#calendar").innerHTML = [...groups.entries()].map(([key, monthDays]) => renderMonth(key, monthDays, role)).join("");
}

async function loadData() {
  const response = await fetch("/swiss/trip-data.json", { cache: "no-cache" });
  state.data = await response.json();
  render();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    $("#offlineReady").textContent = "此瀏覽器不支援離線快取";
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/swiss/sw.js", { scope: "/swiss/" });
    await navigator.serviceWorker.ready;
    $("#offlineReady").textContent = "離線資料已準備";
    registration.addEventListener("updatefound", () => {
      $("#offlineReady").textContent = "正在更新離線資料";
    });
  } catch (error) {
    $("#offlineReady").textContent = "離線快取啟用失敗";
    console.error(error);
  }
}

$("#rolePicker").addEventListener("click", (event) => {
  const button = event.target.closest("[data-role-id]");
  if (!button) return;
  state.selectedRole = button.dataset.roleId;
  render();
});

$("#calendar").addEventListener("click", (event) => {
  const button = event.target.closest(".lodging-button");
  if (!button) return;
  const detail = document.getElementById(button.getAttribute("aria-controls"));
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  detail.hidden = expanded;
});

$("#refreshButton").addEventListener("click", async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));
  }
  await loadData();
  $("#offlineReady").textContent = "離線資料已更新";
});

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

updateNetworkStatus();
registerServiceWorker();
loadData().catch(() => {
  $("#calendar").innerHTML = `<div class="empty">月曆資料載入失敗。第一次離線測試前，請先在有網路時開啟一次。</div>`;
});
