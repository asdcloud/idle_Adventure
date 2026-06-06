// 戰鬥引擎:即時 DPS 制 tick (REQ §5 / §7.2 技能觸發)
// 推進攻擊計時條 → 出手 → 技能(CD+MP)→ 結算 → 擊殺/掉落/推進
import type { GameState } from '../state/GameState';
import { resolveAttack } from './damage';
import { characterCombat, attackProfileOf, profileFromStats, type CombatStats } from './profile';
import { attackInterval, armourReduction, armourFromDEF } from '../formulas/derived';
import { gainExp } from '../formulas/leveling';
import { makeMonster, makeBoss, AREAS, type Enemy } from '../map/enemy';
import { generateItem, rollStone } from '../items/generate';
import { addItemToInventory } from '../items/equip';
import { aggregatePassives, pickNewSkill, type FullPassive } from '../skills';
import { SKILL_BY_ID } from '../../data/skills';
import { STONE_LIST } from '../../data/stones';
import { BALANCE } from '../../data/balance';

const DEV_INF_GOLD = 1_000_000_000_000; // 金錢無限:每 tick 補滿至此
const DEV_INF_STONE = 9999; // 加工石無限:每 tick 補滿至此

let floaterId = 1;

/** 角色含「裝備 + 被動技能」的戰鬥數值 */
function charCombat(state: GameState): CombatStats {
  return characterCombat(state.character, state.equipment, aggregatePassives(state.skillSlots));
}

/** 把角色 HP/MP 補滿(進場 / 復活) */
export function restoreCharacter(state: GameState): void {
  const cs = charCombat(state);
  state.runtime.charHp = cs.maxHp;
  state.runtime.charMp = cs.maxMp;
}

/**
 * 目前關卡階段 (REQ §8.1):
 * - 'mob'       :打小怪(monstersDefeated < monstersPerArea)
 * - 'areaBoss'  :小怪清完 → 區域 Boss
 * - 'worldBoss' :六區 Boss 全清(areaIndex 達 areaCount)→ 世界 Boss
 */
export function mapPhase(state: GameState): 'mob' | 'areaBoss' | 'worldBoss' {
  const m = state.map;
  // 自動打王關閉 → 永遠只刷小怪(練等/刷裝)
  if (state.settings?.autoBoss === false) return 'mob';
  if (m.areaIndex >= BALANCE.enemy.areaCount) return 'worldBoss';
  if (m.monstersDefeated >= BALANCE.enemy.monstersPerArea) return 'areaBoss';
  return 'mob';
}

/** 確保場上有敵人,沒有就依關卡階段生一隻(小怪 / 區域 Boss / 世界 Boss)。回傳是否「本次新生成」 */
export function ensureEnemy(state: GameState, rng: () => number): boolean {
  if (state.runtime.enemy && state.runtime.enemy.hp > 0) return false;
  const m = state.map;
  const phase = mapPhase(state);
  let enemy: Enemy;
  if (phase === 'worldBoss') {
    enemy = makeBoss(m.selectedMapLevel, 0, 'world');
  } else if (phase === 'areaBoss') {
    enemy = makeBoss(m.selectedMapLevel, m.areaIndex, 'area');
  } else {
    enemy = makeMonster(m.selectedMapLevel, m.areaIndex, rng());
  }
  state.runtime.enemy = {
    name: enemy.name,
    level: enemy.level,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    attackBar: 0,
    stats: enemy.stats,
    expReward: enemy.expReward,
    goldReward: enemy.goldReward,
    boss: enemy.boss,
    enraged: false,
    bigHitTimer: enemy.boss ? BALANCE.boss[enemy.boss].bigHitEvery : undefined,
  };
  // Boss 戰開打前自動回滿狀態(HP/MP/技能 CD)(REQ §8):
  // 讓 Boss 是「滿狀態下的獨立 DPS/續航考驗」,血量好評估、也較合理(可設更難)。
  if (enemy.boss) {
    restoreCharacter(state);
    const cds = state.runtime.skillCooldowns;
    for (let i = 0; i < cds.length; i++) cds[i] = 0;
  }
  // 進場先攻:SPD 高者起手給半條 (REQ §5.2)
  const cs = charCombat(state);
  if (cs.eff.SPD >= enemy.stats.SPD) {
    state.runtime.charAttackBar = 0.5;
  } else {
    state.runtime.enemy.attackBar = 0.5;
  }
  return true; // 本 tick 新生成
}

