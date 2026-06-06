# 開發日誌 (Dev Log)

> 放置養成冒險遊戲 — 桌面懸浮視窗
> 相關文件:[REQUIREMENTS.md](REQUIREMENTS.md)(需求規格)、[ARCHITECTURE.md](ARCHITECTURE.md)(技術架構)
>
> **格式說明**:本檔為持續累積的開發日誌,**最新進度寫在最上面**(倒序)。
> 每次有實質進展就新增一個 `## YYYY-MM-DD` 區塊;同一天多筆可在該區塊下用 `###` 分項。
> 區塊內建議含:做了什麼、為什麼、遇到的問題與解法、產出物、下一步。

---

## 目前狀態總覽

> (此區塊隨開發更新,反映「現在」的快照)

- **版本**:v0.1(骨架)
- **平台**:Electron + TypeScript + 原生 HTML/CSS/JS,esbuild 打包
- **可執行檔**:Windows x64 免安裝版 `v0.1/release/IdleAdventure-v0.1-win-x64.zip`
- **已能跑的核心循環**:自動戰鬥(DPS制)→ 經驗/金錢 → 升級(保底+自由點)→ 區域/地圖推進 → 存檔 → 離線結算
- **主視窗(展開態五分頁)已完成**:角色(屬性/衍生數值/分配點/洗點)、地圖(選等級/六區域進度)可實際操作;背包·裝備、加工、技能為**版面預覽 + 空狀態**(待 M4/M5/M6 系統補資料)。懸浮視窗可點 ⛶ 或雙擊對戰區開啟。
- **里程碑進度**(對應 ARCHITECTURE §9):
  - [x] M0 環境 + 透明懸浮視窗
  - [x] M1 核心骨架(GameState + 屬性公式 + 升級)
  - [x] M2 戰鬥(DPS tick + overlay 顯示 + 跳數字)
  - [x] M3 地圖推進(簡化版:6 區域循環,地圖等級 +1)
  - [x] M4 掉落 + 背包 + 裝備(詞綴 / 稀有度 / 物品等級 Tier / 換裝影響數值)
  - [x] M5 加工(石頭 + 金錢升階、成功率 + 失敗保底、稀有度晉升、指定前後綴石)
  - [x] M6 技能(技能書掉落、3 槽配置、主動 CD+MP 自動施放、被動常駐)
  - [x] M7 存檔 + 離線(基本版,離線收益用粗估)
  - [ ] M8 平衡與內容(填 data 表)
  - [ ] M9 打包(Windows 免安裝版已可,正式 installer 待)

---

## 2026-06-06

### 新增 2 顆 tier 交換改造石

- **前綴精煉石** `tierTradePrefix`(提升一條前綴 Tier、降一條後綴 Tier)、**後綴精煉石** `tierTradeSuffix`(反向)。
- `StoneDef` 加 `raiseSide`/`lowerSide`;`modify.ts` 加 `shiftTierOnSide`(dir -1 提升/+1 降低,偏好可變動者,重滾該 Tier 值)+ useModifyStone 分支(**需同時有前綴與後綴**,否則擋下)。詞綴數不變 → 不影響稀有度。
- 走既有 modify 流程:kind 'modify' → 自動顯示為加工頁改造石鈕、走 useStone IPC、**收金幣**(craftCostOf)、計入總加工次數;掉落 dropWeight 5。改造石 6→8 顆。
- 驗證:patk T3→T2(值↑)+ armour T3→T4(值↓);反向石反向;只有前綴 → 擋下「需同時有前綴與後綴」。`tsc` 全綠。
- **平衡評估(回應「會不會太強」)**:發現漏洞——把單一犧牲側洗到 T5 後,精煉石變「免費升主詞綴」(只剩金幣門檻)。修法:精煉石需同時存在「可提升(T>1)」與「可降低(T<5)」對象才生效 → 每次都是真實 Tier 交換,無免費升級。整體做裝系統由**指數金幣費用**把關(每件 perfect 需大量金幣),每顆石頭都有取捨(消除/替換/交換),判定為平衡;不再加新石頭(14 顆已足,避免決策臃腫)。驗證:主詞綴到 T1 或犧牲側到 T5 → 後續精煉被擋。

---

### 再降 SPD + 護甲強化(以護甲彌補攻速損失)

- 使用者:SPD 還是太快 → 再降占比;改用**護甲**彌補 SPD 降低的強度損失;護甲應比生命更好撐。
- `speed.perSpd 0.018→0.012`:自帶 SPD 更慢(SPD100≈0.91s),攻速幾乎全靠攻速%詞綴投資。
- **護甲全面強化**:`armourBudget 6/2.0→8/2.8`(所有護甲基底↑)、護甲詞綴 `armour 80→115 / armourpct 0.2→0.3 / dmgred 0.1→0.12`、`defArmour.k 2.0→2.4`(DEF→護甲↑)。→ epic 物理護甲 L40≈1110 / L99≈1792(約 60% 減傷),護甲成為主要 tank 手段、效益優於純堆血。
- 效果:SPD 變慢使戰鬥變長,但護甲讓玩家撐得住 → **高等小怪致死率 13%→2%**(不靠降難度,而靠 tank);世界王仍可過;DPS 魔/物 96-127%(物理略降→魔法相對更接近)。
- `tsc` 全綠。數值待實機微調。

---

### 魔法/物理平衡 + SPD 攻速 + 非線性怪物 HP(大平衡)

模擬全程以「穿裝玩家」為準(物理 sword1h+rare/epic、魔法 wand+rare/epic、皆帶治療)。

- **魔法太弱(原 69-89%)→ 修正至 ~87-110%**(物理有免費普攻、魔法純技能且偏 burst):
  - **魔攻詞綴調強**(補償「魔法增幅維度少 + CD 長」):matk 40→46、matkpct 0.3→0.4、wpnmag 0.5→0.6、int 12→14(皆高於物理對應詞綴)。
  - **短CD填補技能**(解決魔法輸出不平滑/bursty):新增 `arcane_missile`(CD1.2/魔攻×1.3)、`ice_lance`(CD2.5/×2.5),類比物理普攻的持續輸出。
  - 補償走「技能倍率 / 詞綴」而非單純堆 perLevel 魔攻(mAtk 基底維持與物攻同 2/1)。
- **SPD 攻速**:`minInterval 0.5→0.25`(提高上限,自帶 SPD 不再輕鬆觸頂 → 攻速主要靠攻速%詞綴投資),`perSpd 0.02→0.018`(略降影響、拉低下限)。SPD100≈0.71s、要到 0.25s 需重度投資。
- **怪物 HP 非線性**(REQ §8.4):新增高等遞減 `effHpMult = hpMult × (1 - min(0.25,(等級-40)×0.004))`,避免高等怪 HP 過高、戰鬥過長致死。
- **診斷修正**:SPD 調整一度讓高等「小怪」致死率飆到 ~20%(普攻變慢→戰鬥變長→被小怪磨死),用「死亡分布(小怪/區域王/世界王)」模擬定位後,以 minimal SPD 調整 + HP 遞減修回(小怪致死率回到低/中)。
- **玩家 scaling 哲學**(使用者):裝備為重、適度降基礎屬性影響 → 已先強化魔攻詞綴;模擬一律穿裝。

驗證:DPS 魔/物 110/100/87%(L40/70/99);小怪致死率 低圖0%、L99 under-gear rare 13%/epic ~2%;世界王仍為門檻可過;攻速曲線正確;`tsc` 全綠、全新角色無崩潰。數值待實機微調。

---

### 魔法傷害紫字 + dev 金錢/加工石無限

