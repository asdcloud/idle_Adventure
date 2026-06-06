// 敵人生成 (REQ §8) — v0.1 簡化版
// 六區域各有一個「強化屬性」,怪物等級依地圖等級浮動。
import type { CombatantSnapshot, Stats } from '../state/GameState';
import { BALANCE } from '../../data/balance';
import { effectiveStats, maxHp } from '../formulas/derived';
import { monsterExpReward, monsterGold } from '../formulas/leveling';

/** 六區域名稱 + 強化屬性(REQ §8.2) */
export const AREAS: { name: string; emphasis: keyof Stats }[] = [
  { name: '蠻力之地', emphasis: 'STR' },
  { name: '奧術迴廊', emphasis: 'INT' },
  { name: '鋼鐵要塞', emphasis: 'DEF' },
  { name: '疾風峽谷', emphasis: 'SPD' },
  { name: '迅捷密林', emphasis: 'DEX' },
  { name: '幸運賭場', emphasis: 'LUK' },
];

/** 怪物的完整屬性(供傷害計算) */
export interface Enemy extends CombatantSnapshot {
  stats: Stats;
  attackBar: number;
  /** 給的經驗 / 金幣(v0.1 估算) */
  expReward: number;
  goldReward: number;
  /** Boss 種類(小怪為 undefined) */
  boss?: 'area' | 'world';
}

/** 低等級非線性緩坡:Lv1 = earlyMinScale,到 earlyRampLevel 線性回到 1.0 */
function earlyScale(level: number): number {
  const E = BALANCE.enemy;
  if (level >= E.earlyRampLevel) return 1;
  const t = (level - 1) / Math.max(1, E.earlyRampLevel - 1);
  return E.earlyMinScale + (1 - E.earlyMinScale) * Math.max(0, Math.min(1, t));
}

/** 小怪 HP 倍率(非線性,REQ §8.4):高等逐漸遞減,避免高等怪 HP 過高、戰鬥過長致死 */
function effHpMult(level: number): number {
  const E = BALANCE.enemy;
  const taper = Math.min(E.hpTaperMax, Math.max(0, (level - E.hpTaperFrom) * E.hpTaperPer));
  return E.hpMult * (1 - taper);
}

/** 依等級給一組屬性(對「合理裝備同級玩家」≈中等壓力),強化區域特色屬性 */
function enemyStats(level: number, emphasis: keyof Stats): Stats {
  const E = BALANCE.enemy;
  const ref = (E.statFlat + level * E.statSlope) * earlyScale(level);
  const r1 = (m: number) => Math.max(1, Math.round(ref * m));
  const s: Stats = {
    STR: r1(E.otherMult),
    INT: r1(E.otherMult),
    DEF: r1(E.defMult),
    DEX: r1(E.otherMult),
    SPD: r1(E.spdMult),
    LUK: r1(E.lukMult),
  };
  s[emphasis] = r1(E.emphMult); // 區域特色屬性
  return s;
}

/** 用地圖等級 + 區域 index 產生一隻小怪 */
export function makeMonster(mapLevel: number, areaIndex: number, roll: number): Enemy {
  const area = AREAS[areaIndex % AREAS.length];
  const variance = BALANCE.enemy.levelVariance;
  // roll ∈ [0,1) → 等級浮動 [-variance, +variance]
  const offset = Math.round((roll * 2 - 1) * variance);
  const level = Math.max(1, mapLevel + offset);
  const stats = enemyStats(level, area.emphasis);
  const eff = effectiveStats(stats, { STR: 0, INT: 0, DEF: 0, DEX: 0, SPD: 0, LUK: 0 });
  const hp = Math.floor(maxHp(level, eff) * effHpMult(level) * earlyScale(level));
  return {
    name: `${area.name}的怪物`,
    level,
    hp,
    maxHp: hp,
    attackBar: 0,
    stats: eff,
    expReward: monsterExpReward(level),
    goldReward: monsterGold(level),
  };
}

/**
 * 產生 Boss(REQ §8)。
 * 區域 Boss:每區小怪打完後出現,擊殺 → 進下一區。
 * 世界 Boss:六區 Boss 全清後出現,擊殺 → 升地圖等級。
 * 數值在小怪基礎上強化(HP/攻擊/DEF 倍率 + 等級加成);機制(狂暴/重擊)由戰鬥引擎處理。
 */
export function makeBoss(mapLevel: number, areaIndex: number, kind: 'area' | 'world'): Enemy {
  const B = BALANCE.boss[kind];
  const area = AREAS[areaIndex % AREAS.length];
  const level = Math.max(1, mapLevel + B.levelBonus);
  const base = enemyStats(level, area.emphasis);
  // 強化:攻擊屬性 ×atkMult、DEF ×defMult(SPD/LUK 不變)
  const stats: Stats = {
    STR: Math.max(1, Math.round(base.STR * B.atkMult)),
    INT: Math.max(1, Math.round(base.INT * B.atkMult)),
    DEF: Math.max(1, Math.round(base.DEF * B.defMult)),
    DEX: Math.max(1, Math.round(base.DEX * B.atkMult)),
    SPD: base.SPD,
    LUK: base.LUK,
  };
  const eff = effectiveStats(stats, { STR: 0, INT: 0, DEF: 0, DEX: 0, SPD: 0, LUK: 0 });
  const hp = Math.floor(maxHp(level, eff) * effHpMult(level) * B.hpMult * earlyScale(level));
  const name = kind === 'area' ? `★ ${area.name}之王` : `☆ 世界王 (Lv${level})`;
  return {
    name,
    level,
    hp,
    maxHp: hp,
    attackBar: 0,
    stats: eff,
    expReward: Math.floor(monsterExpReward(level) * B.expMult),
    goldReward: Math.floor(monsterGold(level) * B.goldMult),
    boss: kind,
  };
}
