// 存檔讀寫 (REQ §9) — userData 目錄的 JSON,寫暫存再 rename 防損毀
import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../core';
import { createNewGame, SAVE_VERSION, emptyEquipment } from '../core';

function savePath(): string {
  return join(app.getPath('userData'), 'save.json');
}

/** 舊存檔遷移:補上新欄位,讓舊檔可直接沿用不壞 */
function migrate(data: GameState): GameState {
  // v1 → v2:沒有 equipment / inventory 的補上空的
  if (!data.equipment) data.equipment = emptyEquipment();
  if (!data.inventory) data.inventory = { items: [], cap: 120, stones: {}, skillBooks: [] };
  else {
    if (!Array.isArray(data.inventory.items)) data.inventory.items = [];
    if (typeof data.inventory.cap !== 'number') data.inventory.cap = 120; // v2→v3
    if (!data.inventory.stones) data.inventory.stones = {};
    if (!Array.isArray(data.inventory.skillBooks)) data.inventory.skillBooks = [];
  }
  if (data.runtime && typeof data.runtime.invVersion !== 'number') data.runtime.invVersion = 0;
  // v3→v4:技能槽 + 冷卻
  if (!Array.isArray(data.skillSlots)) data.skillSlots = [null, null, null];
  if (data.runtime && !Array.isArray(data.runtime.skillCooldowns)) data.runtime.skillCooldowns = [0, 0, 0];
  // v4→v5:開發者測試設定
  if (!data.dev || typeof data.dev.expMult !== 'number') data.dev = { expMult: 1, dropMult: 1 };
  // v6→v7:玩家設定(自動打王 / 循環同一關卡)
  if (!data.settings) data.settings = { autoBoss: true, loopStage: false };
  if (typeof data.settings.autoBoss !== 'boolean') data.settings.autoBoss = true;
  if (typeof data.settings.loopStage !== 'boolean') data.settings.loopStage = false;
  // v7→v8:離線收益近期速率取樣
  if (data.runtime && typeof data.runtime.earnedGold !== 'number') data.runtime.earnedGold = 0;
  if (data.runtime && typeof data.runtime.earnedExp !== 'number') data.runtime.earnedExp = 0;
  if (!data.offline) data.offline = { goldPerSec: 0, expPerSec: 0 };
  // v5→v6:裝備模型大改(武器分類/詞綴擴充/護甲值)→ 舊裝備不相容,清空裝備與背包物品
  if (typeof data.version === 'number' && data.version < 6) {
    data.equipment = emptyEquipment();
    if (data.inventory) data.inventory.items = [];
  }
  data.version = SAVE_VERSION;
  return data;
}

export function loadGame(now: number): GameState {
  const path = savePath();
  if (!existsSync(path)) {
    return createNewGame(now);
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw) as GameState;
    if (data.version !== SAVE_VERSION) {
      console.warn(`[save] migrating save ${data.version} → ${SAVE_VERSION}`);
    }
    return migrate(data);
  } catch (e) {
    console.error('[save] load failed, starting new game:', e);
    return createNewGame(now);
  }
}

export function saveGame(state: GameState): void {
  const path = savePath();
  const tmp = path + '.tmp';
  try {
    writeFileSync(tmp, JSON.stringify(state), 'utf-8');
    renameSync(tmp, path); // 原子替換
  } catch (e) {
    console.error('[save] save failed:', e);
  }
}
