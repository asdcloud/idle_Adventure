// 技能清單 (REQ §7) —— 與程式分離的可調資料
// 不做技能升級:效果用「屬性倍率 / 百分比」表示,隨角色屬性自然成長 (REQ §7.4)。

export type SkillId = string;
export type SkillKind = 'active' | 'passive';

/** 主動技能效果(資料驅動,引擎據此運算) */
export interface ActiveEffect {
  /** 傷害:用哪種攻擊力 */
  school?: 'phys' | 'mag';
  /** 傷害倍率 */
  mult?: number;
  /** 攻擊次數(連刺) */
  hits?: number;
  /** 治療:回復 最大HP × pct */
  healPctMaxHp?: number;
  /** 治療:額外 + 魔攻 × mult */
  healMatkMult?: number;
}

/** 被動技能效果(常駐) */
export interface PassiveEffect {
  pAtkPct?: number; // 物攻 +%
  mAtkPct?: number; // 魔攻 +%
  hpPct?: number; // 最大HP +%
  critAdd?: number; // 爆擊率 +(絕對)
  critDmgAdd?: number; // 爆傷倍率 +
  atkSpdPct?: number; // 攻速 +%
  dropPct?: number; // 掉落 +%
  lifestealPct?: number; // 普攻吸血 %
  mpOnHit?: number; // 每次普攻回 MP
  thornsPct?: number; // 受擊反彈 %
  armourPct?: number; // 護甲 +%
  cdrPct?: number; // 冷卻減少 %
  dmgReductionPct?: number; // 硬減傷 %
  expGainPct?: number; // 經驗獲取 +%
}

export interface SkillDef {
  id: SkillId;
  name: string;
  kind: SkillKind;
  emoji: string;
  desc: string;
  /** 主動:冷卻(秒)/ 魔力消耗 */
  cd?: number;
  mp?: number;
  active?: ActiveEffect;
  passive?: PassiveEffect;
}