- **魔法傷害紫色**:`FloatingNumber` 加 `magic`;`castSkills` 對 `school==='mag'` 的技能傷害 `pushFloater(...,true)`;overlay 飄字加 `.magic` class(紫 `#c77dff`,magic crit 更亮紫 `#e0aaff`)。
- **dev 金錢無限 / 加工石無限**:`DevSettings.infiniteGold/infiniteStones`(開關);`tick` 每幀補滿(金幣 1e12、所有石頭 9999);`setInfiniteStones` 開啟時立即補一次 + invVersion++(石頭清單即時更新)。IPC/preload + 設定頁 dev 面板兩顆 toggle 鈕(開啟高亮 `.btn.on`)。
- 驗證:開無限 → 金幣 1e12、12 種石頭各 9999;花光後下幀補回;關閉後不再補。`tsc` 全綠。

---

### 修:後期 Boss「一生成就不滿血」的觀感

- 成因:Boss 本來就以滿血生成,但 `tick` 在「生成的同一幀」就跑戰鬥;又因 Boss 登場會重置技能 CD,所有技能瞬間齊發,後期爆發大 → 玩家看到的第一幀 Boss 已被砍一截。
- 修法:`ensureEnemy` 回傳「是否本幀新生成」,`tick` 在新生成幀**只生成不戰鬥**(early return)→ UI 先顯示一幀「滿血登場」,下一幀才開打。對所有敵人一致(延遲約 1 tick,可忽略)。
- 驗證:超高 DPS 測試下,生成幀 Boss hp===maxHp(27216/27216 ✅),之後才扣血。

---

### Boss 紅框改成整個懸浮面板

- 原本 `.boss-fight` 紅光只加在 `.arena`(中間戰鬥區);改成加在 `#panel`(整個懸浮視窗外框)。`overlay.ts` 改 toggle 在 `els.panel`。
- 順帶區分:區域王紅框、**世界王紫紅框**(`.panel.world-boss`),更醒目。

---

### 所有加工都要花錢(改造石也收費)

- `useModifyStone` 改:用石頭前先收 `craftCostOf(item)` 金幣(金幣不足擋下、不動物品),成功後扣金幣 + 石頭 + `craftCount++`。回傳加 `cost`。
- `craftCount` 現為「升階 + 改造」總次數 → 加工費隨總次數指數上升;`balance.crafting.costMult 2.0→1.5`(做裝會反覆改造,放緩指數)。
- UI:加工頁標題列改「下次加工費(升階/改造皆需)」恆顯示;`updateCraftAffordability` 金幣不足時連改造石鈕一起 disable;改造訊息顯示花費金幣。`modify.ts` import `craftCostOf`(無循環:crafting 不依賴 modify)。
- 驗證:iLv50 rare 連續改造 300→450→675→1013(×1.5)、craftCount 1→4;金幣不足正確擋下。`tsc` 全綠。

---

### 倉庫體驗:我的最愛 / 篩選彈窗(共用加工頁)/ 裝備比對 / 加工身上裝備

- **我的最愛 ★**:`Item.favorite` + `toggleFavorite(state,id)`;`sellItem/discardItem`(單件)與 `sellItems/discardItems`(批量)遇到 favorite 一律跳過(批量回傳 `skipped`)。UI:背包列 + 詳情頁星號鈕;批量訊息顯示跳過數。
- **findItemById(state,id)**:背包 + 已裝備格皆找。`craft/craftInfo/useModifyStone` 改用它 → **身上裝備也能加工**(同一物件 mutate,裝備格即時生效)。加工清單合併背包 + 已裝備(標「已裝備」)。
- **裝備比對**:`describeItem` 加 `equipSlots`(TYPE_INFO.slots);詳情選背包裝備時,逐格顯示身上同部位裝備(無則「空」);`itemBodyHtml` 抽共用;「裝備」鈕改「替換」。
- **篩選彈窗**:篩選/排序移到 modal(`#filterModal`),背包頁 + 加工頁各有圖示鈕開啟、共用 `invFilter/invRarity/invSort/favOnly` 與 `filterSort()`;新增「只看 ★」。
- IPC/preload 補 `action:toggleFavorite`;`sellMany/discardMany` 回傳型別加 `skipped`。SAVE 無需升版(favorite 是選擇性欄位)。
- **驗證**(headless):收藏 B 後批量賣 A/B/C → 賣 2 跳過 1、B 留著;丟最愛 B → count0/skip1,取消收藏後可丟;身上 W 的 craftInfo/craft 正確解析(到石頭檢定)。`tsc` 全綠。

---

### 刷怪模式控制:自動打王 / 循環同一關卡 / 指定區域

- **需求**:玩家想自己決定持續刷小怪(練等)還是打王;有時打王慢想先練;也想挑特定低階區域刷。
- **設定(`GameState.settings`,SAVE_VERSION 6→7)**:`autoBoss`(預設 true)、`loopStage`(預設 false);舊檔遷移補預設。
- **engine**:`mapPhase` 在 `autoBoss=false` 時恆回 `'mob'`(永不出王);區域王擊殺後 `loopStage=true` 則不前進(留同區重刷);小怪數封頂 `monstersPerArea`(關王時不無限累加)。
- **core**:`setAutoBoss`(關閉時若場上是 Boss 立即換回小怪)、`setLoopStage`、`selectArea(idx)`(跳到指定區刷怪)。
- **UI**:設定頁「戰鬥/刷怪」兩開關(toggle);地圖頁區域卡片可點擊指定刷該區(`.area-card.pick`);map-hint 更新(+5 / 指定區)。IPC + preload 補 `action:selectArea / setAutoBoss / setLoopStage`,snapshot 帶 `settings`。
- **驗證**(headless,5 種模式):預設=完整推進(區王+世界王、繞區0-5);王關=只刷小怪;循環開=小怪+區域王不打世界王;選區3+王關=只刷第3區;選區5+循環開=第5區小怪+區域王。全部符合。`tsc` 全綠。

---

### 地圖一階 = 怪物等級 +5(修怪等落後角色等級)

- **問題**:地圖推進靠「打贏世界 Boss(裝備檢定)」,但角色靠刷怪不斷升級 → 世界 Boss 卡住時角色照樣升級,怪物等級(=地圖等級,原 +1/階)遠落後角色等級。
- **改法**:`balance.enemy.mapLevelStep = 5`;`engine.ts` 世界 Boss 推進改 `mapLevel += mapLevelStep`(原 +1)。地圖等級序列 1,6,11,16…
- **驗證**(換同級 rare 裝持續推進的模擬):原本怪等落後 → 現在怪物等級與角色等級持平/略領先(例:角色 Lv37 → 地圖/怪等 51)。實際 gear-gated 玩家會更貼近。`tsc` 全綠。

---

### 經濟系統 + Boss 開打回滿 + 經驗曲線再調

#### 做了什麼
- **Boss 開打前自動回滿**(`engine.ts ensureEnemy`):進區域/世界 Boss 戰前補滿 HP/MP + 清技能 CD → Boss 是「滿狀態獨立考驗」,血量好評估、較合理。因此把 Boss 調更硬:區域 HP×3.5→4、世界 HP×6→7 + 攻 ×1.15→1.18 + 重擊/狂暴略升。
- **經驗曲線**:`killCap 50000→100000`(L99→100 約 10 萬隻同級怪;killStart 仍 10、凹型不變)。
- **經濟系統(§6.11)**:
  - **掉落與物等脫鉤**:`items.dropChance 0.18→0.022` → 無加成約 4~8 分/件(模擬 L10≈7、L30≈6.5、L60≈5 分);高圖只升物等不加快出現。Boss 改**保底掉落**(區域 3 件+1 石、世界 8 件+保底石)避免被低基礎掉率影響。
  - **金錢**:`monsterGold(L)=2+1.2×L^1.3`(非線性,`formulas/leveling.ts`);Boss ×goldMult。
  - **販賣價**(`items/value.ts sellValue`):`base(物等^1.15) × 稀有度倍率 × (1+0.12×詞綴數+0.05×ΣTierScore)` → 同時看物等/稀有度/詞綴數/Tier。
  - **加工費**(`crafting.ts craftCostOf`):加 `(1+物等×0.08)` 物等係數,維持 `costMult^craftCount` 指數。
  - **販賣機制**:`equip.ts` 加 `sellItem / sellItems / discardItems`;IPC `action:sell/sellMany/discardMany` + preload。
  - **倉庫 UI**:類別 + **稀有度**雙篩選、**排序**(物等↓↑/稀有度↓/售價↓)、每件顯示售價、勾選框 + **全選/清除 + 批量販賣/丟棄**(丟棄二次確認)、詳情頁加單件販賣鈕。

