// 升階加工 (REQ §6.6) —— 純函式,直接 mutate state(由 core 內部呼叫)
import type { GameState } from '../state/GameState';
import { BALANCE } from '../../data/balance';
import { AFFIXES } from '../../data/affixes';
import { STONES, upgradeStoneFor } from '../../data/stones';
import { rollAffixValue } from './affixes';
import { pickTier } from './generate';
import { findItemById } from './equip';
import { type Item, type Rarity, type AffixSlot, type StoneId, RARITY_INFO, isWeapon } from './types';

const C = BALANCE.crafting;
const RARITY_ORDER: Rarity[] = ['common', 'magic', 'rare', 'epic', 'legendary'];

export function nextRarity(r: Rarity): Rarity | null {
  const i = RARITY_ORDER.indexOf(r);
  return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null;
}

/** 本次加工費:物等越高基礎費越貴 + 隨已成功加工次數指數成長 (REQ §6.11) */
export function craftCostOf(item: Item): number {
  const ilvlMult = 1 + item.itemLevel * C.ilvlCostCoef;
  return Math.round(C.baseCost * ilvlMult * Math.pow(C.costMult, item.craftCount ?? 0));
}

/** 目前成功率(基礎 + 失敗保底,夾 ≤1) */
export function successRateOf(item: Item, target: Rarity): number {
  const base = (C.successRate as Record<string, number>)[target] ?? 0.3;
  return Math.min(1, base + (item.pity ?? 0) * C.pityStep);
}

function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function affixOnItem(item: Item, defId: string): boolean {
  return item.prefixes.some((a) => a.defId === defId) || item.suffixes.some((a) => a.defId === defId);
}

/** 此詞綴能否滾在這件物品(localWeapon 只能在武器上) */
function affixUsable(def: { slot: AffixSlot; scope?: string }, item: Item): boolean {
  return def.scope !== 'localWeapon' || isWeapon(item.type);
}

function sideHasRoom(item: Item, side: AffixSlot): boolean {
  const arr = side === 'prefix' ? item.prefixes : item.suffixes;
  const cap = side === 'prefix' ? BALANCE.items.prefixCap : BALANCE.items.suffixCap;
  if (arr.length >= cap) return false;
  return AFFIXES.some((d) => d.slot === side && affixUsable(d, item) && !affixOnItem(item, d.defId));
}

/** 追加一條詞綴(forceSide 指定側;無空間回 false) */
function addAffix(item: Item, ilvl: number, rng: () => number, forceSide?: AffixSlot): boolean {
  const sides: AffixSlot[] = (forceSide ? [forceSide] : (['prefix', 'suffix'] as AffixSlot[])).filter(
    (s) => sideHasRoom(item, s),
  );
  if (!sides.length) return false;
  const side = sides[Math.floor(rng() * sides.length)];
  const defs = AFFIXES.filter((d) => d.slot === side && affixUsable(d, item) && !affixOnItem(item, d.defId));
  const def = defs[Math.floor(rng() * defs.length)];
  const tier = pickTier(ilvl, rng);
  const affix = { defId: def.defId, slot: side, field: def.field, tier, value: rollAffixValue(def, tier, rng) };
  (side === 'prefix' ? item.prefixes : item.suffixes).push(affix);
  return true;
}

export interface CraftInfo {
  craftable: boolean;
  reason?: string;
  fromRarity: Rarity;
  fromRarityName: string;
  targetRarity: Rarity | null;
  targetRarityName: string;
  stoneId: StoneId | null;
  stoneName: string;
  stoneOwned: number;
  cost: number;
  successRate: number;
  pity: number;
  maxed: boolean;
  /** 這件裝備已成功加工(升階)的次數 */
  craftCount: number;
}

