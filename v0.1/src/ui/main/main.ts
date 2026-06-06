// 展開態主視窗 renderer:畫狀態 + 發 action(不持有遊戲規則,REQ §11.3)

interface Stats {
  STR: number;
  INT: number;
  DEF: number;
  DEX: number;
  SPD: number;
  LUK: number;
}

interface AffixView {
  text: string;
  tier: number;
  slot: 'prefix' | 'suffix';
}
interface ItemView {
  id: string;
  name: string;
  rarity: string;
  rarityName: string;
  rarityColor: string;
  typeName: string;
  typeEmoji: string;
  category: 'weapon' | 'armor' | 'ring';
  itemLevel: number;
  twoHanded: boolean;
  baseLines: string[];
  affixes: AffixView[];
  affixCount: number;
  rarityOrder: number;
  sellValue: number;
  favorite: boolean;
  equipSlots: string[];
}
interface StoneView {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  kind: 'upgrade' | 'directive' | 'modify';
  count: number;
}
interface CraftInfoView {
  craftable: boolean;
  reason?: string;
  fromRarity: string;
  fromRarityName: string;
  targetRarity: string | null;
  targetRarityName: string;
  stoneId: string | null;
  stoneName: string;
  stoneOwned: number;
  cost: number;
  successRate: number;
  pity: number;
  maxed: boolean;
  craftCount: number;
}
interface SkillItem {
  id: string;
  name: string;
  kind: 'active' | 'passive';
  emoji: string;
  desc: string;
  cd: number | null;
  mp: number | null;
  slot: number | null;
}

interface Snapshot {
  level: number;
  exp: number;
  expToNext: number;
  gold: number;
  unspentPoints: number;
  respecCount: number;
  respecCost: number;
  baseStats: Stats;
  allocated: Stats;
  effStats: Stats;
  charHp: number;
  charMp: number;
  charAttackBar: number;
  enemy: { name: string; level: number; hp: number; maxHp: number } | null;
  floaters: unknown[];
  totalKills: number;
  invVersion: number;
  equipment: Record<string, ItemView | null>;
  inventory: ItemView[];
  inventoryCap: number;
  expandCost: number;
  canExpand: boolean;
  stones: StoneView[];
  skills: { slots: (SkillItem | null)[]; books: SkillItem[]; cooldowns: number[]; total: number };
  dev: { expMult: number; dropMult: number; infiniteGold: boolean; infiniteStones: boolean };
  settings: { autoBoss: boolean; loopStage: boolean };
  map: {
    mapLevel: number;
    selectedMapLevel: number;
    areaIndex: number;
    monstersDefeated: number;
    monstersPerArea: number;
    areaCount: number;
    phase: 'mob' | 'areaBoss' | 'worldBoss';
    areaName: string;
    areas: { name: string; emphasis: keyof Stats }[];
  };
  derived: {
    maxHp: number;
    maxMp: number;
    pAtk: number;
    mAtk: number;
    critChance: number;
    critMult: number;
    attackInterval: number;
    atkPerSec: number;
    dropBonus: number;
    hpRegen: number;
    mpRegen: number;
    armour: number;
    cdrPct: number;
    dmgReductionPct: number;
    expGainPct: number;
    area: string;
  };
}

// window.game 型別見 ../env.d.ts(共用,由 preload 暴露)

const $ = (id: string) => document.getElementById(id)!;

const STAT_META: { key: keyof Stats; cn: string; desc: string }[] = [
  { key: 'STR', cn: '力量 STR', desc: '物理攻擊 · 少量 HP' },
  { key: 'INT', cn: '智力 INT', desc: '魔法攻擊 · 魔力上限' },
  { key: 'DEF', cn: '防禦 DEF', desc: '減傷 · 少量 HP' },
  { key: 'DEX', cn: '敏捷 DEX', desc: '命中 · 爆擊率' },
  { key: 'SPD', cn: '速度 SPD', desc: '出手速度 · 先攻' },
  { key: 'LUK', cn: '幸運 LUK', desc: '爆傷 · 掉落 · 稀有度' },
];

const SLOTS: { key: string; icon: string; label: string }[] = [
  { key: 'mainHand', icon: '⚔️', label: '主武器' },
  { key: 'offHand', icon: '🛡️', label: '副手 / 盾' },
  { key: 'helmet', icon: '⛑️', label: '頭盔' },
  { key: 'chest', icon: '🥋', label: '胸甲' },
  { key: 'gloves', icon: '🧤', label: '手套' },
  { key: 'boots', icon: '🥾', label: '鞋子' },
  { key: 'ring1', icon: '💍', label: '飾品 1' },
  { key: 'ring2', icon: '📿', label: '飾品 2' },
];

// 背包/裝備選取狀態與重畫門檻
let lastInvVersion = -1;
let lastMapStructKey = ''; // 地圖區域卡片只在結構改變時重建(避免高頻重繪吃掉點擊)
let invFilter: 'all' | 'weapon' | 'armor' | 'ring' = 'all';
let invRarity: 'all' | 'common' | 'magic' | 'rare' | 'epic' | 'legendary' = 'all';
let invSort: 'ilvl-desc' | 'ilvl-asc' | 'rarity-desc' | 'sell-desc' = 'ilvl-desc';
let favOnly = false; // 篩選:只看我的最愛
let bagChecked = new Set<string>(); // 批量勾選的物品 id
let selection: { source: 'bag' | 'equip'; key: string } | null = null;

// 加工頁狀態
let craftSelId: string | null = null;
let craftInfoCache: CraftInfoView | null = null;
let craftDir: 'prefix' | 'suffix' | null = null;
let craftMsgTimer: ReturnType<typeof setTimeout> | undefined;

// 技能頁狀態
let lastSkillInv = -1;
let skillMsgTimer: ReturnType<typeof setTimeout> | undefined;

