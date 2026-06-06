// Electron 主行程:透明懸浮視窗 + 主視窗 + 主迴圈 + IPC + 存檔/離線
// 退出策略:關閉懸浮視窗 = 完全結束程式(不留後台、無 tray 常駐)。
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import type { GameState, Stats, EquipSlot } from '../core';
import {
  tick,
  restoreCharacter,
  ensureEnemy,
  allocatePoint,
  respec,
  respecCost,
  selectMap,
  selectArea,
  setAutoBoss,
  setLoopStage,
  defaultRng,
  expToNext,
  currentAreaName,
  mapPhase,
  AREAS,
  characterCombat,
  describeItem,
  equipItem,
  unequipItem,
  discardItem,
  sellItem,
  sellItems,
  discardItems,
  toggleFavorite,
  expandInventory,
  expandCost,
  canExpandInventory,
  craft,
  craftInfo,
  useModifyStone,
  stoneViews,
  setSkillSlot,
  skillBookViews,
  skillSlotViews,
  SKILL_TOTAL,
  aggregatePassives,
  resetGame,
  clearInventory,
  setExpMult,
  setDropMult,
  setInfiniteGold,
  setInfiniteStones,
} from '../core';
import { loadGame, saveGame } from './save';

const TICK_MS = 100; // 主迴圈頻率
const SAVE_MS = 30_000; // 自動存檔(REQ §9.2)
const OFFLINE_EFFICIENCY = 0.7; // (REQ §10.3)
const OFFLINE_CAP_HOURS = 8; // (REQ §10.4)

let overlay: BrowserWindow | null = null;
let mainWin: BrowserWindow | null = null;
let state: GameState;
let isQuitting = false;

/** 建立收合態懸浮小視窗(REQ §11.4) */
function createOverlay(): void {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const W = 260;
  const H = 96; // 左右對戰佈局,壓低高度
  overlay = new BrowserWindow({
    width: W,
    height: H,
    x: width - W - 20, // 預設右上角
    y: 40,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlay.loadFile(join(__dirname, '../ui/overlay/overlay.html'));

  // 關閉懸浮視窗 = 結束整個遊戲(不留後台)。
  // app.quit() 會一併關閉(可能隱藏的)主面板,並觸發 before-quit 存檔。
  overlay.on('close', () => {
    isQuitting = true;
    app.quit();
  });
}

/** 建立 / 顯示展開態主視窗(REQ §11.1 / §11.3) */
function openMain(): void {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.show();
    mainWin.focus();
    return;
  }
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const W = 720;
  const H = 560;
  mainWin = new BrowserWindow({
    width: W,
    height: H,
    x: Math.round((width - W) / 2),
    y: Math.round((height - H) / 2),
    frame: true,
    transparent: false,
    resizable: true,
    minWidth: 600,
    minHeight: 460,
    alwaysOnTop: false,
    backgroundColor: '#12141c',
    title: '放置冒險 — 主面板',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(join(__dirname, '../ui/main/main.html'));

  // 關閉主視窗 → 回到收合態(隱藏保留,不真正關掉)(REQ §11.1)
  mainWin.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWin?.hide();
    }
  });

  // 載完先推一次完整狀態
  mainWin.webContents.on('did-finish-load', () => {
    mainWin?.webContents.send('state:update', snapshotForUI(false));
  });
}

function closeMain(): void {
  if (mainWin && !mainWin.isDestroyed()) mainWin.hide();
}

/** 離線結算(REQ §10) */
function settleOffline(now: number): { seconds: number; gold: number; exp: number } {
  const elapsed = Math.max(0, (now - state.lastSeenTimestamp) / 1000);
  const capped = Math.min(elapsed, OFFLINE_CAP_HOURS * 3600);
  if (capped < 5) return { seconds: 0, gold: 0, exp: 0 };
  // v0.1 估算:用一個保守的每秒基準 × 效率(尚無「最近5分鐘速率」取樣,先用粗估)
  const perSec = 1 + state.character.level * 0.3;
  const gold = Math.floor(perSec * capped * OFFLINE_EFFICIENCY);
  const exp = Math.floor(perSec * 0.5 * capped * OFFLINE_EFFICIENCY * state.dev.expMult);
  state.character.gold += gold;
  // 經驗直接灌(走核心升級邏輯)
  // 注意:離線不推進地圖(REQ §10.2),只給資源
  state.character.exp += exp;
  return { seconds: Math.floor(capped), gold, exp };
}

function startLoops(): void {
  // 主迴圈
  setInterval(() => {
    tick(state, TICK_MS / 1000, defaultRng);
    broadcast();
  }, TICK_MS);

  // 自動存檔
  setInterval(() => {
    state.lastSeenTimestamp = Date.now();
    saveGame(state);
  }, SAVE_MS);
}