/** 加工資訊(給 UI 預覽,不改狀態) */
export function craftInfo(state: GameState, itemId: string): CraftInfo | null {
  const item = findItemById(state, itemId);
  if (!item) return null;
  const target = nextRarity(item.rarity);
  const stoneId = upgradeStoneFor(item.rarity);
  const owned = stoneId ? state.inventory.stones[stoneId] ?? 0 : 0;
  const cost = craftCostOf(item);
  const info: CraftInfo = {
    craftable: false,
    fromRarity: item.rarity,
    fromRarityName: RARITY_INFO[item.rarity].name,
    targetRarity: target,
    targetRarityName: target ? RARITY_INFO[target].name : '—',
    stoneId,
    stoneName: stoneId ? STONES[stoneId].name : '—',
    stoneOwned: owned,
    cost,
    successRate: target ? successRateOf(item, target) : 0,
    pity: item.pity ?? 0,
    maxed: target === null,
    craftCount: item.craftCount ?? 0,
  };
  if (!target || !stoneId) info.reason = '已是最高稀有度';
  else if (owned <= 0) info.reason = `缺少${STONES[stoneId].name}`;
  else if (state.character.gold < cost) info.reason = '金幣不足';
  else info.craftable = true;
  return info;
}

export interface CraftResult {
  ok: boolean; // 是否實際進行了一次加工(消耗資源)
  success?: boolean; // 升階是否成功
  reason?: string;
  newRarity?: Rarity;
}

/**
 * 加工一件背包裝備:消耗升階石 + 金幣,擲成功率。
 * 成功:稀有度晉升 + 追加 1~2 詞綴 + craftCount++ + pity 歸零。
 * 失敗:不降級不損壞,pity +1(下次成功率 +pityStep)。
 * directive:可選用指定前/後綴石,保證追加一條該側詞綴。
 */
export function craft(
  state: GameState,
  itemId: string,
  rng: () => number,
  directive?: AffixSlot | null,
): CraftResult {
  const item = findItemById(state, itemId);
  if (!item) return { ok: false, reason: '物品不存在' };
  const target = nextRarity(item.rarity);
  const stoneId = upgradeStoneFor(item.rarity);
  if (!target || !stoneId) return { ok: false, reason: '已是最高稀有度' };

  const stones = state.inventory.stones;
  if ((stones[stoneId] ?? 0) <= 0) return { ok: false, reason: `缺少${STONES[stoneId].name}` };
  const cost = craftCostOf(item);
  if (state.character.gold < cost) return { ok: false, reason: '金幣不足' };

  // 指定前/後綴石驗證
  if (directive) {
    const dStone: StoneId = directive; // 'prefix' | 'suffix' 同名石頭
    if ((stones[dStone] ?? 0) <= 0) return { ok: false, reason: `缺少${STONES[dStone].name}` };
    if (!sideHasRoom(item, directive)) {
      return { ok: false, reason: directive === 'prefix' ? '前綴已滿' : '後綴已滿' };
    }
  }

  // 消耗資源
  stones[stoneId] = (stones[stoneId] ?? 0) - 1;
  if (directive) stones[directive] = (stones[directive] ?? 0) - 1;
  state.character.gold -= cost;

  // 擲骰
  const rate = successRateOf(item, target);
  const success = rng() < rate;

  state.runtime.invVersion++;

  if (!success) {
    item.pity = (item.pity ?? 0) + 1;
    return { ok: true, success: false };
  }

  // 成功:晉升 + 追加詞綴
  item.rarity = target;
  item.craftCount = (item.craftCount ?? 0) + 1;
  item.pity = 0;

  const [tmin, tmax] = BALANCE.items.affixCount[target];
  const cur = item.prefixes.length + item.suffixes.length;
  let wanted = cur + randInt(C.affixAddMin, C.affixAddMax, rng);
  if (wanted < tmin) wanted = tmin;
  if (wanted > tmax) wanted = tmax;

  if (directive) addAffix(item, item.itemLevel, rng, directive);
  while (item.prefixes.length + item.suffixes.length < wanted) {
    if (!addAffix(item, item.itemLevel, rng)) break;
  }

  return { ok: true, success: true, newRarity: target };
}
