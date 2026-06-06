// 遊戲核心對外 API(供 shell 呼叫)
export type {
  GameState,
  Stats,
  Character,
  MapProgress,
  EnemyState,
  Inventory,
} from './state/GameState';
export { createNewGame, SAVE_VERSION } from './state/defaults';
export { tick, ensureEnemy, restoreCharacter, currentAreaName, mapPhase } from './combat/engine';
export { AREAS, makeMonster, makeBoss } from './map/enemy';
export {
  effectiveStats,
  maxHp,
  maxMp,
  physAtk,
  magAtk,
  armourReduction,
  armourFromDEF,
  hitChance,
  critChance,
  critMultiplier,
  attackInterval,
  dropBonus,
  hpRegenPerSec,
  mpRegenPerSec,
} from './formulas/derived';
export { expToNext, killsToLevel, monsterExpReward, monsterGold } from './formulas/leveling';

// --- 裝備系統 (M4) ---
export type {
  Item,
  Affix,
  Rarity,
  ItemType,
  EquipSlot,
  Equipment,
  Bonus,
  StoneId,
} from './items/types';
export { RARITY_INFO, TYPE_INFO, emptyEquipment, emptyBonus } from './items/types';
export { equipmentBonus, itemBonus, affixDef } from './items/affixes';
export { generateItem, rollStone } from './items/generate';
export { equipItem, unequipItem, discardItem, addItemToInventory, sellItem, sellItems, discardItems, toggleFavorite, findItemById } from './items/equip';
export { sellValue } from './items/value';
export { describeItem, stoneViews } from './items/describe';
export type { ItemView, AffixView, StoneView } from './items/describe';
export { craft, craftInfo, craftCostOf, successRateOf, nextRarity } from './items/crafting';
export type { CraftInfo, CraftResult } from './items/crafting';
export { useModifyStone } from './items/modify';
export type { ModifyResult } from './items/modify';
export type { AffixGroup } from './items/types';

// --- 技能系統 (M6) ---
export {
  aggregatePassives,
  setSkillSlot,
  ownsSkill,
  skillBookViews,
  skillSlotViews,
  skillView,
  SKILL_TOTAL,
} from './skills';
export type { SkillView, FullPassive } from './skills';
export { characterCombat, profileFromStats, attackProfileOf } from './combat/profile';
export type { CombatStats, AttackProfile } from './combat/profile';

import type { GameState, Stats } from './state/GameState';
import { restoreCharacter } from './combat/engine';
import { createNewGame } from './state/defaults';
import { BALANCE } from '../data/balance';
import { STONE_LIST } from '../data/stones';

/** 分配一點自由屬性點 (REQ §3) */
export function allocatePoint(state: GameState, stat: keyof Stats): boolean {
  const c = state.character;
  if (c.unspentPoints <= 0) return false;
  c.allocated[stat] += 1;
  c.unspentPoints -= 1;
  return true;
}

/** 目前洗點需要的金幣 (REQ §3,暫定遞增規則) */
export function respecCost(state: GameState): number {
  const r = BALANCE.respec;
  const c = state.character;
  return r.baseCost + c.level * r.perLevel + c.respecCount * r.perRespec;
}

/**
 * 洗點:把所有「自由分配的點」退回成未分配點,扣金幣 (REQ §3)。
 * 只重置自由點,保底成長不動。回傳是否成功。
 */
export function respec(state: GameState): boolean {
  const c = state.character;
  const cost = respecCost(state);
  if (c.gold < cost) return false;
  const refund =
    c.allocated.STR +
    c.allocated.INT +
    c.allocated.DEF +
    c.allocated.DEX +
    c.allocated.SPD +
    c.allocated.LUK;
  if (refund === 0 && cost > 0) {
    // 沒點可洗就不收費、不進行(避免白扣錢)
    return false;
  }
  c.gold -= cost;
  c.allocated = { STR: 0, INT: 0, DEF: 0, DEX: 0, SPD: 0, LUK: 0 };
  c.unspentPoints += refund;
  c.respecCount += 1;
  // 屬性變了 → HP/MP 重新結算(補滿,避免上限縮水後 hp>max)
  restoreCharacter(state);
  return true;
}

/**
 * 選擇要打的地圖等級 (REQ §8.6)。
 * 夾在 1 ~ 已達成的最高地圖等級;切換後從該圖第一區域重新開始。
 */
