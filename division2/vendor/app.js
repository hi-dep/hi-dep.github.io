// vendor/ から見て ../shop/
const TSV_PATHS = {
  gears: "../shop/gear_jp.tsv",
  weapons: "../shop/weapons_jp.tsv",
  mods: "../shop/mods_jp.tsv",
};

// vendor/ から見て ../img/
const IMG = {
  brands: "../img/brands",
  talents: "../img/talents",
  weaponTalents: "../img/weapon_talents",
  weapons: "../img/weapons",
  gears: "../img/gears",
  dz: "../img/dz.png",
};

// Python画像生成時のベンダー順（UIの「グループ」は不要だが、順序は合わせる）
const VENDOR_ORDER = [
  "ホワイトハウス","クランショップ","キャシー",
  "カウントダウン","キャンパス","シアター","キャッスル",
  "DZイースト","DZウエスト","DZサウス",
  "ヘイヴン","ベニテス","ブリッジ",
];

// ---- batch.py 由来データ（そのまま移植） ----
const GEAR_ATTR_MAX = {
  "武器ダメージ上昇": 15,
  "アーマー": 170000,
  "スキルクラス": 1,
  "クリティカル率": 6,
  "クリティカルダメージ": 12,
  "ヘッドショットダメージ上昇": 10,
  "武器ハンドリング": 8,
  "アーマー回復": 4925,
  "爆発物耐性": 10,
  "状態異常耐性": 10,
  "HP": 18935,
  "スキルダメージ": 10,
  "スキルヘイスト": 12,
  "スキル修復": 20,
  "ステータス効果": 10,
  "カバー外のターゲットへのダメージ": 8,
  "アーマーへのダメージ": 8,
  "HPダメージ": 10,
  "スキャナーPluseヘイスト": 100,
  "キルによるアーマー": 10,
  "近接ダメージ": 500,
  "ピストルダメージ": 9,
  "シールドHP": 50,
  "脅威低下": 50,
  "命中率": 38
};

const WEAPON_ATTR_MAX = {
  "アサルトライフル": {
    "アサルトライフルダメージ": 15,
    "HPダメージ": 21,
    "アーマーへのダメージ": 6,
    "クリティカル率": 9.5,
    "カバー外のターゲットへのダメージ": 10,
    "ヘッドショットダメージ上昇": 10,
    "クリティカルダメージ": 10,
    "リロード速度": 12,
    "安定性": 12,
    "命中率": 12,
    "最適射程": 24,
    "装弾数": 12.5,
    "連射速度": 5,
    "切り替え速度": 15
  },
  "LMG": {
    "LMGダメージ": 15,
    "カバー外のターゲットへのダメージ": 12,
    "アーマーへのダメージ": 6,
    "クリティカル率": 9.5,
    "HPダメージ": 9.5,
    "ヘッドショットダメージ上昇": 10,
    "クリティカルダメージ": 10,
    "リロード速度": 12,
    "安定性": 12,
    "命中率": 12,
    "最適射程": 24,
    "装弾数": 12.5,
    "連射速度": 5,
    "切り替え速度": 15
  },
  "マークスマンライフル": {
    "マークスマンライフルダメージ": 15,
    "ヘッドショットダメージ上昇": 111,
    "アーマーへのダメージ": 6,
    "クリティカル率": 9.5,
    "HPダメージ": 9.5,
    "カバー外のターゲットへのダメージ": 10,
    "クリティカルダメージ": 10,
    "リロード速度": 12,
    "安定性": 12,
    "命中率": 12,
    "最適射程": 24,
    "装弾数": 12.5,
    "連射速度": 5,
    "切り替え速度": 15
  },
  "ピストル": {
    "ピストルダメージ": 15,
    "アーマーへのダメージ": 6,
    "クリティカル率": 9.5,
    "HPダメージ": 9.5,
    "カバー外のターゲットへのダメージ": 10,
    "ヘッドショットダメージ上昇": 10,
    "クリティカルダメージ": 10,
    "リロード速度": 12,
    "安定性": 12,
    "命中率": 12,
    "最適射程": 24,
    "装弾数": 12.5,
    "連射速度": 5,
    "切り替え速度": 15,
    "スキルクラス": 1
  },
  "ライフル": {
    "ライフルダメージ": 15,
    "クリティカルダメージ": 17,
    "アーマーへのダメージ": 6,
    "クリティカル率": 9.5,
    "HPダメージ": 9.5,
    "カバー外のターゲットへのダメージ": 10,
    "ヘッドショットダメージ上昇": 10,
    "リロード速度": 12,
    "安定性": 12,
    "命中率": 12,
    "最適射程": 24,
    "装弾数": 12.5,
    "連射速度": 5,
    "切り替え速度": 15
  },
  "ショットガン": {
    "ショットガンダメージ": 15,
    "アーマーへのダメージ": 12,
    "クリティカル率": 9.5,
    "HPダメージ": 9.5,
    "カバー外のターゲットへのダメージ": 10,
    "ヘッドショットダメージ上昇": 10,
    "クリティカルダメージ": 10,
    "リロード速度": 12,
    "安定性": 12,
    "命中率": 12,
    "最適射程": 24,
    "装弾数": 12.5,
    "連射速度": 5,
    "切り替え速度": 15,
    "キルによるアーマー": 10
  },
  "SMG": {
    "SMGダメージ": 15,
    "クリティカル率": 21,
    "アーマーへのダメージ": 6,
    "HPダメージ": 9.5,
    "カバー外のターゲットへのダメージ": 10,
    "ヘッドショットダメージ上昇": 10,
    "クリティカルダメージ": 10,
    "リロード速度": 12,
    "安定性": 12,
    "命中率": 12,
    "最適射程": 24,
    "装弾数": 12.5,
    "連射速度": 5,
    "切り替え速度": 15
  }
};

