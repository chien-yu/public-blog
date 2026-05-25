const state = {
  data: null,
  selectedRole: localStorage.getItem("swiss_trip_role") || "dad",
  useCustomTime: localStorage.getItem("swiss_trip_use_custom") === "true",
  customTimeValue: localStorage.getItem("swiss_trip_custom_value") || "2026-06-04T12:00",
  customTimezoneValue: localStorage.getItem("swiss_trip_custom_timezone") || "Europe/Zurich",
};

// Dynamic timezone and absolute timestamp helper logic
function getDayTimezone(day) {
  if (!day) return "Europe/Zurich";
  if (day.timezone) return day.timezone;
  if (day.location) {
    const loc = day.location.toLowerCase();
    if (loc.includes("台北") || loc.includes("taipei")) {
      return "Asia/Taipei";
    }
    if (loc.includes("新加坡") || loc.includes("singapore")) {
      return "Asia/Singapore";
    }
    if (loc.includes("倫敦") || loc.includes("london")) {
      return "Europe/London";
    }
  }
  return "Europe/Zurich";
}

function isValidTimezone(tz) {
  try {
    if (!tz) return false;
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

function getActiveTimezone() {
  if (state.useCustomTime && isValidTimezone(state.customTimezoneValue)) {
    return state.customTimezoneValue;
  }
  const now = new Date();
  const formattedZurich = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [m, d, y] = formattedZurich.split("/");
  const todayStr = `${y}-${m}-${d}`;
  const todayDay = state.data?.days.find(day => day.id === todayStr);
  return getDayTimezone(todayDay);
}

function getAbsoluteTimestamp(dateStr, timeStr, timezone) {
  const [year, month, day] = dateStr.split("/").join("-").split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  
  const tz = isValidTimezone(timezone) ? timezone : "Europe/Zurich";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  
  const parts = formatter.formatToParts(utcDate);
  const getPart = (type) => parts.find(p => p.type === type).value;
  
  const tYear = Number(getPart("year"));
  const tMonth = Number(getPart("month"));
  const tDay = Number(getPart("day"));
  let tHour = Number(getPart("hour"));
  if (tHour === 24) tHour = 0;
  const tMinute = Number(getPart("minute"));
  
  const localMs = Date.UTC(tYear, tMonth - 1, tDay, tHour, tMinute);
  const offsetMs = localMs - utcDate.getTime();
  
  return utcDate.getTime() - offsetMs;
}

function formatDisplayTime(timestamp, tz) {
  const targetTz = isValidTimezone(tz) ? tz : "Europe/Zurich";
  const formatter = new Intl.DateTimeFormat("zh-Hant", {
    timeZone: targetTz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  let tzLabel = targetTz;
  if (targetTz === "Europe/Zurich") tzLabel = "歐洲中部時間";
  else if (targetTz === "Europe/London") tzLabel = "英國時間";
  else if (targetTz === "Asia/Taipei") tzLabel = "台北時間";
  return `${formatter.format(new Date(timestamp))} (${tzLabel})`;
}

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

function getOvernight(day, role) {
  return getRoleValue(day.overnight, role);
}

function getLodgingId(day, role) {
  return getRoleValue(day.lodging, role);
}

function getMovements(day, role) {
  return (day.movements || []).filter((movement) => {
    const audience = movement.audience || ["all"];
    return audience.includes("all") || audience.includes(role.id) || audience.includes(role.groupId);
  });
}

function getStayContext(days, dayIndex, role) {
  const lodgingId = getLodgingId(days[dayIndex], role);
  if (!lodgingId) return null;

  const previousId = dayIndex > 0 ? getLodgingId(days[dayIndex - 1], role) : null;
  const nextId = dayIndex < days.length - 1 ? getLodgingId(days[dayIndex + 1], role) : null;

  return {
    lodgingId,
    isFirstNight: lodgingId !== previousId,
    isLastNight: lodgingId !== nextId,
  };
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

function renderStayBadges(lodging, stayContext) {
  if (!stayContext) return "";

  const badges = [];
  if (stayContext.isFirstNight) {
    badges.push(`入住${lodging.checkInTime ? ` ${lodging.checkInTime}` : ""}`);
  } else {
    badges.push("續住");
  }

  if (stayContext.isLastNight) {
    badges.push(`明早退房${lodging.checkOutTime ? ` ${lodging.checkOutTime}` : ""}`);
  }

  return `<div class="stay-badges compact">${badges.map((badge) => `<span>${badge}</span>`).join("")}</div>`;
}

function renderLodging(lodging, stayContext, overnight, id) {
  if (!lodging) return `<div class="calendar-lodging muted">${overnight || "住宿待確認"}</div>`;
  const mapLink = lodging.mapUrl
    ? `<a href="${lodging.mapUrl}" target="_blank" rel="noopener">Google Map</a>`
    : `<span>地圖待補</span>`;

  return `
    <div class="calendar-lodging">
      <button class="lodging-button compact" type="button" aria-expanded="false" aria-controls="${id}">
        <span>住宿</span>
        <strong>${lodging.name}</strong>
        ${renderStayBadges(lodging, stayContext)}
        <em>查看住宿資訊</em>
      </button>
      <div class="lodging-detail" id="${id}" hidden>
        <dl>
          <div>
            <dt>英文 / 備註</dt>
            <dd>${lodging.nameEn || "待補"}${lodging.stayNote ? `；${lodging.stayNote}` : ""}</dd>
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

function renderDocuments(documents) {
  if (!documents?.length) return "";
  return `
    <div class="document-links compact">
      ${documents.map((document) => `
        <a href="${document.href}" target="_blank" rel="noopener">
          <span>${document.type || "PDF"}</span>
          ${document.label}
        </a>
      `).join("")}
    </div>
  `;
}

function renderMovementDetail(movement, detailId) {
  const detailItems = movement.detailItems || [];
  const hasDetail = movement.detail || detailItems.length || movement.documents?.length;
  if (!hasDetail) return "";

  return `
    <div class="movement-detail compact" id="${detailId}" hidden>
      ${movement.detail ? `<p>${movement.detail}</p>` : ""}
      ${detailItems.length ? `
        <dl>
          ${detailItems.map((item) => `
            <div>
              <dt>${item.label}</dt>
              <dd>${item.value}</dd>
            </div>
          `).join("")}
        </dl>
      ` : ""}
      ${renderDocuments(movement.documents)}
    </div>
  `;
}

function renderMovement(movement, detailId) {
  return `
    <li>
      <button class="movement-button compact" type="button" aria-expanded="false" aria-controls="${detailId}">
        <time>${movement.time || "待確認"}</time>
        <span>
          <strong>${movement.title}</strong>
          ${movement.summary ? `<small>${movement.summary}</small>` : ""}
        </span>
        <em>查看細節</em>
      </button>
      ${renderMovementDetail(movement, detailId)}
    </li>
  `;
}

function renderDay(day, role, roleDays) {
  const date = parseDate(day);
  const lodging = getLodging(day, role);
  const overnight = getOvernight(day, role);
  const stayContext = getStayContext(roleDays, roleDays.indexOf(day), role);
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
        ${movements.length ? `
          <ul class="calendar-movements">
            ${movements.slice(0, 2).map((movement, movementIndex) => renderMovement(movement, `calendar-movement-${day.id}-${movementIndex}`)).join("")}
          </ul>
        ` : ""}
        ${renderLodging(lodging, stayContext, overnight, lodgingDetailId)}
      </div>
    </article>
  `;
}

function renderMonth(key, days, role, roleDays) {
  return `
    <section class="calendar-month" aria-labelledby="month-${key}">
      <h2 id="month-${key}">${monthTitle(key)}</h2>
      <div class="calendar-grid">
        ${days.map((day) => renderDay(day, role, roleDays)).join("")}
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

  // Compute absolute active timestamp and timezone
  const activeTz = getActiveTimezone();
  let activeTimestamp;
  if (state.useCustomTime) {
    const [datePart, timePart] = state.customTimeValue.split("T");
    activeTimestamp = getAbsoluteTimestamp(datePart, timePart || "00:00", activeTz);
  } else {
    activeTimestamp = Date.now();
  }

  // Update current time display if element exists
  const timeDisplayEl = $("#currentTimeDisplay");
  if (timeDisplayEl) {
    timeDisplayEl.textContent = formatDisplayTime(activeTimestamp, activeTz);
  }

  $("#calendarRange").textContent = `${days[0]?.date || ""} - ${days.at(-1)?.date || ""}`;

  renderRoles();
  $("#calendar").innerHTML = [...groups.entries()].map(([key, monthDays]) => renderMonth(key, monthDays, role, days)).join("");
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
  localStorage.setItem("swiss_trip_role", state.selectedRole);
  render();
});

$("#calendar").addEventListener("click", (event) => {
  const button = event.target.closest(".lodging-button, .movement-button");
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

function initTimeSimulationListeners() {
  const toggle = $("#toggleCustomTime");
  const inputsContainer = $("#customTimeInputs");
  const dateTimeInput = $("#customDateTime");
  const timezoneSelect = $("#customTimezone");

  if (!toggle || !inputsContainer || !dateTimeInput) return;

  toggle.checked = state.useCustomTime;
  inputsContainer.hidden = !state.useCustomTime;
  dateTimeInput.value = state.customTimeValue;
  if (timezoneSelect) {
    timezoneSelect.value = state.customTimezoneValue;
  }

  toggle.addEventListener("change", (e) => {
    state.useCustomTime = e.target.checked;
    localStorage.setItem("swiss_trip_use_custom", String(state.useCustomTime));
    inputsContainer.hidden = !state.useCustomTime;
    render();
  });

  dateTimeInput.addEventListener("input", (e) => {
    state.customTimeValue = e.target.value;
    localStorage.setItem("swiss_trip_custom_value", state.customTimeValue);
    render();
  });

  if (timezoneSelect) {
    timezoneSelect.addEventListener("input", (e) => {
      state.customTimezoneValue = e.target.value;
      localStorage.setItem("swiss_trip_custom_timezone", state.customTimezoneValue);
      render();
    });
  }
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

updateNetworkStatus();
registerServiceWorker();
initTimeSimulationListeners();

setInterval(() => {
  if (!state.useCustomTime) {
    render();
  }
}, 10000);

loadData().catch(() => {
  $("#calendar").innerHTML = `<div class="empty">月曆資料載入失敗。第一次離線測試前，請先在有網路時開啟一次。</div>`;
});
