# 放置養成冒險遊戲 — 技術架構文件

> 版本:v1
> 最後更新:2026-06-05
> 對應需求文件:REQUIREMENTS.md(v7)
> 狀態:架構規劃中(尚未開始實作)

---

## 0. 設計原則(底子)

1. **遊戲邏輯與畫面完全分離**
   - 核心模擬(屬性公式、戰鬥、掉落、加工、離線結算)是**純 TypeScript,零 Electron / 零 DOM 依賴**。
   - UI 只負責「畫狀態 + 收使用者輸入」,不放任何遊戲規則。

2. **單一資料來源(Single Source of Truth)**
   - 整個遊戲狀態收斂成一個 `GameState` 物件。所有變動透過核心層的函式,不在 UI 散落改狀態。

3. **時間驅動的可重播模擬**
   - 核心以「tick(時間步進)」推進。同一套 tick 邏輯**既跑線上即時、也跑離線快轉**(離線收益用估算,但走同一份規則的參數化版本)。

4. **數值集中、可調、可測**
   - 所有公式 / 平衡數值集中在 `core/formulas` 與 `data/`(設定表)。
   - 核心層可寫單元測試,驗證公式與戰鬥結果(呼應「數值要調好」)。

---

## 1. 技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| 桌面殼層 | **Electron** | 透明無邊框懸浮視窗、always-on-top、tray、本機存檔 |
| 語言 | **TypeScript** | 裝備詞綴/存檔/戰鬥狀態等複雜資料需要型別保護;頻繁調數值與重構時提前抓錯 |
| UI | **原生 HTML / CSS / JS(無框架)** | 桌寵規模不需 React;零依賴、啟動快、好除錯、好維護 |
| 編譯 | **esbuild** | 極輕量、極快、設定少;只把 TS 打包成 JS,不引重型工具鏈 |
| 測試 | **(待定,傾向 Vitest 或 node:test)** | 核心邏輯層單元測試 |

> 原則:UI 保持輕(原生),底子打扎實(TS + 分層 + 可測試)。

---

## 2. 行程模型(Electron)

Electron 有兩種行程,職責分明:

### Main process(主行程)
- 建立 / 管理視窗:**收合態小視窗** + **主視窗**。
- 視窗特性:小視窗無邊框、透明、always-on-top、可拖曳。
- **系統匣 tray**:關窗縮到 tray 繼續掛機,tray 選單真正退出。
- **存檔讀寫**:讀寫 userData 目錄的 JSON。
- **遊戲核心的執行宿主**:核心模擬跑在 main(或 main 控制的計時迴圈)中,確保「即使小視窗在動畫、邏輯也穩定推進」。
- 透過 **IPC** 把最新 `GameState` 快照推給 renderer 畫,接收 renderer 的操作指令(分配點數、換裝、加工、配技能、選地圖…)。

### Renderer process(渲染行程)
- 只做兩件事:**把收到的狀態畫出來** + **把使用者操作丟回 main**。
- 兩個畫面:
  - 收合態小視窗 UI(緊湊面板 + 跳傷害動效)
  - 主視窗 UI(角色 / 背包+裝備 / 加工 / 技能 / 地圖 / 設定 六分頁;設定頁含開發者測試面板)
- **不持有遊戲規則**,不直接改核心狀態。

### IPC 介面(初版草案)
```
main → renderer:
  state:update   (推送 GameState 快照,小視窗高頻、主視窗按需)
  offline:report (回到遊戲時的離線結算結果)

renderer → main:
  action:allocateStat   分配自由屬性點
  action:respec         金幣洗點
  action:equip / unequip 換裝
  action:craft          升階加工(選裝備+升階石)
  action:useStone       改造石(做裝通貨,改現有詞綴)
  action:sell / sellMany / discardMany  販賣 / 批量販賣 / 批量丟棄(跳過★我的最愛,REQ §6.11)
  action:toggleFavorite 切換★我的最愛(批量販賣/丟棄會跳過)
  action:setSkillSlot   配置技能槽
  action:selectMap / selectArea  選地圖等級 / 指定刷某區域(REQ §8.6)
  action:setAutoBoss / setLoopStage  自動打王 / 循環同一關卡 開關(REQ §12.1)
  action:expandInventory 花金幣擴充背包格
  window:openMain / closeMain / drag / quit
  // 開發者測試面板(設定頁輸入碼解鎖,REQ §12)
  dev:reset             一鍵重置角色資料(保留 dev 倍率)
  dev:clearInventory    一鍵清空倉庫
  dev:setExpMult        設定經驗倍率(0.25~1000)
  dev:setDropMult       設定掉落倍率(0.25~1000)
  dev:setInfiniteGold / dev:setInfiniteStones  金錢無限 / 加工石無限 開關(每 tick 補滿)
```