const MOD_ATTR_MAX = {
  "クリティカル率": 6,
  "クリティカルダメージ": 12,
  "ヘッドショットダメージ上昇": 10,
  "キルによるアーマー": 18935,
  "出血耐性": 10,
  "視聴覚ダメージ耐性": 10,
  "炎上耐性": 10,
  "混乱耐性": 10,
  "電波妨害耐性": 10,
  "トラップ耐性": 10,
  "修復量": 20,
  "対エリート防御": 13,
  "パルス耐性": 10,
  "スキル持続時間": 10,
  "スキルヘイスト": 12,
  "スキル修復": 20,
  "ケミランチャー弾薬": 1,
  "ケミランチャー炎上強度": 7.5,
  "ケミランチャーダメージ": 5,
  "ケミランチャー持続時間": 5,
  "ケミランチャートラップ持続時間": 10,
  "ケミランチャートラップHP": 17.5,
  "ケミランチャー回復": 7.5,
  "ケミランチャー範囲": 7.5,
  "ケミランチャースキルヘイスト": 7.5,
  "デコイ持続時間": 7.5,
  "デコイHP": 7.5,
  "ドローンアーマー修理": 7.5,
  "ドローンダメージ": 5,
  "ドローンダメージ軽減": 6,
  "ドローン偏向持続時間": 7.5,
  "ドローン持続時間": 7.5,
  "ドローン追加爆弾": 2,
  "ドローンHP": 10,
  "ファイアフライ視覚奪取効果持続時間": 7.5,
  "ファイアフライダメージ": 7.5,
  "ファイアフライ最多ターゲット": 1,
  "ファイアフライスキルヘイスト": 7.5,
  "ファイアフライスピード": 10,
  "ハイヴダメージ": 5,
  "ハイヴ持続時間": 5,
  "ハイヴ回復": 5,
  "ハイヴHP": 10,
  "ハイヴ範囲": 5,
  "ハイヴ射程": 5,
  "ハイヴ修復チャージ": 4,
  "ハイヴリバイバーアーマー修復": 10,
  "ハイヴスティムチャージ": 4,
  "ハイヴスティム効率": 10,
  "ハイヴスティンガーチャージ": 4,
  "パルスコーンサイズ": 7.5,
  "パルス効果持続時間": 10,
  "パルスHP": 17.5,
  "パルス範囲": 10,
  "パルススキルヘイスト": 6,
  "マインクラスターマイン": 1,
  "マインダメージ": 5,
  "マイン回復": 7.5,
  "マインHP": 7.5,
  "マイン範囲": 5,
  "マインスキルヘイスト": 6,
  "シールドアクティブ自動回復": 5,
  "シールドダメージボーナス(敵1体ごと)": 5,
  "シールドディフレクターダメージ": 5,
  "シールドホルスタード自動回復": 5,
  "シールドシールドHP": 5,
  "粘着爆弾ブラスト範囲": 6,
  "粘着爆弾炎上持続時間": 5,
  "粘着爆弾ダメージ": 7.5,
  "粘着爆弾持続時間": 7.5,
  "粘着爆弾スキルヘイスト": 5,
  "トラップショック範囲": 7.5,
  "タレット炎上ダメージ": 5,
  "タレットダメージ": 5,
  "タレット持続時間": 7.5,
  "タレット追加迫撃砲弾薬": 1,
  "タレット追加スナイパー弾薬": 1,
  "タレットHP": 10,
  "タレットスキルヘイスト": 7.5
};

