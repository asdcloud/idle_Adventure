// 改造石(做裝通貨)：改現有裝備的詞綴 (REQ §6.7) —— 直接 mutate state
import type { GameState } from '../state/GameState';
import { BALANCE } from '../../data/balance';
import { AFFIXES, AFFIX_BY_ID } from '../../data/affixes';
import { STONES } from '../../data/stones';
import { rollAffixValue } from './affixes';
import { pickTier } from './generate';
import { findItemById } from './equip';
import { craftCostOf } from './crafting';
import { type Item, type AffixSlot, type AffixGroup, type Rarity, type StoneId, isWeapon } from './types';

const RARITY_ORDER: Rarity[] = ['common', 'magic', 'rare', 'epic', 'legendary'];

/** 依目前詞綴數,回推「容得下」的最高稀有度 */
function rarityForCount(count: number): Rarity {
  let r: Rarity = 'common';
  for (const cand of RARITY_ORDER) {
    if (BALANCE.items.affixCount[cand][0] <= count) r = cand;
  }
  return r;
}

/** 詞綴數若低於目前稀有度下限 → 降級(才能再用升階石升回去) (REQ §6.6) */
function demoteRarityIfNeeded(item: Item): void {
  const count = item.prefixes.length + item.suffixes.length;
  if (count < BALANCE.items.affixCount[item.rarity][0]) {
    item.rarity = rarityForCount(count);
  }
}

function onItem(item: Item, defId: string): boolean {
  return item.prefixes.some((a) => a.defId === defId) || item.suffixes.some((a) => a.defId === defId);
}
function roomOnSide(item: Item, side: AffixSlot): boolean {
  const arr = side === 'prefix' ? item.prefixes : item.suffixes;
  const cap = side === 'prefix' ? BALANCE.items.prefixCap : BALANCE.items.suffixCap;
  return arr.length < cap;
}
function totalAffixes(item: Item): number {
  return item.prefixes.length + item.suffixes.length;
}
function removeRandomFromSide(item: Item, side: AffixSlot, rng: () => number): boolean {
  const arr = side === 'prefix' ? item.prefixes : item.suffixes;
  if (!arr.length) return false;
  arr.splice(Math.floor(rng() * arr.length), 1);
  return true;
}
function removeRandomAny(item: Item, rng: () => number): boolean {
  const total = totalAffixes(item);
  if (!total) return false;
  const i = Math.floor(rng() * total);
  if (i < item.prefixes.length) item.prefixes.splice(i, 1);
  else item.suffixes.splice(i - item.prefixes.length, 1);
  return true;
}
function groupCandidates(item: Item, group: AffixGroup) {
  return AFFIXES.filter(
    (d) => d.group === group && (d.scope !== 'localWeapon' || isWeapon(item.type)) && !onItem(item, d.defId),
  );
}

/** 替換隨機一條 → 新增一條指定群組詞綴(net 詞綴數不變) */
function reforgeAdd(item: Item, group: AffixGroup, rng: () => number): boolean {
  const cands = groupCandidates(item, group);
  if (!cands.length) return false;
  const def = cands[Math.floor(rng() * cands.length)];
  // 先騰位:目標側滿就從該側移、否則隨機移一條
  if (!roomOnSide(item, def.slot)) {
    if (!removeRandomFromSide(item, def.slot, rng)) return false;
  } else if (!removeRandomAny(item, rng)) {
    return false;
  }
  const tier = pickTier(item.itemLevel, rng);
  const affix = { defId: def.defId, slot: def.slot, field: def.field, tier, value: rollAffixValue(def, tier, rng) };
  (def.slot === 'prefix' ? item.prefixes : item.suffixes).push(affix);
  return true;
}

/**
 * 提升 / 降低某側隨機一條詞綴的 Tier(dir=-1 提升:tier 數變小、值變高;dir=+1 降低),重滾該 Tier 的值。
 * 偏好可變動者(提升選 tier>1、降低選 tier<5);呼叫前已保證該側有詞綴。
 */
