// 新檔初始狀態
import type { GameState, Stats } from './GameState';
import type { Item, ItemType, EquipSlot } from '../items/types';
import { BALANCE } from '../../data/balance';
import { emptyEquipment, TYPE_INFO } from '../items/types';

// v2:新增 equipment + inventory(M4 裝備系統)
// v3:背包容量 inventory.cap(可用金幣擴充)
// v4:技能槽 skillSlots + runtime.skillCooldowns(M6 技能系統)
// v5:dev 開發者測試設定(經驗/掉落倍率)
// v6:裝備系統大改(武器分類 / 詞綴擴充 / 護甲值);舊裝備不相容 → 遷移時清空
// v7:玩家設定 settings(autoBoss 自動打王開關)
// v8:離線收益近期速率取樣(runtime.earnedGold/Exp + offline 速率)
export const SAVE_VERSION = 8;

function startingStats(): Stats {
  const v = BALANCE.startingStat;
  return { STR: v, INT: v, DEF: v, DEX: v, SPD: v, LUK: v };
}

function zeroStats(): Stats {
  return { STR: 0, INT: 0, DEF: 0, DEX: 0, SPD: 0, LUK: 0 };
}

/** 新手起始裝(common,ilvl1):讓全新角色一開始就打得動小怪(角色為 floor,戰力靠裝備) */
function starterItem(type: ItemType, basePAtk: number, baseArmour: number): Item {
  return {
    id: `starter-${type}`,
    type,
    rarity: 'common',
    itemLevel: 1,
    name: `新手${TYPE_INFO[type].name}`,
    basePAtk,
    baseMAtk: 0,
    baseArmour,
    baseAtkSpdPct: 0,
    baseCdrPct: 0,
    baseStats: {},
    prefixes: [],
    suffixes: [],
  };
}

/** 起始裝備:單手劍 + 胸甲 + 頭盔(基礎值對應 ilvl1) */
function starterEquipment() {
  const eq = emptyEquipment();
  eq.mainHand = starterItem('sword1h', 8, 0);
  eq.chest = starterItem('chest', 0, 8);
  eq.helmet = starterItem('helmet', 0, 5);
  return eq as Record<EquipSlot, Item | null>;
}

export function createNewGame(now: number): GameState {
  return {
    version: SAVE_VERSION,
    character: {
      level: 1,
      exp: 0,
      baseStats: startingStats(),
      allocated: zeroStats(),
      unspentPoints: 0,
      gold: 0,
      respecCount: 0,
    },
    equipment: starterEquipment(),
    inventory: { items: [], cap: BALANCE.items.inventoryCap, stones: {}, skillBooks: [] },
    skillSlots: [null, null, null],
    map: {
      mapLevel: 1,
      selectedMapLevel: 1,
      areaIndex: 0,
      monstersDefeated: 0,
    },
    runtime: {
      charHp: 0, // 由 engine 進場時補滿
      charMp: 0,
      charAttackBar: 0,
      enemy: null,
      floaters: [],
      totalKills: 0,
      invVersion: 0,
      skillCooldowns: [0, 0, 0],
      earnedGold: 0,
      earnedExp: 0,
    },
    settings: { autoBoss: true, loopStage: false },
    dev: { expMult: 1, dropMult: 1, infiniteGold: false, infiniteStones: false },
    lastSeenTimestamp: now,
    offline: { goldPerSec: 0, expPerSec: 0 },
  };
}