#### 為什麼這樣設計
- 「Boss 回滿才開打」讓 Boss HP 不必考慮「前面小怪耗了多少血」,純粹是 DPS race + 續航測試,好調且合理 → 順勢加難。
- 掉落改超低基礎機率 + 怪等只決定物等:符合「升圖加品質不加速度,速度靠掉落率」。Boss 保底補上「里程碑感」。
- 售價納入詞綴數 + Tier:好裝即使要賣也值錢,鼓勵撿/加工。

#### 驗證(headless)
- 掉落:中階裝無 LUK,L10/30/60 → 7.0 / 6.5 / 5.1 分鐘一件 ✓(目標 4~8)。
- Boss(回滿後加難):中階 rare 世界王首殺 ~3.5–5 分、各等級皆可過(高等死亡次數多、需邊打邊變強);頂 epic 輾壓(~1.5–2.5 分)。
- 經濟:掉金 L30=102/L100=480;售價 common 94→epic5詞 1071;加工費 iLv50 300→2400、iLv100 540→4320。`tsc` 全綠。

---

### 怪物數值 + 難度曲線 + Boss / 世界 Boss(M3 完整化)

#### 做了什麼
- **小怪曲線重做**(`data/balance.ts.enemy` + `core/map/enemy.ts`):屬性 `ref=(4+1.5×Lv)×低等緩坡`,強化×1.3 / 其餘×0.85 / DEF×0.9 / **SPD×0.4(壓低,避免高等 DPS 超線性)** / LUK×0.5;HP=`maxHp×2.4×低等緩坡`。目標:對「合理裝備同級玩家 ≈ 中等壓力」。
- **關卡結構**(`core/combat/engine.ts`):新增 `mapPhase()`(mob / areaBoss / worldBoss)。每區小怪清完 → **區域 Boss**;6 區 Boss 全清(`areaIndex` 達 areaCount)→ **世界 Boss**;擊敗世界 Boss → 升地圖等級(前沿)+ 回第一區。`areaIndex` 改為 0..6(6=世界王待打),不需遷移(沿用既有欄位,enemy 載入時本就清空)。
- **Boss 數值 + 機制**(`makeBoss` + `EnemyState.boss/enraged/bigHitTimer`):區域王 HP×3.5/攻×1.2/DEF×1.25;世界王 HP×6/攻×1.15/DEF×1.32。機制:**狂暴**(HP<40%→攻速+30/35%)、**週期重擊**(每7/6s 一次 ×1.8/2.0)。
- **世界 Boss 獎勵**:保底 5 顆高階升階石(階別依地圖等級,低圖只給低階)+ 隨機 2 顆改造石 + 8 次大量掉落 + 升圖。
- **玩家 scaling 一併調整**(經使用者同意):HP perLevel 10→13 / perSTR 3→4 / perDEF 5→7、護甲 `DEF^0.85→0.9` → 同一裝備品質在各等級手感一致。
- **新手友善**:低等**非線性緩坡**(Lv1=0.5→Lv20=1.0,乘屬性+HP)+ **起始裝**(單手劍/胸甲/頭盔 common ilvl1,`defaults.ts`)→ 全新 naked/初始角色一開局就打得動。
- **UI**:地圖頁加「關卡階段橫幅」+ 區域卡片狀態(已清✔ / 進行中 / ★區域王);overlay Boss 頭像(💀/👑)、紅光 `.boss-fight`、🔥狂暴提示。snapshot.map 加 `phase` / `areaCount`。

#### 為什麼這樣調(踩雷紀錄)
- 一開始 Boss 倍率訂太高(HP×8/×25)→ 連區域王都打不過。發現主因:**長戰需要技能續航**,且我的參考玩家沒帶技能;改用「蓄力+治療+續航」技能組重測。
- 又發現**高等 Boss 仍打不過、低等可以** → 根因是**敵人 DPS 超線性**(怪 SPD 隨等級↑使攻速變快)+ **玩家護甲次線性**,長戰在高等被耗死。→ 壓低怪 SPD 成長 + 提升玩家 HP/護甲 scaling(使用者明示可調玩家端 + 怪物可非線性)。
- 依使用者澄清「**不期望幾百隻怪就過世界王**,而是看**同級+挑過詞綴的裝備**打不打得過」→ 改以 3 檔裝備(入門 magic / 中階 rare 挑詞 / 頂 epic)驗證,把世界王調到「中階挑詞玩家吃力可過」。
- 整合測試發現全新 **naked 角色 totalKills=0**(打不死第一隻怪)→ 我前面把怪變壯造成的回歸 → 補起始裝 + 低等緩坡。

#### 驗證(headless,無法 GUI 測:透明 always-on-top 視窗在 xvfb 會 SIGTRAP)
- 小怪(floor 起始裝):死 0–8%、掉血 9→40%、TTK 11→5s,隨等級漸難(gear gate)。
- 3 檔裝備 loop(expMult=0):入門高圖卡關;中階 rare 挑詞 **世界王首殺 3–5 分、高等開始有死亡**;頂 epic 輾壓(~90s)。
- 全新角色實機 tick:擊殺 3014、Lv35、地圖→8、區域王 + 世界王皆出現,無崩潰。`tsc` 全綠。

---

### 技能:修正「/15」寫死 + 擴充技能池(17→28)+ 被動新效果

- **修正**:技能頁「擁有/總數」原寫死 `/15`,但已有 17 個 → 改成動態 `SKILL_TOTAL`(snapshot 帶 total)。對不上的問題解決。
- **擴充被動效果**:`PassiveEffect` 加 `armourPct / cdrPct / dmgReductionPct / expGainPct`,並在 `aggregatePassives` + `characterCombat` 套用。
- **新增 11 技能(總 28:13 主動 + 15 被動)**:
  - 主動:旋風斬(物×1.3×4)、處決(物×5.5)、閃電箭(魔×3.5)、隕石術(魔×6)、烈焰風暴(魔×1.8×3)、急速治療(快回)。
  - 被動:堅壁(護甲+20%)、疾風步(CDR 8%)、銅皮(減傷6%)、博學(經驗+12%)、雙修(物/魔攻各+8%)。
- 驗證:SKILL_TOTAL=28、新被動生效(堅壁護甲×1.2、CDR/減傷/經驗正確);`tsc` 全綠。

---

### 改造石(做裝通貨,類 POE)+ 詞綴主題群組

#### 做了什麼
- 每條詞綴標 **group**(攻擊 / 魔法 / 生命防禦 / 運氣);改造石「加 X 系」就從對應群組抽。
- 新增 6 顆 **改造石**(`kind:'modify'`,`core/items/modify.ts`):
  - 淨化前綴石 / 淨化後綴石:隨機消除一條前/後綴。
  - 攻擊 / 魔法 / 防禦 / 幸運 **重鑄石**:替換隨機一條 → 新增一條該系詞綴(net 詞綴數不變;會處理側別騰位、不重複、Tier 依物等)。
- **稀有度降級**(demoteRarityIfNeeded):淨化石消詞綴後若數量低於該稀有度下限,自動降級(橙5→消→紫4→藍3…),才能再用對應升階石升回去(避免「橙裝只有 4 條」的矛盾)。
- 走掉落取得(加入 rollStone 權重);**不收金幣**(經濟系統未定)。
- shell IPC `action:useStone`;preload `useStone`;加工頁:選裝備後在面板下方列出「擁有的改造石」按鈕,點即套用(任何稀有度可用,傳說也能改詞綴)。