---

## 3. 三層分層

```
┌──────────────────────────────────────────────┐
│  shell/   Electron 殼層 (main process)          │
│   - 視窗、tray、IPC、存檔 I/O、主迴圈計時        │
├──────────────────────────────────────────────┤
│  ui/      渲染層 (renderer)                      │
│   - overlay 小視窗 / main 主視窗分頁             │
│   - 只 render 狀態 + 發 action,無遊戲規則        │
├──────────────────────────────────────────────┤
│  core/    遊戲核心 (純 TS,無 Electron/DOM)      │
│   - 狀態、公式、戰鬥、掉落、加工、離線結算       │
│   - 可獨立測試 ← 專案底子                        │
├──────────────────────────────────────────────┤
│  data/    靜態設定表 (數值/詞綴/敵人/掉落表)     │
│   - 與程式分離的可調平衡資料                     │
└──────────────────────────────────────────────┘
```

---

## 4. 專案目錄結構(規劃)

```
GAME/
├─ REQUIREMENTS.md
├─ ARCHITECTURE.md
├─ package.json
├─ tsconfig.json
├─ esbuild.config.mjs
│
├─ src/
│  ├─ core/                  # 純 TS 遊戲核心(無 Electron/DOM)
│  │  ├─ state/
│  │  │  ├─ GameState.ts      # 整體狀態定義(SSOT;含 settings 自動打王/循環關卡)
│  │  │  └─ defaults.ts       # 新檔初始狀態(含新手起始裝、SAVE_VERSION=7)
│  │  ├─ formulas/
│  │  │  ├─ derived.ts        # HP/MP/攻擊/減傷/命中/爆擊/攻速(REQ §4)
│  │  │  └─ leveling.ts       # 升級曲線(凹型「打怪數」主軸)、保底成長、自由點、怪物經驗/掉金(REQ §6.11)
│  │  ├─ combat/
│  │  │  ├─ engine.ts         # DPS tick + 關卡推進(mapPhase 受 autoBoss/loopStage)+ Boss 開打回滿/狂暴/週期重擊 + 掉落/世界王獎勵(REQ §5/§8)
│  │  │  ├─ damage.ts         # 傷害公式(物理+魔法、命中、爆擊、減傷)
│  │  │  └─ skills.ts         # 主動 CD+MP 觸發、被動常駐(REQ §7)
│  │  ├─ items/
│  │  │  ├─ types.ts          # 裝備/詞綴/稀有度/石頭 型別(REQ §6)
│  │  │  ├─ generate.ts       # 掉落生成:稀有度、物品等級→詞綴Tier、前後綴
│  │  │  ├─ affixes.ts        # 詞綴定義與套用
│  │  │  ├─ crafting.ts       # 升階加工:石頭+金錢、成功率、保底、晉升;加工費=物等×總加工次數指數(craftCostOf,升階+改造共用);背包+身上裝備皆可加工(REQ §6.11)
│  │  │  ├─ modify.ts         # 改造石(做裝通貨,8 顆):消前/後綴、群組重鑄、前/後綴精煉(Tier 交換,需真實取捨);收金幣(craftCostOf)+ 計入總加工次數(REQ §6.10/§6.11)
│  │  │  ├─ value.ts          # 販賣價:物等+稀有度+詞綴數+Tier(REQ §6.11)
│  │  │  ├─ equip.ts          # 裝/卸/丟棄/販賣、批量、我的最愛、findItemById(背包+裝備格)、雙持、2H 佔兩格
│  │  │  └─ describe.ts       # Item/石頭 → UI 視圖(含 sellValue/詞綴數/稀有度排序/favorite/equipSlots)(讓 UI 不懂規則)
│  │  ├─ loot/
│  │  │  └─ dropTable.ts      # 線上 / 離線(獨立池)掉落邏輯(REQ §5.10/§10.5)
│  │  ├─ map/
│  │  │  └─ enemy.ts          # 六區域、小怪屬性曲線(低等緩坡 + 高等 HP 非線性遞減)、makeMonster / makeBoss(區域+世界王)(REQ §8)
│  │  │  (離線結算實作於 shell/main.ts:近期 3 分鐘速率取樣 + 不足以簡單版補,REQ §10.1)
│  │  └─ index.ts             # 核心對外 API(供 shell 呼叫)
│  │
│  ├─ data/                  # 可調平衡資料(與程式分離)
│  │  ├─ balance.ts           # 公式係數、效率%、上限、加工費、enemy/boss 數值、economy(掉金/售價/掉落率)…
│  │  ├─ affixes.ts           # 詞綴清單 + 各 Tier 數值範圍
│  │  ├─ skills.ts            # 完整技能清單
│  │  ├─ enemies.ts           # 六區域怪物特性 / Boss / 世界Boss
│  │  ├─ stones.ts            # 石頭種類與掉落權重
│  │  └─ uniques.ts           # 紅裝(定製傳奇)清單
│  │
│  ├─ shell/                 # Electron main process
│  │  ├─ main.ts              # app 入口、視窗建立、主迴圈
│  │  ├─ windows.ts           # overlay / main 視窗設定
│  │  ├─ tray.ts              # 系統匣
│  │  ├─ save.ts              # 存檔讀寫(userData JSON)
│  │  └─ ipc.ts               # IPC 註冊(state:update / action:*)
│  │
│  ├─ preload/
│  │  └─ preload.ts           # 安全暴露 IPC 給 renderer(contextBridge)
│  │
│  └─ ui/                    # renderer(原生 HTML/CSS/JS)
│     ├─ overlay/
│     │  ├─ overlay.html
│     │  ├─ overlay.css
│     │  └─ overlay.ts        # 收合態小視窗:畫狀態 + 跳傷害動效
│     └─ main/
│        ├─ main.html
│        ├─ main.css
│        └─ tabs/             # 角色 / 背包裝備 / 加工 / 技能 / 地圖 / 設定(含 dev 面板)
│
├─ assets/                   # 圖示、音效(待美術)
└─ dist/                     # esbuild 輸出
```