// 設定 / 開發者面板
const DEV_CODE = '920207';
let devUnlocked = false;
let devMsgTimer: ReturnType<typeof setTimeout> | undefined;
const M_MIN = 0.25;
const M_MAX = 1000;
const M_SPAN = 1000; // 對數刻度滑桿位置範圍
function multFromPos(pos: number): number {
  return M_MIN * Math.pow(M_MAX / M_MIN, pos / M_SPAN);
}
function posFromMult(v: number): number {
  const c = Math.min(M_MAX, Math.max(M_MIN, v));
  return Math.round((M_SPAN * Math.log(c / M_MIN)) / Math.log(M_MAX / M_MIN));
}
function clampMult(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.round(Math.min(M_MAX, Math.max(M_MIN, v)) * 100) / 100;
}
function fmtMult(v: number): string {
  return v >= 100 ? `${Math.round(v)}` : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

const AREA_EMOJI = ['👹', '🔮', '🛡️', '🌪️', '🏹', '🎰'];

// 衍生數值列(固定 8 項,只建一次,之後就地更新值)
const DERIVED_ROWS: { id: string; label: string; val: (d: Snapshot['derived']) => string }[] = [
  { id: 'maxhp', label: '最大 HP', val: (d) => `${d.maxHp}` },
  { id: 'maxmp', label: '最大 MP', val: (d) => `${d.maxMp}` },
  { id: 'patk', label: '物理攻擊(普攻)', val: (d) => `${d.pAtk}` },
  { id: 'matk', label: '魔法攻擊(技能)', val: (d) => `${d.mAtk}` },
  { id: 'armour', label: '護甲值', val: (d) => `${Math.round(d.armour)}` },
  { id: 'crit', label: '爆擊率', val: (d) => `${(d.critChance * 100).toFixed(1)}%` },
  { id: 'critdmg', label: '爆擊傷害', val: (d) => `×${d.critMult.toFixed(2)}` },
  { id: 'spd', label: '攻擊間隔', val: (d) => `${d.attackInterval.toFixed(2)}s · ${d.atkPerSec.toFixed(2)}/s` },
  { id: 'cdr', label: '冷卻減少', val: (d) => `${(d.cdrPct * 100).toFixed(0)}%` },
  { id: 'dmgred', label: '傷害減免', val: (d) => `${(d.dmgReductionPct * 100).toFixed(0)}%` },
  { id: 'hpregen', label: '生命回復', val: (d) => `${d.hpRegen.toFixed(1)}/s` },
  { id: 'mpregen', label: '魔力回復', val: (d) => `${d.mpRegen.toFixed(1)}/s` },
  { id: 'drop', label: '掉落加成', val: (d) => `+${((d.dropBonus - 1) * 100).toFixed(0)}%` },
  { id: 'expg', label: '經驗加成', val: (d) => `+${(d.expGainPct * 100).toFixed(0)}%` },
];

let latest: Snapshot | null = null;
let mapDial = -1; // 玩家在地圖頁上正在挑選的等級(尚未按前往)

function pct(cur: number, max: number): string {
  if (max <= 0) return '0%';
  return Math.max(0, Math.min(100, (cur / max) * 100)).toFixed(1) + '%';
}

/** 大數字縮寫(經驗/金幣後期會到百萬以上) */
function fmtNum(n: number): string {
  if (n < 10000) return `${Math.round(n)}`;
  if (n < 1e6) return `${(n / 1e3).toFixed(1)}k`;
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M`;
  if (n < 1e12) return `${(n / 1e9).toFixed(2)}B`;
  return `${(n / 1e12).toFixed(2)}T`;
}

// ---------- 一次性建立靜態結構 ----------
function buildStatic(): void {
  // 屬性列:只建一次。之後每幀只就地更新數字與按鈕禁用狀態,
  // 不再用 innerHTML 重建 —— 否則高頻(~10Hz)重建會在使用者按下的瞬間
  // 抽換按鈕元素,導致 click 無法成立(加點「有時按不到」的根因)。
  $('statList').innerHTML = STAT_META.map(
    (m) =>
      `<div class="stat-row">` +
      `<div class="stat-name"><span class="cn">${m.cn}</span><span class="desc">${m.desc}</span></div>` +
      `<div class="stat-val"><div class="total" id="st-total-${m.key}"></div>` +
      `<div class="break" id="st-break-${m.key}"></div></div>` +
      `<button class="stat-plus" data-stat="${m.key}" id="st-plus-${m.key}">+</button>` +
      `</div>`,
  ).join('');

  // 衍生數值列:只建一次
  $('derivedGrid').innerHTML = DERIVED_ROWS.map(
    (r) =>
      `<div class="derived-item"><span class="k">${r.label}</span>` +
      `<span class="v" id="dv-${r.id}"></span></div>`,
  ).join('');

  // 裝備格 / 背包 / 加工 / 技能 皆為動態(依 invVersion 重畫)。
}

// ---------- 角色頁(就地更新,不抽換 DOM 節點) ----------
function renderChar(s: Snapshot): void {
  $('statHint').textContent = `未分配 ${s.unspentPoints} 點`;
  const canAlloc = s.unspentPoints > 0;
  for (const m of STAT_META) {
    const alloc = s.allocated[m.key];
    $(`st-total-${m.key}`).textContent = `${s.effStats[m.key]}`;
    $(`st-break-${m.key}`).textContent = `保底 ${s.baseStats[m.key]}${alloc ? ` + 分配 ${alloc}` : ''}`;
    ($(`st-plus-${m.key}`) as HTMLButtonElement).disabled = !canAlloc;
  }

  // 衍生數值
  for (const r of DERIVED_ROWS) {
    $(`dv-${r.id}`).textContent = r.val(s.derived);
  }

  // 洗點
  const allocSum =
    s.allocated.STR + s.allocated.INT + s.allocated.DEF + s.allocated.DEX + s.allocated.SPD + s.allocated.LUK;
  $('respecInfo').textContent = `洗點費用 💰${s.respecCost} · 可退 ${allocSum} 點 · 已洗 ${s.respecCount} 次`;
  const rb = $('respecBtn') as HTMLButtonElement;
  rb.disabled = allocSum === 0 || s.gold < s.respecCost;
}

// ---------- 地圖頁 ----------
function renderMap(s: Snapshot): void {
  if (mapDial < 0) mapDial = s.map.selectedMapLevel;
  mapDial = Math.max(1, Math.min(mapDial, s.map.mapLevel));

  $('mapSel').textContent = `${mapDial}`;
  $('mapMax').textContent = `${s.map.mapLevel}`;
  $('mapCurLevel').textContent = `${s.map.selectedMapLevel}`;
  (($('mapMinus') as HTMLButtonElement).disabled = mapDial <= 1);
  (($('mapPlus') as HTMLButtonElement).disabled = mapDial >= s.map.mapLevel);
  (($('mapGo') as HTMLButtonElement).disabled = mapDial === s.map.selectedMapLevel);

  // 目前關卡階段橫幅
  const phaseEl = $('mapPhase');
  if (s.map.phase === 'worldBoss') {
    phaseEl.className = 'map-phase world';
    phaseEl.textContent = '☆ 世界王降臨!擊敗即可升地圖等級 + 保底高階加工石 + 大量掉落';
  } else if (s.map.phase === 'areaBoss') {
    phaseEl.className = 'map-phase boss';
    phaseEl.textContent = `★ ${s.map.areaName}之王 — 擊敗後前進下一區`;
  } else {
    phaseEl.className = 'map-phase';
    phaseEl.textContent = `目前:${s.map.areaName} · 清小怪 ${s.map.monstersDefeated}/${s.map.monstersPerArea} → 區域王`;
  }

  const cur = s.map.areaIndex; // = areaCount 時代表世界王階段
  const total = s.map.monstersPerArea;

  // 區域卡片只在「結構」改變時重建(等級/區域/階段),不含 monstersDefeated → 避免每幀重建吃掉點擊
  const structKey = `${s.map.mapLevel}|${s.map.selectedMapLevel}|${cur}|${s.map.phase}`;
  if (structKey !== lastMapStructKey) {
    lastMapStructKey = structKey;
    $('areaGrid').innerHTML = s.map.areas
      .map((a, i) => {
        const cleared = i < cur;
        const isCur = i === cur && s.map.phase !== 'worldBoss';
        const bossNow = isCur && s.map.phase === 'areaBoss';
        const done = isCur ? s.map.monstersDefeated : cleared ? total : 0;
        const w = bossNow ? 100 : (done / total) * 100;
        const badge = bossNow
          ? '<span class="badge-current">★ 區域王</span>'
          : isCur
            ? '<span class="badge-current">進行中</span>'
            : cleared
              ? '<span class="badge-done">✔ 已清</span>'
              : '';
        const prog = bossNow ? '★ 區域王 待戰' : cleared ? '已通關' : `小怪 ${done}/${total}`;
        return (
          `<div class="area-card pick ${isCur ? 'current' : ''} ${cleared ? 'cleared' : ''} ${bossNow ? 'boss' : ''}" data-area="${i}" title="點擊指定刷此區域">` +
          `<div class="a-top"><span class="a-emoji">${AREA_EMOJI[i % AREA_EMOJI.length]}</span>` +
          `<div><div class="a-name">${a.name}</div><div class="a-emph">強化 ${a.emphasis}</div></div>` +
          `${badge}</div>` +
          `<div class="a-prog">${prog}</div>` +
          `<div class="mini-bar"><div style="width:${w}%"></div></div>` +
          `</div>`
        );
      })
      .join('');
  }

  // 每幀就地更新「目前區域」的小怪進度(不重建 DOM → 點擊穩定)
  if (s.map.phase === 'mob') {
    const card = document.querySelector(`#areaGrid .area-card[data-area="${cur}"]`);
    const prog = card?.querySelector('.a-prog');
    const bar = card?.querySelector('.mini-bar > div') as HTMLElement | null;
    if (prog) prog.textContent = `小怪 ${s.map.monstersDefeated}/${total}`;
    if (bar) bar.style.width = `${(s.map.monstersDefeated / total) * 100}%`;
  }
}

