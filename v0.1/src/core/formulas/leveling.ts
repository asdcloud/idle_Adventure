// 升級 / 經驗 / 保底成長 (REQ §3) — 純函式
import type { Character, Stats } from '../state/GameState';
import { BALANCE } from '../../data/balance';

const L = BALANCE.leveling;

/**
 * 打「同等級」怪要幾隻才升一級(設計主軸,REQ §3)。凸型加速:
 * 前期平緩(每級約 ×ratioStart),倍率逐級放大,後期激增,
 * 於滿級(maxLevel)恰好到達 killCap。
 * killsToLevel(L) = killStart × ratioStart^(L-1) × ratioGrow^((L-1)(L-2)/2)
 */
export function killsToLevel(level: number): number {
  // 錨點 = 最後一次升級(L(maxLevel-1) → maxLevel),其 steps = maxLevel-2。
  // 反推 ratioGrow,使 killStart × ratioStart^N × ratioGrow^(N(N-1)/2) = killCap,
  // 即 killsToLevel(maxLevel-1) = killCap(最後一級才到頂)。
  const N = BALANCE.maxLevel - 2;
  const steps = Math.max(0, level - 1);
  const totalMul = L.killCap / L.killStart;
  const ratioGrow = Math.pow(totalMul / Math.pow(L.killRatioStart, N), 2 / (N * (N - 1)));
  const k = L.killStart * Math.pow(L.killRatioStart, steps) * Math.pow(ratioGrow, (steps * (steps - 1)) / 2);
  return Math.min(L.killCap, k);
}

/** 同等級怪每隻給的經驗(緩和指數成長,非線性) */
export function monsterExpReward(level: number): number {
  return Math.max(1, Math.round(L.monExpBase * Math.pow(L.monExpGrowth, level - 1)));
}

/** 怪物掉金(非線性,REQ §6.11):gold = goldFlat + goldCoef × 等級^goldExp */
export function monsterGold(level: number): number {
  const E = BALANCE.economy;
  return Math.max(1, Math.round(E.goldFlat + E.goldCoef * Math.pow(level, E.goldExp)));
}

/**
 * 升到下一級所需經驗。
 * = 該級「同級怪打怪數」× 該級「每隻怪經驗」→ 同級刷時恰好需要 killsToLevel 隻。
 */
export function expToNext(level: number): number {
  return Math.max(1, Math.round(killsToLevel(level) * monsterExpReward(level)));
}

function addGuaranteed(base: Stats): Stats {
  const g = L.guaranteedPerStat;
  return {
    STR: base.STR + g,
    INT: base.INT + g,
    DEF: base.DEF + g,
    DEX: base.DEX + g,
    SPD: base.SPD + g,
    LUK: base.LUK + g,
  };
}

/**
 * 把 exp 灌進角色,處理(可能多次)升級。
 * 直接 mutate 傳入的 character(由 core 內部呼叫,外部不直接碰)。
 * 回傳這次總共升了幾級。
 */
export function gainExp(c: Character, amount: number): number {
  if (c.level >= BALANCE.maxLevel) {
    return 0; // 滿級不再吃經驗
  }
  c.exp += amount;
  let levels = 0;
  while (c.level < BALANCE.maxLevel && c.exp >= expToNext(c.level)) {
    c.exp -= expToNext(c.level);
    c.level += 1;
    c.baseStats = addGuaranteed(c.baseStats);
    // 自由點:平常 +freePointsPerLevel,逢里程碑(每 N 級)改給 milestone
    c.unspentPoints +=
      c.level % L.freePointsMilestoneEvery === 0 ? L.freePointsMilestone : L.freePointsPerLevel;
    levels += 1;
  }
  if (c.level >= BALANCE.maxLevel) {
    c.exp = 0; // 滿級清空殘餘經驗
  }
  return levels;
}