---

## 5. 遊戲狀態(GameState 草案)

整個遊戲收斂成一個可序列化(JSON-able)的物件,直接對應存檔:

```
GameState {
  version: number              // 存檔版本(供日後遷移)
  character: {
    level, exp,
    baseStats: { STR, INT, DEF, DEX, SPD, LUK }   // 含保底成長
    allocated: { STR, INT, DEF, DEX, SPD, LUK }   // 玩家分配的自由點
    unspentPoints: number
    gold: number
    respecCount: number        // 洗點次數(若費用遞增用)
  }
  equipment: { mainHand, offHand, helmet, chest, gloves, boots, ring1, ring2 }
  inventory: {
    items: Item[]              // 裝備
    stones: { [stoneId]: count }
    skillBooks: SkillId[]
  }
  skillSlots: [SkillId|null, SkillId|null, SkillId|null]
  mapProgress: {
    mapLevel: number           // 連續(可 >100)
    selectedMapLevel: number   // 玩家當前選擇要打的地圖等級
    areaIndex: number          // 目前第幾區域 (0..5)
    stageProgress: ...         // 小怪進度 / Boss 狀態
    worldBossUnlocked: boolean
  }
  runtime: {                   // 不一定要存,或存最小集
    currentEnemy, charHp, charMp,
    attackBars: { char, enemy }
    skillCooldowns: ...
    invVersion: number         // 背包/裝備版本(UI 依此才重畫)
    earnedGold / earnedExp     // 累計實際收益(離線近期速率取樣用)
  }
  settings: { autoBoss, loopStage }            // 玩家設定
  dev: { expMult, dropMult, infiniteGold, infiniteStones }  // 開發者測試(設定頁解鎖,REQ §12)
  lastSeenTimestamp: number    // 離線結算基準
  offline: { goldPerSec, expPerSec }           // 離線速率快照(近期3分;§10.1)
}
```

> Item 內含:base 類型、稀有度、itemLevel、prefixes[]、suffixes[]、craftCount、(紅裝 uniqueId)。