// 共用:套用類別 + 稀有度 + 我的最愛篩選 + 排序(背包與加工頁共用)
function filterSort(items: ItemView[]): ItemView[] {
  const list = items.filter(
    (it) =>
      (invFilter === 'all' || it.category === invFilter) &&
      (invRarity === 'all' || it.rarity === invRarity) &&
      (!favOnly || it.favorite),
  );
  const sorters: Record<typeof invSort, (a: ItemView, b: ItemView) => number> = {
    'ilvl-desc': (a, b) => b.itemLevel - a.itemLevel || b.rarityOrder - a.rarityOrder,
    'ilvl-asc': (a, b) => a.itemLevel - b.itemLevel || b.rarityOrder - a.rarityOrder,
    'rarity-desc': (a, b) => b.rarityOrder - a.rarityOrder || b.itemLevel - a.itemLevel,
    'sell-desc': (a, b) => b.sellValue - a.sellValue,
  };
  return [...list].sort(sorters[invSort]);
}
function bagFiltered(s: Snapshot): ItemView[] {
  return filterSort(s.inventory);
}

// 篩選條件摘要文字(顯示在篩選鈕旁)
function filterSummaryText(): string {
  const cat: Record<string, string> = { all: '全部', weapon: '武器', armor: '防具', ring: '飾品' };
  const rar: Record<string, string> = { all: '全稀有', common: '普通', magic: '魔法', rare: '稀有', epic: '史詩', legendary: '傳說' };
  const sort: Record<string, string> = { 'ilvl-desc': '物等↓', 'ilvl-asc': '物等↑', 'rarity-desc': '稀有度↓', 'sell-desc': '售價↓' };
  return `${cat[invFilter]} · ${rar[invRarity]} · ${sort[invSort]}${favOnly ? ' · ★' : ''}`;
}

// 更新批量工具列(已選數量 / 估計金額 / 按鈕可用狀態)
function updateBulkInfo(s: Snapshot): void {
  const sellMap = new Map(s.inventory.map((i) => [i.id, i.sellValue]));
  let gold = 0;
  for (const id of bagChecked) gold += sellMap.get(id) ?? 0;
  const n = bagChecked.size;
  const info = document.getElementById('bagBulkInfo');
  if (info) info.textContent = n ? `已選 ${n} · 估 💰${gold}` : '已選 0';
  const sell = document.getElementById('bagSell') as HTMLButtonElement | null;
  const disc = document.getElementById('bagDiscard') as HTMLButtonElement | null;
  if (sell) sell.disabled = n === 0;
  if (disc) disc.disabled = n === 0;
}

