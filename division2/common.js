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

  window.highlightTalentDiffHtml = function highlightTalentDiffHtml(baseText, nextText, diffClass) {
    const markerClass = String(diffClass || "gear-talent-pvp-diff");
    const tokenize = (value) => {
      const out = [];
      const re = /(\r\n|\n|[ \t]+|[A-Za-z0-9%+.\-]+|[^A-Za-z0-9\s])/g;
      let m;
      while ((m = re.exec(String(value || ""))) !== null) out.push(m[0]);
      return out;
    };
    const escToken = (value) => String(value || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
    const tokenHtml = (value) => value === "\n" || value === "\r\n" ? "<br>" : escToken(value);
    const a = tokenize(baseText);
    const b = tokenize(nextText);
    if (!a.length || !b.length) return b.map(tokenHtml).join("");
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    let diff = [];
    const chunks = [];
    const flush = () => {
      if (diff.length) chunks.push(`<span class="${markerClass}">${diff.map(tokenHtml).join("")}</span>`);
      diff = [];
    };
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { flush(); chunks.push(tokenHtml(b[j])); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else { diff.push(b[j]); j++; }
    }
    while (j < b.length) diff.push(b[j++]);
    flush();
    return chunks.join("");
  };

  window.highlightTalentMultiDiffHtml = function highlightTalentMultiDiffHtml(baseTexts, nextText, diffClasses) {
    const bases = (Array.isArray(baseTexts) ? baseTexts : [baseTexts]).map((v) => String(v || ""));
    const next = String(nextText || "");
    const classes = Array.isArray(diffClasses) ? diffClasses : [diffClasses];
    const tokenize = (value) => {
      const out = [];
      const re = /(\r\n|\n|[ \t]+|[A-Za-z0-9%+.\-]+|[^A-Za-z0-9\s])/g;
      let m;
      while ((m = re.exec(value)) !== null) out.push(m[0]);
      return out;
    };
    const bTokens = tokenize(next);
    const diffIndexes = (base) => {
      const a = tokenize(base);
      const n = a.length;
      const m = bTokens.length;
      const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          dp[i][j] = a[i] === bTokens[j]
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      const out = new Set();
      let i = 0;
      let j = 0;
      while (i < n && j < m) {
        if (a[i] === bTokens[j]) { i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
        else { out.add(j); j++; }
      }
      while (j < m) out.add(j++);
      return out;
    };
    const marked = diffClasses.map((_, i) => diffIndexes(bases[i] || ""));
    const escToken = (value) => String(value || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
    const tokenHtml = (value) => value === "\n" || value === "\r\n" ? "<br>" : escToken(value);
    const chunks = [];
    let activeClasses = [];
    let activeTokens = [];
    const flush = () => {
      if (!activeTokens.length) return;
      const body = activeTokens.map(tokenHtml).join("");
      chunks.push(activeClasses.length ? `<span class="${activeClasses.join(" ")}">${body}</span>` : body);
      activeTokens = [];
    };
    bTokens.forEach((token, index) => {
      const nextClasses = marked
        .map((set, i) => set.has(index) ? classes[i] : "")
        .filter(Boolean);
      if (nextClasses.join(" ") !== activeClasses.join(" ")) {
        flush();
        activeClasses = nextClasses;
      }
      activeTokens.push(token);
    });
    flush();
    return chunks.join("");
  };
})();