---

## 6. 主迴圈與離線結算

### 線上主迴圈
- main process 以固定頻率 tick(例如每 100ms,或用 delta time)。
- 每 tick:推進攻擊計時條 → 判定出手 → 戰鬥結算 → 掉落 → 經驗/升級 → 區域推進。
- 狀態快照經 IPC 推給 overlay(高頻畫面)與 main 視窗(開啟時)。

### 離線結算(shell/main.ts,已實作)
- 啟動時讀 `lastSeenTimestamp`,算離線秒數(上限 8h)。
- 速率 = `state.offline`(存檔時由「近期 3 分鐘實際速率」快照;不足 3 分以簡單版 `1+等級×0.3` 補)× 離線秒數 × 效率 70% → 金幣/經驗(經驗走 `gainExp` 立即結算升級)。
- 只給金幣/經驗,**不掉裝備/石頭、不推進地圖**(§10.2)。
- **不推進 Boss / 地圖**。
- 產生 `offline:report` 給 UI 跳結算視窗。

---

## 7. 存檔策略

- 格式:JSON(GameState 序列化),不加密。
- 位置:Electron `app.getPath('userData')`。
- 時機:每 30 秒 + 視窗關閉(縮 tray)+ app 真正退出。
- **存檔版本欄位**:`GameState.version`,日後結構變更可寫遷移函式,不讓舊存檔壞掉。
- 寫檔用「先寫暫存檔再 rename」避免寫到一半當機損毀存檔。

---

## 8. 建置與執行(規劃,尚未實作)

```
npm install            # 安裝 electron / esbuild / typescript
npm run build          # esbuild 打包 core/shell/preload/ui → dist
npm run dev            # watch 模式 + 啟動 electron
npm run test           # 核心邏輯單元測試
npm run package        # 打包成可執行檔(待選 electron-builder 等)
```

> 前置需求:**本機需安裝 Node.js**(目前環境尚未安裝,進實作前需先處理)。

---

## 9. 實作里程碑(建議順序,先骨架後血肉)

1. **M0 環境**:裝 Node.js、初始化 package/tsconfig/esbuild、Electron 跑出一個透明懸浮視窗。
2. **M1 核心骨架**:GameState + 屬性公式 + 升級;寫公式單元測試。
3. **M2 戰鬥**:DPS tick 戰鬥引擎(先打固定假怪),overlay 顯示 HP/敵人/跳數字。
4. **M3 地圖推進**:區域 / Boss / 世界Boss / 地圖等級。✅ 已完成(難度曲線+區域王+世界王+機制+獎勵;見 DEV_LOG 2026-06-06)。
5. **M4 掉落+背包+裝備**:掉裝、背包+裝備合併頁、換裝影響數值。
6. **M5 加工**:石頭+金錢升階、成功率/保底/晉升。
7. **M6 技能**:技能書、3 槽配置、主動/被動接進戰鬥。
8. **M7 存檔+離線**:存讀檔、離線結算視窗、tray。
9. **M8 平衡與內容**:填 data/ 各表(敵人/詞綴/技能/掉落),調數值。🔄 進行中(難度曲線 + 經濟系統 §6.11 已做:掉金/售價/加工費/掉落率;見 DEV_LOG 2026-06-06)。
10. **M9 打包**:做成可執行檔。

> 前 7 個里程碑把「底子」立起來,M8 之後才是大量填數值與內容。

---

## 變更紀錄
- v1 (2026-06-05):初版架構。確立三層分層(core/ui/shell + data)、技術選型(Electron + TypeScript + 原生UI + esbuild)、Electron 雙行程模型與 IPC 草案、目錄結構、GameState 草案、主迴圈/離線結算、存檔策略、建置流程、實作里程碑 M0~M9。
- v2 (2026-06-05):補實作後架構。GameState 加 `equipment / inventory(含 cap)/ skillSlots / dev / runtime.invVersion`(存檔版本到 v5,save.ts 有 migrate);IPC 補 `equip/unequip/discard/expandInventory/setSkillSlot` 與開發者 `dev:reset/clearInventory/setExpMult/setDropMult`;主視窗六分頁(加「設定」含開發者測試面板,REQ §12);退出策略改「關閉=完全退出」(取消 tray、加單一實例鎖)。詳見 DEV_LOG。
