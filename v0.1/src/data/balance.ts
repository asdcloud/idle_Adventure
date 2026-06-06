// 可調平衡數值 — 與程式邏輯分離,方便狂調數值
// 對應 REQUIREMENTS.md 第 3、4 章

export const BALANCE = {
  /** 屬性起始值 (Lv1 六屬性皆 5) */
  startingStat: 5,
  /** 角色等級上限 */
  maxLevel: 100,

  /** 升級成長 */
  leveling: {
    /** 每級六屬性各 +n 保底(角色的「底子」floor) */
    guaranteedPerStat: 1,
    /** 每級給的自由分配點(天賦;影響刻意壓低,主力交給裝備+技能) */
    freePointsPerLevel: 2,
    /** 每逢此倍數的等級,自由點改給 milestonePoints */
    freePointsMilestoneEvery: 5,
    freePointsMilestone: 5,
    // --- 升級曲線(以「同級怪要打幾隻才升一級」為設計主軸,凹型減速)---
    // killsToLevel(L) = killStart × ratioStart^(L-1) × ratioGrow^((L-1)(L-2)/2)
    // ratioGrow 由程式反推,使「最後一次升級(L99→100)恰好 = killCap」。
    // killRatioStart 設較高(>幾何平均)→ ratioGrow<1 → 前期倍率高、後期逐級趨緩(凹型)。
    /** Lv1 升級約需打幾隻同級怪 */
    killStart: 10,
    /** 最後一次升級(L99→100)約需的打怪數(cap 落在最後一級;數字可調) */
    killCap: 100000,
    /** 前期每級倍率(L1→L2),之後逐級「縮小」→ 前陡後緩 */
    killRatioStart: 1.15,
    // --- 同級怪每隻給的經驗(緩和指數,讓經驗數字不爆但也非線性)---
    monExpBase: 5,
    monExpGrowth: 1.05,
  },

  /** 洗點費用 (REQ §3,費用規則暫定:遞增) */
  respec: {
    /** 基礎費 */
    baseCost: 50,
    /** 每等級加成 */
    perLevel: 5,
    /** 每洗一次後續更貴 */
    perRespec: 25,
  },

  /** 衍生數值公式係數 (REQ §4) */
  derived: {
    hp: { flat: 50, perLevel: 13, perSTR: 4, perDEF: 7 },
    mp: { flat: 20, perLevel: 3, perINT: 5 },
    /** 物理攻擊(普攻 + 物理技能) */
    pAtk: { flat: 5, perSTR: 2, perLevel: 1 },
    /** 魔法攻擊(只走技能;與物攻同基底,魔法的補償走「技能倍率」與「魔攻詞綴」)*/
    mAtk: { flat: 5, perINT: 2, perLevel: 1 },
    /** 命中:base + (myDEX - enemyDEX)*perDex,夾 [min,max](DEX 同時當命中/閃避) */
    hit: { base: 0.85, perDex: 0.006, min: 0.4, max: 0.99 },
    /** 爆擊率:base + DEX*perDex(只來自 DEX,且很小),上限 cap */
    crit: { base: 0.05, perDex: 0.0008, cap: 0.5 },
    /** 爆擊傷害倍率:base + LUK*perLuk(爆傷只來自 LUK) */
    critDmg: { base: 1.5, perLuk: 0.02 },
    /**
     * 攻擊間隔(秒):interval = baseInterval / (1 + SPD*perSpd) / (1+攻速%),下限 minInterval。
     * perSpd 調低(0.02→0.01):自帶 SPD 不再輕鬆觸頂 → 拉低物攻下限;攻速主要靠「攻速%詞綴」投資。
     * minInterval 0.5→0.25:提高上限,重度投資攻速可達每 0.25s 一擊。
     */
    speed: { baseInterval: 2.0, perSpd: 0.012, minInterval: 0.25 },
    /** 掉落加成:1 + LUK*perLuk */
    drop: { perLuk: 0.01 },
    /**
     * 回復(每秒):
     * HP = 最大HP × hpBasePct(小 base,隨等級自然增加)+ 裝備詞綴 flat
     * MP = 最大MP × mpBasePct + INT × mpPerINT(INT 加速魔力回復 → 魔法職業續航)
     */
    regen: { hpBasePct: 0.006, mpBasePct: 0.015, mpPerINT: 0.05 },
  },

  /** 怪物等級換算 (REQ §8.4) */
  enemy: {
    /** 怪物等級 = 地圖等級 ± 浮動值 */
    levelVariance: 2,
    /** 區域 Boss = 怪物等級 + n */
    bossBonus: 3,
    /** 每區域小怪數量 */
    monstersPerArea: 6,
    /** 區域數量 */
    areaCount: 6,
    /** 擊敗世界 Boss 升一階地圖時,怪物等級提升量(+5:讓怪等跟得上角色升級速度) */
    mapLevelStep: 5,
    // --- 小怪屬性曲線(2026-06-06 重調,對「合理裝備同級玩家」≈中等壓力)---
    // ref = statFlat + statSlope×等級;強化屬性 ×emphMult、其餘 ×*Mult
    statFlat: 4,
    statSlope: 1.5,
    emphMult: 1.3,
    otherMult: 0.85, // STR/INT/DEX 非強化
    defMult: 0.9,
    spdMult: 0.4, // 壓低:避免高等怪攻速過快讓 DPS 超線性(長戰才撐得住)
    lukMult: 0.5,
    /** 小怪 HP = maxHp(等級, 屬性) × hpMult × 高等遞減(hpTaper)。2.4→2.0:配合 SPD 調整後較低的玩家 DPS,縮短戰鬥 */
    hpMult: 2.4,
    /** 高等級 HP 遞減(非線性,REQ §8.4):effHpMult = hpMult × (1 - min(hpTaperMax, (等級-hpTaperFrom)×hpTaperPer)) */
    hpTaperFrom: 40,
    hpTaperPer: 0.004,
    hpTaperMax: 0.25,
    // --- 低等級非線性緩坡(新手友善:naked/初始裝也打得動,到 rampLevel 才全強度)---
    earlyRampLevel: 20, // 到此等級怪物恢復 100% 強度
    earlyMinScale: 0.5, // Lv1 怪物強度比例(屬性與 HP 皆乘上此緩坡)
  },

  /** Boss (REQ §8) —— 數值強化 + 少量機制 */
  boss: {
    // 註:Boss 開打前玩家自動回滿(見 engine),故 Boss 是「滿狀態獨立考驗」,數值可較硬。
    area: {
      levelBonus: 2, // 等級 = 地圖等級 + 此
      hpMult: 4.0, // 在小怪 HP 基礎上再 ×(boss 是 HP 牆)
      atkMult: 1.15, // 攻擊屬性 ×
      defMult: 1.2, // DEF ×
      expMult: 6,
      goldMult: 5,
      enrageBelowHp: 0.4, // HP 低於此比例 → 狂暴
      enrageAtkSpdPct: 0.35, // 狂暴:攻速 +%
      bigHitEvery: 7, // 每幾秒一次重擊
      bigHitMult: 2.0, // 重擊倍率
      dropRolls: 3, // 額外掉落次數
    },
    world: {
      levelBonus: 4,
      hpMult: 7,
      atkMult: 1.18,
      defMult: 1.38,
      expMult: 20,
      goldMult: 18,
      enrageBelowHp: 0.4,
      enrageAtkSpdPct: 0.4,
      bigHitEvery: 6,
      bigHitMult: 2.1,
      dropRolls: 8, // 大量掉落
      stoneCount: 5, // 保底高階升階石數量(階別依地圖等級)
    },
  },

  /** 裝備 / 掉落 (REQ §6) */
  items: {
    /**
     * 每殺一隻的基礎掉落機率(再乘 LUK/詞綴掉落加成 × dev 倍率)。
     * 設計:怪物等級只決定「物品等級」,不加快出現速度;出現速度由掉落率決定。
     * 0.022 ≈ 完全沒加掉落率時,以中段刷怪速度約 4~8 分鐘掉一件(見 §8/§6.9)。
     */
    dropChance: 0.022,
    /** 背包基礎上限(可用金幣擴充,見 expand)。滿了就停止掉落 */
    inventoryCap: 120,
    /** 花金幣擴充背包格(費用隨次數遞增) */
    expand: {
      slotsPerBuy: 20, // 每次 +20 格
      baseCost: 300, // 第一次費用
      costPerBuy: 200, // 每買一次後續再 +200
      maxCap: 400, // 容量上限
    },
    /** 稀有度掉落權重(白最常見,橙極稀有) */
    rarityWeights: { common: 50, magic: 30, rare: 14, epic: 5, legendary: 1 },
    /** 稀有度 → 詞綴總數範圍 [min, max] (REQ §6.3) */
    affixCount: {
      common: [0, 1],
      magic: [1, 2],
      rare: [3, 4],
      epic: [4, 5],
      legendary: [5, 6],
    },
    /** 前綴 / 後綴各自上限 (REQ §6.4) */
    prefixCap: 3,
    suffixCap: 3,
    /** T(n) 數值 = t1max × tierFactor^(n-1) */
    tierFactor: 0.7,
    /** 滾值下限 = tierMax × tierRollMin(上限即 tierMax);放寬→單Tier內更隨機 */
    tierRollMin: 0.65,

    // --- 基底數值預算(隨物等線性)---
    weaponBudget: { flat: 6, perIlvl: 2.2 }, // 1H 攻擊預算基準
    twoHandMult: 1.8, // 2H 攻擊預算 ×
    armourBudget: { flat: 8, perIlvl: 2.8 }, // 護甲值預算基準(提高:護甲為主要 tank 手段)
    ringStat: { flat: 3, perIlvl: 0.6 }, // 飾品單一屬性

    /**
     * 各物品基底配比:
     * phys/mag = 佔「攻擊預算」比例;armour = 佔「護甲預算」比例;
     * atkSpdPct/cdrPct = 固定值(匕首攻速、法球冷卻減少)。
     */
    baseProfile: {
      sword1h: { phys: 1.0 },
      dagger: { phys: 0.7, atkSpdPct: 0.12 },
      lance: { phys: 0.75, armour: 0.5 },
      wand: { mag: 1.0 },
      scepter: { phys: 0.6, mag: 0.6 },
      sword2h: { phys: 1.0 },
      staff: { mag: 1.0 },
      longstaff: { phys: 0.6, mag: 0.6 },
      shield: { armour: 1.0 },
      orb: { mag: 0.3, cdrPct: 0.1 },
      helmet: { armour: 0.6 },
      chest: { armour: 1.0 },
      gloves: { armour: 0.45 },
      boots: { armour: 0.45 },
    } as Record<string, { phys?: number; mag?: number; armour?: number; atkSpdPct?: number; cdrPct?: number }>,

    /** DEF 屬性 → 護甲值(邊際遞減):armour = DEF^exp × k(exp 提高→高等護甲較跟得上) */
    defArmour: { exp: 0.9, k: 2.4 },
    /** 護甲減傷:reduction = armour / (armour + K × 來襲傷害) */
    armourK: 3.0,

    /**
     * Tier 機率(取代硬門檻):
     * 期望Tier = max(1, 5 - ilvl/spread);實際 = round(期望 + 高斯(0,jitter)),
     * 夾在 [1, 5 - floor(max(0,ilvl-overflowStart)/overflowPer)]。
     * spread=44 → ilvl100 期望≈2.7、T1≈15%(中物等仍有低機率 T1、整體更散);高物等才偏高 Tier。
     */
    tier: { spread: 44, jitter: 1.2, overflowStart: 100, overflowPer: 30 },
  },

  /** 加工 / 升階 (REQ §6.6) */
  crafting: {
    /** 加工費 = baseCost × (1 + 物等×ilvlCostCoef) × costMult^(總加工次數:升階+改造皆計) */
    baseCost: 60,
    // 1.5:總加工次數現含改造石(做裝會反覆改),指數放緩讓多次加工仍可負擔(但越改越貴)
    costMult: 1.5,
    /** 物等對基礎費的加成係數(物等越高基礎費越貴) */
    ilvlCostCoef: 0.08,
    /** 各「目標稀有度」的基礎成功率(放置友善:失敗不降級、不損壞) */
    successRate: { magic: 0.9, rare: 0.7, epic: 0.5, legendary: 0.3 },
    /** 失敗保底:每次失敗 +pityStep 成功率(成功後歸零) */
    pityStep: 0.1,
    /** 每次成功升階追加的詞綴數 [min, max] */
    affixAddMin: 1,
    affixAddMax: 2,
  },

  /** 石頭掉落 (REQ §6.7) */
  stones: {
    /** 每殺一隻掉石頭的機率 */
    dropChance: 0.12,
  },

  /** 經濟系統 (REQ §6.11) —— 金錢掉落 + 販賣價(公式可非線性) */
  economy: {
    /** 怪物掉金(非線性):gold = round(goldFlat + goldCoef × 等級^goldExp) */
    goldFlat: 2,
    goldCoef: 1.2,
    goldExp: 1.3,
    /** 販賣價基礎(隨物等非線性):base = sellFlat + sellCoef × 物等^sellExp */
    sellFlat: 4,
    sellCoef: 1.0,
    sellExp: 1.15,
    /** 稀有度倍率 */
    sellRarityMult: { common: 1, magic: 1.6, rare: 2.6, epic: 4, legendary: 6 } as Record<string, number>,
    /** 每條詞綴 +sellPerAffix;每點 TierScore(=Σ(6-tier),T1=5…T5=1)+sellPerTierScore */
    sellPerAffix: 0.12,
    sellPerTierScore: 0.05,
    /** 販賣價下限 */
    sellFloor: 1,
  },

  /** 技能 (REQ §7) */
  skills: {
    /** 每秒回復 最大MP × 此比例(讓主動技能能持續施放) */
    mpRegenPct: 0.04,
    /** 每殺一隻掉技能書的機率(只掉未擁有的) */
    bookDropChance: 0.04,
    /** 治療術自動施放門檻:HP 低於 最大HP × 此值才放(避免浪費) */
    healThreshold: 0.85,
  },
} as const;