#### 驗證(headless 10/10)
淨化前/後綴正確、無對應側時失敗不消耗、重鑄替換後詞綴總數不變且確實加到該系、運氣重鑄加到運氣系、engine 跑 8000 tick 改造石有掉落。`tsc` 全綠。

#### 待續
已向使用者提出額外加工石點子(神聖重滾值 / 精煉升Tier / 品質升基底 / 混沌全重鑄…),待選做。

---

### 裝備系統大改(武器分類 / 詞綴擴充 / 屬性↔數值分離 / Tier 機率化)

#### 做了什麼(架構級,REQ §6.10)
- **屬性 ↔ 戰鬥數值分離**:管線 `最終值 =(屬性轉換 + 裝備flat)×(1+Σ%)`。**DEF≠護甲值**:`armourFromDEF = DEF^0.85 × k`(邊際遞減);裝備直接給「護甲值」。護甲減傷 `armourReduction(護甲值, 來襲)`。
- **武器分類**(types/balance.baseProfile):單手劍/匕首(攻速)/長槍(物+護甲)/單手法杖/權杖(物+魔);雙手劍/雙手法杖/長杖(混合,×1.8 預算);盾(護甲)/法球(CDR)。**單手皆可雙持、雙手佔兩格、盾法球只副手**(equip.ts)。
- **詞綴池 ~28 條**(data/affixes):flat+%(物/魔攻、生命、法力、護甲、生命/魔力回復)、**local 武器傷害%**(只放大該武器基底,affixes.ts 逐件處理)、傷害減免%、冷卻減少%、爆傷、全屬性、經驗獲取%。`Bonus` 大幅擴充。
- **Tier 機率化**(generate.pickTier):期望Tier = max(1, 5 − ilvl/22) + 高斯(σ1.1),夾 [1, 5−floor((ilvl−100)/30)]。中物等就有低機率 T1、高物等砍低 Tier。
- combat 接上:CDR 縮技能 CD、傷害減免% 套在護甲後、經驗獲取% 套在擊殺、護甲值代入減傷。角色頁加顯示 護甲值/冷卻減少/傷害減免/經驗加成。
- **存檔**:SAVE_VERSION=6,migrate 清空舊裝備/背包(物品模型不相容)。

#### 驗證(headless 模擬)
- 各武器基底正確(雙手劍物攻209、匕首攻速+12%、法球CDR+10%、長槍物攻+護甲、權杖物+魔…)。
- Tier 分布(retune 後 spread=44/jitter=1.2/rollMin=0.65,參考 POE「頂階仍需追求」):ilvl50 T1 3%、**ilvl100 T1 15%**、ilvl130 T1 33%、ilvl160 T1 55%(高物等才偏高 Tier、>100 砍 T5;整體更散,因後續可加工再雕)。
- 雙持:兩把單手劍 物攻 463 =(裸163 + 主手120×local+50% + 副手120),**local 武器%只放大該武器** ✓;2H 裝上清副手 ✓。
- 護甲(POE):胸甲護甲311 對來襲300 減傷 26% ✓。engine 跑 5000 tick 正常掉新類裝備。`tsc` 全綠。

#### 待續(下一步:怪物難度)
角色 + 裝備架構就位;接下來才依「角色 floor + 預期裝備」回推怪物數值與難度曲線。係數(armourK、defArmour、tier.spread、各詞綴 t1max…)集中於 `data/balance.ts` 待平衡。

---

### 戰鬥系統重構(玩家端)+ 物攻/魔攻玩法分流

#### 需求(使用者)
先把玩家數值與傷害公式弄好,再依難度定怪物。重點:普攻只物理、魔攻只走技能且倍率更高、HP/MP 隨時間回(INT 加速 MP)、護甲改 POE 式、DEX 改命中/閃避(爆率歸 DEX 微量、爆傷歸 LUK)、角色當保底(天賦影響降低、強度交給裝備+技能)。

#### 做了什麼
- **普攻只算物理**(`damage.ts`):移除普攻的魔攻加成;魔法只透過技能。
- **護甲 POE 式**(`derived.armourReduction(def, 來襲傷害)` = DEF×K/(DEF×K+hit),K=1.5):大攻擊穿甲、小攻擊被擋,無硬上限。取代舊 `DEF/(DEF+50+5Lv)`。技能傷害也走同一護甲。
- **爆擊重分配**:`critChance = 0.05 + DEX×0.0008`(上限0.5,LUK 不再給爆率);`critMult = 1.5 + LUK×0.02`。修正「百等滿爆」。
- **回復系統**:`hpRegen = maxHP×0.6%/s`(+裝備詞綴);`mpRegen = maxMP×1.5%/s + INT×0.05`(INT 加速 → 魔法職業續航)。engine 每 tick 回 HP/MP。
- **技能倍率**(`data/skills.ts`):物理中等(重斬×2.2、連刺×0.9×3、蓄力×4.5)、魔法明顯高(火球×4.0、冰霜×3.2、奧能×8.0)。
- **自由點**:`2/級 + 逢5級+5`(L100 共 258,原 297);保底 +1/級維持當 floor。
- **新詞綴**:「生命回復/秒」(suffix)。角色頁加顯示 物理(普攻)/魔法(技能)/生命回復/魔力回復。

#### 驗證(headless 模擬)
- 普攻只物理 ✓;爆率 均衡 L100=16.8% / 純DEX=34%(不再滿爆)✓;護甲 DEF=80:來襲10→92%、150→44%、2000→6% ✓;INT 加速 MP(L50 純INT 25.3/s vs 純STR 9.3/s)✓。`tsc` 全綠。

#### 下一步(使用者指定)
角色數值敲定 → **裝備系統** → 才是怪物難度。

---

## 2026-06-05

### 設定頁 + 開發者測試面板(輸入碼 920207 解鎖)

#### 做了什麼
主視窗新增第 6 分頁「設定」;設定頁的開發者區輸入測試碼(暫定 `920207`)解鎖測試面板。已補進 REQUIREMENTS §12 與 ARCHITECTURE(GameState/IPC/目錄)。

**面板功能**
- **一鍵重置角色資料**:等級/屬性/自由點/裝備/倉庫/技能槽+技能書/地圖全清回新檔,**保留 dev 倍率**(二次確認)。
- **一鍵清空倉庫**:清背包未裝備物品(二次確認)。
- **經驗值倍率 / 掉落率倍率**:0.25×~1000×,滑桿(**對數刻度**)拖曳或直接輸入,**按「確認」才套用**;影響線上+離線經驗、以及裝備/石頭/技能書掉落率。

**實作**
- `GameState.dev = { expMult, dropMult }`(`SAVE_VERSION=5`,migrate 補舊檔);倍率夾 0.25~1000。
- core:`resetGame`(就地 mutate、保留 dev)、`clearInventory`、`setExpMult`、`setDropMult`。
- engine:擊殺給經驗 ×expMult、三種掉落機率 ×dropMult;離線經驗也 ×expMult。
- shell:snapshot 加 `dev`;IPC `dev:reset / clearInventory / setExpMult / setDropMult`;preload 同步。
- UI:設定分頁 + 輸入碼解鎖(僅本次開啟有效)+ 面板;倍率滑桿↔輸入框雙向綁定(對數),確認才送;重置/清倉用 `confirm()` 二次確認。破壞性操作後強制重畫背包/技能/詳情。
- 註:解鎖碼為前端比對(`920207`),純開發方便、非安全機制。

#### 驗證 / 產出
- `tsc` 全綠、`esbuild` 五 entry 打包、DOM id 對照無缺。
- headless 12/12:倍率夾範圍、清倉、重置(全清+保留 dev)、expMult 100× 升更快(Lv23→Lv57)、dropMult 20× 掉更多(38→208 件)。
- 重新打包(asar 確認含 dev:reset / dev:setExpMult / 920207 / devPanel);106 MB。

