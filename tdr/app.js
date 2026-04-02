/* web のメニュー切り替え実装に合わせた最小構成 */

let currentViewMode = "gear"; // gear | weapon_talent
window.currentViewMode = currentViewMode;

const state = {
  payload: null,
};

const contentEl = document.getElementById("content");
const navMenuBtn = document.getElementById("navMenuBtn");
const navMenuPanel = document.getElementById("navMenuPanel");
const navGearBtn = document.getElementById("navGearBtn");
const navWeaponTalentBtn = document.getElementById("navWeaponTalentBtn");
const pageTitleEl = document.querySelector(".topbar .title");

if (navMenuPanel) navMenuPanel.inert = true;

function getViewModeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const view = String(params.get("view") || "").trim();
    if (view === "weapon_talent") return "weapon_talent";
  } catch (_e) {}
  return "gear";
}

function syncViewModeToUrl(mode) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("view", mode === "weapon_talent" ? "weapon_talent" : "gear");
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch (_e) {}
}

function getPageTitle(mode) {
  return mode === "weapon_talent"
    ? "Division Resurgence Weapon Talents"
    : "Division Resurgence Gears";
}

function updatePageTitle(mode) {
  const title = getPageTitle(mode);
  if (pageTitleEl) pageTitleEl.textContent = title;
  document.title = title;
}

function sortByJapaneseName(items, keyName) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const av = String(a?.[keyName] || "").trim();
    const bv = String(b?.[keyName] || "").trim();
    return av.localeCompare(bv, "ja", { sensitivity: "base", numeric: true });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createEmptyState(message) {
  return `<div class="tdr-empty">${escapeHtml(message)}</div>`;
}

function bindMissingImages(root) {
  root.querySelectorAll(".tdr-card-bgimg").forEach((img) => {
    if (img.dataset.boundError === "1") return;
    img.dataset.boundError = "1";
    img.addEventListener("error", () => {
      img.closest(".tdr-card-bg")?.classList.add("is-missing");
      img.remove();
    });
  });
}

function bindMissingTalentIcons(root) {
  root.querySelectorAll(".tdr-talent-icon").forEach((img) => {
    if (img.dataset.boundError === "1") return;
    img.dataset.boundError = "1";
    img.addEventListener("error", () => {
      img.closest(".tdr-talent-bg")?.classList.add("is-missing");
      img.remove();
    });
  });
}

function buildIconHtml(kind, key, altText) {
  const dir = kind === "gear" ? "gear_sets" : "weapon_talents";
  const iconKey = String(key || "").trim();
  if (!iconKey) return "";
  return `
    <div class="card__bg card__bg--tr tdr-card-bg">
      <img class="card__bgimg tdr-card-bgimg" src="./img/${dir}/${escapeHtml(iconKey)}.png" alt="${escapeHtml(altText || "")}" loading="lazy" decoding="async" />
    </div>
  `;
}

function escapeHtmlWithDiff(baseText, nextText, diffClass) {
  const base = String(baseText || "");
  const next = String(nextText || "");
  if (!base || !next || base === next) return escapeHtml(next);
  const tokenRe = /[+-]?\d+(?:\.\d+)?%?/g;
  const baseTokens = Array.from(base.matchAll(tokenRe), (m) => m[0]);
  const nextMatches = Array.from(next.matchAll(tokenRe));
  if (!nextMatches.length) return escapeHtml(next);
  let out = "";
  let cursor = 0;
  nextMatches.forEach((match, idx) => {
    const token = match[0];
    const start = match.index || 0;
    out += escapeHtml(next.slice(cursor, start));
    const baseToken = baseTokens[idx] || "";
    if (baseToken && baseToken !== token) {
      out += `<span class="${diffClass}">${escapeHtml(token)}</span>`;
    } else {
      out += escapeHtml(token);
    }
    cursor = start + token.length;
  });
  out += escapeHtml(next.slice(cursor));
  return out;
}

function renderGearView(items) {
  const body = items.length
    ? items.map((item) => {
        const bonusLines = (item.bonuses || [])
          .map((bonus) => {
            const attr = escapeHtml(String(bonus.attr || "").trim());
            const value = escapeHtml(String(bonus.value || "").trim());
            const fallback = escapeHtml(String(bonus.description || "").trim());
            const textHtml = attr && value
              ? `<span class="tdr-bonus-value">${value}</span><span class="tdr-bonus-attr">${attr}</span>`
              : fallback;
            return `
            <div class="line line--core">
              <div class="line__body">
                <div class="line__text tdr-bonus-text">${textHtml}</div>
              </div>
            </div>
          `;
          })
          .join("");
        return `
          <article class="card">
            <div class="card__head">
              ${buildIconHtml("gear", item.key, item.name)}
              <div class="card__title-wrap">
                <div class="card__titles">
                  <div class="card__title"><span class="card__title-text">${escapeHtml(item.name)}</span></div>
                </div>
              </div>
            </div>
            <div class="lines">${bonusLines}</div>
          </article>
        `;
      }).join("")
    : createEmptyState("条件に一致するギアセットはありません。");

  return `
    <section class="catgroup catgroup--gear">
      <h3 class="catgroup__title">ギア</h3>
      <div class="grid grid--gear tdr-grid">${body}</div>
    </section>
  `;
}

