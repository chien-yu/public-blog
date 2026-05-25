const state = {
  data: null,
  selectedRole: localStorage.getItem("swiss_trip_role") || "dad",
  query: "",
  // Time simulation states
  useCustomTime: localStorage.getItem("swiss_trip_use_custom") === "true",
  customTimeValue: localStorage.getItem("swiss_trip_custom_value") || "2026-06-04T12:00",
  customTimezoneValue: localStorage.getItem("swiss_trip_custom_timezone") || "Europe/Zurich",
  nowMovementId: null,
  nextMovementId: null,
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

function linkify(text) {
  if (!text) return "";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
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

function normalize(value) {
  return String(value ?? "").toLowerCase();
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

function getMovementsWithIndex(day, role) {
  return (day.movements || [])
    .map((movement, idx) => ({ movement, originalIndex: idx }))
    .filter(({ movement }) => {
      const audience = movement.audience || ["all"];
      return audience.includes("all") || audience.includes(role.id) || audience.includes(role.groupId);
    });
}



function daySearchText(day, role) {
  const lodging = getLodging(day, role);
  return [
    day.date,
    day.weekday,
    day.dayLabel,
    ...(day.notes || []),
    ...getMovements(day, role).flatMap((movement) => [
      movement.time,
      movement.title,
      movement.summary,
      movement.detail,
      ...(movement.detailItems || []).flatMap((item) => [item.label, item.value]),
      ...(movement.documents || []).flatMap((document) => [document.label, document.type]),
    ]),
    lodging?.name,
    lodging?.nameEn,
    lodging?.address,
    lodging?.booking,
    lodging?.checkInTime,
    lodging?.checkOutTime,
    lodging?.stayNote,
    getOvernight(day, role),
  ].map(normalize).join(" ");
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

function renderMovementDetails(movement, detailId, hiddenAttr = "hidden") {
  const detailItems = movement.detailItems || [];
  const hasDetail = movement.detail || detailItems.length || movement.documents?.length;
  if (!hasDetail) return "";

  return `
    <div class="movement-detail" id="${detailId}" ${hiddenAttr}>
      ${movement.detail ? `<p>${linkify(movement.detail)}</p>` : ""}
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
  const isNow = detailId === state.nowMovementId;
  const isNext = detailId === state.nextMovementId;
  const expanded = isNow ? "true" : "false";
  const hiddenAttr = isNow ? "" : "hidden";

  const badge = isNow 
    ? `<span class="pill-badge pill-now">現在要做</span>` 
    : (isNext ? `<span class="pill-badge pill-next">等等要做</span>` : "");

  const highlightClass = isNow ? "is-now" : (isNext ? "is-next" : "");

  return `
    <li class="${highlightClass}">
      <button class="movement-button" type="button" aria-expanded="${expanded}" aria-controls="${detailId}">
        <time>${movement.time || "待確認"}</time>
        <span>
          <strong>${movement.title}${badge}</strong>
          ${movement.summary ? `<small>${movement.summary}</small>` : ""}
        </span>
        <em>查看細節</em>
      </button>
      ${renderMovementDetails(movement, detailId, hiddenAttr)}
    </li>
  `;
}

function renderDocuments(documents) {
  if (!documents?.length) return "";
  return `
    <div class="document-links">
      ${documents.map((document) => `
        <a href="${document.href}" target="_blank" rel="noopener">
          <span>${document.type || "PDF"}</span>
          ${document.label}
        </a>
      `).join("")}
    </div>
  `;
}

function toggleDisclosure(button) {
  const detail = document.getElementById(button.getAttribute("aria-controls"));
  if (!detail) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  detail.hidden = expanded;
}

function renderStayBadges(day, role) {
  const badges = getRoleValue(day.lodgingBadges, role) || [];
  if (!badges.length) return "";
  return `<div class="stay-badges">${badges.map((badge) => `<span>${badge}</span>`).join("")}</div>`;
}

function renderLodging(day, role, index) {
  const lodging = getLodging(day, role);
  const overnight = getOvernight(day, role);
  if (!lodging) {
    return `<div class="lodging-empty">${overnight || "住宿待確認"}</div>`;
  }

  const mapLink = lodging.mapUrl
    ? `<a href="${lodging.mapUrl}" target="_blank" rel="noopener">Google Map</a>`
    : `<span>地圖待補</span>`;

  return `
    <div class="lodging">
      <button class="lodging-button" type="button" aria-expanded="false" aria-controls="lodging-${index}">
        <span>今晚住宿</span>
        <strong>${lodging.name}${lodging.nameEn ? `（${lodging.nameEn}）` : ""}</strong>
        ${renderStayBadges(day, role)}
        <em>查看住宿資訊</em>
      </button>
      <div class="lodging-detail" id="lodging-${index}" hidden>
        <dl>
          <div>
            <dt>地址</dt>
            <dd>${lodging.address || "待補"}</dd>
          </div>
          <div>
            <dt>訂房</dt>
            <dd>${linkify(lodging.booking) || "待補"}</dd>
          </div>
          <div>
            <dt>住宿備註</dt>
            <dd>${linkify(lodging.stayNote) || "待補"}</dd>
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

function renderDay(day, role, days, index) {
  let movementsWithIdx = getMovementsWithIndex(day, role);
  if (!state.query) {
    movementsWithIdx = movementsWithIdx.filter(({ originalIndex }) => {
      const id = `movement-${day.id}-${originalIndex}`;
      return !state.expiredMovementIds.has(id);
    });
  }

  return `
    <article>
      <div class="date-rail">
        <strong>${day.date}</strong>
        <span>${day.weekday || ""}</span>
        ${day.dayLabel ? `<em>${day.dayLabel}</em>` : ""}
      </div>
      <div class="event-body">
        <h3>${day.title}</h3>
        ${movementsWithIdx.length ? `<ul class="movement-list">${movementsWithIdx.map(({ movement, originalIndex }) => renderMovement(movement, `movement-${day.id}-${originalIndex}`)).join("")}</ul>` : ""}
        ${renderLodging(day, role, day.id)}
        ${(day.notes || []).length ? `
          <div class="notes">
            ${day.notes.map((note) => `<p>${note}</p>`).join("")}
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function render() {
  if (!state.data) return;

  const role = getRole();
  const query = state.query.trim().toLowerCase();
  const days = state.data.days
    .filter((day) => appliesTo(day, role))
    .filter((day) => daySearchText(day, role).includes(query));

  // Compute absolute active timestamp and timezone
  const activeTz = getActiveTimezone();
  let activeTimestamp;
  if (state.useCustomTime) {
    const [datePart, timePart] = state.customTimeValue.split("T");
    activeTimestamp = getAbsoluteTimestamp(datePart, timePart || "00:00", activeTz);
  } else {
    activeTimestamp = Date.now();
  }

  // Build a list of all movements with absolute timestamps based on their day's timezone
  const allMovements = [];
  for (const day of state.data.days) {
    if (!appliesTo(day, role)) continue;
    const dayTz = getDayTimezone(day);
    const movementsWithIdx = getMovementsWithIndex(day, role);
    movementsWithIdx.forEach(({ movement, originalIndex }) => {
      const timeStr = movement.time && /^\d{2}:\d{2}$/.test(movement.time) ? movement.time : "00:00";
      const timestamp = getAbsoluteTimestamp(day.id, timeStr, dayTz);
      allMovements.push({
        id: `movement-${day.id}-${originalIndex}`,
        dayId: day.id,
        timestamp: timestamp,
        movement: movement
      });
    });
  }

  allMovements.sort((a, b) => a.timestamp - b.timestamp);

  // Get active date formatted
  const activeDateStr = new Intl.DateTimeFormat("en-US", { timeZone: activeTz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(activeTimestamp));
  const [am, ad, ay] = activeDateStr.split("/");
  const activeDateFormatted = `${ay}-${am}-${ad}`;

  // Find expired movements
  const expiredMovementIds = new Set();
  const pastOrEqualMovements = allMovements.filter(m => m.timestamp <= activeTimestamp);
  if (pastOrEqualMovements.length > 0) {
    const latestPastTimestamp = pastOrEqualMovements[pastOrEqualMovements.length - 1].timestamp;
    allMovements.forEach(m => {
      if (m.timestamp < latestPastTimestamp) {
        expiredMovementIds.add(m.id);
      }
    });
  }
  state.expiredMovementIds = expiredMovementIds;

  let nowMovementId = null;
  if (pastOrEqualMovements.length > 0) {
    const candidateNow = pastOrEqualMovements[pastOrEqualMovements.length - 1];
    if (candidateNow.dayId === activeDateFormatted) {
      nowMovementId = candidateNow.id;
    }
  }

  let nextMovementId = null;
  const candidateNext = allMovements.find(m => m.timestamp > activeTimestamp);
  if (candidateNext) {
    nextMovementId = candidateNext.id;
  }

  state.nowMovementId = nowMovementId;
  state.nextMovementId = nextMovementId;

  // Update current time display if element exists
  const timeDisplayEl = $("#currentTimeDisplay");
  if (timeDisplayEl) {
    timeDisplayEl.textContent = formatDisplayTime(activeTimestamp, activeTz);
  }

  $("#timelineEyebrow").textContent = `${role.label} 的視角`;
  $("#timelineTitle").textContent = role.timelineTitle;

  renderRoles();

  let activeDays = days;
  if (!query) {
    const hasUnexpiredDays = days.some(d => d.id >= activeDateFormatted);
    if (hasUnexpiredDays) {
      activeDays = days.filter(d => d.id >= activeDateFormatted);
    }
  }

  $("#itinerary").innerHTML = activeDays.length
    ? activeDays.map((day) => renderDay(day, role, days, days.indexOf(day))).join("")
    : `<div class="empty">找不到符合「${state.query}」的行程。</div>`;

  $("#essentials").innerHTML = state.data.essentials.map((item) => `
    <article>
      <p class="event-kicker">${item.type}</p>
      <h3>${item.title}</h3>
      <p>${item.detail}</p>
    </article>
  `).join("");
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

$("#itinerary").addEventListener("click", (event) => {
  const button = event.target.closest(".lodging-button, .movement-button");
  if (!button) return;
  toggleDisclosure(button);
});

$("#searchBox").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
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
  $("#itinerary").innerHTML = `<div class="empty">行程資料載入失敗。第一次離線測試前，請先在有網路時開啟一次。</div>`;
});