---

### 數值微調:升級曲線改 Lv1≈100 隻、Lv99→100≈30 萬隻,且改「前陡後緩」(凹型)
- 錨點:`killStart 5→100`、`killCap 200000→300000`;`killsToLevel` 錨點由滿級(L100)改到**最後一次升級 L99**(`N = maxLevel-2`),使 L99→100 恰好到 cap。
- 形狀(依使用者修正):由凸型(前緩後陡)改為**凹型(前陡後緩)**——`killRatioStart` 設 1.15(>幾何平均),`ratioGrow` 反推成 <1 → 每級倍率由 1.15 逐級**遞減**到 ~1.02。
- 實表:L1=100、L10=337、L30=3.5k、L50=23k、L70=93k、L85=193k、**L99=300k**;倍率 1.15→1.02、單調遞增。前期升級難度提升快、後期每級增幅趨緩。重新打包。

### 數值:重做經驗 / 升級曲線(凸型加速,cap 落最後一級)

#### 需求(使用者)
- 升級要呈指數上升、別讓人一下衝很高;前期平緩、**越後面需要的怪物數量激增**。
- 以「打同級怪幾隻才升一級」為主軸:Lv1 約 5 隻,**~20 萬隻的 cap 落在最後一級(數字可調)**。
- 怪物經驗也要修,不要單純線性。

#### 做法(以打怪數為設計主軸,反推經驗)
- `killsToLevel(L) = killStart × ratioStart^(L-1) × ratioGrow^((L-1)(L-2)/2)`(凸型);`ratioGrow` 由程式反推,**使滿級(maxLevel)恰好 = killCap**。參數:killStart=5、killCap=200000、ratioStart=1.06。
- `monsterExpReward(L) = round(monExpBase × monExpGrowth^(L-1))`(緩和指數,非線性;monExpBase=5、monExpGrowth=1.05)。
- `expToNext(L) = round(killsToLevel(L) × monsterExpReward(L))` → 同級刷時剛好需要 killsToLevel(L) 隻。
- 怪物 `expReward` 改用 `monsterExpReward(怪物等級)`(取代舊的 `8+4×level` 線性)。
- 移除舊的 `expBase/expExponent`(舊曲線是 `20×L^1.5`,倍率反而遞減 → 前期最難後期狂噴,與需求相反)。

#### 結果(實表)
| Lv | 同級怪數/級 | 倍率/前級 | 升級需求 |
|----|------|------|------|
| 1 | 5 | — | 25 |
| 30 | 41 | 1.09 | 852 |
| 50 | 280 | 1.11 | 15.4k |
| 70 | 2,878 | 1.13 | 417k |
| 85 | 21.5k | 1.15 | 6.46M |
| 95 | 92.7k | 1.16 | 45.5M |
| 100 | 200,000 | 1.17 | 125M |
- 前期超平緩(Lv30 也才 41 隻)、後期激增、cap 正好在最後一級。UI 經驗/金幣加大數字縮寫(k/M/B/T)。

#### 驗證 / 產出
- `tsc` 全綠、headless 確認單調遞增 + L1=5 + L100=200k;重新打包 exe/zip(106 MB)。
- 數學限制備註:「每級接近 ×2」與「滿級才 20 萬」無法並存(複利會爆到 10^15),故保 20 萬上限時後期倍率上限約 1.2;要更陡可調高 killCap。

---

### M6 技能系統(技能書 / 3 槽 / 主動 CD+MP / 被動常駐)—— 養成三大系統到齊

#### 做了什麼
技能用「屬性倍率 / 百分比」表示(不升級,隨角色屬性自然成長,REQ §7.4),打怪掉技能書、配 3 槽、戰鬥中自動運作。

**核心 `data/skills.ts` + `core/skills.ts`(純 TS,headless 驗證)**
- 15 個技能(REQ §7.5):5 主動(重斬/火球術/連刺/蓄力一擊/治療術)+ 10 被動(狂戰意志/奧術精通/鋼鐵之軀/致命精準/暴虐/迅捷/幸運星/吸血/法力迴響/荊棘)。資料驅動(傷害倍率/治療/被動加成欄位)。
- `aggregatePassives()`:把 3 槽中的被動加總成一份加成;`setSkillSlot()`:配槽(需擁有、同技能不重複);`pickNewSkill()`:只掉未擁有的技能書;`skillSlotViews/skillBookViews`:UI 視圖。

**接進戰鬥**
- `characterCombat()` 多吃一份被動:物攻%/魔攻%/HP%/爆率/爆傷/攻速%/掉落% 全部疊上去(角色頁數值即時反映)。
- `engine` tick:**MP 每秒回 4% + 技能冷卻遞減**;依槽位順序,**CD 到且 MP 足夠就自動施放**(傷害技能走減傷/爆擊、連刺多段;治療術低於 85% HP 才放避免浪費);普攻觸發**吸血 / 法力迴響**,受擊觸發**荊棘**反彈;擊殺多一道**技能書掉落**(只掉未擁有)。

**狀態**:`skillSlots`(3 槽)+ `runtime.skillCooldowns`;`SAVE_VERSION=4`,migrate 補舊檔。

**shell / UI**
- 快照加 `skills`(3 槽視圖 + 已擁有技能書 + 冷卻);IPC `setSkillSlot`;preload 同步。
- 主視窗技能頁(取代空殼):**3 技能槽(顯示已裝技能 + 主/被動標籤 + CD/MP)+ 已擁有技能書清單**;點技能書裝到空槽、點槽位/已裝書卸下、技能槽滿提示。

#### 驗證(server 無螢幕)
- `tsc` 全綠、`esbuild` 五 entry 打包成功、DOM id 對照無缺。
- headless 22/22:被動加總 + 套進戰鬥數值(物攻+12%、HP+15%、爆率+8%)、配槽(擁有才裝/不重複/越界擋)、主動施放(消耗 MP + 設 CD + 打到敵人 + 10 秒內受 CD 限約 3 次)、治療術低血回血、MP 隨時間回復、技能書掉落(最多 15、不重複)。
- UI 互動仍無法本機目視(xvfb SIGTRAP);技能頁配槽請在 Windows 實測。

#### 產出物
- 重新打包 `release/win-unpacked/IdleAdventure.exe` 與 zip(106 MB)。動工前備份於 `GAME/_backups/20260605-pre-m6/`。

#### 里程碑現況
- **M0~M7 全部完成**(養成三大系統 裝備/加工/技能 + 戰鬥/地圖/存檔/離線都到位)。剩 **M8 內容與平衡**(填 data 表、敵人曲線、Boss/世界 Boss)與 M9 正式 installer。

---

### M5 加工系統(石頭 + 金錢升階 / 成功率 + 失敗保底 / 稀有度晉升)

#### 做了什麼
讓裝備可以「加工變強」:消耗升階石 + 金幣,把裝備往上一個稀有度推,成功就追加詞綴。

**核心 `src/core/items/crafting.ts` + `data/stones.ts`(純 TS,headless 驗證)**
- 6 種石頭(REQ §6.7):4 種升階石(粗糙/普通/精良/完美,各對應白→綠→藍→紫→橙一階)+ 2 種指定前/後綴石。`upgradeStoneFor(rarity)` 決定要用哪顆。
- `craft()`:消耗對應升階石 + 金幣 → 擲成功率。
  - **成功**:稀有度晉升、依物品等級追加 1~2 條詞綴(尊重前後綴各 ≤3)、`craftCount++`、pity 歸零。
  - **失敗(放置友善)**:不降級、不損壞,只 pity +1(下次成功率 +10%)。
  - 基礎成功率 90/70/50/30%(白→綠…紫→橙),加工費 = 100 × 2^craftCount(隨次數指數成長)。
  - **指定前/後綴石**:可選,保證追加一條該側詞綴(該側已滿則擋下)。