function pushFloater(state: GameState, amount: number, crit: boolean, target: 'enemy' | 'char', magic = false) {
  state.runtime.floaters.push({ id: floaterId++, amount, crit, target, magic });
  if (state.runtime.floaters.length > 30) {
    state.runtime.floaters.splice(0, state.runtime.floaters.length - 30);
  }
}

/** 一次標準掉落判定(裝備 / 石頭 / 技能書);Boss 會多滾幾次 */
function rollDrops(state: GameState, rng: () => number, ilvl: number, dropBonus: number, dropMult: number): void {
  // 裝備掉落 (REQ §5.10 / §6.5):物品等級 = 怪物等級
  if (rng() < BALANCE.items.dropChance * dropBonus * dropMult) {
    addItemToInventory(state, generateItem(ilvl, rng));
  }
  // 石頭掉落 (REQ §6.7)
  if (rng() < BALANCE.stones.dropChance * dropBonus * dropMult) {
    const sid = rollStone(rng);
    state.inventory.stones[sid] = (state.inventory.stones[sid] ?? 0) + 1;
    state.runtime.invVersion++;
  }
  // 技能書掉落 (REQ §7.4):只掉未擁有的
  if (rng() < BALANCE.skills.bookDropChance * dropBonus * dropMult) {
    const sk = pickNewSkill(state.inventory.skillBooks, rng);
    if (sk) {
      state.inventory.skillBooks.push(sk);
      state.runtime.invVersion++;
    }
  }
}

/** 世界 Boss 獎勵 (REQ §8.3):保底高階升階石(階別依地圖等級)+ 隨機改造石 + 大量掉落 */
function worldBossReward(state: GameState, rng: () => number, ilvl: number): void {
  const W = BALANCE.boss.world;
  const ml = state.map.selectedMapLevel;
  // 保底升階石:地圖越高,保底石階別越高(低圖刷不到高階石,避免低圖洗高階)
  const upTier = ml < 25 ? 'rough' : ml < 50 ? 'normal' : ml < 75 ? 'fine' : 'perfect';
  state.inventory.stones[upTier] = (state.inventory.stones[upTier] ?? 0) + W.stoneCount;
  // 附帶 2 顆隨機改造石
  for (let k = 0; k < 2; k++) {
    const sid = rollStone(rng);
    state.inventory.stones[sid] = (state.inventory.stones[sid] ?? 0) + 1;
  }
  // 大量裝備掉落(背包滿了會自動停止,符合「滿了停掉落」規則)
  for (let k = 0; k < W.dropRolls; k++) {
    addItemToInventory(state, generateItem(ilvl, rng));
  }
  state.runtime.invVersion++;
}

/** 擊殺敵人:給經驗/金錢、掉落、推進關卡(小怪 / 區域 Boss / 世界 Boss) */
function onEnemyKilled(state: GameState, rng: () => number, dropBonus: number, expGainPct: number): void {
  const reward = state.runtime.enemy;
  const c = state.character;
  const m = state.map;
  if (reward) {
    // dev 倍率:經驗 / 掉落(開發者測試面板)+ 經驗獲取詞綴
    const dropMult = state.dev.dropMult;
    const expGain = Math.round(reward.expReward * state.dev.expMult * (1 + expGainPct));
    gainExp(c, expGain);
    c.gold += reward.goldReward;
    // 累計實際收益(供離線「近期速率」取樣)
    state.runtime.earnedGold += reward.goldReward;
    state.runtime.earnedExp += expGain;
    if (reward.boss === 'area') {
      // 區域 Boss:保底掉落 dropRolls 件(里程碑獎勵,不受低基礎掉落率影響)+ 一顆石頭
      for (let k = 0; k < BALANCE.boss.area.dropRolls; k++) {
        addItemToInventory(state, generateItem(reward.level, rng));
      }
      const sid = rollStone(rng);
      state.inventory.stones[sid] = (state.inventory.stones[sid] ?? 0) + 1;
      state.runtime.invVersion++;
    } else if (reward.boss === 'world') {
      worldBossReward(state, rng, reward.level);
    } else {
      rollDrops(state, rng, reward.level, dropBonus, dropMult); // 小怪:一般機率掉落
    }
  }
  state.runtime.totalKills += 1;

  // 關卡推進 (REQ §8.1)
  if (reward?.boss === 'world') {
    // 世界 Boss → 升一階地圖:怪物等級 +mapLevelStep(僅在前沿,刷低圖不被拉走)+ 回第一區
    if (m.selectedMapLevel >= m.mapLevel) {
      m.mapLevel += BALANCE.enemy.mapLevelStep;
      m.selectedMapLevel = m.mapLevel;
    }
    m.areaIndex = 0;
    m.monstersDefeated = 0;
  } else if (reward?.boss === 'area') {
    // 區域 Boss → 循環同一關卡:留在原區域重刷;否則進下一區(達 areaCount → 世界 Boss 待打)
    if (!state.settings?.loopStage) m.areaIndex += 1;
    m.monstersDefeated = 0;
  } else {
    // 小怪:累積到 monstersPerArea → 出現區域 Boss(關閉自動打王時上限封頂,不無限累加)
    m.monstersDefeated = Math.min(BALANCE.enemy.monstersPerArea, m.monstersDefeated + 1);
  }

  state.runtime.enemy = null;
}