export function selectMap(state: GameState, level: number): boolean {
  const m = state.map;
  const target = Math.max(1, Math.min(Math.floor(level), m.mapLevel));
  if (target === m.selectedMapLevel) return false;
  m.selectedMapLevel = target;
  m.areaIndex = 0;
  m.monstersDefeated = 0;
  state.runtime.enemy = null; // 重生對應新等級的怪
  return true;
}

/** 選擇要刷的特定區域(0..areaCount-1)→ 跳到該區域刷怪 (REQ §8.6) */
export function selectArea(state: GameState, areaIndex: number): boolean {
  const m = state.map;
  const target = Math.max(0, Math.min(Math.floor(areaIndex), BALANCE.enemy.areaCount - 1));
  if (target === m.areaIndex && m.monstersDefeated < BALANCE.enemy.monstersPerArea) return false;
  m.areaIndex = target;
  m.monstersDefeated = 0;
  state.runtime.enemy = null;
  return true;
}

/** 設定「自動打王」開關;關閉時若場上正是 Boss,立即換回小怪 */
export function setAutoBoss(state: GameState, on: boolean): boolean {
  state.settings.autoBoss = on;
  if (!on && state.runtime.enemy?.boss) state.runtime.enemy = null;
  return on;
}

/** 設定「循環同一關卡」開關 */
export function setLoopStage(state: GameState, on: boolean): boolean {
  state.settings.loopStage = on;
  return on;
}

/** 擴充背包:目前這次要花的金幣(隨已擴充次數遞增) */
export function expandCost(state: GameState): number {
  const e = BALANCE.items.expand;
  const times = Math.max(0, Math.round((state.inventory.cap - BALANCE.items.inventoryCap) / e.slotsPerBuy));
  return e.baseCost + times * e.costPerBuy;
}

/** 背包是否還能再擴充(未達上限) */
export function canExpandInventory(state: GameState): boolean {
  return state.inventory.cap < BALANCE.items.expand.maxCap;
}

/** 花金幣擴充背包格(+slotsPerBuy)。成功回 true。 */
export function expandInventory(state: GameState): boolean {
  if (!canExpandInventory(state)) return false;
  const cost = expandCost(state);
  if (state.character.gold < cost) return false;
  state.character.gold -= cost;
  state.inventory.cap += BALANCE.items.expand.slotsPerBuy;
  state.runtime.invVersion++;
  return true;
}

// ---- 開發者測試面板 ----
function clampMult(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0.25, Math.min(1000, v));
}

/** 一鍵清空倉庫(背包未裝備物品) */
export function clearInventory(state: GameState): void {
  state.inventory.items = [];
  state.runtime.invVersion++;
}

/** 設定經驗倍率(0.25~1000) */
export function setExpMult(state: GameState, v: number): number {
  state.dev.expMult = clampMult(v);
  return state.dev.expMult;
}

/** 設定掉落倍率(0.25~1000) */
export function setDropMult(state: GameState, v: number): number {
  state.dev.dropMult = clampMult(v);
  return state.dev.dropMult;
}

/** dev:金錢無限 開關(每 tick 補滿;金幣顯示為即時,不需 invVersion) */
export function setInfiniteGold(state: GameState, on: boolean): boolean {
  state.dev.infiniteGold = on;
  return on;
}

/** dev:加工石無限 開關(每 tick 補滿所有石頭;開啟時立即補一次 + 通知 UI 重畫) */
export function setInfiniteStones(state: GameState, on: boolean): boolean {
  state.dev.infiniteStones = on;
  if (on) {
    for (const st of STONE_LIST) state.inventory.stones[st.id] = 9999;
    state.runtime.invVersion++;
  }
  return on;
}

/**
 * 一鍵重置角色資料(等級/屬性/裝備/倉庫/技能/地圖全清)。
 * 保留 dev 測試設定(倍率)。就地 mutate(維持同一 state 參考)。
 */
export function resetGame(state: GameState, now: number): void {
  const dev = state.dev;
  const fresh = createNewGame(now);
  Object.assign(state, fresh);
  state.dev = dev;
}

/** 簡易亂數產生器(v0.1 用 Math.random,之後可換成可重播 seed) */
export function defaultRng(): number {
  return Math.random();
}
