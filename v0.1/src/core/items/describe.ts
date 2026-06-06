// 把 Item 轉成「可直接顯示」的視圖物件 —— 讓 UI 不必懂遊戲規則 (架構原則:UI 只 render)
import type { Stats } from '../state/GameState';
import { type Item, RARITY_INFO, TYPE_INFO } from './types';
import { affixDef } from './affixes';
import { sellValue } from './value';
import type { AffixDef } from '../../data/affixes';
import { STONE_LIST } from '../../data/stones';

const STAT_LABEL: Record<keyof Stats, string> = {
  STR: '力量',
  INT: '智力',
  DEF: '防禦',
  DEX: '敏捷',
  SPD: '速度',
  LUK: '幸運',
};

export interface AffixView {
  text: string; // 例:「+25 物理攻擊」
  tier: number;
  slot: 'prefix' | 'suffix';
}

export interface ItemView {
  id: string;
  name: string;
  rarity: string;
  rarityName: string;
  rarityColor: string;
  typeName: string;
  typeEmoji: string;
  category: 'weapon' | 'armor' | 'ring'; // 背包篩選用
  itemLevel: number;
  twoHanded: boolean;
  baseLines: string[]; // 基底主數值
  affixes: AffixView[]; // 詞綴
  affixCount: number; // 詞綴總數(排序/篩選用)
  rarityOrder: number; // 稀有度排序值(common 0 … legendary 4)
  sellValue: number; // 販賣價
  favorite: boolean; // 我的最愛(批量販賣/丟棄會跳過)
  equipSlots: string[]; // 此物可裝的格(供比對同部位裝備)
}

function categoryOf(type: Item['type']): 'weapon' | 'armor' | 'ring' {
  const c = TYPE_INFO[type].category;
  // 盾 / 法球(offhand)屬於武器類,歸到「武器」篩選
  if (c === 'weapon1h' || c === 'weapon2h' || c === 'offhand') return 'weapon';
  if (c === 'accessory') return 'ring';
  return 'armor'; // 純防具(頭/胸/手/腳)
}

function fmtValue(def: AffixDef, value: number): string {
  if (def.display === 'crit' || def.display === 'pct') return `+${(value * 100).toFixed(1)}%`;
  return `+${value}`;
}

export function describeItem(item: Item): ItemView {
  const ri = RARITY_INFO[item.rarity];
  const ti = TYPE_INFO[item.type];

  const baseLines: string[] = [];
  if (item.basePAtk) baseLines.push(`物理攻擊 +${item.basePAtk}`);
  if (item.baseMAtk) baseLines.push(`魔法攻擊 +${item.baseMAtk}`);
  if (item.baseArmour) baseLines.push(`護甲值 +${item.baseArmour}`);
  if (item.baseAtkSpdPct) baseLines.push(`攻擊速度 +${(item.baseAtkSpdPct * 100).toFixed(0)}%`);
  if (item.baseCdrPct) baseLines.push(`冷卻減少 +${(item.baseCdrPct * 100).toFixed(0)}%`);
  for (const k of Object.keys(STAT_LABEL) as (keyof Stats)[]) {
    const v = item.baseStats[k];
    if (v) baseLines.push(`${STAT_LABEL[k]} +${v}`);
  }

  const affixes: AffixView[] = [];
  for (const a of [...item.prefixes, ...item.suffixes]) {
    const def = affixDef(a);
    if (!def) continue;
    affixes.push({ text: `${fmtValue(def, a.value)} ${def.label}`, tier: a.tier, slot: a.slot });
  }

  return {
    id: item.id,
    name: item.name,
    rarity: item.rarity,
    rarityName: ri.name,
    rarityColor: ri.color,
    typeName: ti.name,
    typeEmoji: ti.emoji,
    category: categoryOf(item.type),
    itemLevel: item.itemLevel,
    twoHanded: !!ti.twoHanded,
    baseLines,
    affixes,
    affixCount: item.prefixes.length + item.suffixes.length,
    rarityOrder: ri.order,
    sellValue: sellValue(item),
    favorite: !!item.favorite,
    equipSlots: ti.slots,
  };
}

export interface StoneView {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  kind: 'upgrade' | 'directive' | 'modify';
  count: number;
}

/** 石頭庫存視圖(給加工頁顯示) */
export function stoneViews(stones: Record<string, number>): StoneView[] {
  return STONE_LIST.map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    desc: d.desc,
    kind: d.kind,
    count: stones[d.id] ?? 0,
  }));
}
