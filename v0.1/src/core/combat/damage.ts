// 傷害結算 (REQ §5.3) —— 純函式;普攻只算物理。
import { armourReduction, hitChance } from '../formulas/derived';
import type { AttackProfile } from './profile';

export interface AttackResult {
  hit: boolean;
  crit: boolean;
  amount: number;
}

/**
 * 計算一次「普攻」(物理)。
 * defArmour = 防禦方護甲值(角色含裝備;敵人由 DEF 換算);defDex = 防禦方 DEX(命中/閃避)。
 * 流程:命中 → 物理傷害 → 護甲減傷(依傷害大小)→ 爆擊。
 */
export function resolveAttack(
  att: AttackProfile,
  defArmour: number,
  defDex: number,
  rng: () => number,
): AttackResult {
  if (rng() > hitChance(att.dex, defDex)) {
    return { hit: false, crit: false, amount: 0 };
  }
  let raw = Math.max(1, att.pAtk);
  raw = raw * (1 - armourReduction(defArmour, raw));
  const crit = rng() < att.critChance;
  if (crit) raw *= att.critMult;
  return { hit: true, crit, amount: Math.max(1, Math.round(raw)) };
}
