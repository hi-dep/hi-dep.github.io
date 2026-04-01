const state = {
  payload: null,
};

const gearGridEl = document.getElementById("gearGrid");
const talentGridEl = document.getElementById("talentGrid");
const contentEl = document.getElementById("content");

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createEmptyState(message) {
  const div = document.createElement("div");
  div.className = "tdr-empty";
  div.textContent = message;
  return div;
}

function renderGearCards(items) {
  gearGridEl.innerHTML = "";
  if (!items.length) {
    gearGridEl.appendChild(createEmptyState("条件に一致するギアセットはありません。"));
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    const bonusLines = (item.bonuses || [])
      .map((bonus) => `
        <div class="line line--core">
          <div class="line__body">
            <div class="line__text">${escapeHtml(String(bonus.pieces))}pc ${escapeHtml(bonus.description)}</div>
          </div>
        </div>
      `)
      .join("");
    card.innerHTML = `
      <div class="card__head">
        ${buildIconHtml("gear", item.key, item.name)}
        <div class="card__title-wrap">
          <div class="card__titles">
            <div class="card__title"><span class="card__title-text">${escapeHtml(item.name)}</span></div>
          </div>
        </div>
      </div>
      <div class="lines">${bonusLines}</div>
    `;
    bindMissingImages(card);
    gearGridEl.appendChild(card);
  });
}

function renderTalentCards(items) {
  talentGridEl.innerHTML = "";
  if (!items.length) {
    talentGridEl.appendChild(createEmptyState("条件に一致する武器タレントはありません。"));
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card__head">
        ${buildIconHtml("talent", item.key, item.name)}
        <div class="card__title-wrap">
          <div class="card__titles">
            <div class="card__title"><span class="card__title-text">${escapeHtml(item.name)}</span></div>
          </div>
        </div>
      </div>
      <div class="lines">
        <div class="line line--talent">
          <div class="line__body">
            <div class="line__text">${escapeHtml(item.description || "説明なし")}</div>
          </div>
        </div>
      </div>
    `;
    bindMissingImages(card);
    talentGridEl.appendChild(card);
  });
}

function render() {
  if (!state.payload) return;
  const gearItems = state.payload?.gear_sets || [];
  const talentItems = state.payload?.weapon_talents || [];
  renderGearCards(gearItems);
  renderTalentCards(talentItems);
}

async function boot() {
  const response = await fetch("./data/items.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`items.json の読み込みに失敗しました: ${response.status}`);
  }
  state.payload = await response.json();
  render();
}

boot().catch((error) => {
  gearGridEl.innerHTML = "";
  talentGridEl.innerHTML = "";
  const message = createEmptyState(error.message || "読み込みに失敗しました。");
  gearGridEl.appendChild(message.cloneNode(true));
  talentGridEl.appendChild(message);
  console.error(error);
});