/** 把同一份快照推給兩個視窗(floaters 只在這裡消費一次) */
function broadcast(): void {
  const snap = snapshotForUI(true);
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send('state:update', snap);
  }
  if (mainWin && !mainWin.isDestroyed() && mainWin.isVisible()) {
    mainWin.webContents.send('state:update', snap);
  }
}

/** 8 格裝備的顯示視圖 */
function equipmentView() {
  const eq = state.equipment;
  const out: Record<string, ReturnType<typeof describeItem> | null> = {};
  for (const slot of Object.keys(eq) as EquipSlot[]) {
    const item = eq[slot];
    out[slot] = item ? describeItem(item) : null;
  }
  return out;
}

/** 給 UI 的快照(主視窗 + 懸浮視窗共用,欄位夠兩邊各取所需) */
function snapshotForUI(consumeFloaters: boolean) {
  const c = state.character;
  const cs = characterCombat(c, state.equipment, aggregatePassives(state.skillSlots));
  return {
    // --- 角色基本 ---
    level: c.level,
    exp: c.exp,
    expToNext: expToNext(c.level),
    gold: c.gold,
    unspentPoints: c.unspentPoints,
    respecCount: c.respecCount,
    respecCost: respecCost(state),
    // --- 屬性(effStats 已含裝備加成)---
    baseStats: c.baseStats,
    allocated: c.allocated,
    effStats: cs.eff,
    // --- 戰鬥 runtime ---
    charHp: state.runtime.charHp,
    charMp: state.runtime.charMp,
    charAttackBar: state.runtime.charAttackBar,
    enemy: state.runtime.enemy,
    floaters: consumeFloaters ? state.runtime.floaters.splice(0) : [],
    totalKills: state.runtime.totalKills,
    // --- 裝備 / 背包(UI 以 invVersion 變化才重畫,避免高頻重繪)---
    invVersion: state.runtime.invVersion,
    equipment: equipmentView(),
    inventory: state.inventory.items.map(describeItem),
    inventoryCap: state.inventory.cap,
    expandCost: expandCost(state),
    canExpand: canExpandInventory(state),
    stones: stoneViews(state.inventory.stones),
    skills: {
      slots: skillSlotViews(state),
      books: skillBookViews(state),
      cooldowns: state.runtime.skillCooldowns,
      total: SKILL_TOTAL,
    },
    dev: {
      expMult: state.dev.expMult,
      dropMult: state.dev.dropMult,
      infiniteGold: !!state.dev.infiniteGold,
      infiniteStones: !!state.dev.infiniteStones,
    },
    settings: { autoBoss: state.settings.autoBoss, loopStage: state.settings.loopStage },
    // --- 地圖 ---
    map: {
      mapLevel: state.map.mapLevel,
      selectedMapLevel: state.map.selectedMapLevel,
      areaIndex: state.map.areaIndex,
      monstersDefeated: state.map.monstersDefeated,
      monstersPerArea: 6,
      areaCount: AREAS.length,
      // 'mob' | 'areaBoss' | 'worldBoss' —— 目前關卡階段(供 UI 顯示 Boss 狀態)
      phase: mapPhase(state),
      areaName: currentAreaName(state),
      areas: AREAS.map((a) => ({ name: a.name, emphasis: a.emphasis })),
    },
    // --- 衍生數值(已含裝備加成)---
    derived: {
      maxHp: cs.maxHp,
      maxMp: cs.maxMp,
      pAtk: cs.pAtk,
      mAtk: cs.mAtk,
      critChance: cs.critChance,
      critMult: cs.critMult,
      attackInterval: cs.attackInterval,
      atkPerSec: cs.atkPerSec,
      dropBonus: cs.dropBonus,
      hpRegen: cs.hpRegen,
      mpRegen: cs.mpRegen,
      armour: cs.armour,
      cdrPct: cs.cdrPct,
      dmgReductionPct: cs.dmgReductionPct,
      expGainPct: cs.expGainPct,
      area: currentAreaName(state),
    },
  };
}

