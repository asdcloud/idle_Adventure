// 掉落生成 (REQ §6.5) —— 武器分類、基底配比、Tier 機率模型
import type { Stats } from '../state/GameState';
import { BALANCE } from '../../data/balance';
import { AFFIXES, type AffixDef } from '../../data/affixes';
import {
  type Item,
  type ItemType,
  type Rarity,
  type Affix,
  type StoneId,
  TYPE_INFO,
  RARITY_INFO,
  isWeapon,
} from './types';
import { rollAffixValue } from './affixes';
import { STONE_LIST } from '../../data/stones';

const I = BALANCE.items;
const STAT_KEYS: (keyof Stats)[] = ['STR', 'INT', 'DEF', 'DEX', 'SPD', 'LUK'];
let idCounter = 1;

/** 掉落型別權重 */
const TYPE_WEIGHTS: Record<ItemType, number> = {
  sword1h: 10, dagger: 7, lance: 6, wand: 9, scepter: 5,
  sword2h: 6, staff: 6, longstaff: 4,
  shield: 7, orb: 6,
  helmet: 9, chest: 9, gloves: 9, boots: 9,
  ring: 14,
};

function weightedPick<T extends string>(weights: Record<T, number>, rng: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}

function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 高斯亂數(Box-Muller) */
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Tier 機率(取代硬門檻):期望 Tier 隨物等往 T1 靠,加高斯散布,
 * 夾在 [1, 5 - floor((ilvl-overflowStart)/overflowPer)]。
 */
export function pickTier(ilvl: number, rng: () => number): number {
  const T = I.tier;
  const expected = Math.max(1, 5 - ilvl / T.spread);
  const maxTierNum = Math.max(1, 5 - Math.floor(Math.max(0, ilvl - T.overflowStart) / T.overflowPer));
  let t = Math.round(expected + gaussian(rng) * T.jitter);
  t = Math.max(1, Math.min(maxTierNum, t));
  return t;
}

/** 基底主數值 */
function rollBase(
  type: ItemType,
  ilvl: number,
  rng: () => number,
): Pick<Item, 'basePAtk' | 'baseMAtk' | 'baseArmour' | 'baseAtkSpdPct' | 'baseCdrPct' | 'baseStats'> {
  const prof = I.baseProfile[type] ?? {};
  const atkBudget =
    (I.weaponBudget.flat + I.weaponBudget.perIlvl * ilvl) * (TYPE_INFO[type].twoHanded ? I.twoHandMult : 1);
  const armBudget = I.armourBudget.flat + I.armourBudget.perIlvl * ilvl;
  const baseStats: Partial<Stats> = {};
  if (type === 'ring') {
    const stat = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
    baseStats[stat] = Math.max(1, Math.round(I.ringStat.flat + I.ringStat.perIlvl * ilvl));
  }
  return {
    basePAtk: Math.round(atkBudget * (prof.phys ?? 0)),
    baseMAtk: Math.round(atkBudget * (prof.mag ?? 0)),
    baseArmour: Math.round(armBudget * (prof.armour ?? 0)),
    baseAtkSpdPct: prof.atkSpdPct ?? 0,
    baseCdrPct: prof.cdrPct ?? 0,
    baseStats,
  };
}

function pickUnused(defs: AffixDef[], used: Set<string>, rng: () => number): AffixDef | undefined {
  const avail = defs.filter((d) => !used.has(d.defId));
  if (!avail.length) return undefined;
  return avail[Math.floor(rng() * avail.length)];
}

function rollAffixes(
  rarity: Rarity,
  ilvl: number,
  type: ItemType,
  rng: () => number,
): { prefixes: Affix[]; suffixes: Affix[] } {
  const [minC, maxC] = I.affixCount[rarity];
  const count = randInt(minC, maxC, rng);
  const weaponItem = isWeapon(type);
  const usable = AFFIXES.filter((a) => a.scope !== 'localWeapon' || weaponItem);
  const prefixDefs = usable.filter((a) => a.slot === 'prefix');
  const suffixDefs = usable.filter((a) => a.slot === 'suffix');
  const usedPre = new Set<string>();
  const usedSuf = new Set<string>();
  const prefixes: Affix[] = [];
  const suffixes: Affix[] = [];

  for (let i = 0; i < count; i++) {
    const preRoom = prefixes.length < I.prefixCap && usedPre.size < prefixDefs.length;
    const sufRoom = suffixes.length < I.suffixCap && usedSuf.size < suffixDefs.length;
    if (!preRoom && !sufRoom) break;
    const usePrefix = preRoom && (!sufRoom || rng() < 0.5);
    const def = pickUnused(usePrefix ? prefixDefs : suffixDefs, usePrefix ? usedPre : usedSuf, rng);
    if (!def) continue;
    const tier = pickTier(ilvl, rng);
    const affix: Affix = {
      defId: def.defId,
      slot: def.slot,
      field: def.field,
      tier,
      value: rollAffixValue(def, tier, rng),
    };
    if (usePrefix) {
      usedPre.add(def.defId);
      prefixes.push(affix);
    } else {
      usedSuf.add(def.defId);
      suffixes.push(affix);
    }
  }
  return { prefixes, suffixes };
}

function rollRarity(rng: () => number): Rarity {
  return weightedPick(I.rarityWeights as Record<Rarity, number>, rng);
}

/** 生成一件裝備(itemLevel 由怪物等級決定,REQ §6.5) */
export function generateItem(itemLevel: number, rng: () => number): Item {
  const ilvl = Math.max(1, Math.floor(itemLevel));
  const type = weightedPick(TYPE_WEIGHTS, rng);
  const rarity = rollRarity(rng);
  const base = rollBase(type, ilvl, rng);
  const { prefixes, suffixes } = rollAffixes(rarity, ilvl, type, rng);
  return {
    id: `it_${idCounter++}_${Math.floor(rng() * 1e6).toString(36)}`,
    type,
    rarity,
    itemLevel: ilvl,
    name: `${RARITY_INFO[rarity].name}${TYPE_INFO[type].name}`,
    ...base,
    prefixes,
    suffixes,
    craftCount: 0,
    pity: 0,
  };
}

/** 掉落一顆石頭(依掉落權重) (REQ §6.7) */
export function rollStone(rng: () => number): StoneId {
  const total = STONE_LIST.reduce((s, d) => s + d.dropWeight, 0);
  let r = rng() * total;
  for (const d of STONE_LIST) {
    r -= d.dropWeight;
    if (r < 0) return d.id;
  }
  return STONE_LIST[STONE_LIST.length - 1].id;
}
