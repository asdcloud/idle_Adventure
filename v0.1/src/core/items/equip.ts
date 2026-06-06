// 裝備 / 卸裝 / 丟棄 / 販賣 / 掉落入袋 (REQ §6.1 / §6.11) —— 直接 mutate state
import type { GameState } from '../state/GameState';
import { type Item, type Equipment, type EquipSlot, TYPE_INFO } from './types';
import { sellValue } from './value';

/** 一件物品預設要裝到哪個格(處理戒指雙格、單手雙持) */
function targetSlot(item: Item, eq: Equipment): EquipSlot {
  const cat = TYPE_INFO[item.type].category;
  if (cat === 'accessory') {
    if (!eq.ring1) return 'ring1';
    if (!eq.ring2) return 'ring2';
    return 'ring1';
  }
  if (cat === 'weapon1h') {
    if (!eq.mainHand) return 'mainHand';
    if (!eq.offHand) return 'offHand'; // 雙持:主手已有 → 放副手
    return 'mainHand';
  }
  if (cat === 'weapon2h') return 'mainHand';
  if (cat === 'offhand') return 'offHand';
  return TYPE_INFO[item.type].slots[0]; // 護甲
}

/** 依 id 尋找物品(背包 + 已裝備皆找)→ 供加工/我的最愛在身上裝備也能操作 */
export function findItemById(state: GameState, itemId: string): Item | null {
  const inv = state.inventory.items.find((i) => i.id === itemId);
  if (inv) return inv;
  for (const slot of Object.keys(state.equipment) as EquipSlot[]) {
    const it = state.equipment[slot];
    if (it && it.id === itemId) return it;
  }
  return null;
}

/** 切換「我的最愛」星號(背包 + 身上裝備皆可) */
export function toggleFavorite(state: GameState, itemId: string): boolean {
  const it = findItemById(state, itemId);
  if (!it) return false;
  it.favorite = !it.favorite;
  state.runtime.invVersion++;
  return !!it.favorite;
}

export function addItemToInventory(state: GameState, item: Item): boolean {
  const inv = state.inventory.items;
  if (inv.length >= state.inventory.cap) return false;
  inv.push(item);
  state.runtime.invVersion++;
  return true;
}

/** 裝備背包中的某件物品(處理雙手佔兩格、單手雙持、副手互斥) */
export function equipItem(state: GameState, itemId: string): boolean {
  const inv = state.inventory.items;
  const idx = inv.findIndex((i) => i.id === itemId);
  if (idx < 0) return false;
  const item = inv[idx];
  const eq = state.equipment;
  const cat = TYPE_INFO[item.type].category;
  const displaced: Item[] = [];

  inv.splice(idx, 1);

  if (cat === 'weapon2h') {
    if (eq.mainHand) displaced.push(eq.mainHand);
    if (eq.offHand) displaced.push(eq.offHand);
    eq.mainHand = item;
    eq.offHand = null;
  } else {
    const slot = targetSlot(item, eq);
    if (slot === 'offHand' && eq.mainHand && TYPE_INFO[eq.mainHand.type].category === 'weapon2h') {
      // 放副手 → 主手的雙手武器要卸下
      displaced.push(eq.mainHand);
      eq.mainHand = null;
    }
    if (eq[slot]) displaced.push(eq[slot] as Item);
    eq[slot] = item;
  }

  for (const d of displaced) inv.push(d);
  state.runtime.invVersion++;
  return true;
}

export function unequipItem(state: GameState, slot: EquipSlot): boolean {
  const eq = state.equipment;
  const item = eq[slot];
  if (!item) return false;
  if (state.inventory.items.length >= state.inventory.cap) return false;
  eq[slot] = null;
  state.inventory.items.push(item);
  state.runtime.invVersion++;
  return true;
}

export function discardItem(state: GameState, itemId: string): boolean {
  const inv = state.inventory.items;
  const idx = inv.findIndex((i) => i.id === itemId);
  if (idx < 0) return false;
  if (inv[idx].favorite) return false; // 我的最愛需先取消星號
  inv.splice(idx, 1);
  state.runtime.invVersion++;
  return true;
}

/** 販賣一件背包裝備 → 加金幣,回傳所得金幣(找不到 / 我的最愛回 0)(REQ §6.11) */
export function sellItem(state: GameState, itemId: string): number {
  const inv = state.inventory.items;
  const idx = inv.findIndex((i) => i.id === itemId);
  if (idx < 0) return 0;
  if (inv[idx].favorite) return 0; // 我的最愛需先取消星號
  const gold = sellValue(inv[idx]);
  inv.splice(idx, 1);
  state.character.gold += gold;
  state.runtime.invVersion++;
  return gold;
}

/** 批量販賣(跳過我的最愛):回傳 { count, gold, skipped } */
export function sellItems(state: GameState, itemIds: string[]): { count: number; gold: number; skipped: number } {
  const set = new Set(itemIds);
  const inv = state.inventory.items;
  let gold = 0;
  let count = 0;
  let skipped = 0;
  for (let i = inv.length - 1; i >= 0; i--) {
    if (!set.has(inv[i].id)) continue;
    if (inv[i].favorite) {
      skipped++;
      continue;
    } // 我的最愛不賣
    gold += sellValue(inv[i]);
    inv.splice(i, 1);
    count++;
  }
  if (count) {
    state.character.gold += gold;
    state.runtime.invVersion++;
  }
  return { count, gold, skipped };
}

/** 批量丟棄(跳過我的最愛):回傳 { count, skipped } */
export function discardItems(state: GameState, itemIds: string[]): { count: number; skipped: number } {
  const set = new Set(itemIds);
  const inv = state.inventory.items;
  let count = 0;
  let skipped = 0;
  for (let i = inv.length - 1; i >= 0; i--) {
    if (!set.has(inv[i].id)) continue;
    if (inv[i].favorite) {
      skipped++;
      continue;
    } // 我的最愛不丟
    inv.splice(i, 1);
    count++;
  }
  if (count) state.runtime.invVersion++;
  return { count, skipped };
}
