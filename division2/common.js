/* shared UI helpers */
(function () {
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.buildTalentPopTriggerHtml = function buildTalentPopTriggerHtml(opts) {
    const o = opts || {};
    const text = String(o.text || "").trim();
    const namedAttr = o.talentNamed ? "1" : "0";
    return `<button type="button" class="inline-pop-trigger line__text-pop-trigger" data-pop-type="talent" data-item-category="${esc(o.itemCategory || "")}" data-item-rarity="${esc(o.itemRarity || "")}" data-item-id="${esc(o.itemId || "")}" data-item-name-key="${esc(o.itemNameKey || "")}" data-talent-key="${esc(o.talentKey || "")}" data-talent-name="${esc(o.talentName || text)}" data-talent-named="${namedAttr}">${esc(text)}</button>`;
  };
})();