// ---------- 背包 / 裝備頁 ----------
// 只有 invVersion 變動(掉落 / 換裝 / 丟棄)才重畫格子,避免高頻重繪讓點擊失效。
function renderInventory(s: Snapshot, force = false): void {
  if (!force && s.invVersion === lastInvVersion) return;
  lastInvVersion = s.invVersion;

  // 8 格裝備
  $('equipGrid').innerHTML = SLOTS.map((sl) => {
    const it = s.equipment[sl.key];
    const sel = selection && selection.source === 'equip' && selection.key === sl.key ? ' selected' : '';
    const body = it
      ? `<div class="slot-item" style="color:${it.rarityColor}">${it.name}</div>`
      : `<div class="slot-item empty">— 空 —</div>`;
    return (
      `<div class="equip-slot${it ? ' filled' : ''}${sel}" data-slot="${sl.key}">` +
      `<span class="icon">${it ? it.typeEmoji : sl.icon}</span>` +
      `<div class="slot-body"><div class="slot-label">${sl.label}</div>${body}</div>` +
      `</div>`
    );
  }).join('');

  // 背包清單(套用 類別 + 稀有度 篩選 + 排序)
  const items = bagFiltered(s);
  // 勾選集合只保留仍存在的物品
  const present = new Set(s.inventory.map((i) => i.id));
  for (const id of [...bagChecked]) if (!present.has(id)) bagChecked.delete(id);
  if (!items.length) {
    $('bagList').innerHTML = `<div class="bag-empty">${
      s.inventory.length ? '此條件沒有物品' : '背包是空的 — 打怪會掉裝備'
    }</div>`;
  } else {
    $('bagList').innerHTML = items
      .map((it) => {
        const sel = selection && selection.source === 'bag' && selection.key === it.id ? ' selected' : '';
        const chk = bagChecked.has(it.id) ? ' checked' : '';
        return (
          `<div class="item-row${sel}${chk ? ' checked' : ''}" data-id="${it.id}" style="border-left-color:${it.rarityColor}">` +
          `<span class="ri-check" data-check="${it.id}">${chk ? '☑' : '☐'}</span>` +
          `<span class="ri-fav${it.favorite ? ' on' : ''}" data-fav="${it.id}">${it.favorite ? '★' : '☆'}</span>` +
          `<span class="ri-emoji">${it.typeEmoji}</span>` +
          `<span class="ri-name" style="color:${it.rarityColor}">${it.name}</span>` +
          `<span class="ri-ilvl">iLv ${it.itemLevel}</span>` +
          `<span class="ri-sell">💰${it.sellValue}</span>` +
          `</div>`
        );
      })
      .join('');
  }
  updateBulkInfo(s);
  $('bagFilterSummary').textContent = filterSummaryText();
  $('craftFilterSummary').textContent = filterSummaryText();

  // 加工清單:背包 + 已裝備(都可加工),套用同一篩選
  const equipped = Object.values(s.equipment).filter((x): x is ItemView => !!x);
  const equippedIds = new Set(equipped.map((it) => it.id));
  const craftPool = filterSort([...s.inventory, ...equipped]);
  $('craftList').innerHTML = craftPool.length
    ? craftPool
        .map((it) => {
          const sel = craftSelId === it.id ? ' selected' : '';
          const worn = equippedIds.has(it.id) ? '<span class="badge-worn">已裝備</span>' : '';
          const fav = it.favorite ? '<span class="ri-fav on">★</span>' : '';
          return (
            `<div class="item-row${sel}" data-cid="${it.id}" style="border-left-color:${it.rarityColor}">` +
            `${fav}<span class="ri-emoji">${it.typeEmoji}</span>` +
            `<span class="ri-name" style="color:${it.rarityColor}">${it.name}</span>` +
            `${worn}<span class="ri-ilvl">${it.rarityName}</span></div>`
          );
        })
        .join('')
    : `<div class="bag-empty">此條件沒有裝備</div>`;

  // 石頭庫存
  $('stoneList').innerHTML = s.stones
    .map(
      (st) =>
        `<div class="stone-row${st.count <= 0 ? ' zero' : ''}"><span class="s-emoji">${st.emoji}</span>` +
        `<div class="s-body"><div class="s-name">${st.name}</div><div class="s-desc">${st.desc}</div></div>` +
        `<span class="s-cnt">${st.count}</span></div>`,
    )
    .join('');
}

/** 物品本體(名稱/副標/基底/詞綴)— 詳情與比對共用 */
function itemBodyHtml(it: ItemView): string {
  const base = it.baseLines.map((l) => `<div class="di-base">${l}</div>`).join('');
  const affixes = it.affixes
    .map((a) => `<div class="di-affix ${a.slot}"><span>${a.text}</span><span class="tier">T${a.tier}</span></div>`)
    .join('');
  return (
    `<div class="di-name" style="color:${it.rarityColor}">${it.favorite ? '★ ' : ''}${it.name}</div>` +
    `<div class="di-sub">${it.rarityName} · ${it.typeName}${it.twoHanded ? '(雙手)' : ''} · iLv ${it.itemLevel}</div>` +
    (base ? `<div class="di-section">${base}</div>` : '') +
    (affixes ? `<div class="di-section">${affixes}</div>` : '')
  );
}

/** 詳情面板:只在選取改變 / 操作後重畫(動作按鈕因此穩定可點) */
function renderDetail(s: Snapshot): void {
  const host = $('invDetail');
  const sel = selection;
  if (!sel) {
    host.innerHTML = `<div class="detail-empty">點背包物品或裝備格查看</div>`;
    return;
  }
  const item =
    sel.source === 'equip'
      ? s.equipment[sel.key]
      : s.inventory.find((i) => i.id === sel.key) || null;
  if (!item) {
    selection = null;
    host.innerHTML = `<div class="detail-empty">物品已不在</div>`;
    return;
  }
  const favBtn = `<button class="btn fav-btn${item.favorite ? ' on' : ''}" data-act="fav">${item.favorite ? '★ 已收藏' : '☆ 收藏'}</button>`;
  const actions =
    sel.source === 'equip'
      ? `<button class="btn" data-act="unequip">卸下</button>` + favBtn
      : `<button class="btn primary" data-act="equip">替換</button>` +
        `<button class="btn" data-act="sell">販賣 💰${item.sellValue}</button>` +
        favBtn +
        `<button class="btn danger" data-act="discard">丟棄</button>`;

  // 比對:選背包裝備時,顯示目前身上同部位的裝備(無則顯示空)
  let cmp = '';
  if (sel.source === 'bag' && item.equipSlots.length) {
    const labelOf = (k: string) => SLOTS.find((sl) => sl.key === k)?.label ?? k;
    cmp =
      `<div class="di-cmp-title">目前裝備(同部位)</div>` +
      item.equipSlots
        .map((slot) => {
          const eq = s.equipment[slot];
          return (
            `<div class="di-cmp"><div class="di-cmp-slot">${labelOf(slot)}</div>` +
            (eq ? itemBodyHtml(eq) : `<div class="di-cmp-empty">— 空 —</div>`) +
            `</div>`
          );
        })
        .join('');
  }

  host.innerHTML = itemBodyHtml(item) + `<div class="di-actions">${actions}</div>` + cmp;
}

// ---------- 加工頁 ----------
function craftMsgSet(text: string): void {
  const el = document.getElementById('craftMsg');
  if (!el) return;
  el.textContent = text;
  if (craftMsgTimer) clearTimeout(craftMsgTimer);
  craftMsgTimer = setTimeout(() => {
    const e = document.getElementById('craftMsg');
    if (e) e.textContent = '';
  }, 3200);
}

