const state = {
  data: null,
  selectedRole: "dad",
  query: "",
};

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

function daySearchText(day, role) {
  const lodging = getLodging(day, role);
  return [
    day.date,
    day.weekday,
    day.dayLabel,
    day.location,
    day.summary,
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

function renderMovementDetails(movement, detailId) {
  const detailItems = movement.detailItems || [];
  const hasDetail = movement.detail || detailItems.length || movement.documents?.length;
  if (!hasDetail) return "";

  return `
    <div class="movement-detail" id="${detailId}" hidden>
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
      <button class="movement-button" type="button" aria-expanded="false" aria-controls="${detailId}">
        <time>${movement.time || "待確認"}</time>
        <span>
          <strong>${movement.title}</strong>
          ${movement.summary ? `<small>${movement.summary}</small>` : ""}
        </span>
        <em>查看細節</em>
      </button>
      ${renderMovementDetails(movement, detailId)}
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

  return `<div class="stay-badges">${badges.map((badge) => `<span>${badge}</span>`).join("")}</div>`;
}

function renderLodging(lodging, stayContext, overnight, index) {
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
        ${renderStayBadges(lodging, stayContext)}
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
            <dd>${lodging.booking || "待補"}</dd>
          </div>
          <div>
            <dt>住宿備註</dt>
            <dd>${lodging.stayNote || "待補"}</dd>
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
  const movements = getMovements(day, role);
  const lodging = getLodging(day, role);
  const overnight = getOvernight(day, role);
  const stayContext = getStayContext(days, index, role);

  return `
    <article>
      <div class="date-rail">
        <strong>${day.date}</strong>
        <span>${day.weekday || ""}</span>
        ${day.dayLabel ? `<em>${day.dayLabel}</em>` : ""}
      </div>
      <div class="event-body">
        <p class="event-kicker">${day.location || "地點待確認"}</p>
        <h3>${day.title}</h3>
        <p>${day.summary || ""}</p>
        ${movements.length ? `<ul class="movement-list">${movements.map((movement, movementIndex) => renderMovement(movement, `movement-${index}-${movementIndex}`)).join("")}</ul>` : ""}
        ${renderLodging(lodging, stayContext, overnight, index)}
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

  $("#viewEyebrow").textContent = role.groupLabel;
  $("#viewTitle").textContent = role.heroTitle;
  $("#viewSummary").textContent = role.summary;
  $("#timelineEyebrow").textContent = `${role.label} 的視角`;
  $("#timelineTitle").textContent = role.timelineTitle;

  renderRoles();

  $("#itinerary").innerHTML = days.length
    ? days.map((day, index) => renderDay(day, role, days, index)).join("")
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

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

updateNetworkStatus();
registerServiceWorker();
loadData().catch(() => {
  $("#itinerary").innerHTML = `<div class="empty">行程資料載入失敗。第一次離線測試前，請先在有網路時開啟一次。</div>`;
});