const PERFECT_TALENT = {
  "パーフェクト・テックサポート": "テクニカルサポート",
  "パーフェクト・ブレイスド": "射撃準備",
  "パーフェクト・オポチュニスティック": "便乗屋",
  "フューチャーパーフェクション": "フューチャーパーフェクト",
  "パーフェクト・パーペチュエーション": "持続力",
  "パーフェクト・クローズ＆パーソナル": "接近戦"
};

const NAMED_ITEMS = {
  "パーカッシブメンテナンス": [],
  "リキッドエンジニア": [],
  "デビルズデュー": [],
  "ストラテジックアライメント": [],
  "バッテリーパック": [],
  "アナーキストのクックブック": [],
  "フォースマルチプライアー": [],
  "ザ・ギフト": [],
  "マタドール": [],
  "プリスティンイグザンプル": [],
  "ゼロエフス": [],
  "エブリディキャリア": [],
  "シーザーズガード": [],
  "フェローシャスカーム": [],
  "ポイントマン": [],
  "ハンターキラー": [],
  "ドアキッカーズノック": [],
  "ヴェドメデツィアベスト": [],
  "ザ・サクリファイス": [],
  "チェインキラー": [],
  "デスグリップ": [
    "キルによるアーマー"
  ],
  "マザリーラブ": [
    "スキルHP"
  ],
  "コントラクターグローブ": [
    "アーマーへのダメージ"
  ],
  "ファームハンドシェイク": [
    "ステータス効果"
  ],
  "廃弾入れ": [
    "弾薬数"
  ],
  "フォージ": [
    "シールドHP"
  ],
  "クローズアウト": [
    "近接ダメージ",
    "ピストルダメージ"
  ],
  "エンペラーガード": [
    "アーマー回復"
  ],
  "フォックスの祈り": [
    "カバー外のターゲットへのダメージ"
  ],
  "パンチドランク": [
    "ヘッドショットダメージ上昇"
  ],
  "ナイトウォッチャー": [
    "スキャナーPluseヘイスト"
  ],
  "ザ・ホローマン": [
    "HPダメージ"
  ],
  "クローザー": [],
  "ザ・セットアップ": [],
  "エルマーノ": [],
  "ピカロズホルスター": [
    "武器ダメージ上昇"
  ],
  "イーグルグラスプ": [
    "武器ハンドリング"
  ],
  "ビジョナリオ": [
    "最適射程"
  ],
  "グリース": [
    "ステータス効果"
  ],
  "クローク": [
    "脅威低下"
  ],
  "スポット・オン": [
    "命中率"
  ],
  "TDI 「ケルド」 カスタム": [
    "スキルクラス"
  ],
  "アパートメント": [],
  "アーティストツール": [],
  "イキムロングスティック": [],
  "インビジブルハンド": [],
  "エバーラスティング・ゲイズ": [],
  "エミリーンガード": [],
  "オービット": [],
  "カーネッジ": [],
  "キングブレイカー": [],
  "クエレブレ": [],
  "クワイエットロア": [],
  "グッドタイムズ": [],
  "グローリーデーズ": [],
  "コマンドー": [],
  "コールドリレーションズ": [],
  "サージ": [],
  "ザ・グラッジ": [],
  "ザ・ダークネス": [],
  "ザ・モップ": [
    "キルによるアーマー"
  ],
  "シールドスプリンタラー": [],
  "スカルパル": [],
  "ステージレフト": [],
  "スワップチェーン": [],
  "セーフティディスタンス": [],
  "タブラ・ラーサ": [],
  "ダークウィンター": [],
  "ツナミ": [],
  "テストサブジェクト": [],
  "デシグネーテッドヒッター": [],
  "ニューリアライザブル": [],
  "ハニーバジャー": [],
  "ハーモニー": [],
  "バックアップブームスティック": [
    "ショットガンダメージ"
  ],
  "バージニアン": [],
  "バーンアウト": [],
  "パイロマニアック": [],
  "ピンプリック": [],
  "ブラックフライデー": [],
  "ブームスティック": [],
  "ベイカーズダズン": [],
  "ホワイトデス": [
    "ヘッドショットダメージ上昇"
  ],
  "マニック": [],
  "メカニカルアニマル": [],
  "モザンビークスペシャル": [],
  "ライトニングロッド": [],
  "レイルスプリッター": [],
  "レフティ": [],
  "ロックンロール": []
};