async function refreshCraftPanel(): Promise<void> {
  if (!craftSelId) {
    craftInfoCache = null;
    buildCraftPanel();
    return;
  }
  craftInfoCache = (await window.game.craftInfo(craftSelId)) as CraftInfoView | null;
  buildCraftPanel();
}

function buildCraftPanel(): void {
  const host = $('craftPanel');
  const info = craftInfoCache;
  const item =
    latest && craftSelId
      ? latest.inventory.find((i) => i.id === craftSelId) ??
        Object.values(latest.equipment).find((it) => it?.id === craftSelId) ??
        null
      : null;
  if (!info || !item) {
    host.innerHTML = `<div class="detail-empty">從左側選一件裝備加工</div>`;
    return;
  }
  const affixes = item.affixes
    .map((a) => `<div class="di-affix ${a.slot}"><span>${a.text}</span><span class="tier">T${a.tier}</span></div>`)
    .join('');
  const head =
    `<div class="di-name" style="color:${item.rarityColor}">${item.name}</div>` +
    `<div class="craft-count">🔨 已加工 <b>${info.craftCount}</b> 次 · 下次加工費 <b class="gold-num">💰${info.cost}</b><span class="craft-count-note">(升階 / 改造皆需此費用)</span></div>` +
    (affixes ? `<div class="di-section">${affixes}</div>` : '');

  // 升階區(非最高稀有度才有)
  let upgradeHtml: string;
  if (info.maxed) {
    upgradeHtml = `<div class="craft-directive">已是最高稀有度(傳說),無法再升階。</div>`;
  } else {
    const pre = latest!.stones.find((s) => s.id === 'prefix');
    const suf = latest!.stones.find((s) => s.id === 'suffix');
    const dirChips =
      `<button class="chip${craftDir === 'prefix' ? ' active' : ''}" data-dir="prefix"${pre && pre.count > 0 ? '' : ' disabled'}>前綴石 ×${pre ? pre.count : 0}</button>` +
      `<button class="chip${craftDir === 'suffix' ? ' active' : ''}" data-dir="suffix"${suf && suf.count > 0 ? '' : ' disabled'}>後綴石 ×${suf ? suf.count : 0}</button>`;
    upgradeHtml =
      `<div class="di-sub">${info.fromRarityName} → <b style="color:var(--gold)">${info.targetRarityName}</b> · iLv ${item.itemLevel}</div>` +
      `<div class="craft-info di-section">` +
      `<div class="row"><span>升階石</span><span>${info.stoneName} ×${info.stoneOwned}</span></div>` +
      `<div class="row"><span>成功率</span><span class="craft-rate-big">${Math.round(info.successRate * 100)}%</span></div>` +
      `<div class="row"><span>失敗保底</span><span>每次 +10%(累積 ${info.pity})</span></div>` +
      `<div class="row"><span>加工費</span><span>💰${info.cost}</span></div>` +
      `</div>` +
      `<div class="craft-directive">指定詞綴:${dirChips}</div>` +
      `<button class="btn primary" id="craftBtn">升階加工</button>`;
  }

  // 改造石區(改現有詞綴,任何稀有度可用)
  const mods = latest!.stones.filter((s) => s.kind === 'modify' && s.count > 0);
  const modHtml = mods.length
    ? `<div class="mod-stones">` +
      mods
        .map(
          (s) => `<button class="btn tiny mod-btn" data-stone="${s.id}" title="${s.desc}">${s.emoji} ${s.name} ×${s.count}</button>`,
        )
        .join('') +
      `</div>`
    : `<div class="dev-hint">改造石(改詞綴)— 目前沒有,打怪會掉</div>`;

  host.innerHTML =
    head +
    upgradeHtml +
    `<div class="di-section"><div class="craft-directive">改造石(改詞綴):</div>${modHtml}</div>` +
    `<div class="inv-msg" id="craftMsg"></div>`;
  if (latest) updateCraftAffordability(latest);
}

// 每幀更新加工鈕可否按(金幣即時變;鈕本身只在選取/加工後重建)
function updateCraftAffordability(s: Snapshot): void {
  if (!craftInfoCache) return;
  const info = craftInfoCache;
  const btn = document.getElementById('craftBtn') as HTMLButtonElement | null;
  if (btn) btn.disabled = info.maxed || info.stoneOwned <= 0 || s.gold < info.cost;
  // 改造石按鈕:金幣不足也不能用(任何加工都要錢)
  const broke = s.gold < info.cost;
  document.querySelectorAll('.mod-btn').forEach((b) => ((b as HTMLButtonElement).disabled = broke));
}

async function selectCraft(id: string): Promise<void> {
  craftSelId = id;
  craftDir = null;
  if (latest) renderInventory(latest, true); // 更新左側選取高亮
  await refreshCraftPanel();
}

// 背包計數 + 擴充鈕(每幀更新:金幣會即時變,故不走 invVersion 門檻;元素固定不抽換)
function updateExpandUI(s: Snapshot): void {
  $('bagCount').textContent = `${s.inventory.length}/${s.inventoryCap}`;
  const btn = $('expandBtn') as HTMLButtonElement;
  if (!s.canExpand) {
    btn.textContent = '已達上限';
    btn.disabled = true;
  } else {
    btn.textContent = `擴充 💰${s.expandCost}`;
    btn.disabled = s.gold < s.expandCost;
  }
}

let msgTimer: ReturnType<typeof setTimeout> | undefined;
function setMsg(text: string): void {
  $('invMsg').textContent = text;
  if (msgTimer) clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    $('invMsg').textContent = '';
  }, 2800);
}

// ---------- 技能頁(invVersion 變動才重畫:配槽 / 掉技能書)----------
function skillMsgSet(text: string): void {
  const el = document.getElementById('skillMsg');
  if (!el) return;
  el.textContent = text;
  if (skillMsgTimer) clearTimeout(skillMsgTimer);
  skillMsgTimer = setTimeout(() => {
    const e = document.getElementById('skillMsg');
    if (e) e.textContent = '';
  }, 3000);
}

