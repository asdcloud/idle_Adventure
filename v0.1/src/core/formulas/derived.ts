// 衍生數值公式 (REQ §4) — 純函式,可單元測試
import type { Stats } from '../state/GameState';
import { BALANCE } from '../../data/balance';

const D = BALANCE.derived;
const ITEMS = BALANCE.items;

/** 合成有效屬性 = 保底 + 自由分配 (v0.1 尚無裝備加成) */
export function effectiveStats(base: Stats, allocated: Stats): Stats {
  return {
    STR: base.STR + allocated.STR,
    INT: base.INT + allocated.INT,
    DEF: base.DEF + allocated.DEF,
    DEX: base.DEX + allocated.DEX,
    SPD: base.SPD + allocated.SPD,
    LUK: base.LUK + allocated.LUK,
  };
}

export function maxHp(level: number, s: Stats): number {
  return Math.floor(D.hp.flat + level * D.hp.perLevel + s.STR * D.hp.perSTR + s.DEF * D.hp.perDEF);
}

export function maxMp(level: number, s: Stats): number {
  return Math.floor(D.mp.flat + level * D.mp.perLevel + s.INT * D.mp.perINT);
}

export function physAtk(level: number, s: Stats): number {
  return Math.floor(D.pAtk.flat + s.STR * D.pAtk.perSTR + level * D.pAtk.perLevel);
}

export function magAtk(level: number, s: Stats): number {
  return Math.floor(D.mAtk.flat + s.INT * D.mAtk.perINT + level * D.mAtk.perLevel);
}

/** DEF 屬性 → 護甲值(邊際遞減):armour = DEF^exp × k(REQ §6:屬性與護甲值分離) */
export function armourFromDEF(def: number): number {
  return Math.pow(Math.max(0, def), ITEMS.defArmour.exp) * ITEMS.defArmour.k;
}

/**
 * 護甲減傷率 0~1 (POE 式):reduction = armour / (armour + K × 來襲傷害)。
 * 傳入的是「護甲值」(已含 DEF轉換 + 裝備護甲);大攻擊穿甲、小攻擊被擋;無硬上限。
 */
export function armourReduction(armour: number, rawHit: number): number {
  const a = Math.max(0, armour);
  const hit = Math.max(1, rawHit);
  return a / (a + ITEMS.armourK * hit);
}

/** 命中率,夾在 [min, max](DEX 同時是命中與閃避:我高→命中↑、敵高→我命中↓) */
export function hitChance(myDex: number, enemyDex: number): number {
  const raw = D.hit.base + (myDex - enemyDex) * D.hit.perDex;
  return clamp(raw, D.hit.min, D.hit.max);
}

/** 爆擊率(只來自 DEX,且很小),上限 cap */
export function critChance(s: Stats): number {
  return Math.min(D.crit.base + s.DEX * D.crit.perDex, D.crit.cap);
}

/** 爆擊傷害倍率(只來自 LUK) */
export function critMultiplier(s: Stats): number {
  return D.critDmg.base + s.LUK * D.critDmg.perLuk;
}

/** 每秒 HP 回復(小 base,隨最大HP/等級自然增加;裝備詞綴另加) */
export function hpRegenPerSec(maxHpVal: number): number {
  return maxHpVal * D.regen.hpBasePct;
}

/** 每秒 MP 回復(base + INT 加速 → 魔法職業續航) */
export function mpRegenPerSec(maxMpVal: number, intStat: number): number {
  return maxMpVal * D.regen.mpBasePct + intStat * D.regen.mpPerINT;
}

/** 攻擊間隔(秒),下限 minInterval */
export function attackInterval(spd: number): number {
  const raw = D.speed.baseInterval / (1 + spd * D.speed.perSpd);
  return Math.max(raw, D.speed.minInterval);
}

/** 掉落加成倍率 */
export function dropBonus(luk: number): number {
  return 1 + luk * D.drop.perLuk;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