function renderWeaponTalentView(items) {
  const rows = items.length
    ? items.map((item) => `
      <tr class="table-list-row tdr-talent-row">
        <td class="table-list-td-accent"><span class="table-list-accent"></span></td>
        <td class="tdr-talent-detail-cell">
          <div class="card__bg card__bg--tr tdr-card-bg tdr-talent-bg tdr-talent-row__bg">
            <img class="card__bgimg tdr-card-bgimg tdr-talent-icon" src="./img/weapon_talents/${escapeHtml(item.key)}.png" alt="${escapeHtml(item.name1 || item.name || "")}" loading="lazy" decoding="async" />
          </div>
          <div class="tdr-talent-pack">
            <div class="tdr-talent-pack__title">${escapeHtml(item.name1 || item.name || "")}</div>
            <div class="tdr-talent-entry tdr-talent-entry--base">
              <div class="tdr-talent-entry__desc">${escapeHtml(item.desc1 || "")}</div>
            </div>
            ${item.name2 || item.desc2 ? `
            <div class="tdr-talent-entry tdr-talent-entry--sub">
              <div class="tdr-talent-entry__name">${escapeHtml(item.name2 || "")}</div>
              <div class="tdr-talent-entry__desc">${escapeHtmlWithDiff(item.desc1 || "", item.desc2 || "", "gear-talent-diff")}</div>
            </div>` : ""}
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="2">${escapeHtml("条件に一致する武器タレントはありません。")}</td></tr>`;

  return `
    <section class="table-list-view">
      <h3 class="catgroup__title">武器タレント</h3>
      <section class="table-list-wrap">
        <div class="table-list-scroll">
          <table class="table-list-table tdr-talent-table">
            <thead>
              <tr>
                <th class="table-list-th-accent"></th>
                <th class="tdr-talent-th tdr-talent-th--detail">名前 / 説明</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

function renderCurrentView() {
  if (!state.payload || !contentEl) return;
  const gearItems = sortByJapaneseName(state.payload?.gear_sets || [], "name");
  const talentItems = sortByJapaneseName(state.payload?.weapon_talents || [], "name1");
  updatePageTitle(currentViewMode);
  if (currentViewMode === "weapon_talent") {
    contentEl.innerHTML = renderWeaponTalentView(talentItems);
    bindMissingTalentIcons(contentEl);
  } else {
    contentEl.innerHTML = renderGearView(gearItems);
    bindMissingImages(contentEl);
  }
}

function closeNavMenu() {
  if (!navMenuPanel) return;
  const active = document.activeElement;
  if (active && navMenuPanel.contains(active) && typeof active.blur === "function") {
    active.blur();
  }
  navMenuPanel.inert = true;
  navMenuPanel.setAttribute("aria-hidden", "true");
}

function toggleNavMenu() {
  if (!navMenuPanel) return;
  const hidden = navMenuPanel.getAttribute("aria-hidden") !== "false";
  navMenuPanel.inert = !hidden;
  navMenuPanel.setAttribute("aria-hidden", hidden ? "false" : "true");
}

async function switchViewMode(mode) {
  currentViewMode = mode === "weapon_talent" ? "weapon_talent" : "gear";
  window.currentViewMode = currentViewMode;
  closeNavMenu();
  syncViewModeToUrl(currentViewMode);
  renderCurrentView();
}

async function boot() {
  const response = await fetch("./data/items.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`items.json の読み込みに失敗しました: ${response.status}`);
  }
  state.payload = await response.json();
  currentViewMode = getViewModeFromUrl();
  window.currentViewMode = currentViewMode;
  syncViewModeToUrl(currentViewMode);
  updatePageTitle(currentViewMode);
  renderCurrentView();
}

if (navMenuBtn) {
  navMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNavMenu();
  });
}
if (navGearBtn) {
  navGearBtn.addEventListener("click", () => {
    switchViewMode("gear").catch((err) => console.error(err));
  });
}
if (navWeaponTalentBtn) {
  navWeaponTalentBtn.addEventListener("click", () => {
    switchViewMode("weapon_talent").catch((err) => console.error(err));
  });
}
document.addEventListener("click", (e) => {
  if (!navMenuPanel || !navMenuBtn) return;
  if (!navMenuPanel.contains(e.target) && !navMenuBtn.contains(e.target)) {
    closeNavMenu();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNavMenu();
});

boot().catch((error) => {
  if (contentEl) contentEl.innerHTML = createEmptyState(error.message || "読み込みに失敗しました。");
  console.error(error);
});