- `craftInfo()`:給 UI 預覽(目標稀有度、需求石、擁有數、成功率含保底、費用、pity、可否加工)。
- 石頭走掉落:engine 擊殺多一道石頭掉落(權重 rough 多、perfect 極稀有);`rollStone()`。

**狀態**:Item 加 `craftCount` / `pity`(選用,舊物 `?? 0`);石頭存在既有 `inventory.stones`。

**shell / UI**
- 快照加 `stones`(石頭庫存視圖);IPC `craftInfo` / `craft`;preload 同步。
- 主視窗加工頁(取代空殼):**左 可升階裝備清單 / 中 加工面板(現有詞綴 + 目標稀有度 + 升階石擁有數 + 成功率 + 失敗保底 + 加工費 + 指定前後綴石切換 + 升階加工鈕 + 結果訊息)/ 右 石頭庫存**。
- 沿用防呆:清單/庫存只在 `invVersion` 變動重畫;加工面板只在選取/加工後重建(按鈕穩定),金幣可負擔狀態每幀更新。

#### 驗證(server 無螢幕)
- `tsc` 全綠、`esbuild` 五 entry 打包成功、DOM id 對照無缺。
- headless 29/29:成功晉升 + 追加詞綴(白→綠,詞綴≤2)、扣石扣錢、費用 100→200、失敗不降級 + pity +10% + 保底累積必成功、最高稀有度擋下、缺石/缺錢擋下、指定前綴石保證前綴、石頭掉落分佈(rough≫perfect);engine 實跑確認石頭會掉(rough 26 / perfect 3…)。
- UI 仍無法本機目視(xvfb SIGTRAP);加工頁互動請在 Windows 實測。

#### 產出物
- 重新打包 `release/win-unpacked/IdleAdventure.exe` 與 zip(106 MB)。動工前備份於 `GAME/_backups/20260605-pre-m5/`。

#### 下一步
- 只剩 **M6 技能系統**(技能書掉落、3 槽配置、主動 CD+MP / 被動)未做;之後是 M8 內容/平衡與 Boss/世界 Boss。

---

### 背包容量:滿了停止掉落 + 金幣擴充(取代原本「丟最舊」)

#### 起因
被問到「超出背包容量會怎樣」。原本 `addItemToInventory` 是 FIFO **靜默丟最舊的**(可能丟掉特意留的好裝,且無提示)。經確認改為:**背包滿就停止掉落**,並可**用金幣購買容量**。

#### 做了什麼
- `addItemToInventory`:達 `inventory.cap` 就**不撿**(回 false),不再丟舊物。
- 背包容量改為**可變**:`GameState.inventory.cap`(`SAVE_VERSION=3`,migrate 補舊檔 = 120)。
- `index.ts` 新增 `expandInventory / expandCost / canExpandInventory`:每次 +20 格,費用 300 起、每次 +200,上限 400(`data/balance.items.expand`)。
- 卸裝在滿包時仍擋下(回 false),但現在 UI 會提示。
- shell:snapshot 加 `inventoryCap / expandCost / canExpand`;IPC `action:expandInventory`;preload 同步。
- UI 背包頁:加「擴充 💰費用」鈕(每幀更新可負擔狀態、達上限顯示「已達上限」)+ 訊息列(擴充結果 / 「背包已滿無法卸下」提示)。

#### 驗證
- `tsc` 全綠;headless 測試 17/17:滿包停撿、不丟舊物、擴充扣費 + 費用遞增(300→500…)、擴到上限 400 後停止。
- 重新打包(asar 確認含 action:expandInventory / inventory.cap)。

---

### M4 裝備系統(掉落 / 詞綴 / 稀有度 / 換裝影響數值)

#### 做了什麼
讓「打怪掉寶 → 換裝變強」的核心循環跑起來,並把主視窗背包/裝備頁接上真資料。

**核心 `src/core/items/`(純 TS,全程 headless 測試)**
- `types.ts`:Item / Rarity(白綠藍紫橙)/ Affix(前後綴)/ EquipSlot(8 格)/ Bonus / Equipment,以及稀有度顏色、物品大類→格位對應。
- `affixes.ts` + `data/affixes.ts`:13 條詞綴(前綴 6 / 後綴 7),Tier T1~T5 數值由 `t1max × tierFactor^(t-1)` 推算;`itemLevel` 決定可滾到的最佳 Tier(門檻見 balance)。`equipmentBonus()` 把 8 格加總成一份 Bonus。
- `generate.ts`:依 itemLevel 滾稀有度(權重)→ 基底主數值(武器物/魔攻、護甲防禦、飾品單屬性)→ 詞綴(前/後綴各 ≤3、合計受稀有度限、不重複)。
- `equip.ts`:裝/卸/丟棄、掉落入袋(背包上限 120 丟最舊);**雙手武器佔主+副、裝副手會卸雙手**;每次變動 `runtime.invVersion++`。
- `describe.ts`:把 Item 轉成 UI 直接可顯示的 `ItemView`(名稱/稀有度色/主數值行/詞綴行),維持「UI 不懂規則」。

**戰鬥接上裝備**
- 新 `combat/profile.ts`:`characterCombat()` 把「屬性 + 裝備加成」整合成最終戰鬥數值(maxHp/MP、物/魔攻、爆率、攻速、掉落);`profileFromStats()` 給敵人用。
- 重構 `damage.ts`:`resolveAttack(攻擊側profile, 防禦等級, 防禦屬性)` —— 攻擊力改由 profile 預先算好(角色含裝備、敵人由屬性換算)。
- `engine.ts`:tick 用 characterCombat;**擊殺按掉落率(× LUK 掉落加成)生成 itemLevel=怪物等級的裝備入袋**。

**狀態 / 存檔**
- `GameState` 加 `equipment` + `inventory`;`SAVE_VERSION = 2`;`save.ts` 加 `migrate()` 補舊檔缺的欄位(v1 存檔可直接沿用)。

**shell / UI**
- 快照改用 characterCombat(角色頁/頂列數值即時反映換裝),加 `equipment` / `inventory`(已轉 ItemView)/ `invVersion`;IPC `equip / unequip / discard`;preload 同步。
- 主視窗背包/裝備頁(取代原空殼):**左 8 格裝備 / 中 背包清單(全部·武器·防具·飾品篩選)/ 右 詳情(主數值 + 前後綴詞綴 + 裝備/卸下/丟棄)**。稀有度以顏色標示。
- **避免高頻重繪讓按鈕點不到**:背包/裝備格只在 `invVersion` 變動才重畫;詳情面板(含動作按鈕)只在選取/操作後重畫(延續上次加點 bug 的修法)。

#### 驗證(server 無螢幕)
- `tsc --noEmit` 全綠、`esbuild` 五 entry 打包成功、DOM id 對照無缺。
- headless 核心測試:生成形狀(前後綴≤3、總數≤6、不重複、Tier 受 itemLevel 限)、裝備影響屬性(戒指+STR、武器+物攻、卸下還原)、雙手佔兩格、掉落入袋(上限 120)、存檔往返一致 —— 全數通過;整合測試:跑模擬掉 114 件→裝武器物攻 300→313→存檔往返一致。
- UI 仍無法本機目視(透明懸浮窗在 xvfb 會 SIGTRAP);背包頁互動請在 Windows 實測。

#### 產出物
- 重新打包 `release/win-unpacked/IdleAdventure.exe` 與 zip(106 MB)。動工前備份於 `GAME/_backups/20260605-pre-m4/`。

#### 下一步
- M5 加工(石頭+金錢升階)現已解鎖(裝備系統就位)。

---

### 修正:角色頁加點按鈕「有時按不到」

#### 問題
使用者回報天賦/屬性加點的 `+` 按鈕有時可觸發、有時沒反應。

