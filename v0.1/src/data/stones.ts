// 石頭種類 (REQ §6.7) —— 與程式分離的可調資料
import type { StoneId, Rarity, AffixGroup, AffixSlot } from '../core/items/types';

export interface StoneDef {
  id: StoneId;
  name: string;
  emoji: string;
  kind: 'upgrade' | 'directive' | 'modify';
  /** upgrade 石:從哪個稀有度升到下一個 */
  fromRarity?: Rarity;
  toRarity?: Rarity;
  /** directive 石:升階時強制追加的詞綴側 */
  side?: AffixSlot;
  /** modify 石:消除哪一側(scour) */
  removeSide?: AffixSlot;
  /** modify 石:重鑄要加的詞綴群組 */
  group?: AffixGroup;
  /** tier 交換石:提升此側一條詞綴 Tier */
  raiseSide?: AffixSlot;
  /** tier 交換石:降低此側一條詞綴 Tier(此側必須有詞綴才能用) */
  lowerSide?: AffixSlot;
  dropWeight: number;
  desc: string;
}

export const STONES: Record<StoneId, StoneDef> = {
  // --- 升階石 ---
  rough: { id: 'rough', name: '粗糙升階石', emoji: '🪨', kind: 'upgrade', fromRarity: 'common', toRarity: 'magic', dropWeight: 50, desc: '白 → 綠' },
  normal: { id: 'normal', name: '普通升階石', emoji: '🧱', kind: 'upgrade', fromRarity: 'magic', toRarity: 'rare', dropWeight: 24, desc: '綠 → 藍' },
  fine: { id: 'fine', name: '精良升階石', emoji: '💠', kind: 'upgrade', fromRarity: 'rare', toRarity: 'epic', dropWeight: 10, desc: '藍 → 紫' },
  perfect: { id: 'perfect', name: '完美升階石', emoji: '🔷', kind: 'upgrade', fromRarity: 'epic', toRarity: 'legendary', dropWeight: 3, desc: '紫 → 橙' },
  // --- 升階指定石 ---
  prefix: { id: 'prefix', name: '指定前綴石', emoji: '🔶', kind: 'directive', side: 'prefix', dropWeight: 5, desc: '升階時保證追加一條前綴' },
  suffix: { id: 'suffix', name: '指定後綴石', emoji: '🔻', kind: 'directive', side: 'suffix', dropWeight: 5, desc: '升階時保證追加一條後綴' },
  // --- 改造石(改現有裝備詞綴)---
  scourPrefix: { id: 'scourPrefix', name: '淨化前綴石', emoji: '🧹', kind: 'modify', removeSide: 'prefix', dropWeight: 9, desc: '隨機消除一條前綴' },
  scourSuffix: { id: 'scourSuffix', name: '淨化後綴石', emoji: '🧽', kind: 'modify', removeSide: 'suffix', dropWeight: 9, desc: '隨機消除一條後綴' },
  reforgeAttack: { id: 'reforgeAttack', name: '攻擊重鑄石', emoji: '⚔️', kind: 'modify', group: 'attack', dropWeight: 7, desc: '替換隨機一條 → 新增一條攻擊系詞綴' },
  reforgeMagic: { id: 'reforgeMagic', name: '魔法重鑄石', emoji: '🔮', kind: 'modify', group: 'magic', dropWeight: 7, desc: '替換隨機一條 → 新增一條魔法系詞綴' },
  reforgeDefense: { id: 'reforgeDefense', name: '防禦重鑄石', emoji: '🏰', kind: 'modify', group: 'defense', dropWeight: 7, desc: '替換隨機一條 → 新增一條生命/防禦系詞綴' },
  reforgeLuck: { id: 'reforgeLuck', name: '幸運重鑄石', emoji: '🍀', kind: 'modify', group: 'luck', dropWeight: 7, desc: '替換隨機一條 → 新增一條運氣系詞綴(爆擊/掉落/經驗)' },
  // tier 交換石(需同時有前綴與後綴)
  tierTradePrefix: { id: 'tierTradePrefix', name: '前綴精煉石', emoji: '⬆️', kind: 'modify', raiseSide: 'prefix', lowerSide: 'suffix', dropWeight: 5, desc: '提升隨機一條前綴 Tier、降低隨機一條後綴 Tier(需同時有前後綴)' },
  tierTradeSuffix: { id: 'tierTradeSuffix', name: '後綴精煉石', emoji: '⬇️', kind: 'modify', raiseSide: 'suffix', lowerSide: 'prefix', dropWeight: 5, desc: '提升隨機一條後綴 Tier、降低隨機一條前綴 Tier(需同時有前後綴)' },
};

export const STONE_LIST: StoneDef[] = Object.keys(STONES).map((k) => STONES[k as StoneId]);

/** 某稀有度要升階所需的升階石 id(legendary 已最高 → null) */
export function upgradeStoneFor(rarity: Rarity): StoneId | null {
  switch (rarity) {
    case 'common':
      return 'rough';
    case 'magic':
      return 'normal';
    case 'rare':
      return 'fine';
    case 'epic':
      return 'perfect';
    default:
      return null;
  }
}