function registerIpc(): void {
  ipcMain.handle('action:allocateStat', (_e, stat: keyof Stats) => {
    const ok = allocatePoint(state, stat);
    if (ok) clampVitals();
    return ok;
  });
  ipcMain.handle('action:respec', () => respec(state));
  ipcMain.handle('action:selectMap', (_e, level: number) => selectMap(state, level));
  ipcMain.handle('action:selectArea', (_e, areaIndex: number) => selectArea(state, areaIndex));
  ipcMain.handle('action:setAutoBoss', (_e, on: boolean) => setAutoBoss(state, on));
  ipcMain.handle('action:setLoopStage', (_e, on: boolean) => setLoopStage(state, on));
  ipcMain.handle('action:equip', (_e, itemId: string) => {
    const ok = equipItem(state, itemId);
    if (ok) clampVitals();
    return ok;
  });
  ipcMain.handle('action:unequip', (_e, slot: EquipSlot) => {
    const ok = unequipItem(state, slot);
    if (ok) clampVitals();
    return ok;
  });
  ipcMain.handle('action:discard', (_e, itemId: string) => discardItem(state, itemId));
  ipcMain.handle('action:sell', (_e, itemId: string) => sellItem(state, itemId));
  ipcMain.handle('action:sellMany', (_e, ids: string[]) => sellItems(state, ids));
  ipcMain.handle('action:discardMany', (_e, ids: string[]) => discardItems(state, ids));
  ipcMain.handle('action:toggleFavorite', (_e, itemId: string) => toggleFavorite(state, itemId));
  ipcMain.handle('action:expandInventory', () => expandInventory(state));
  ipcMain.handle('action:craftInfo', (_e, itemId: string) => craftInfo(state, itemId));
  ipcMain.handle('action:craft', (_e, itemId: string, directive: 'prefix' | 'suffix' | null) =>
    craft(state, itemId, defaultRng, directive ?? null),
  );
  ipcMain.handle('action:useStone', (_e, itemId: string, stoneId: string) =>
    useModifyStone(state, itemId, stoneId as never, defaultRng),
  );
  ipcMain.handle('action:setSkillSlot', (_e, slot: number, skillId: string | null) =>
    setSkillSlot(state, slot, skillId),
  );
  // --- 開發者測試面板 ---
  ipcMain.handle('dev:reset', () => {
    resetGame(state, Date.now());
    restoreCharacter(state);
    state.runtime.enemy = null;
    ensureEnemy(state, defaultRng);
    return true;
  });
  ipcMain.handle('dev:clearInventory', () => {
    clearInventory(state);
    return true;
  });
  ipcMain.handle('dev:setExpMult', (_e, v: number) => setExpMult(state, v));
  ipcMain.handle('dev:setDropMult', (_e, v: number) => setDropMult(state, v));
  ipcMain.handle('dev:setInfiniteGold', (_e, on: boolean) => setInfiniteGold(state, on));
  ipcMain.handle('dev:setInfiniteStones', (_e, on: boolean) => setInfiniteStones(state, on));
  ipcMain.on('window:quit', () => {
    isQuitting = true;
    app.quit();
  });
  ipcMain.on('window:openMain', () => openMain());
  ipcMain.on('window:closeMain', () => closeMain());
  ipcMain.handle('state:get', () => snapshotForUI(false));
}

/** 屬性 / 裝備變動會改變 HP/MP 上限;把當前值夾在新上限內(不免費回血) */
function clampVitals(): void {
  const cs = characterCombat(state.character, state.equipment, aggregatePassives(state.skillSlots));
  if (state.runtime.charHp > cs.maxHp) state.runtime.charHp = cs.maxHp;
  if (state.runtime.charMp > cs.maxMp) state.runtime.charMp = cs.maxMp;
}

// 單一實例鎖:免安裝 exe 被重複點開時,不再疊出第二個背景 process,
// 而是把既有視窗叫到前景。
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (overlay && !overlay.isDestroyed()) {
      if (overlay.isMinimized()) overlay.restore();
      overlay.show();
      overlay.focus();
    }
  });

  app.whenReady().then(() => {
    const now = Date.now();
    state = loadGame(now);

    // 還原戰鬥場(HP/MP 補滿)
    restoreCharacter(state);
    // 啟動時強制重生敵人:相容舊存檔(敵人可能缺 stats 欄位導致卡死)
    state.runtime.enemy = null;
    ensureEnemy(state, defaultRng);

    // 離線結算
    const offline = settleOffline(now);
    state.lastSeenTimestamp = now;

    createOverlay();
    registerIpc();
    startLoops();

    // 視窗載完後送離線報告
    overlay?.webContents.on('did-finish-load', () => {
      if (offline.seconds > 0) {
        overlay?.webContents.send('offline:report', offline);
      }
    });
  });

  // 所有視窗關閉 → 結束程式(不留後台)。這也是退出的最後保險。
  app.on('window-all-closed', () => app.quit());

  app.on('before-quit', () => {
    isQuitting = true;
    state.lastSeenTimestamp = Date.now();
    saveGame(state);
  });
}