#### 根因
`renderChar()` 在每次 `state:update`(約 10Hz)都用 `innerHTML` **整列重建**屬性列。`click` 需要 mousedown 與 mouseup 落在同一個元素;若按下的瞬間剛好卡進一次重建,按鈕節點被抽換 → click 不成立 → 看起來「按了沒反應」。屬於高頻重繪抽換互動元素的經典 bug。

#### 解法
屬性列與衍生數值列改成 **只在 `buildStatic()` 建立一次**(每格給穩定 id),之後 `renderChar()` 只用 `textContent` / `.disabled` **就地更新**,不再抽換 DOM 節點。按鈕節點全程穩定 → 點擊一定成立。其餘高頻重建處(地圖 `areaGrid`)內無互動元素,不受影響。

#### 驗證
- `tsc --noEmit` 全綠、`esbuild` 重新打包;靜態確認 `statList.innerHTML` 僅出現在 `buildStatic`(1 次)、`renderChar` 已無 `innerHTML`、穩定 id `st-plus-*` 存在。
- **本機 headless 無法跑 renderer**(xvfb 下 Electron renderer 一律 SIGTRAP,無真實 GPU/螢幕),故 UI 互動以靜態 + 機制推理驗證。請在 Windows 連點加點按鈕確認每下都生效。

#### 產出物
- 重新打包 `release/win-unpacked/IdleAdventure.exe` 與 zip。

---

### 修正:關閉遊戲後 electron 殘留後台 → 改為「關閉 = 完全退出」

#### 問題
使用者回報關掉遊戲後 electron 仍在後台跑。確認後:這原是**刻意的 tray 常駐設計**(REQ §11.4「視窗關閉縮到 tray 繼續掛機」),按 × 只是 `hide()`,只有 tray→退出 才真正結束。另發現**沒有單一實例鎖**,免安裝 exe 被點兩次會疊出兩個背景程序(很可能是「一堆 electron 殘留」的主因)。

#### 決策(經使用者確認)
改為 **關閉懸浮視窗 = 完全結束程式,不留後台**;**取消 tray 常駐**。已同步更新 REQ §11.4。

#### 做了什麼(`shell/main.ts` + preload + overlay)
- `overlay.on('close')`:不再 `preventDefault + hide`,改成 `isQuitting = true; app.quit()`。
- 移除整個系統匣(`Tray / Menu / nativeImage`、`createTray`、tray icon)。
- `window-all-closed` 由「空(不退出)」改為 `app.quit()`(退出保險)。
- IPC `window:hide` → `window:quit`;懸浮視窗 × 鈕(及 preload `hide()`→`quit()`)改為結束程式;tooltip 改「關閉並結束遊戲」。
- **隱藏的主面板不再卡住退出**:因 `app.quit()` 時 `isQuitting` 已為 true,`mainWin.on('close')` 不再攔截 → 隱藏的主面板也會一併關閉。
- 新增 **單一實例鎖** `requestSingleInstanceLock()`:重複開啟時把既有視窗叫到前景,不再疊背景程序。
- 主面板的「收合 / 關閉」維持只回到懸浮視窗(不退出),符合直覺。

#### 驗證(server 無螢幕)
- `tsc --noEmit` 全綠、`esbuild` 重新打包成功;grep 確認無殘留 `Tray / window:hide / game.hide`。
- **runtime 退出流程無法在本機目視**:headless xvfb 啟動透明 always-on-top 懸浮視窗會 SIGTRAP(軟體渲染環境限制,非程式 bug);改以程式碼審查確認退出路徑(標準 Electron 語義)。請在 Windows 上實測:按 × 後工作管理員應無殘留 `IdleAdventure.exe`。

#### 產出物
- 重新打包 `release/win-unpacked/IdleAdventure.exe` 與 zip。

---

### 主視窗 + 全部分頁 UI(展開態 REQ §11.3)

#### 做了什麼
補上 ARCHITECTURE 缺的展開態主視窗與五分頁,並打通對應的 IPC / 核心 API。新增 `src/ui/main/`(main.html / main.css / main.ts),Electron 端新增第二個視窗。

**核心層(純 TS)**
- `core/index.ts`:新增 `respec`(洗點:退回自由點、扣金幣、保底不動)、`respecCost`、`selectMap`(選地圖等級,夾 1~已達最高,切圖重置區域進度),並對外多 export 衍生公式(爆擊率/爆傷/攻速/掉落)與 `AREAS`。
- `combat/engine.ts`:**前沿推進 guard** —— 僅在 `selectedMapLevel >= mapLevel`(打的是最高圖)時清完六區域才 `mapLevel +1`;在低圖刷素材不會被往前拉。
- `data/balance.ts`:新增 `respec` 費用係數(暫定遞增 = baseCost + 等級 + 已洗次數)。

**Electron 殼**
- `shell/main.ts`:`openMain()` 建立/顯示有框可調整的主視窗(關閉→隱藏回收合態);新增 IPC `window:openMain / closeMain`、`action:respec / selectMap`;**快照豐富化**(屬性、衍生、地圖區域、洗點費等),改成 `broadcast()` 一次把同一份快照推給兩個視窗(floaters 只消費一次,主視窗隱藏時不推)。
- `preload`:加 `respec / selectMap / openMain / closeMain`。
- `ui/env.d.ts`:共用的 `window.game` 全域型別(由 preload 的 `GameApi` 推導),解決兩個 renderer 各自 declare 衝突。

**主視窗 UI(五分頁)**
- 頂部常駐:角色頭像/等級/區域、HP/MP/EXP 條、金幣、未分配點、收合鈕。
- 角色:六屬性(顯示保底+分配拆解、[+] 分配鈕)、衍生戰鬥數值、洗點(顯示費用/可退點數,條件不足自動禁用)。**完整功能**。
- 地圖:選地圖等級(− / + / 跳到最高 / 前往)、六大區域卡片(目前區域高亮 + 小怪進度條 + 強化屬性)。**完整功能**。
- 背包/裝備、加工、技能:**真實版面**(8 格裝備欄、背包格、加工三欄、3 技能槽)+ 明確的「🚧 尚未實作(Mx 里程碑)」空狀態。
- 懸浮視窗:topbar 加 ⛶ 開主面板鈕,雙擊對戰區也可開。

