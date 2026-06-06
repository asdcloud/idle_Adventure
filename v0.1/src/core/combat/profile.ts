// 戰鬥側資料:把「屬性 + 裝備 + 被動」整合成最終戰鬥數值 —— 純函式
// 管線:最終值 = (屬性轉換 + 裝備flat) × (1 + Σ%)
import type { Character, Stats } from '../state/GameState';
import type { Equipment } from '../items/types';
import { equipmentBonus } from '../items/affixes';
import {
  effectiveStats,
  maxHp,
  maxMp,
  physAtk,
  magAtk,
  critChance,
  critMultiplier,
  attackInterval,
  dropBonus,
  hpRegenPerSec,
  mpRegenPerSec,
  armourFromDEF,
} from '../formulas/derived';
import { emptyPassive, type FullPassive } from '../skills';
import { BALANCE } from '../../data/balance';

const D = BALANCE.derived;

/** 攻擊側資料(算傷害用) */
export interface AttackProfile {
  pAtk: number;
  mAtk: number;
  critChance: number;
  critMult: number;
  dex: number;
}

/** 角色含裝備+被動的完整戰鬥數值 */
export interface CombatStats {
  eff: Stats; // 含裝備屬性加成
  maxHp: number;
  maxMp: number;
  pAtk: number; // 普攻物理
  mAtk: number; // 技能魔法
  armour: number; // 護甲值(減傷用)
  critChance: number;
  critMult: number;
  attackInterval: number;
  atkPerSec: number;
  dropBonus: number;
  hpRegen: number;
  mpRegen: number;
  cdrPct: number; // 冷卻減少
  dmgReductionPct: number; // 硬減傷
  expGainPct: number; // 經驗加成
}

/** 敵人(純屬性)的攻擊側資料 */
export function profileFromStats(level: number, s: Stats): AttackProfile {
  return {
    pAtk: physAtk(level, s),
    mAtk: magAtk(level, s),
    critChance: critChance(s),
    critMult: critMultiplier(s),
    dex: s.DEX,
  };
}

/** 角色含「裝備 + 被動技能」的完整戰鬥數值 */
export function characterCombat(
  c: Character,
  eq: Equipment,
  passive: FullPassive = emptyPassive(),
): CombatStats {
  const b = equipmentBonus(eq);
  const eff = effectiveStats(c.baseStats, c.allocated);
  eff.STR += b.stats.STR;
  eff.INT += b.stats.INT;
  eff.DEF += b.stats.DEF;
  eff.DEX += b.stats.DEX;
  eff.SPD += b.stats.SPD;
  eff.LUK += b.stats.LUK;

  // 攻擊:(屬性轉換 + 裝備flat[含武器基底/local]) × (1 + %)
  const pAtk = Math.round((physAtk(c.level, eff) + b.pAtkFlat) * (1 + b.pAtkPct + passive.pAtkPct));
  const mAtk = Math.round((magAtk(c.level, eff) + b.mAtkFlat) * (1 + b.mAtkPct + passive.mAtkPct));
  // 護甲:(DEF轉護甲 + 裝備護甲) × (1 + 護甲%[裝備+被動])
  const armour = (armourFromDEF(eff.DEF) + b.armourFlat) * (1 + b.armourPct + passive.armourPct);
  // 生命 / 法力
  const mhp = Math.floor((maxHp(c.level, eff) + b.hpFlat) * (1 + b.hpPct + passive.hpPct));
  const mmp = Math.floor((maxMp(c.level, eff) + b.mpFlat) * (1 + b.mpPct));
  // 攻速 / 爆擊
  const interval = Math.max(
    D.speed.minInterval,
    attackInterval(eff.SPD) / (1 + b.atkSpdPct + passive.atkSpdPct),
  );
  const crit = Math.min(D.crit.cap, critChance(eff) + b.critFlat + passive.critAdd);
  return {
    eff,
    maxHp: mhp,
    maxMp: mmp,
    pAtk,
    mAtk,
    armour,
    critChance: crit,
    critMult: critMultiplier(eff) + b.critDmgAdd + passive.critDmgAdd,
    attackInterval: interval,
    atkPerSec: 1 / interval,
    dropBonus: dropBonus(eff.LUK) * (1 + b.dropPct) * (1 + passive.dropPct),
    hpRegen: (hpRegenPerSec(mhp) + b.hpRegenFlat) * (1 + b.hpRegenPct),
    mpRegen: (mpRegenPerSec(mmp, eff.INT) + b.mpRegenFlat) * (1 + b.mpRegenPct),
    cdrPct: Math.min(0.8, b.cdrPct + passive.cdrPct),
    dmgReductionPct: Math.min(0.9, b.dmgReductionPct + passive.dmgReductionPct),
    expGainPct: b.expGainPct + passive.expGainPct,
  };
}

/** 由角色戰鬥數值取攻擊側資料 */
export function attackProfileOf(cs: CombatStats): AttackProfile {
  return { pAtk: cs.pAtk, mAtk: cs.mAtk, critChance: cs.critChance, critMult: cs.critMult, dex: cs.eff.DEX };
}