const DZ_ITEMS = new Set([
  "TDI 「ケルド」 カスタム",
  "アパートメント",
  "エバーラスティング・ゲイズ",
  "エンペラーガード",
  "オービット",
  "クローズアウト",
  "グッドタイムズ",
  "ザ・ギフト",
  "ザ・ホローマン",
  "ダークウィンター",
  "デスグリップ",
  "デビルズデュー",
  "ドアキッカーズノック",
  "ハーモニー",
  "バージニアン",
  "ピンプリック",
  "フェローシャスカーム",
  "ブラックフライデー",
  "マタドール",
  "マニック",
  "リキッドエンジニア",
  "レイルスプリッター",
  "ロックンロール"
]);

const DZ_BRANDS = new Set(["システムコラプション","ヤールギア"]);

const GEAR_RED = new Set([
  "HPダメージ",
  "アーマーへのダメージ",
  "カバー外のターゲットへのダメージ",
  "クリティカルダメージ",
  "クリティカル率",
  "ピストルダメージ",
  "ヘッドショットダメージ上昇",
  "命中率",
  "武器ダメージ上昇",
  "武器ハンドリング",
  "近接ダメージ"
]);

const GEAR_BLUE = new Set([
  "HP",
  "アーマー",
  "アーマー回復",
  "キルによるアーマー",
  "爆発物耐性",
  "状態異常耐性"
]);

const GEAR_YELLOW = new Set([
  "シールドHP",
  "ステータス効果",
  "スキャナーPluseヘイスト",
  "スキルクラス",
  "スキルダメージ",
  "スキルヘイスト",
  "スキル修復",
  "最適射程",
  "脅威低下"
]);

const GEAR_MOD_TYPES = new Set(["オフェンス","ディフェンス","ユーティリティ"]);
const SKILL_MOD_TYPES = new Set([
  "ケミランチャー","シールド","タレット","デコイ","トラップ","ドローン","ハイヴ","パルス","ファイアフライ","マイン","粘着爆弾"
]);

const ATTR_PER = {
  "武器ダメージ上昇": "%",
  "アーマー": "",
  "スキルクラス": "",
  "クリティカル率": "%",
  "クリティカルダメージ": "%",
  "ヘッドショットダメージ上昇": "%",
  "武器ハンドリング": "%",
  "アーマー回復": "",
  "爆発物耐性": "%",
  "状態異常耐性": "%",
  "HP": "",
  "スキルダメージ": "%",
  "スキルヘイスト": "%",
  "スキル修復": "%",
  "ステータス効果": "%",
  "カバー外のターゲットへのダメージ": "%",
  "アーマーへのダメージ": "%",
  "HPダメージ": "%",
  "スキャナーPluseヘイスト": "%",
  "キルによるアーマー": "%",
  "近接ダメージ": "%",
  "ピストルダメージ": "%",
  "シールドHP": "%",
  "出血耐性": "%",
  "視聴覚ダメージ耐性": "%",
  "炎上耐性": "%",
  "混乱耐性": "%",
  "電波妨害耐性": "%",
  "トラップ耐性": "%",
  "修復量": "%",
  "対エリート防御": "%",
  "パルス耐性": "%",
  "スキル持続時間": "%",
  "アクティブ自動回復": "%",
  "アーマー修理": "%",
  "ブラスト範囲": "%",
  "視覚奪取効果持続時間": "%",
  "炎上持続時間": "%",
  "炎上強度": "%",
  "クラスターマイン": "",
  "コーンサイズ": "%",
  "ダメージボーナス(敵1体ごと)": "%",
  "ダメージ軽減": "%",
  "ダメージ": "%",
  "偏向持続時間": "%",
  "ディフレクターダメージ": "%",
  "持続時間": "%",
  "トラップ持続時間": "%",
  "追加迫撃砲弾薬": "",
  "追加スナイパー弾薬": "",
  "回復": "%",
  "最多ターゲット": "",
  "範囲": "%",
  "射程": "%",
  "修復チャージ": "",
  "リバイバーアーマー修復": "%",
  "ショック範囲": "%",
  "スティムチャージ": "",
  "スティム効率": "%",
  "スティンガーチャージ": "",
  "スキャン範囲": "%",
  "炎上ダメージ": "%",
  "効果持続時間": "%",
  "追加爆弾": "",
  "スピード": "%"
};

