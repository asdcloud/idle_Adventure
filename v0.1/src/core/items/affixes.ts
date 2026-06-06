// 詞綴數值計算 + 加成彙總 (REQ §6.4/§6.5) —— 純函式
import type { Stats } from '../state/GameState';
import { BALANCE } from '../../data/balance';
import { AFFIX_BY_ID, type AffixDef } from '../../data/affixes';
import { type Affix, type Bonus, type BonusField, type Item, type Equipment, emptyBonus } from './types';

const I = BALANCE.items;
const STAT_KEYS: (keyof Stats)[] = ['STR', 'INT', 'DEF', 'DEX', 'SPD', 'LUK'];

/** 非屬性的數值欄位(addBonus 用) */
const NUM_FIELDS: (keyof Bonus)[] = [
  'pAtkFlat', 'mAtkFlat', 'armourFlat', 'hpFlat', 'mpFlat', 'hpRegenFlat', 'mpRegenFlat',
  'pAtkPct', 'mAtkPct', 'armourPct', 'hpPct', 'mpPct', 'hpRegenPct', 'mpRegenPct', 'atkSpdPct',
  'critFlat', 'critDmgAdd', 'cdrPct', 'dmgReductionPct', 'expGainPct', 'dropPct',
];

function isStatField(f: BonusField): f is keyof Stats {
  return (STAT_KEYS as string[]).includes(f);
}

export function tierMaxValue(def: AffixDef, tier: number): number {
  return def.t1max * Math.pow(I.tierFactor, tier - 1);
}

function roundValue(def: AffixDef, raw: number): number {
  if (def.display === 'flat') return Math.max(1, Math.round(raw));
  return Math.round(raw * 1000) / 1000;
}

export function rollAffixValue(def: AffixDef, tier: number, rng: () => number): number {
  const max = tierMaxValue(def, tier);
  const min = max * I.tierRollMin;
  return roundValue(def, min + rng() * (max - min));
}

/** 把一個欄位加進 Bonus(local 武器欄位不在此處理) */
function addField(b: Bonus, field: BonusField, v: number): void {
  if (isStatField(field)) {
    b.stats[field] += v;
  } else if (field === 'allStats') {
    for (const k of STAT_KEYS) b.stats[k] += v;
  } else if (field !== 'wpnPhysPct' && field !== 'wpnMagPct') {
    (b as unknown as Record<string, number>)[field] += v;
  }
}

function addBonus(target: Bonus, src: Bonus): void {
  for (const k of STAT_KEYS) target.stats[k] += src.stats[k];
  for (const f of NUM_FIELDS) (target[f] as number) += src[f] as number;
}

/** 單件裝備的加成(基底 + 詞綴;武器 local% 只改本武器基底) */
export function itemBonus(item: Item): Bonus {
  const b = emptyBonus();
  // 武器 local 詞綴(只放大本武器基底攻擊)
  let localPhysPct = 0;
  let localMagPct = 0;
  for (const a of item.prefixes) {
    if (a.field === 'wpnPhysPct') localPhysPct += a.value;
    else if (a.field === 'wpnMagPct') localMagPct += a.value;
  }
  for (const a of item.suffixes) {
    if (a.field === 'wpnPhysPct') localPhysPct += a.value;
    else if (a.field === 'wpnMagPct') localMagPct += a.value;
  }
  // 基底主數值
  b.pAtkFlat += item.basePAtk * (1 + localPhysPct);
  b.mAtkFlat += item.baseMAtk * (1 + localMagPct);
  b.armourFlat += item.baseArmour;
  b.atkSpdPct += item.baseAtkSpdPct;
  b.cdrPct += item.baseCdrPct;
  for (const k of STAT_KEYS) {
    const v = item.baseStats[k];
    if (v) b.stats[k] += v;
  }
  // 一般詞綴
  for (const a of item.prefixes) addField(b, a.field, a.value);
  for (const a of item.suffixes) addField(b, a.field, a.value);
  return b;
}

/** 8 格裝備加總 */
export function equipmentBonus(eq: Equipment): Bonus {
  const total = emptyBonus();
  for (const slot of Object.keys(eq) as (keyof Equipment)[]) {
    const item = eq[slot];
    if (item) addBonus(total, itemBonus(item));
  }
  return total;
}

export function affixDef(a: Affix): AffixDef | undefined {
  return AFFIX_BY_ID[a.defId];
}
