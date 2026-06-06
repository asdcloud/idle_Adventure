// 裝備販賣價 (REQ §6.11) —— 純函式
// 依「物等 + 稀有度 + 詞綴數量 + 詞綴 Tier」決定售價(公式可非線性)。
import { BALANCE } from '../../data/balance';
import type { Item } from './types';

const E = BALANCE.economy;

/** 單條詞綴的 TierScore:T1=5 … T5=1(越好的 Tier 越值錢) */
function tierScore(tier: number): number {
  return Math.max(0, 6 - tier);
}

/**
 * 販賣價 = base(物等) × 稀有度倍率 × (1 + 每詞綴加成×數量 + 每TierScore加成×ΣTierScore)
 * base(物等) = sellFlat + sellCoef × 物等^sellExp(非線性)
 */
export function sellValue(item: Item): number {
  const base = E.sellFlat + E.sellCoef * Math.pow(item.itemLevel, E.sellExp);
  const rarityMult = E.sellRarityMult[item.rarity] ?? 1;
  const affixes = [...item.prefixes, ...item.suffixes];
  const totalTierScore = affixes.reduce((s, a) => s + tierScore(a.tier), 0);
  const affixMult = 1 + E.sellPerAffix * affixes.length + E.sellPerTierScore * totalTierScore;
  return Math.max(E.sellFloor, Math.round(base * rarityMult * affixMult));
}