export const SKILLS: SkillDef[] = [
  // ---- 主動:物理(普攻有免費傷害,故技能倍率「中等」)----
  { id: 'heavy_slash', name: '重斬', kind: 'active', emoji: '🗡️', cd: 4, mp: 15, active: { school: 'phys', mult: 2.2 }, desc: '物理:物攻 × 2.2' },
  { id: 'multi_stab', name: '連刺', kind: 'active', emoji: '🔪', cd: 6, mp: 18, active: { school: 'phys', mult: 0.9, hits: 3 }, desc: '物理:攻 3 下,每下 物攻 × 0.9' },
  { id: 'charged_blow', name: '蓄力一擊', kind: 'active', emoji: '💥', cd: 12, mp: 28, active: { school: 'phys', mult: 4.5 }, desc: '物理:物攻 × 4.5(大爆發)' },
  // ---- 主動:魔法(無普攻傷害、全壓技能且耗 MP,故倍率「明顯較高」)----
  { id: 'fireball', name: '火球術', kind: 'active', emoji: '🔥', cd: 4, mp: 20, active: { school: 'mag', mult: 4.0 }, desc: '魔法:魔攻 × 4.0' },
  { id: 'frost_nova', name: '冰霜新星', kind: 'active', emoji: '❄️', cd: 6, mp: 24, active: { school: 'mag', mult: 3.2 }, desc: '魔法:魔攻 × 3.2' },
  { id: 'arcane_blast', name: '奧能爆發', kind: 'active', emoji: '🌟', cd: 12, mp: 34, active: { school: 'mag', mult: 8.0 }, desc: '魔法:魔攻 × 8.0(大爆發)' },
  // 短CD魔法(高頻率填補輸出,讓法師 DPS 平滑,類比物理普攻的持續輸出)
  { id: 'arcane_missile', name: '奧術飛彈', kind: 'active', emoji: '✴️', cd: 1.2, mp: 7, active: { school: 'mag', mult: 1.3 }, desc: '魔法:魔攻 × 1.3(短CD、高頻)' },
  { id: 'ice_lance', name: '寒冰箭', kind: 'active', emoji: '🧊', cd: 2.5, mp: 12, active: { school: 'mag', mult: 2.5 }, desc: '魔法:魔攻 × 2.5(短CD)' },
  // ---- 主動:輔助 ----
  { id: 'heal', name: '治療術', kind: 'active', emoji: '✨', cd: 10, mp: 30, active: { healPctMaxHp: 0.2, healMatkMult: 1.5 }, desc: '回復 最大HP×20% + 魔攻×1.5' },

  // ---- 被動 ----
  { id: 'berserk', name: '狂戰意志', kind: 'passive', emoji: '⚔️', passive: { pAtkPct: 0.12 }, desc: '物理攻擊 +12%' },
  { id: 'arcane', name: '奧術精通', kind: 'passive', emoji: '🔮', passive: { mAtkPct: 0.12 }, desc: '魔法攻擊 +12%' },
  { id: 'iron_body', name: '鋼鐵之軀', kind: 'passive', emoji: '🛡️', passive: { hpPct: 0.15 }, desc: '最大 HP +15%' },
  { id: 'precision', name: '致命精準', kind: 'passive', emoji: '🎯', passive: { critAdd: 0.08 }, desc: '爆擊率 +8%' },
  { id: 'brutal', name: '暴虐', kind: 'passive', emoji: '😈', passive: { critDmgAdd: 0.3 }, desc: '爆擊傷害倍率 +0.3' },
  { id: 'swift', name: '迅捷', kind: 'passive', emoji: '💨', passive: { atkSpdPct: 0.1 }, desc: '攻擊速度 +10%' },
  { id: 'lucky_star', name: '幸運星', kind: 'passive', emoji: '🍀', passive: { dropPct: 0.15 }, desc: '掉落率 +15%' },
  { id: 'vampire', name: '吸血', kind: 'passive', emoji: '🩸', passive: { lifestealPct: 0.08 }, desc: '普攻傷害的 8% 回復 HP' },
  { id: 'mana_echo', name: '法力迴響', kind: 'passive', emoji: '💧', passive: { mpOnHit: 5 }, desc: '每次普攻回復 5 MP' },
  { id: 'thorns', name: '荊棘', kind: 'passive', emoji: '🌵', passive: { thornsPct: 0.1 }, desc: '受擊反彈攻擊者 10% 傷害' },

  // ---- 新增主動(2026-06-06)----
  { id: 'whirlwind', name: '旋風斬', kind: 'active', emoji: '🌀', cd: 7, mp: 24, active: { school: 'phys', mult: 1.3, hits: 4 }, desc: '物理:攻 4 下,每下 物攻 × 1.3' },
  { id: 'execute', name: '處決', kind: 'active', emoji: '🪓', cd: 14, mp: 30, active: { school: 'phys', mult: 5.5 }, desc: '物理:物攻 × 5.5(大爆發)' },
  { id: 'lightning', name: '閃電箭', kind: 'active', emoji: '⚡', cd: 5, mp: 22, active: { school: 'mag', mult: 3.5 }, desc: '魔法:魔攻 × 3.5' },
  { id: 'meteor', name: '隕石術', kind: 'active', emoji: '☄️', cd: 13, mp: 36, active: { school: 'mag', mult: 6.0 }, desc: '魔法:魔攻 × 6.0(大爆發)' },
  { id: 'firestorm', name: '烈焰風暴', kind: 'active', emoji: '🔥', cd: 8, mp: 30, active: { school: 'mag', mult: 1.8, hits: 3 }, desc: '魔法:攻 3 下,每下 魔攻 × 1.8' },
  { id: 'quick_heal', name: '急速治療', kind: 'active', emoji: '💚', cd: 5, mp: 16, active: { healPctMaxHp: 0.12, healMatkMult: 0.8 }, desc: '回復 最大HP×12% + 魔攻×0.8(快回)' },

  // ---- 新增被動(2026-06-06)----
  { id: 'fortify', name: '堅壁', kind: 'passive', emoji: '🏰', passive: { armourPct: 0.2 }, desc: '護甲 +20%' },
  { id: 'haste', name: '疾風步', kind: 'passive', emoji: '🪶', passive: { cdrPct: 0.08 }, desc: '技能冷卻 -8%' },
  { id: 'ironskin', name: '銅皮', kind: 'passive', emoji: '🪙', passive: { dmgReductionPct: 0.06 }, desc: '受到傷害 -6%' },
  { id: 'scholar', name: '博學', kind: 'passive', emoji: '📚', passive: { expGainPct: 0.12 }, desc: '經驗獲取 +12%' },
  { id: 'versatile', name: '雙修', kind: 'passive', emoji: '☯️', passive: { pAtkPct: 0.08, mAtkPct: 0.08 }, desc: '物理 / 魔法攻擊各 +8%' },
];

/** 技能總數(UI 顯示「擁有 / 總數」用) */
export const SKILL_TOTAL = SKILLS.length;

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