function renderSkills(s: Snapshot, force = false): void {
  if (!force && s.invVersion === lastSkillInv) return;
  lastSkillInv = s.invVersion;

  $('skillSlots').innerHTML = s.skills.slots
    .map((sk, i) => {
      if (!sk) return `<div class="skill-slot empty" data-slot="${i}"><span class="slot-num">${i + 1}</span>＋</div>`;
      const spec = sk.kind === 'active' ? `CD ${sk.cd}s · MP ${sk.mp}` : '常駐';
      return (
        `<div class="skill-slot filled" data-slot="${i}" title="點此卸下"><span class="slot-num">${i + 1}</span>` +
        `<div class="sk-emoji">${sk.emoji}</div><div class="sk-name">${sk.name}</div>` +
        `<div class="sk-tag ${sk.kind}">${sk.kind === 'active' ? '主動' : '被動'}</div>` +
        `<div class="sk-spec">${spec}</div></div>`
      );
    })
    .join('');

  $('skillCount').textContent = `${s.skills.books.length}/${s.skills.total}`;
  $('skillBookList').innerHTML = s.skills.books.length
    ? s.skills.books
        .map((b) => {
          const slotted = b.slot != null ? `<span class="sk-slotted">已裝槽 ${b.slot + 1}</span>` : '';
          const spec = b.kind === 'active' ? `CD ${b.cd}s · MP ${b.mp}` : '常駐';
          return (
            `<div class="skbook" data-id="${b.id}">` +
            `<span class="sk-emoji">${b.emoji}</span>` +
            `<div class="skbook-body"><div class="skbook-top"><span class="skbook-name">${b.name}</span>` +
            `<span class="sk-tag ${b.kind}">${b.kind === 'active' ? '主動' : '被動'}</span>${slotted}</div>` +
            `<div class="skbook-desc">${b.desc} · ${spec}</div></div></div>`
          );
        })
        .join('')
    : `<div class="bag-empty">還沒有技能書 — 打怪有機會掉落</div>`;
}

// ---------- 設定 / 開發者面板 ----------
function devMsgSet(text: string): void {
  const el = document.getElementById('devMsg');
  if (!el) return;
  el.textContent = text;
  if (devMsgTimer) clearTimeout(devMsgTimer);
  devMsgTimer = setTimeout(() => {
    const e = document.getElementById('devMsg');
    if (e) e.textContent = '';
  }, 3000);
}

// 顯示「目前已套用」的倍率(每幀更新文字,元素固定不抽換)
function renderDev(s: Snapshot): void {
  $('devExpCur').textContent = `×${fmtMult(s.dev.expMult)}`;
  $('devDropCur').textContent = `×${fmtMult(s.dev.dropMult)}`;
  // dev 無限開關(反映狀態 + 高亮)
  const gb = $('devInfGold');
  gb.textContent = `💰 金錢無限:${s.dev.infiniteGold ? '開' : '關'}`;
  gb.classList.toggle('on', s.dev.infiniteGold);
  const sb = $('devInfStones');
  sb.textContent = `🪨 加工石無限:${s.dev.infiniteStones ? '開' : '關'}`;
  sb.classList.toggle('on', s.dev.infiniteStones);
  // 設定頁開關(反映目前狀態)
  ($('setAutoBoss') as HTMLInputElement).checked = s.settings.autoBoss;
  ($('setLoopStage') as HTMLInputElement).checked = s.settings.loopStage;
}

// 解鎖時把滑桿/輸入框初始化成目前套用值
function initDevSliders(s: Snapshot): void {
  ($('devExpInput') as HTMLInputElement).value = `${s.dev.expMult}`;
  ($('devExpSlider') as HTMLInputElement).value = `${posFromMult(s.dev.expMult)}`;
  ($('devDropInput') as HTMLInputElement).value = `${s.dev.dropMult}`;
  ($('devDropSlider') as HTMLInputElement).value = `${posFromMult(s.dev.dropMult)}`;
}

// ---------- 頂部概況 ----------
function renderHeader(s: Snapshot): void {
  $('hLv').textContent = `Lv.${s.level}`;
  $('hArea').textContent = s.derived.area;
  $('hHpFill').style.width = pct(s.charHp, s.derived.maxHp);
  $('hHpText').textContent = `${Math.ceil(s.charHp)}/${s.derived.maxHp}`;
  $('hMpFill').style.width = pct(s.charMp, s.derived.maxMp);
  $('hMpText').textContent = `${Math.ceil(s.charMp)}/${s.derived.maxMp}`;
  $('hExpFill').style.width = pct(s.exp, s.expToNext);
  $('hExpText').textContent = s.level >= 100 ? 'MAX' : `${fmtNum(s.exp)}/${fmtNum(s.expToNext)}`;
  $('hGold').textContent = fmtNum(s.gold);
  $('hPoints').textContent = `✦ ${s.unspentPoints}`;
}

function render(s: Snapshot): void {
  latest = s;
  renderHeader(s);
  renderChar(s);
  renderMap(s);
  renderInventory(s);
  renderSkills(s);
  renderDev(s);
  updateExpandUI(s);
  updateCraftAffordability(s);
}

async function refresh(): Promise<void> {
  const s = await window.game.getState();
  render(s);
}

