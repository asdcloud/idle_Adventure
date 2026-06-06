// 技能核心 (REQ §7):被動加總、技能槽配置、技能書掉落、顯示視圖 —— 純函式
import type { GameState } from './state/GameState';
import { SKILL_BY_ID, SKILLS, SKILL_TOTAL, type PassiveEffect, type SkillId } from '../data/skills';

export { SKILL_TOTAL };

/** 把所有欄位補 0 的被動加成 */
export type FullPassive = Required<PassiveEffect>;

export function emptyPassive(): FullPassive {
  return {
    pAtkPct: 0,
    mAtkPct: 0,
    hpPct: 0,
    critAdd: 0,
    critDmgAdd: 0,
    atkSpdPct: 0,
    dropPct: 0,
    lifestealPct: 0,
    mpOnHit: 0,
    thornsPct: 0,
    armourPct: 0,
    cdrPct: 0,
    dmgReductionPct: 0,
    expGainPct: 0,
  };
}

/** 把 3 個技能槽中的被動技能加總 (REQ §7.3) */
export function aggregatePassives(slots: (SkillId | null)[]): FullPassive {
  const p = emptyPassive();
  for (const id of slots) {
    if (!id) continue;
    const def = SKILL_BY_ID[id];
    if (!def || def.kind !== 'passive' || !def.passive) continue;
    const e = def.passive;
    p.pAtkPct += e.pAtkPct ?? 0;
    p.mAtkPct += e.mAtkPct ?? 0;
    p.hpPct += e.hpPct ?? 0;
    p.critAdd += e.critAdd ?? 0;
    p.critDmgAdd += e.critDmgAdd ?? 0;
    p.atkSpdPct += e.atkSpdPct ?? 0;
    p.dropPct += e.dropPct ?? 0;
    p.lifestealPct += e.lifestealPct ?? 0;
    p.mpOnHit += e.mpOnHit ?? 0;
    p.thornsPct += e.thornsPct ?? 0;
    p.armourPct += e.armourPct ?? 0;
    p.cdrPct += e.cdrPct ?? 0;
    p.dmgReductionPct += e.dmgReductionPct ?? 0;
    p.expGainPct += e.expGainPct ?? 0;
  }
  return p;
}

export function ownsSkill(state: GameState, id: SkillId): boolean {
  return state.inventory.skillBooks.includes(id);
}

/**
 * 配置技能槽 (REQ §7.1)。slot 0..2;id=null 清空。
 * 同一技能不可同時在多槽(會把舊槽清掉)。回傳是否成功。
 */
export function setSkillSlot(state: GameState, slot: number, id: SkillId | null): boolean {
  if (slot < 0 || slot >= state.skillSlots.length) return false;
  if (id === null) {
    state.skillSlots[slot] = null;
    return true;
  }
  if (!SKILL_BY_ID[id] || !ownsSkill(state, id)) return false;
  const existing = state.skillSlots.indexOf(id);
  if (existing >= 0 && existing !== slot) state.skillSlots[existing] = null; // 不重複
  state.skillSlots[slot] = id;
  return true;
}

/** 掉一本「尚未擁有」的技能書;全擁有則回 null (REQ §7.4) */
export function pickNewSkill(owned: SkillId[], rng: () => number): SkillId | null {
  const pool = SKILLS.filter((s) => !owned.includes(s.id));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)].id;
}

// ---- 顯示視圖 ----
export interface SkillView {
  id: string;
  name: string;
  kind: 'active' | 'passive';
  emoji: string;
  desc: string;
  cd: number | null;
  mp: number | null;
  slot: number | null; // 目前在第幾槽(沒裝為 null)
}

export function skillView(state: GameState, id: SkillId): SkillView | null {
  const def = SKILL_BY_ID[id];
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    kind: def.kind,
    emoji: def.emoji,
    desc: def.desc,
    cd: def.cd ?? null,
    mp: def.mp ?? null,
    slot: state.skillSlots.indexOf(id) >= 0 ? state.skillSlots.indexOf(id) : null,
  };
}

/** 已擁有的技能書視圖 */
export function skillBookViews(state: GameState): SkillView[] {
  return state.inventory.skillBooks
    .map((id) => skillView(state, id))
    .filter((v): v is SkillView => v !== null);
}

/** 3 個技能槽的視圖(空槽為 null) */
export function skillSlotViews(state: GameState): (SkillView | null)[] {
  return state.skillSlots.map((id) => (id ? skillView(state, id) : null));
}
