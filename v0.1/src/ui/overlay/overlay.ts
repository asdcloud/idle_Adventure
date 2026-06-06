// 收合態小視窗 renderer:畫狀態 + 跳傷害動效
// 不持有遊戲規則,只消費 main 推來的快照 (REQ §11.2)

interface Snapshot {
  level: number;
  gold: number;
  unspentPoints: number;
  charHp: number;
  charMp: number;
  charAttackBar: number;
  enemy: { name: string; hp: number; maxHp: number; level: number; boss?: 'area' | 'world'; enraged?: boolean } | null;
  map: { selectedMapLevel: number; areaIndex: number; monstersDefeated: number };
  floaters: { id: number; amount: number; crit: boolean; target: 'enemy' | 'char'; magic?: boolean }[];
  totalKills: number;
  derived: { maxHp: number; maxMp: number; area: string };
}

// window.game 型別見 ../env.d.ts(共用,由 preload 暴露)

const $ = (id: string) => document.getElementById(id)!;

const els = {
  lv: $('lv'),
  area: $('area'),
  hpFill: $('hpFill'),
  hpText: $('hpText'),
  mpFill: $('mpFill'),
  mpText: $('mpText'),
  enemyName: $('enemyName'),
  enemyHpFill: $('enemyHpFill'),
  enemyHpText: $('enemyHpText'),
  enemyAvatar: $('enemyAvatar'),
  progress: $('progress'),
  floaters: $('floaters'),
  hideBtn: $('hideBtn'),
  openBtn: $('openBtn'),
  arena: $('arena'),
  panel: $('panel'),
  offlineModal: $('offlineModal'),
  offlineBody: $('offlineBody'),
  offlineClaim: $('offlineClaim'),
};

/** 六區域對應的怪物 emoji(視覺辨識) */
const AREA_EMOJI = ['👹', '🔮', '🛡️', '🌪️', '🏹', '🎰'];

function pct(cur: number, max: number): string {
  if (max <= 0) return '0%';
  return Math.max(0, Math.min(100, (cur / max) * 100)).toFixed(1) + '%';
}

function render(s: Snapshot): void {
  els.lv.textContent = `Lv.${s.level}`;
  els.area.textContent = s.derived.area;

  // 角色側
  els.hpFill.style.width = pct(s.charHp, s.derived.maxHp);
  els.hpText.textContent = `${Math.ceil(s.charHp)}/${s.derived.maxHp}`;
  els.mpFill.style.width = pct(s.charMp, s.derived.maxMp);
  els.mpText.textContent = `${Math.ceil(s.charMp)}/${s.derived.maxMp}`;

  // 怪物側
  if (s.enemy) {
    const enr = s.enemy.enraged ? ' 🔥狂暴' : '';
    els.enemyName.textContent = `${s.enemy.name} Lv.${s.enemy.level}${enr}`;
    els.enemyHpFill.style.width = pct(s.enemy.hp, s.enemy.maxHp);
    els.enemyHpText.textContent = `${Math.ceil(s.enemy.hp)}/${s.enemy.maxHp}`;
    els.enemyAvatar.textContent = s.enemy.boss === 'world' ? '👑' : s.enemy.boss === 'area' ? '💀' : AREA_EMOJI[s.map.areaIndex % AREA_EMOJI.length];
    els.panel.classList.toggle('boss-fight', !!s.enemy.boss);
    els.panel.classList.toggle('world-boss', s.enemy.boss === 'world');
  } else {
    els.enemyName.textContent = '尋找中…';
    els.enemyHpFill.style.width = '0%';
    els.enemyHpText.textContent = '';
    els.panel.classList.remove('boss-fight', 'world-boss');
  }

  const monstersPerArea = 6;
  els.progress.textContent = `地圖 ${s.map.selectedMapLevel} · ${s.map.monstersDefeated}/${monstersPerArea} · 擊殺 ${s.totalKills}`;

  for (const f of s.floaters) {
    spawnFloater(f);
  }
}

function spawnFloater(f: Snapshot['floaters'][number]): void {
  const el = document.createElement('div');
  el.className = 'floater ' + f.target + (f.crit ? ' crit' : '') + (f.magic ? ' magic' : '');
  el.textContent = (f.target === 'char' ? '-' : '') + f.amount + (f.crit ? '!' : '');
  // 打怪 → 飄在右側(怪物側);角色受傷 → 飄在左側(角色側)
  const w = els.floaters.clientWidth || 220;
  const x =
    f.target === 'enemy' ? w * 0.55 + Math.random() * w * 0.3 : w * 0.1 + Math.random() * w * 0.3;
  el.style.left = x + 'px';
  el.style.top = 2 + Math.random() * 6 + 'px';
  els.floaters.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// --- 事件 ---
els.hideBtn.addEventListener('click', () => window.game.quit());
els.openBtn.addEventListener('click', () => window.game.openMain());
// 點兩下對戰區也可開主面板(REQ §11.2)
els.arena.addEventListener('dblclick', () => window.game.openMain());

els.offlineClaim.addEventListener('click', () => {
  els.offlineModal.classList.add('hidden');
});

window.game.onStateUpdate(render);

window.game.onOfflineReport((r) => {
  const mins = Math.floor(r.seconds / 60);
  els.offlineBody.innerHTML = `離線約 ${mins} 分鐘<br>金幣 +${r.gold}<br>經驗 +${r.exp}`;
  els.offlineModal.classList.remove('hidden');
});

// 初次載入先抓一次狀態
window.game.getState().then(render);

export {};