// ---- state ----
const state = {
  raw: { gears: [], weapons: [], mods: [] },
  weeks: [],
  selectedWeek: null,
  hideEmptyVendors: true,
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindUI();

  try {
    const [gearsTsv, weaponsTsv, modsTsv] = await Promise.all([
      fetchText(TSV_PATHS.gears),
      fetchText(TSV_PATHS.weapons),
      fetchText(TSV_PATHS.mods),
    ]);

    state.raw.gears = parseTSV(gearsTsv);
    state.raw.weapons = parseTSV(weaponsTsv);
    state.raw.mods = parseTSV(modsTsv);

    state.weeks = collectWeeks(state.raw);
    setupWeekSelect(state.weeks);
    state.selectedWeek = state.weeks[0] ?? null;

    render();
  } catch (e) {
    console.error(e);
    document.getElementById("content").innerHTML =
      `<div style="color:#a9b0c0;padding:8px;">読み込みに失敗しました。</div>`;
  }
}

function bindUI() {
  const weekSelect = document.getElementById("weekSelect");
  const hideEmpty = document.getElementById("hideEmptyVendors");

  weekSelect.addEventListener("change", () => {
    state.selectedWeek = weekSelect.value;
    render();
  });

  hideEmpty.addEventListener("change", () => {
    state.hideEmptyVendors = hideEmpty.checked;
    render();
  });
}