#### 驗證(server 無螢幕,以非 GUI 方式驗)
- `tsc --noEmit` 全綠;`esbuild` 四個 entry(main/preload/overlay/**main UI**)打包成功。
- headless 核心測試 17/17 通過:respec(退點/扣費/保底不動/金幣不足擋下)、selectMap(夾範圍/重置進度)、前沿 guard(低圖刷不推進、前沿打會推進)。
- 打包 `--dir` 免安裝版,確認 `app.asar` 內含 `dist/ui/main/*`。

#### 產出物
- 重新打包:`release/win-unpacked/IdleAdventure.exe`、`release/IdleAdventure-v0.1-win-x64.zip`(106 MB)。
- 動工前已整包備份到 `GAME/_backups/20260605-pre-ui/`(排除 node_modules)。

#### 下一步候選
- M4 裝備掉落 → 把背包/裝備頁接上真資料(換裝影響數值)。
- 洗點費用規則最終定案(目前暫定遞增)。

---

### v0.1 骨架完成 + 打包成 Windows 免安裝版

#### 做了什麼
從零建立 `GAME/v0.1/`,完成可執行的最小骨架,並打包成 Windows x64 免安裝版供下載測試。

**環境**
- 用 conda 在 `v0.1/.condaenv` 裝 Node.js 20(本機原無 Node)。
- 遵守「不用 `conda activate`,改用絕對路徑」的慣例。

**專案骨架**
- `package.json` / `tsconfig.json` / `esbuild.config.mjs`:TypeScript + esbuild,三個 entry(main / preload / overlay)。
- 採 ARCHITECTURE 的三層分層:`core`(純邏輯)/ `shell`(Electron)/ `ui`(渲染)+ `data`(數值表)。

**核心邏輯層 `src/core/`(純 TS,可獨立測試)**
- `state/GameState.ts`:整體狀態(SSOT),含角色 / 地圖進度 / 戰鬥 runtime,直接對應存檔。
- `state/defaults.ts`:新檔初始狀態,`SAVE_VERSION = 1`。
- `formulas/derived.ts`:衍生數值公式(HP/MP/物攻/魔攻/減傷/命中/爆擊/攻速/掉落)——對應 REQ §4。
- `formulas/leveling.ts`:經驗曲線、升級保底成長(每屬性 +1)、自由點(每級 +3)。
- `combat/damage.ts`:單次攻擊結算(命中→物理+魔法→減傷→爆擊)。
- `combat/engine.ts`:即時 DPS tick——攻擊計時條、進場先攻、擊殺獎勵、區域推進、戰敗退回關卡開頭。
- `map/enemy.ts`:六區域(各強化一屬性)、依地圖等級 ±2 浮動生怪。
- `data/balance.ts`:所有平衡係數集中於此(與程式分離,方便調)。

**Electron 殼 `src/shell/`**
- `main.ts`:透明無邊框 always-on-top 懸浮小視窗、主迴圈(100ms tick)、自動存檔(30s)、系統匣 tray(關窗縮 tray 繼續掛機)、IPC、離線結算。
- `save.ts`:存檔讀寫(userData 的 JSON,寫暫存再 rename 防損毀)。
- `preload/preload.ts`:contextBridge 安全暴露 IPC。

**UI `src/ui/overlay/`**
- 收合態緊湊面板:角色 / 敵人 / HP / MP / 關卡進度 / 跳傷害數字(爆擊變色)/ 離線結算彈窗。

#### 驗證
- 核心邏輯以 headless 模擬驗證(無需 GUI):
  - 60 秒模擬:打 5 隻怪、升到 Lv2,循環正常。
  - 10 分鐘模擬(點數投 STR):Lv19、432 擊殺、地圖 11,曲線健康無卡關;投 STR 後擊殺速度明顯提升(屬性有感)。

#### 遇到的問題與解法
1. **esbuild 打包後 `electron.app` 為 undefined**
   - 原因:esbuild 對 `require("electron")` 套了 `__toESM` interop,把 API 包到 `.default`。
   - 解法:esbuild 的 node 目標設 `mainFields: ['main']`,讓 electron 當純 CJS,不套 interop。
2. **Electron 啟動即崩潰 `Cannot read properties of undefined (reading 'whenReady')`**
   - 原因:**環境變數 `ELECTRON_RUN_AS_NODE=1`** 強制 Electron 當純 Node 跑,不啟動 app,導致 `require("electron")` 回傳字串路徑。
   - 解法:啟動時清掉該變數(`env -u ELECTRON_RUN_AS_NODE`)。注意:這是開發環境問題,打包成 exe 後在使用者電腦不受影響。
3. **跨平台打包 Windows 版需要 wine**
   - 原因:electron-builder 在 Linux 上做 exe 簽章 / rcedit 需要 wine(本機無 wine 且無 sudo)。
   - 解法:`win.signAndEditExecutable: false` + `CSC_IDENTITY_AUTO_DISCOVERY=false`,跳過簽章,用 `--dir` 產出免安裝 `win-unpacked/`(正好就是要的綠色版)。

#### 產出物
- `v0.1/release/win-unpacked/IdleAdventure.exe`(+ 依賴)
- `v0.1/release/IdleAdventure-v0.1-win-x64.zip`(118 MB,下載用)

#### 下一步候選
- M4 裝備掉落 + 背包 / 裝備頁(需開主視窗)。
- 主視窗(角色頁:看屬性、分配自由點 UI;目前分配只能透過 IPC)。
- 戰鬥節奏 / 數值手感微調。

---

### v0.1 修正:重開卡死、左右佈局、舊存檔相容

> (同日後續修正,基於上方 v0.1 骨架)

#### 修正 1:重新開啟後 UI / 戰鬥不動
- **現象**:關掉再開,畫面有顯示但戰鬥不推進(數字不動)。
- **根因**:敵人的完整屬性 / 獎勵原本存在 engine 的**模組變數 `liveEnemy`**(不進存檔)。重開後 `state.runtime.enemy` 還在(hp>0),`ensureEnemy` 因此不重生,但 `liveEnemy` 已歸 null → `tick()` 每次 `if (!enemy || !liveEnemy) return` 直接返回 → 永遠卡住。
- **解法**:把敵人完整狀態(新增 `EnemyState`,含 stats / expReward / goldReward)直接存進 `state.runtime.enemy`,移除 `liveEnemy` 模組變數。狀態自洽、可序列化。
- **驗證**:序列化往返(等同存檔→讀檔)後再玩 2 分鐘,擊殺數 29 → 76(+47),確認正常推進。

#### 修正 2:視窗太高 + 改左右對戰佈局
- 收合態 UI 從「上下堆疊」改為**左角色 / 中間 VS / 右怪物**的對戰佈局。
- 視窗高度 150 → **96**,更省桌面空間。
- 怪物血條改由右往左縮(視覺對稱);依區域顯示不同怪物 emoji。

#### 修正 3:舊存檔相容(強制重生敵人)
- 啟動載入存檔後,**強制 `state.runtime.enemy = null` 再 `ensureEnemy`**。
- 確保舊存檔裡「缺 stats 欄位的敵人」不會殘留導致卡死;舊存檔可直接沿用,不必手動刪。

#### 產出物
- 重新打包,以上三項已含入 `IdleAdventure-v0.1-win-x64.zip`。

---

## 待辦 / 已知限制(滾動更新)

> 完成後移到對應日期區塊或劃掉;新發現的問題往這裡加。

### 尚未實作(對照需求)
- [x] ~~主視窗(角色 / 背包+裝備 / 加工 / 技能 / 地圖 五分頁)+ 從懸浮視窗開啟~~ → 已完成(背包/加工/技能為版面預覽)。
- [x] ~~屬性分配 UI~~ → 角色頁 [+] 鈕已可分配。
- [x] ~~洗點 UI~~ → 角色頁洗點鈕已可用;**費用規則仍暫定(遞增),待最終定案**。
- [x] ~~裝備系統(掉落、詞綴、稀有度、前後綴、物品等級 Tier)~~ → M4 完成,背包/裝備頁可換裝。
- [x] ~~加工系統(石頭 + 金錢升階、成功率、保底、稀有度晉升)~~ → M5 完成,加工頁可升階。
- [x] ~~技能系統(技能書、3 槽配置、主動 CD+MP / 被動)~~ → M6 完成,技能頁可配槽、戰鬥自動施放。
- [x] ~~Boss / 世界 Boss~~ → 已實作(區域 Boss + 世界 Boss + 狂暴/週期重擊 + 世界王保底高階石+大量掉落+升圖);難度曲線重做 + 玩家 scaling 微調 + 新手起始裝/低等緩坡。數值待實機微調。

### 已知技術債 / 待優化
- [ ] 離線收益目前用**粗估**(每秒基準 × 等級),尚未實作「最近 5 分鐘實際收益速率」取樣(REQ §10.1)。
- [ ] 離線結算的經驗目前直接加進 `exp`,未走 `gainExp`(可能未即時觸發升級結算)——待 M7 完整化時修。
- [ ] tray icon 用內嵌 base64 小圖,之後換正式美術。
- [ ] 尚無單元測試框架(目前靠 headless 腳本手動驗證),待 M1 完整化時導入(傾向 Vitest / node:test)。
- [ ] Windows exe 未簽章,使用者首次執行會被 SmartScreen 警告(需「仍要執行」)。

---

## 變更紀錄(日誌本身的格式 / 結構變動)
- 2026-06-05:建立開發日誌,記錄 v0.1 骨架完成 + 三項修正。
