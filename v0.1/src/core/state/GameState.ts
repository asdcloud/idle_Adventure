// 整體遊戲狀態 (Single Source of Truth)
// 角色 / 戰鬥 runtime / 地圖進度 / 裝備 + 背包(M4)/ 加工(M5)/ 技能(M6)。
import type { Equipment, Item } from '../items/types';
import type { SkillId } from '../../data/skills';

/** 六大基礎屬性 */
export interface Stats {
  STR: number;
  INT: number;
  DEF: number;
  DEX: number;
  SPD: number;
  LUK: number;
}

/** 角色資料 */
export interface Character {
  level: number;
  exp: number;
  /** 保底自動成長累積的屬性 */
  baseStats: Stats;
  /** 玩家分配的自由點 */
  allocated: Stats;
  /** 尚未分配的自由點 */
  unspentPoints: number;
  gold: number;
  /** 洗點次數(費用遞增用,v0.1 先保留欄位) */
  respecCount: number;
}

/** 戰鬥中的單位(角色或敵人共用的最小快照) */
export interface CombatantSnapshot {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  /** 攻擊計時條 0~1,滿了就出手 */
  attackBar: number;
}

/**
 * 場上敵人的完整狀態 —— 含屬性與獎勵,直接進存檔。
 * (不再用模組變數暫存,避免重開後遺失導致戰鬥卡死)
 */
export interface EnemyState extends CombatantSnapshot {
  stats: Stats;
  expReward: number;
  goldReward: number;
  /** Boss 種類(小怪為 undefined);供 UI 區分與機制觸發 */
  boss?: 'area' | 'world';
  /** Boss 機制 runtime:是否已狂暴 */
  enraged?: boolean;
  /** Boss 機制 runtime:距下次重擊的秒數 */
  bigHitTimer?: number;
}

/** 飄出的傷害數字(供 overlay 動效) */
export interface FloatingNumber {
  id: number;
  amount: number;
  crit: boolean;
  /** 'enemy' = 打在敵人身上, 'char' = 打在角色身上 */
  target: 'enemy' | 'char';
  /** 魔法傷害(技能 school='mag')→ UI 顯示紫色 */
  magic?: boolean;
}

/** 地圖進度 */
export interface MapProgress {
  /** 已達成的最高地圖等級 */
  mapLevel: number;
  /** 玩家當前選擇要打的地圖等級 */
  selectedMapLevel: number;
  /** 目前第幾區域 0..5;= areaCount(6) 表示六區已清、世界 Boss 待打 */
  areaIndex: number;
  /** 此區域已擊敗的小怪數(達 monstersPerArea → 出現區域 Boss) */
  monstersDefeated: number;
}

/** runtime:戰鬥當下狀態(v0.1 也存,方便還原) */
export interface Runtime {
  charHp: number;
  charMp: number;
  charAttackBar: number;
  enemy: EnemyState | null;
  /** 最近彈出的傷害數字(環狀,給 UI 消費) */
  floaters: FloatingNumber[];
  /** 累計擊殺數(統計 / debug) */
  totalKills: number;
  /** 背包/裝備變動版本號,變了 UI 才重畫背包(避免高頻重繪讓按鈕點不到) */
  invVersion: number;
  /** 3 個技能槽的冷卻剩餘秒數(對應 skillSlots) */
  skillCooldowns: number[];
  /** 累計從戰鬥獲得的金幣 / 經驗(僅供離線收益「近期速率」取樣;單調遞增) */
  earnedGold: number;
  earnedExp: number;
}

/** 背包 (REQ §6.9) */
export interface Inventory {
  /** 未裝備的裝備 */
  items: Item[];
  /** 目前背包容量上限(可用金幣擴充) */
  cap: number;
  /** 石頭(M5 加工用,先預留) */
  stones: Record<string, number>;
  /** 技能書(M6 用,先預留) */
  skillBooks: string[];
}

/** 玩家設定(設定頁) */
export interface GameSettings {
  /** 自動打王:開 → 清完小怪自動出現 Boss;關 → 只持續刷小怪(練等/刷裝) */
  autoBoss: boolean;
  /** 循環同一關卡:開 → 擊敗區域 Boss 後留在同一區域重複刷(不前進、不打世界王) */
  loopStage: boolean;
}

/** 開發者測試設定(設定頁輸入碼解鎖) */
export interface DevSettings {
  /** 經驗值倍率 (0.25 ~ 1000) */
  expMult: number;
  /** 掉落率倍率 (0.25 ~ 1000) */
  dropMult: number;
  /** 金錢無限(每 tick 補滿金幣) */
  infiniteGold?: boolean;
  /** 加工石無限(每 tick 補滿所有石頭) */
  infiniteStones?: boolean;
}

/** 整體存檔狀態 */
export interface GameState {
  /** 存檔版本,供日後遷移 */
  version: number;
  character: Character;
  /** 8 格已裝備 (REQ §6.1) */
  equipment: Equipment;
  /** 背包 */
  inventory: Inventory;
  /** 3 個技能槽(主被動共用)(REQ §7.1) */
  skillSlots: (SkillId | null)[];
  map: MapProgress;
  runtime: Runtime;
  /** 玩家設定 */
  settings: GameSettings;
  /** 開發者測試設定 */
  dev: DevSettings;
  /** 上次在線時間戳(離線結算用) */
  lastSeenTimestamp: number;
  /** 離線收益速率(存檔時由「近期 3 分鐘實際速率」算出,不足 3 分以簡單版補;每秒、未乘效率)*/
  offline: { goldPerSec: number; expPerSec: number };
}