async function fetchText(path) {
  const url = new URL(path, window.location.href).toString();
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} ${url}`);
  return await res.text();
}

function parseTSV(tsvText) {
  const text = tsvText.replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split("\t").map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = (cols[c] ?? "").trim();
    rows.push(obj);
  }
  return rows;
}

function collectWeeks(raw) {
  const set = new Set();
  for (const k of ["gears","weapons","mods"]) for (const r of raw[k]) if (r.DATE) set.add(r.DATE);
  return Array.from(set).sort((a,b) => (a < b ? 1 : -1));
}

function setupWeekSelect(weeks) {
  const el = document.getElementById("weekSelect");
  el.innerHTML = "";
  for (const w of weeks) {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    el.appendChild(opt);
  }
  if (weeks[0]) el.value = weeks[0];
}

// ---- helpers ----
function isMissing(v) {
  return v == null || v === "" || String(v).toLowerCase() === "nan";
}

function fixValueString(value) {
  let s = String(value).replace("%", "");
  const firstDot = s.indexOf(".");
  const dotCount = (s.match(/\./g) || []).length;
  if (dotCount > 1 && firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  return s;
}

function toNumber(value) {
  if (isMissing(value)) return null;
  const s = fixValueString(value).replace(/,/g, "");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatValue(attr, valueNum) {
  if (valueNum == null) return "";
  let per = (ATTR_PER.hasOwnProperty(attr) ? ATTR_PER[attr] : "%");

  if (attr === "アーマー回復") {
    if (valueNum <= 100) per = "%";
    else per = "";
  } else if (attr === "HP") {
    if (valueNum <= 100) per = "%";
    else per = "";
  }

  if (Number.isInteger(valueNum)) return `${valueNum}${per}`;

  const s2 = valueNum.toFixed(2);
  const parts = s2.split(".");
  const dp = parts[1] ?? "00";
  if (dp[1] === "0" && dp[0] !== "0") return `${valueNum.toFixed(1)}${per}`;
  return `${s2}${per}`;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function rarityClass(rarity) {
  if (rarity === "header-gs") return "gearset";
  if (rarity === "header-named") return "named";
  return "highend";
}

function getGearAttrColor(attr) {
  if (GEAR_RED.has(attr)) return "var(--gRed)";
  if (GEAR_BLUE.has(attr)) return "var(--gBlue)";
  if (GEAR_YELLOW.has(attr)) return "var(--gYellow)";
  return "var(--gGray)";
}

function getModColor(modType) {
  if (modType === "オフェンス") return "var(--gRed)";
  if (modType === "ディフェンス") return "var(--gBlue)";
  if (modType === "ユーティリティ") return "var(--gYellow)";
  return "var(--gGray)";
}

function getTalentIconName(talent) {
  const t = String(talent);
  return PERFECT_TALENT[t] ?? t.replace("パーフェクト・", "");
}

function getModIconName(mod) {
  if (GEAR_MOD_TYPES.has(mod)) return "装備mod";
  if (SKILL_MOD_TYPES.has(mod)) return "スキルmod";
  return "";
}

function createIcon(srcList, className, alt = "") {
  const img = document.createElement("img");
  img.className = className;
  img.alt = alt;
  let i = 0;
  const tryNext = () => {
    if (i >= srcList.length) { img.remove(); return; }
    img.src = srcList[i++];
  };
  img.onerror = tryNext;
  tryNext();
  return img;
}

// ---- normalize (batch.pyの変換をWeb側で再現) ----
function normalizeGearRow(r) {
  const attrs = [];
  if (!isMissing(r.core_type)) attrs.push({ attr: r.core_type, value: r.core_value, max: GEAR_ATTR_MAX[r.core_type] });
  if (!isMissing(r.attribute1_type)) attrs.push({ attr: r.attribute1_type, value: r.attribute1_value, max: GEAR_ATTR_MAX[r.attribute1_type] });
  if (!isMissing(r.attribute2_type)) attrs.push({ attr: r.attribute2_type, value: r.attribute2_value, max: GEAR_ATTR_MAX[r.attribute2_type] });

  // batch.pyの補正
  if (r.name === "エンペラーガード") {
    for (const a of attrs) if (a.attr === "アーマー回復") { a.value = 1; a.max = 1; }
  }
  if (r.name === "ビジョナリオ") {
    for (const a of attrs) if (a.attr === "最適射程") { a.value = 50; a.max = 50; }
  }
  if (r.name === "スポット・オン") {
    for (const a of attrs) if (a.attr === "命中率") { a.value = 38; a.max = 38; }
  }
  if (r.name === "クローズアウト") {
    const hasMelee = attrs.some(a => a.attr === "近接ダメージ");
    const hasPistol = attrs.some(a => a.attr === "ピストルダメージ");
    if (!hasMelee) attrs.push({ attr: "近接ダメージ", value: 500, max: 500 });
    if (!hasPistol) attrs.push({ attr: "ピストルダメージ", value: 11, max: 11 });
  }

  return {
    type: "gear",
    date: r.DATE,
    rarity: r.rarity,
    vendor: r.vendor,
    brand: r.brand,
    name: r.name,
    slot: r.slot,
    talent: r.talents,
    attrs,
  };
}

function normalizeWeaponRow(r) {
  const weaponType = (r.attribute1_type || "").replace("ダメージ", "");
  const maxMap = WEAPON_ATTR_MAX[weaponType] || {};
  const attrs = [];
  if (!isMissing(r.attribute1_type)) attrs.push({ attr: r.attribute1_type, value: r.attribute1_value, max: maxMap[r.attribute1_type] });
  if (!isMissing(r.attribute2_type)) attrs.push({ attr: r.attribute2_type, value: r.attribute2_value, max: maxMap[r.attribute2_type] });
  if (!isMissing(r.attribute3_type)) attrs.push({ attr: r.attribute3_type, value: r.attribute3_value, max: maxMap[r.attribute3_type] });

  return {
    type: "weapon",
    date: r.DATE,
    rarity: r.rarity,
    vendor: r.vendor,
    name: r.name,
    weaponType,
    talent: r.talent,
    attrs,
  };
}

function getModType(name, attributeSlot) {
  const s = String(name ?? "");
  if (s.startsWith("Offensive")) return "オフェンス";
  if (s.startsWith("Defensive")) return "ディフェンス";
  if (s.startsWith("Utility")) return "ユーティリティ";
  return attributeSlot;
}

function getModMax(modsType, attr) {
  const k = `${modsType}${attr}`;
  return MOD_ATTR_MAX[k] ?? MOD_ATTR_MAX[attr];
}

function normalizeModRow(r) {
  const modsType = getModType(r.name, r.attribute_slot);
  return {
    type: "mod",
    date: r.DATE,
    rarity: r.rarity,
    vendor: r.vendor,
    modsType,
    attr: r.attribute_type,
    value: r.attribute_value,
    max: getModMax(modsType, r.attribute_type),
  };
}

// ---- render ----
function render() {
  const week = state.selectedWeek;
  if (!week) { document.getElementById("content").innerHTML = ""; return; }

  const gears = state.raw.gears.filter(r => r.DATE === week).map(normalizeGearRow);
  const weapons = state.raw.weapons.filter(r => r.DATE === week).map(normalizeWeaponRow);
  const mods = state.raw.mods.filter(r => r.DATE === week).map(normalizeModRow);

  const vendors = collectVendorsInOrder(gears, weapons, mods);

  const content = document.getElementById("content");
  content.innerHTML = "";

  for (const vendor of vendors) {
    const vG = gears.filter(x => x.vendor === vendor);
    const vW = weapons.filter(x => x.vendor === vendor);
    const vM = mods.filter(x => x.vendor === vendor);

    if (state.hideEmptyVendors && vG.length === 0 && vW.length === 0 && vM.length === 0) continue;

    const section = document.createElement("section");
    section.className = "vendor";

    const h = document.createElement("h2");
    h.className = "vendor__title";
    h.textContent = `■${vendor}`;
    section.appendChild(h);

    const grid = document.createElement("div");
    grid.className = "grid";

    // Python同様：gear -> weapon -> mod
    for (const row of vG) grid.appendChild(renderGearCard(row));
    for (const row of vW) grid.appendChild(renderWeaponCard(row));
    for (const row of vM) grid.appendChild(renderModCard(row));

    section.appendChild(grid);
    content.appendChild(section);
  }
}

function collectVendorsInOrder(gears, weapons, mods) {
  const set = new Set();
  for (const r of gears) set.add(r.vendor);
  for (const r of weapons) set.add(r.vendor);
  for (const r of mods) set.add(r.vendor);

  const ordered = [];
  for (const v of VENDOR_ORDER) if (set.has(v)) ordered.push(v);

  const rest = Array.from(set).filter(v => !VENDOR_ORDER.includes(v)).sort((a,b)=>a.localeCompare(b,"ja"));
  return ordered.concat(rest);
}

function isDZGear(g) {
  return DZ_ITEMS.has(g.name) || DZ_BRANDS.has(g.brand);
}
function isDZWeapon(w) {
  return DZ_ITEMS.has(w.name);
}

// ---- card builders ----
function renderGearCard(g) {
  const rClass = rarityClass(g.rarity);

  const card = document.createElement("article");
  card.className = `card ${rClass}`;

  const tint = document.createElement("div");
  tint.className = `card__tint ${rClass}`;
  card.appendChild(tint);

  const body = document.createElement("div");
  body.className = "card__body";

  if (isDZGear(g)) body.appendChild(createIcon([IMG.dz], "dzIcon", "DZ"));

  const head = document.createElement("div");
  head.className = "head";

  const htext = document.createElement("div");
  htext.className = "htext";

  const t1 = document.createElement("h3");
  t1.className = "h1" + (g.rarity === "header-named" ? " namedText" : "");
  t1.textContent = g.brand || "(brandなし)";

  const t2 = document.createElement("p");
  t2.className = "h2";
  t2.textContent = (g.rarity === "header-named" && !isMissing(g.name))
    ? `${g.slot || ""} / ${g.name}`
    : (g.slot || "");

  htext.appendChild(t1);
  htext.appendChild(t2);

  const bIcon = createIcon([`${IMG.brands}/${g.brand}.png`], "bigIcon", g.brand);

  head.appendChild(htext);
  head.appendChild(bIcon);
  body.appendChild(head);

  const box = document.createElement("div");
  box.className = "box";

  // talent row (アイコンあり)
  if (!isMissing(g.talent)) {
    const iconName = getTalentIconName(g.talent);
    const isPerfect = String(g.talent) !== iconName;
    box.appendChild(makeIconTextRow(
      [
        `${IMG.talents}/${iconName}.png`,
        `${IMG.weaponTalents}/${iconName}.png`,
      ],
      String(g.talent),
      isPerfect
    ));
  }

  const highlightAttrs = NAMED_ITEMS[g.name] ?? [];
  for (const a of g.attrs) {
    const isHi = highlightAttrs.includes(a.attr);
    box.appendChild(makeAttrRow(a.attr, a.value, a.max, getGearAttrColor(a.attr), isHi));
  }

  body.appendChild(box);
  card.appendChild(body);
  return card;
}

function renderWeaponCard(w) {
  const rClass = rarityClass(w.rarity);

  const card = document.createElement("article");
  card.className = `card ${rClass}`;

  const tint = document.createElement("div");
  tint.className = `card__tint ${rClass}`;
  card.appendChild(tint);

  const body = document.createElement("div");
  body.className = "card__body";

  if (isDZWeapon(w)) body.appendChild(createIcon([IMG.dz], "dzIcon", "DZ"));

  const head = document.createElement("div");
  head.className = "head";

  const htext = document.createElement("div");
  htext.className = "htext";

  const t1 = document.createElement("h3");
  t1.className = "h1" + (w.rarity === "header-named" ? " namedText" : "");
  t1.textContent = w.name || "(nameなし)";

  const t2 = document.createElement("p");
  t2.className = "h2";
  t2.textContent = w.weaponType || "(weapon_typeなし)";

  htext.appendChild(t1);
  htext.appendChild(t2);

  const wIcon = createIcon([`${IMG.weapons}/${w.weaponType}.png`], "bigIcon", w.weaponType);

  head.appendChild(htext);
  head.appendChild(wIcon);
  body.appendChild(head);

  const box = document.createElement("div");
  box.className = "box";

  if (!isMissing(w.talent)) {
    const iconName = getTalentIconName(w.talent);
    const isPerfect = String(w.talent) !== iconName;
    box.appendChild(makeIconTextRow(
      [
        `${IMG.weaponTalents}/${iconName}.png`,
        `${IMG.talents}/${iconName}.png`,
      ],
      String(w.talent),
      isPerfect
    ));
  }

  const highlightAttrs = NAMED_ITEMS[w.name] ?? [];
  for (const a of w.attrs) {
    const isHi = highlightAttrs.includes(a.attr);
    // 武器のゲージ色はPython同様グレー
    box.appendChild(makeAttrRow(a.attr, a.value, a.max, "var(--gGray)", isHi));
  }

  body.appendChild(box);
  card.appendChild(body);
  return card;
}

function renderModCard(m) {
  const rClass = rarityClass(m.rarity);

  const card = document.createElement("article");
  card.className = `card ${rClass}`;

  const tint = document.createElement("div");
  tint.className = `card__tint ${rClass}`;
  card.appendChild(tint);

  const body = document.createElement("div");
  body.className = "card__body";

  const head = document.createElement("div");
  head.className = "head";

  const htext = document.createElement("div");
  htext.className = "htext";

  const t1 = document.createElement("h3");
  t1.className = "h1";
  t1.textContent = `${m.modsType} MOD`;

  const t2 = document.createElement("p");
  t2.className = "h2";
  t2.textContent = ""; // 余白削減

  htext.appendChild(t1);
  htext.appendChild(t2);

  const iconName = getModIconName(m.modsType);
  const mIcon = iconName
    ? createIcon([`${IMG.gears}/${iconName}.png`], "bigIcon", iconName)
    : document.createElement("div");

  head.appendChild(htext);
  head.appendChild(mIcon);
  body.appendChild(head);

  const box = document.createElement("div");
  box.className = "box";

  if (!isMissing(m.attr)) {
    box.appendChild(makeAttrRow(m.attr, m.value, m.max, getModColor(m.modsType), false));
  }

  body.appendChild(box);
  card.appendChild(body);
  return card;
}

// ---- rows ----
function makeIconTextRow(iconSrcList, text, highlight) {
  const row = document.createElement("div");
  row.className = "row";

  const icon = createIcon(iconSrcList, "icon", "");
  row.appendChild(icon);

  const t = document.createElement("div");
  t.className = "rtext" + (highlight ? " namedText" : "");
  t.textContent = text;

  row.appendChild(t);
  return row;
}

function makeAttrRow(attr, valueRaw, maxRaw, fillColorCss, highlight) {
  const valueNum = (typeof valueRaw === "number") ? valueRaw : toNumber(valueRaw);
  const maxNum = (typeof maxRaw === "number") ? maxRaw : toNumber(maxRaw);

  const rowWrap = document.createElement("div");

  // テキスト行
  const row = document.createElement("div");
  row.className = "row";

  const t = document.createElement("div");
  t.className = "rtext" + (highlight ? " namedText" : "");
  const valueText = formatValue(attr, valueNum);
  t.textContent = `+${valueText} ${attr}`;

  row.appendChild(t);
  rowWrap.appendChild(row);

  // ゲージ（%表示なし）
  if (valueNum != null && maxNum != null && maxNum !== 0) {
    const per = clamp01(valueNum / maxNum);

    const gauge = document.createElement("div");
    gauge.className = "gauge" + (per >= 0.999 ? " max" : "");

    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${Math.round(per * 1000) / 10}%`;
    fill.style.background = fillColorCss;

    gauge.appendChild(fill);
    rowWrap.appendChild(gauge);
  }

  return rowWrap;
}
