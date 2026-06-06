// 詞綴清單 (REQ §6.4) —— 與程式分離的可調資料
// Tier 機率見 balance.items.tier(ilvl100 ≈ 15% T1,隨物等上升)。
// 消除詞綴若低於稀有度下限 → 自動降級(見 items/modify.ts demoteRarityIfNeeded)。
// group:主題群組(改造石「加 X 系詞綴」用)。
import type { AffixSlot, AffixScope, AffixGroup, BonusField } from '../core/items/types';

export interface AffixDef {
  defId: string;
  slot: AffixSlot;
  field: BonusField;
  label: string;
  display: 'flat' | 'pct' | 'crit';
  t1max: number;
  group: AffixGroup;
  scope?: AffixScope;
}

export const AFFIXES: AffixDef[] = [
  // ===== 前綴 =====
  { defId: 'patk', slot: 'prefix', field: 'pAtkFlat', label: '物理攻擊', display: 'flat', t1max: 40, group: 'attack' },
  { defId: 'matk', slot: 'prefix', field: 'mAtkFlat', label: '魔法攻擊', display: 'flat', t1max: 46, group: 'magic' },
  { defId: 'patkpct', slot: 'prefix', field: 'pAtkPct', label: '物理攻擊%', display: 'pct', t1max: 0.3, group: 'attack' },
  { defId: 'matkpct', slot: 'prefix', field: 'mAtkPct', label: '魔法攻擊%', display: 'pct', t1max: 0.4, group: 'magic' },
  { defId: 'wpnphys', slot: 'prefix', field: 'wpnPhysPct', label: '武器物理傷害%', display: 'pct', t1max: 0.5, group: 'attack', scope: 'localWeapon' },
  { defId: 'wpnmag', slot: 'prefix', field: 'wpnMagPct', label: '武器魔法傷害%', display: 'pct', t1max: 0.6, group: 'magic', scope: 'localWeapon' },
  { defId: 'hp', slot: 'prefix', field: 'hpFlat', label: '最大生命', display: 'flat', t1max: 200, group: 'defense' },
  { defId: 'hppct', slot: 'prefix', field: 'hpPct', label: '最大生命%', display: 'pct', t1max: 0.12, group: 'defense' },
  { defId: 'str', slot: 'prefix', field: 'STR', label: '力量', display: 'flat', t1max: 12, group: 'attack' },
  { defId: 'int', slot: 'prefix', field: 'INT', label: '智力', display: 'flat', t1max: 14, group: 'magic' },
  { defId: 'crit', slot: 'prefix', field: 'critFlat', label: '爆擊率', display: 'crit', t1max: 0.08, group: 'luck' },

  // ===== 後綴 =====
  { defId: 'armour', slot: 'suffix', field: 'armourFlat', label: '護甲值', display: 'flat', t1max: 115, group: 'defense' },
  { defId: 'armourpct', slot: 'suffix', field: 'armourPct', label: '護甲%', display: 'pct', t1max: 0.3, group: 'defense' },
  { defId: 'dmgred', slot: 'suffix', field: 'dmgReductionPct', label: '傷害減免', display: 'pct', t1max: 0.12, group: 'defense' },
  { defId: 'def', slot: 'suffix', field: 'DEF', label: '防禦', display: 'flat', t1max: 12, group: 'defense' },
  { defId: 'mp', slot: 'suffix', field: 'mpFlat', label: '最大法力', display: 'flat', t1max: 120, group: 'magic' },
  { defId: 'mppct', slot: 'suffix', field: 'mpPct', label: '最大法力%', display: 'pct', t1max: 0.15, group: 'magic' },
  { defId: 'mpregen', slot: 'suffix', field: 'mpRegenFlat', label: '魔力回復/秒', display: 'flat', t1max: 12, group: 'magic' },
  { defId: 'hpregen', slot: 'suffix', field: 'hpRegenFlat', label: '生命回復/秒', display: 'flat', t1max: 40, group: 'defense' },
  { defId: 'atkspd', slot: 'suffix', field: 'atkSpdPct', label: '攻擊速度', display: 'pct', t1max: 0.15, group: 'attack' },
  { defId: 'cdr', slot: 'suffix', field: 'cdrPct', label: '冷卻減少', display: 'pct', t1max: 0.12, group: 'magic' },
  { defId: 'critdmg', slot: 'suffix', field: 'critDmgAdd', label: '爆擊傷害', display: 'pct', t1max: 0.4, group: 'luck' },
  { defId: 'dex', slot: 'suffix', field: 'DEX', label: '敏捷', display: 'flat', t1max: 12, group: 'attack' },
  { defId: 'spd', slot: 'suffix', field: 'SPD', label: '速度', display: 'flat', t1max: 12, group: 'attack' },
  { defId: 'luk', slot: 'suffix', field: 'LUK', label: '幸運', display: 'flat', t1max: 12, group: 'luck' },
  { defId: 'allstats', slot: 'suffix', field: 'allStats', label: '全屬性', display: 'flat', t1max: 6, group: 'luck' },
  { defId: 'drop', slot: 'suffix', field: 'dropPct', label: '掉落率', display: 'pct', t1max: 0.2, group: 'luck' },
  { defId: 'expgain', slot: 'suffix', field: 'expGainPct', label: '經驗獲取', display: 'pct', t1max: 0.15, group: 'luck' },
];

export const AFFIX_BY_ID: Record<string, AffixDef> = Object.fromEntries(
  AFFIXES.map((a) => [a.defId, a]),
);