/** 角色戰敗:退回當前關卡開頭刷怪 (REQ §5.5 B2) */
function onCharacterDefeated(state: GameState): void {
  // 敗給世界 Boss → 退回最後一區刷怪/再戰區域 Boss(否則會卡在世界 Boss 無法練功)
  if (state.runtime.enemy?.boss === 'world') {
    state.map.areaIndex = Math.max(0, BALANCE.enemy.areaCount - 1);
  }
  state.map.monstersDefeated = 0; // 退回區域開頭(重新出現區域 Boss 前要再清小怪)
  state.runtime.enemy = null;
  restoreCharacter(state);
}

/**
 * 主動技能施放 (REQ §7.2):依槽位順序,CD 到 + MP 足夠才放。
 * 回傳是否擊殺了敵人(killed → 本 tick 結束)。
 */
function castSkills(state: GameState, cs: CombatStats, rng: () => number): boolean {
  const enemy = state.runtime.enemy;
  if (!enemy) return false;
  const slots = state.skillSlots;
  const cds = state.runtime.skillCooldowns;
  const enemyArmour = armourFromDEF(enemy.stats.DEF);
  const cdMult = 1 - cs.cdrPct; // 冷卻減少

  for (let i = 0; i < slots.length; i++) {
    const id = slots[i];
    if (!id) continue;
    const def = SKILL_BY_ID[id];
    if (!def || def.kind !== 'active' || !def.active) continue;
    if ((cds[i] ?? 0) > 0) continue;
    const mp = def.mp ?? 0;
    if (state.runtime.charMp < mp) continue;
    const a = def.active;

    // 治療術:HP 夠高就不放(避免浪費 MP)
    if (a.healPctMaxHp != null) {
      if (state.runtime.charHp >= cs.maxHp * BALANCE.skills.healThreshold) continue;
      state.runtime.charMp -= mp;
      cds[i] = (def.cd ?? 0) * cdMult;
      const heal = Math.round(cs.maxHp * (a.healPctMaxHp ?? 0) + cs.mAtk * (a.healMatkMult ?? 0));
      state.runtime.charHp = Math.min(cs.maxHp, state.runtime.charHp + heal);
      continue;
    }

    // 傷害技能
    if (a.mult != null) {
      state.runtime.charMp -= mp;
      cds[i] = (def.cd ?? 0) * cdMult;
      const isMag = a.school === 'mag';
      const atk = isMag ? cs.mAtk : cs.pAtk;
      const hits = a.hits ?? 1;
      for (let h = 0; h < hits; h++) {
        const base = atk * a.mult;
        let raw = base * (1 - armourReduction(enemyArmour, base));
        const crit = rng() < cs.critChance;
        if (crit) raw *= cs.critMult;
        const dmg = Math.max(1, Math.round(raw));
        enemy.hp = Math.max(0, enemy.hp - dmg);
        pushFloater(state, dmg, crit, 'enemy', isMag);
        if (enemy.hp <= 0) {
          onEnemyKilled(state, rng, cs.dropBonus, cs.expGainPct);
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * 推進一個時間步。dt = 經過秒數。rng() ∈ [0,1)。
 */
export function tick(state: GameState, dt: number, rng: () => number): void {
  // dev:金錢 / 加工石 無限(每 tick 補滿)
  if (state.dev.infiniteGold) state.character.gold = DEV_INF_GOLD;
  if (state.dev.infiniteStones) {
    for (const st of STONE_LIST) state.inventory.stones[st.id] = DEV_INF_STONE;
  }
  // 新生成的敵人:本 tick 只生成、不打,讓 UI 先顯示「滿血登場」一幀(避免高 DPS 在生成幀就把 Boss 打掉一截)
  if (ensureEnemy(state, rng)) return;
  const enemy = state.runtime.enemy;
  if (!enemy) return;

  const c = state.character;
  const passive: FullPassive = aggregatePassives(state.skillSlots);
  const cs = characterCombat(c, state.equipment, passive);
  const charAtk = attackProfileOf(cs);
  const enemyAtk = profileFromStats(enemy.level, enemy.stats);
  const enemyArmour = armourFromDEF(enemy.stats.DEF);

  // --- HP / MP 隨時間回復(MP 受 INT 加速)+ 技能冷卻推進 ---
  state.runtime.charHp = Math.min(cs.maxHp, state.runtime.charHp + cs.hpRegen * dt);
  state.runtime.charMp = Math.min(cs.maxMp, state.runtime.charMp + cs.mpRegen * dt);
  for (let i = 0; i < state.runtime.skillCooldowns.length; i++) {
    state.runtime.skillCooldowns[i] = Math.max(0, (state.runtime.skillCooldowns[i] ?? 0) - dt);
  }

  // --- 角色普攻計時條 ---
  state.runtime.charAttackBar += dt / cs.attackInterval;
  while (state.runtime.charAttackBar >= 1) {
    state.runtime.charAttackBar -= 1;
    const r = resolveAttack(charAtk, enemyArmour, enemy.stats.DEX, rng);
    if (r.hit) {
      enemy.hp = Math.max(0, enemy.hp - r.amount);
      pushFloater(state, r.amount, r.crit, 'enemy');
      // 吸血 / 法力迴響(普攻觸發,REQ §7.5)
      if (passive.lifestealPct > 0) {
        state.runtime.charHp = Math.min(cs.maxHp, state.runtime.charHp + Math.round(r.amount * passive.lifestealPct));
      }
      if (passive.mpOnHit > 0) {
        state.runtime.charMp = Math.min(cs.maxMp, state.runtime.charMp + passive.mpOnHit);
      }
    }
    if (enemy.hp <= 0) {
      onEnemyKilled(state, rng, cs.dropBonus, cs.expGainPct);
      return;
    }
  }

  // --- 主動技能 ---
  if (castSkills(state, cs, rng)) return;

  // --- 敵人攻擊計時條(Boss:狂暴加速 + 週期重擊,REQ §8 機制)---
  const bossCfg = enemy.boss ? BALANCE.boss[enemy.boss] : null;
  if (bossCfg) {
    // 狂暴:HP 低於門檻一次性觸發 → 攻速提升
    if (!enemy.enraged && enemy.hp <= enemy.maxHp * bossCfg.enrageBelowHp) enemy.enraged = true;
    // 重擊計時(每 tick 遞減一次)
    enemy.bigHitTimer = (enemy.bigHitTimer ?? bossCfg.bigHitEvery) - dt;
  }
  const enemyInterval = attackInterval(enemy.stats.SPD) / (enemy.enraged && bossCfg ? 1 + bossCfg.enrageAtkSpdPct : 1);
  enemy.attackBar += dt / enemyInterval;
  while (enemy.attackBar >= 1) {
    enemy.attackBar -= 1;
    const r = resolveAttack(enemyAtk, cs.armour, cs.eff.DEX, rng);
    if (r.hit) {
      // Boss 週期重擊:計時到 → 本次傷害 ×bigHitMult
      let amount = r.amount;
      let big = false;
      if (bossCfg && (enemy.bigHitTimer ?? 1) <= 0) {
        big = true;
        amount = Math.round(amount * bossCfg.bigHitMult);
        enemy.bigHitTimer = bossCfg.bigHitEvery;
      }
      // 護甲(POE)後再吃硬減傷%
      const dmg = Math.max(1, Math.round(amount * (1 - cs.dmgReductionPct)));
      state.runtime.charHp = Math.max(0, state.runtime.charHp - dmg);
      pushFloater(state, dmg, r.crit || big, 'char');
      // 荊棘:反彈傷害 (REQ §7.5)
      if (passive.thornsPct > 0) {
        const reflect = Math.max(1, Math.round(dmg * passive.thornsPct));
        enemy.hp = Math.max(0, enemy.hp - reflect);
        pushFloater(state, reflect, false, 'enemy');
      }
    }
    if (state.runtime.charHp <= 0) {
      onCharacterDefeated(state);
      return;
    }
    if (enemy.hp <= 0) {
      onEnemyKilled(state, rng, cs.dropBonus, cs.expGainPct);
      return;
    }
  }
}

/** 給 UI 用:目前區域名稱 */
export function currentAreaName(state: GameState): string {
  return AREAS[state.map.areaIndex % AREAS.length].name;
}