// ---------- 事件 ----------
function setupEvents(): void {
  // 分頁切換
  $('tabs').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab') as HTMLElement | null;
    if (!btn) return;
    const tab = btn.dataset.tab!;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
    document
      .querySelectorAll('.panel-tab')
      .forEach((p) => p.classList.toggle('active', (p as HTMLElement).dataset.panel === tab));
  });

  // 分配屬性點(事件委派)
  $('statList').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('.stat-plus') as HTMLElement | null;
    if (!btn || (btn as HTMLButtonElement).disabled) return;
    await window.game.allocateStat(btn.dataset.stat!);
    await refresh();
  });

  // 洗點
  $('respecBtn').addEventListener('click', async () => {
    await window.game.respec();
    await refresh();
  });

  // 地圖選等
  $('mapMinus').addEventListener('click', () => {
    mapDial = Math.max(1, mapDial - 1);
    if (latest) renderMap(latest);
  });
  $('mapPlus').addEventListener('click', () => {
    if (latest) mapDial = Math.min(latest.map.mapLevel, mapDial + 1);
    if (latest) renderMap(latest);
  });
  $('mapTop').addEventListener('click', () => {
    if (latest) mapDial = latest.map.mapLevel;
    if (latest) renderMap(latest);
  });
  $('mapGo').addEventListener('click', async () => {
    await window.game.selectMap(mapDial);
    await refresh();
  });

  // 點區域卡片 → 指定刷該區域
  $('areaGrid').addEventListener('click', async (e) => {
    const card = (e.target as HTMLElement).closest('.area-card') as HTMLElement | null;
    if (!card || card.dataset.area == null) return;
    await window.game.selectArea(parseInt(card.dataset.area, 10));
    await refresh();
  });

  // 設定:自動打王 / 循環同一關卡
  $('setAutoBoss').addEventListener('change', async (e) => {
    await window.game.setAutoBoss((e.target as HTMLInputElement).checked);
    await refresh();
  });
  $('setLoopStage').addEventListener('change', async (e) => {
    await window.game.setLoopStage((e.target as HTMLInputElement).checked);
    await refresh();
  });

  // 背包篩選:類別
  $('invFilters').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.chip') as HTMLElement | null;
    if (!chip) return;
    invFilter = chip.dataset.f as typeof invFilter;
    document.querySelectorAll('#invFilters .chip').forEach((c) => c.classList.toggle('active', c === chip));
    if (latest) renderInventory(latest, true);
  });

  // 背包篩選:稀有度
  $('invRarities').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.chip') as HTMLElement | null;
    if (!chip) return;
    invRarity = chip.dataset.r as typeof invRarity;
    document.querySelectorAll('#invRarities .chip').forEach((c) => c.classList.toggle('active', c === chip));
    if (latest) renderInventory(latest, true);
  });

  // 背包排序
  $('invSort').addEventListener('change', (e) => {
    invSort = (e.target as HTMLSelectElement).value as typeof invSort;
    if (latest) renderInventory(latest, true);
  });

  // 只看我的最愛
  $('filterFavOnly').addEventListener('change', (e) => {
    favOnly = (e.target as HTMLInputElement).checked;
    if (latest) renderInventory(latest, true);
  });

  // 篩選彈出視窗:開 / 關(背包 + 加工共用)
  const openFilter = () => {
    ($('invSort') as HTMLSelectElement).value = invSort;
    ($('filterFavOnly') as HTMLInputElement).checked = favOnly;
    $('filterModal').classList.remove('hidden');
  };
  const closeFilter = () => $('filterModal').classList.add('hidden');
  $('bagFilterBtn').addEventListener('click', openFilter);
  $('craftFilterBtn').addEventListener('click', openFilter);
  $('filterClose').addEventListener('click', closeFilter);
  $('filterModal').addEventListener('click', (e) => {
    if (e.target === $('filterModal')) closeFilter(); // 點背景關閉
  });

  // 全選(目前篩選結果) / 清除勾選
  $('bagSelAll').addEventListener('click', () => {
    if (!latest) return;
    for (const it of bagFiltered(latest)) bagChecked.add(it.id);
    renderInventory(latest, true);
  });
  $('bagSelNone').addEventListener('click', () => {
    bagChecked.clear();
    if (latest) renderInventory(latest, true);
  });

  // 批量販賣勾選
  $('bagSell').addEventListener('click', async () => {
    if (!bagChecked.size) return;
    const ids = [...bagChecked];
    const res = await window.game.sellMany(ids);
    bagChecked.clear();
    setMsg(`已販賣 ${res.count} 件,獲得 💰${res.gold}${res.skipped ? `(★ ${res.skipped} 件最愛已跳過)` : ''}`);
    selection = null;
    await refresh();
    if (latest) {
      renderInventory(latest, true);
      renderDetail(latest);
    }
  });

  // 批量丟棄勾選(二次確認)
  $('bagDiscard').addEventListener('click', async () => {
    if (!bagChecked.size) return;
    if (!confirm(`確定丟棄勾選的 ${bagChecked.size} 件裝備?(無法復原)`)) return;
    const ids = [...bagChecked];
    const res = await window.game.discardMany(ids);
    bagChecked.clear();
    setMsg(`已丟棄 ${res.count} 件${res.skipped ? `(★ ${res.skipped} 件最愛已跳過)` : ''}`);
    selection = null;
    await refresh();
    if (latest) {
      renderInventory(latest, true);
      renderDetail(latest);
    }
  });

  // 選裝備格
  $('equipGrid').addEventListener('click', (e) => {
    const slot = (e.target as HTMLElement).closest('.equip-slot') as HTMLElement | null;
    if (!slot || !latest) return;
    const key = slot.dataset.slot!;
    if (!latest.equipment[key]) {
      selection = null;
    } else {
      selection = { source: 'equip', key };
    }
    renderInventory(latest, true);
    renderDetail(latest);
  });

  // 背包物品:點星號 → 切換我的最愛;點勾選框 → 批量勾選;點其他 → 選取看詳情
  $('bagList').addEventListener('click', async (e) => {
    if (!latest) return;
    const favEl = (e.target as HTMLElement).closest('.ri-fav') as HTMLElement | null;
    if (favEl) {
      await window.game.toggleFavorite(favEl.dataset.fav!);
      await refresh();
      if (latest) renderInventory(latest, true);
      return;
    }
    const checkEl = (e.target as HTMLElement).closest('.ri-check') as HTMLElement | null;
    if (checkEl) {
      const id = checkEl.dataset.check!;
      if (bagChecked.has(id)) bagChecked.delete(id);
      else bagChecked.add(id);
      renderInventory(latest, true);
      return;
    }
    const row = (e.target as HTMLElement).closest('.item-row') as HTMLElement | null;
    if (!row) return;
    selection = { source: 'bag', key: row.dataset.id! };
    renderInventory(latest, true);
    renderDetail(latest);
  });

  // 詳情面板動作:裝備 / 卸下 / 丟棄(委派在穩定容器上)
  $('invDetail').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
    if (!btn || !selection) return;
    const act = btn.dataset.act!;
    const key = selection.key;
    let ok = true;
    let keepSel = false;
    if (act === 'equip') ok = await window.game.equip(key);
    else if (act === 'unequip') ok = await window.game.unequip(key);
    else if (act === 'discard') {
      ok = await window.game.discard(key);
      if (!ok) {
        setMsg('★ 我的最愛需先取消星號才能丟棄');
        keepSel = true;
      }
    } else if (act === 'sell') {
      const gold = await window.game.sell(key);
      setMsg(gold > 0 ? `已販賣,獲得 💰${gold}` : '★ 我的最愛需先取消星號才能販賣');
      if (gold <= 0) keepSel = true;
    } else if (act === 'fav') {
      await window.game.toggleFavorite(key);
      keepSel = true; // 收藏後留在詳情
    }
    if (!ok && act === 'unequip') setMsg('背包已滿,無法卸下(可擴充背包或先丟棄)');
    if (!keepSel) selection = null;
    await refresh();
    if (latest) {
      renderInventory(latest, true);
      renderDetail(latest);
    }
  });

  // 擴充背包
  $('expandBtn').addEventListener('click', async () => {
    const ok = await window.game.expandInventory();
    setMsg(ok ? '背包已擴充 +20 格' : '金幣不足或已達背包上限');
    await refresh();
  });

  // 加工:選裝備
  $('craftList').addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('.item-row') as HTMLElement | null;
    if (!row) return;
    void selectCraft(row.dataset.cid!);
  });

  // 加工:面板動作(指定石切換 / 升階加工)—— 委派在穩定容器上
  $('craftPanel').addEventListener('click', async (e) => {
    const dir = (e.target as HTMLElement).closest('button[data-dir]') as HTMLButtonElement | null;
    if (dir && !dir.disabled) {
      const d = dir.dataset.dir as 'prefix' | 'suffix';
      craftDir = craftDir === d ? null : d;
      buildCraftPanel();
      return;
    }
    const cbtn = (e.target as HTMLElement).closest('#craftBtn') as HTMLButtonElement | null;
    if (cbtn && !cbtn.disabled && craftSelId) {
      const res = await window.game.craft(craftSelId, craftDir);
      craftDir = null;
      await refresh();
      await refreshCraftPanel();
      if (res && res.ok === false) craftMsgSet(res.reason || '無法加工');
      else if (res && res.success) craftMsgSet('✨ 升階成功!');
      else craftMsgSet('升階失敗,保底 +10%(裝備無損)');
      return;
    }
    // 改造石
    const mbtn = (e.target as HTMLElement).closest('.mod-btn') as HTMLButtonElement | null;
    if (mbtn && !mbtn.disabled && craftSelId) {
      const res = await window.game.useStone(craftSelId, mbtn.dataset.stone!);
      await refresh();
      await refreshCraftPanel();
      craftMsgSet(res && res.ok ? `✨ 改造完成(花費 💰${res.cost ?? 0})` : `改造失敗:${res?.reason ?? ''}`);
    }
  });

  // 技能:點技能槽 → 卸下
  $('skillSlots').addEventListener('click', async (e) => {
    const slot = (e.target as HTMLElement).closest('.skill-slot') as HTMLElement | null;
    if (!slot || !latest) return;
    const i = Number(slot.dataset.slot);
    if (latest.skills.slots[i]) {
      await window.game.setSkillSlot(i, null);
      await refresh();
      if (latest) renderSkills(latest, true);
    }
  });

  // 技能:點技能書 → 已裝則卸下,未裝則放進第一個空槽
  $('skillBookList').addEventListener('click', async (e) => {
    const row = (e.target as HTMLElement).closest('.skbook') as HTMLElement | null;
    if (!row || !latest) return;
    const id = row.dataset.id!;
    const book = latest.skills.books.find((b) => b.id === id);
    if (!book) return;
    if (book.slot != null) {
      await window.game.setSkillSlot(book.slot, null);
    } else {
      const empty = latest.skills.slots.findIndex((x) => x === null);
      if (empty < 0) {
        skillMsgSet('技能槽已滿(先卸下一個)');
        return;
      }
      await window.game.setSkillSlot(empty, id);
    }
    await refresh();
    if (latest) renderSkills(latest, true);
  });

  // --- 設定 / 開發者面板 ---
  $('devUnlockBtn').addEventListener('click', () => {
    const code = ($('devCode') as HTMLInputElement).value.trim();
    if (code === DEV_CODE) {
      devUnlocked = true;
      $('devPanel').classList.remove('hidden');
      devMsgSet('已解鎖開發者面板');
      if (latest) initDevSliders(latest);
    } else {
      devMsgSet('代碼錯誤');
    }
  });

  // 倍率滑桿 ↔ 輸入框 雙向綁定(對數刻度);按確認才送出
  function bindMult(slider: string, input: string, apply: string, send: (v: number) => Promise<number>): void {
    const sl = $(slider) as HTMLInputElement;
    const inp = $(input) as HTMLInputElement;
    sl.addEventListener('input', () => {
      inp.value = `${clampMult(multFromPos(Number(sl.value)))}`;
    });
    inp.addEventListener('input', () => {
      const v = clampMult(parseFloat(inp.value));
      sl.value = `${posFromMult(v)}`;
    });
    $(apply).addEventListener('click', async () => {
      if (!devUnlocked) return;
      const v = clampMult(parseFloat(inp.value));
      const applied = await send(v);
      inp.value = `${applied}`;
      sl.value = `${posFromMult(applied)}`;
      devMsgSet(`已套用 ×${fmtMult(applied)}`);
    });
  }
  bindMult('devExpSlider', 'devExpInput', 'devExpApply', (v) => window.game.devSetExpMult(v));
  bindMult('devDropSlider', 'devDropInput', 'devDropApply', (v) => window.game.devSetDropMult(v));

  // 一鍵重置 / 清倉(破壞性,需確認)
  $('devReset').addEventListener('click', async () => {
    if (!devUnlocked) return;
    if (!confirm('確定要重置所有角色資料?\n(等級 / 屬性 / 裝備 / 倉庫 / 技能 全部清空,無法復原)')) return;
    await window.game.devReset();
    selection = null;
    craftSelId = null;
    await refresh();
    if (latest) {
      renderInventory(latest, true);
      renderSkills(latest, true);
      renderDetail(latest);
      buildCraftPanel();
    }
    devMsgSet('已重置角色資料');
  });
  $('devClear').addEventListener('click', async () => {
    if (!devUnlocked) return;
    if (!confirm('確定清空倉庫(背包未裝備物品)?')) return;
    await window.game.devClearInventory();
    selection = null;
    await refresh();
    if (latest) {
      renderInventory(latest, true);
      renderDetail(latest);
    }
    devMsgSet('已清空倉庫');
  });
  // 金錢無限 / 加工石無限 切換
  $('devInfGold').addEventListener('click', async () => {
    if (!devUnlocked) return;
    const on = !(latest?.dev.infiniteGold);
    await window.game.devSetInfiniteGold(on);
    await refresh();
    devMsgSet(on ? '金錢無限:開' : '金錢無限:關');
  });
  $('devInfStones').addEventListener('click', async () => {
    if (!devUnlocked) return;
    const on = !(latest?.dev.infiniteStones);
    await window.game.devSetInfiniteStones(on);
    await refresh();
    if (latest) renderInventory(latest, true); // 石頭數變了
    devMsgSet(on ? '加工石無限:開' : '加工石無限:關');
  });

  // 收合
  $('collapseBtn').addEventListener('click', () => window.game.closeMain());
}

// ---------- 啟動 ----------
buildStatic();
setupEvents();
window.game.onStateUpdate(render);
refresh();

export {};
