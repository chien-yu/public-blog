const state = {
  data: null,
  query: "",
};

const $ = (selector) => document.querySelector(selector);

function updateNetworkStatus() {
  const status = $("#networkStatus");
  const online = navigator.onLine;
  status.textContent = online ? "線上" : "離線";
  status.className = `status ${online ? "online" : "offline"}`;
}

function searchableText(item) {
  return Object.values(item).flat().join(" ").toLowerCase();
}

function render() {
  if (!state.data) return;

  const query = state.query.trim().toLowerCase();
  const days = state.data.itinerary.filter((item) => searchableText(item).includes(query));
  const essentials = state.data.essentials.filter((item) => searchableText(item).includes(query));

  $("#todayTitle").textContent = state.data.today.title;
  $("#todaySummary").textContent = state.data.today.summary;

  $("#itinerary").innerHTML = days.length
    ? days.map((day) => `
        <article>
          <h3>${day.date} · ${day.title}</h3>
          <p>${day.summary}</p>
          <div class="meta">
            ${day.tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
        </article>
      `).join("")
    : `<div class="empty">找不到符合「${state.query}」的行程。</div>`;

  $("#essentials").innerHTML = essentials.length
    ? essentials.map((item) => `
        <article>
          <h3>${item.title}</h3>
          <p>${item.detail}</p>
        </article>
      `).join("")
    : `<div class="empty">找不到符合「${state.query}」的重要資訊。</div>`;
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
  $("#itinerary").innerHTML = `<div class="empty">資料載入失敗。若是第一次開啟，請先連上網路。</div>`;
});
