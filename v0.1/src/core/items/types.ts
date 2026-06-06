// 裝備系統型別 (REQ §6) —— 純資料,可序列化進存檔
import type { Stats } from '../state/GameState';

/** 稀有度(白→綠→藍→紫→橙;紅裝 unique 留待後續) */
export type Rarity = 'common' | 'magic' | 'rare' | 'epic' | 'legendary';

/** 物品大類 */
export type ItemType =
  // 單手武器(可雙持:主手或副手)
  | 'sword1h' // 單手劍:物攻
  | 'dagger' // 匕首:物攻(低)+ 攻速
  | 'lance' // 長槍:物攻 + 護甲
  | 'wand' // 單手法杖:魔攻
  | 'scepter' // 權杖:物攻+魔攻 混
  // 雙手武器(佔主+副)
  | 'sword2h' // 雙手劍:物攻(高)
  | 'staff' // 雙手法杖:魔攻(高)
  | 'longstaff' // 長杖:物攻+魔攻 混(高)
  // 只能放副手
  | 'shield' // 盾:護甲
  | 'orb' // 法球:冷卻減少(+少量魔攻)
  // 護甲
  | 'helmet'
  | 'chest'
  | 'gloves'
  | 'boots'
  // 飾品
  | 'ring';

/** 物品分類(決定可裝格位 / 雙持規則) */
export type ItemCategory = 'weapon1h' | 'weapon2h' | 'offhand' | 'armour' | 'accessory';

/** 8 個裝備格位 (REQ §6.1) */
export type EquipSlot =
  | 'mainHand'
  | 'offHand'
  | 'helmet'
  | 'chest'
  | 'gloves'
  | 'boots'
  | 'ring1'
  | 'ring2';

/** 詞綴前後綴 (REQ §6.4) */
export type AffixSlot = 'prefix' | 'suffix';

/** 詞綴主題群組(改造石「加 X 系詞綴」用) */
export type AffixGroup = 'attack' | 'magic' | 'defense' | 'luck';

/** 石頭種類 (REQ §6.7) */
export type StoneId =
  // 升階石(稀有度)
  | 'rough'
  | 'normal'
  | 'fine'
  | 'perfect'
  // 升階時指定加前/後綴
  | 'prefix'
  | 'suffix'
  // 改造石(改現有裝備詞綴,類 POE 通貨)
  | 'scourPrefix' // 隨機消除一條前綴
  | 'scourSuffix' // 隨機消除一條後綴
  | 'reforgeAttack' // 加一條攻擊詞綴、替換隨機一條
  | 'reforgeMagic'
  | 'reforgeDefense'
  | 'reforgeLuck'
  // tier 交換石(提升一側 Tier、降低另一側 Tier)
  | 'tierTradePrefix' // 提升一條前綴 Tier、降低一條後綴 Tier(需有後綴)
  | 'tierTradeSuffix'; // 提升一條後綴 Tier、降低一條前綴 Tier(需有前綴)

/** 詞綴作用範圍:global=全域;localWeapon=只改該武器自身基底(POE local) */
export type AffixScope = 'global' | 'localWeapon';

/** 詞綴可影響的數值欄位 */
export type BonusField =
  // 屬性
  | 'STR'
  | 'INT'
  | 'DEF'
  | 'DEX'
  | 'SPD'
  | 'LUK'
  | 'allStats'
  // flat 直接加
  | 'pAtkFlat'
  | 'mAtkFlat'
  | 'armourFlat'
  | 'hpFlat'
  | 'mpFlat'
  | 'hpRegenFlat'
  | 'mpRegenFlat'
  // % 增加(加總後 ×(1+Σ))
  | 'pAtkPct'
  | 'mAtkPct'
  | 'armourPct'
  | 'hpPct'
  | 'mpPct'
  | 'hpRegenPct'
  | 'mpRegenPct'
  | 'atkSpdPct'
  // 特殊
  | 'critFlat' // 爆擊率 +
  | 'critDmgAdd' // 爆擊傷害倍率 +
  | 'cdrPct' // 冷卻減少 %
  | 'dmgReductionPct' // 硬減傷 %(護甲之外再乘)
  | 'expGainPct' // 經驗獲取 %
  | 'dropPct' // 掉落率 %
  // local 武器(只改該武器自身基底攻擊)
  | 'wpnPhysPct'
  | 'wpnMagPct';

/** 一條已滾好的詞綴 */
export interface Affix {
  defId: string;
  slot: AffixSlot;
  field: BonusField;
  tier: number; // 1(最強)~ 5(最弱)
  value: number;
}

/** 一件裝備實例 */
export interface Item {
  id: string;
  type: ItemType;
  rarity: Rarity;
  itemLevel: number;
  name: string;
  // 基底主數值(依大類給;其餘為 0)
  basePAtk: number; // 武器物攻
  baseMAtk: number; // 武器魔攻
  baseArmour: number; // 護甲值(護甲/盾/長槍)
  baseAtkSpdPct: number; // 攻速%(匕首)
  baseCdrPct: number; // 冷卻減少%(法球)
  baseStats: Partial<Stats>; // 飾品:單一屬性
  prefixes: Affix[];
  suffixes: Affix[];
  craftCount?: number;
  pity?: number;
  /** 我的最愛:被加星 → 批量販賣/丟棄時會跳過(需先取消星號)(REQ §6.9) */
  favorite?: boolean;
}