function shiftTierOnSide(item: Item, side: AffixSlot, dir: -1 | 1, rng: () => number): void {
  const arr = side === 'prefix' ? item.prefixes : item.suffixes;
  if (!arr.length) return;
  const eligible = arr.filter((a) => (dir === -1 ? a.tier > 1 : a.tier < 5));
  const pool = eligible.length ? eligible : arr;
  const a = pool[Math.floor(rng() * pool.length)];
  a.tier = Math.max(1, Math.min(5, a.tier + dir));
  const def = AFFIX_BY_ID[a.defId];
  if (def) a.value = rollAffixValue(def, a.tier, rng);
}

export interface ModifyResult {
  ok: boolean;
  reason?: string;
  /** 實際花費的金幣 */
  cost?: number;
}

/** 對裝備(背包或身上)使用改造石:消耗石頭 + 金幣(任何加工都要花錢,REQ §6.11) */
export function useModifyStone(
  state: GameState,
  itemId: string,
  stoneId: StoneId,
  rng: () => number,
): ModifyResult {
  const item = findItemById(state, itemId);
  if (!item) return { ok: false, reason: '物品不存在' };
  const def = STONES[stoneId];
  if (!def || def.kind !== 'modify') return { ok: false, reason: '不是改造石' };
  if ((state.inventory.stones[stoneId] ?? 0) <= 0) return { ok: false, reason: `缺少${def.name}` };
  // 金幣檢查(依物等 + 總加工次數)— 在改動物品前先擋下
  const cost = craftCostOf(item);
  if (state.character.gold < cost) return { ok: false, reason: '金幣不足' };

  if (def.removeSide) {
    const arr = def.removeSide === 'prefix' ? item.prefixes : item.suffixes;
    if (!arr.length) return { ok: false, reason: def.removeSide === 'prefix' ? '沒有前綴可消除' : '沒有後綴可消除' };
    removeRandomFromSide(item, def.removeSide, rng);
  } else if (def.group) {
    if (totalAffixes(item) === 0) return { ok: false, reason: '物品沒有詞綴可替換' };
    if (!groupCandidates(item, def.group).length) return { ok: false, reason: '沒有可新增的該系詞綴' };
    if (!reforgeAdd(item, def.group, rng)) return { ok: false, reason: '重鑄失敗' };
  } else if (def.raiseSide && def.lowerSide) {
    // tier 交換石:需同時有前綴與後綴(提升一側一條、降低另一側一條;詞綴數不變)
    if (!item.prefixes.length || !item.suffixes.length) return { ok: false, reason: '需同時有前綴與後綴' };
    const rArr = def.raiseSide === 'prefix' ? item.prefixes : item.suffixes;
    const lArr = def.lowerSide === 'prefix' ? item.prefixes : item.suffixes;
    const sideName = (sl: AffixSlot) => (sl === 'prefix' ? '前綴' : '後綴');
    // 必須有「可提升(Tier>1)」與「可降低(Tier<5)」的對象 → 每次都是真實交換,杜絕「犧牲側已觸底→免費升級」
    if (!rArr.some((a) => a.tier > 1)) return { ok: false, reason: `沒有可再提升的${sideName(def.raiseSide)}` };
    if (!lArr.some((a) => a.tier < 5)) return { ok: false, reason: `沒有可再降低的${sideName(def.lowerSide)}` };
    shiftTierOnSide(item, def.raiseSide, -1, rng); // 提升
    shiftTierOnSide(item, def.lowerSide, 1, rng); // 降低
  } else {
    return { ok: false, reason: '未知改造石' };
  }

  // 消除詞綴後若數量低於稀有度下限 → 降級(reforge 數量不變則無影響)
  demoteRarityIfNeeded(item);

  // 扣資源:石頭 + 金幣 + 累加總加工次數(讓後續加工費隨之上升)
  state.inventory.stones[stoneId] = (state.inventory.stones[stoneId] ?? 0) - 1;
  state.character.gold -= cost;
  item.craftCount = (item.craftCount ?? 0) + 1;
  state.runtime.invVersion++;
  return { ok: true, cost };
}