/** 所有加成的彙總(角色身上裝備加總) */
export interface Bonus {
  stats: Stats;
  // flat
  pAtkFlat: number;
  mAtkFlat: number;
  armourFlat: number;
  hpFlat: number;
  mpFlat: number;
  hpRegenFlat: number;
  mpRegenFlat: number;
  // %
  pAtkPct: number;
  mAtkPct: number;
  armourPct: number;
  hpPct: number;
  mpPct: number;
  hpRegenPct: number;
  mpRegenPct: number;
  atkSpdPct: number;
  // 特殊
  critFlat: number;
  critDmgAdd: number;
  cdrPct: number;
  dmgReductionPct: number;
  expGainPct: number;
  dropPct: number;
}

export type Equipment = Record<EquipSlot, Item | null>;

export function emptyBonus(): Bonus {
  return {
    stats: { STR: 0, INT: 0, DEF: 0, DEX: 0, SPD: 0, LUK: 0 },
    pAtkFlat: 0,
    mAtkFlat: 0,
    armourFlat: 0,
    hpFlat: 0,
    mpFlat: 0,
    hpRegenFlat: 0,
    mpRegenFlat: 0,
    pAtkPct: 0,
    mAtkPct: 0,
    armourPct: 0,
    hpPct: 0,
    mpPct: 0,
    hpRegenPct: 0,
    mpRegenPct: 0,
    atkSpdPct: 0,
    critFlat: 0,
    critDmgAdd: 0,
    cdrPct: 0,
    dmgReductionPct: 0,
    expGainPct: 0,
    dropPct: 0,
  };
}

export function emptyEquipment(): Equipment {
  return {
    mainHand: null,
    offHand: null,
    helmet: null,
    chest: null,
    gloves: null,
    boots: null,
    ring1: null,
    ring2: null,
  };
}

/** 稀有度顯示名 / 顏色 */
export const RARITY_INFO: Record<Rarity, { name: string; color: string; order: number }> = {
  common: { name: '普通', color: '#c8cdd8', order: 0 },
  magic: { name: '魔法', color: '#5bd75b', order: 1 },
  rare: { name: '稀有', color: '#5b9bff', order: 2 },
  epic: { name: '史詩', color: '#c06bff', order: 3 },
  legendary: { name: '傳說', color: '#ff9d3c', order: 4 },
};

/** 物品大類 → 顯示名 / emoji / 分類 / 適配格位 */
export const TYPE_INFO: Record<
  ItemType,
  { name: string; emoji: string; category: ItemCategory; slots: EquipSlot[]; twoHanded?: boolean }
> = {
  sword1h: { name: '單手劍', emoji: '🗡️', category: 'weapon1h', slots: ['mainHand', 'offHand'] },
  dagger: { name: '匕首', emoji: '🔪', category: 'weapon1h', slots: ['mainHand', 'offHand'] },
  lance: { name: '長槍', emoji: '🔱', category: 'weapon1h', slots: ['mainHand', 'offHand'] },
  wand: { name: '單手法杖', emoji: '🪄', category: 'weapon1h', slots: ['mainHand', 'offHand'] },
  scepter: { name: '權杖', emoji: '⚜️', category: 'weapon1h', slots: ['mainHand', 'offHand'] },
  sword2h: { name: '雙手劍', emoji: '⚔️', category: 'weapon2h', slots: ['mainHand'], twoHanded: true },
  staff: { name: '雙手法杖', emoji: '🔮', category: 'weapon2h', slots: ['mainHand'], twoHanded: true },
  longstaff: { name: '長杖', emoji: '🌿', category: 'weapon2h', slots: ['mainHand'], twoHanded: true },
  shield: { name: '盾', emoji: '🛡️', category: 'offhand', slots: ['offHand'] },
  orb: { name: '法球', emoji: '🔵', category: 'offhand', slots: ['offHand'] },
  helmet: { name: '頭盔', emoji: '⛑️', category: 'armour', slots: ['helmet'] },
  chest: { name: '胸甲', emoji: '🥋', category: 'armour', slots: ['chest'] },
  gloves: { name: '手套', emoji: '🧤', category: 'armour', slots: ['gloves'] },
  boots: { name: '鞋子', emoji: '🥾', category: 'armour', slots: ['boots'] },
  ring: { name: '飾品', emoji: '💍', category: 'accessory', slots: ['ring1', 'ring2'] },
};

/** 是否為武器(主手/雙手/單手) */
export function isWeapon(type: ItemType): boolean {
  const c = TYPE_INFO[type].category;
  return c === 'weapon1h' || c === 'weapon2h';
}
