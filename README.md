# IdleAdventure(放置養成冒險遊戲)

> 一款桌面放置型 RPG —— 掛著就會自動戰鬥、掉裝、升級;你負責配屬性、做裝、配技能、推地圖。
> Electron + TypeScript + 原生 HTML/CSS/JS,以 esbuild 打包。

---

## 簡介

懸浮小視窗常駐桌面顯示戰況,點開有完整主視窗(角色 / 背包裝備 / 加工 / 技能 / 地圖 / 設定)。
核心邏輯為**純 TypeScript**(零 Electron / 零 DOM 依賴),方便測試與調數值;UI 只負責 render。

## 已實作系統

- **角色 / 六屬性**(STR / INT / DEF / DEX / SPD / LUK):角色為「保底」,主力戰力來自裝備與技能。
- **即時 DPS 戰鬥**:普攻只計物理、魔法只走技能;POE 式護甲減傷;DEX→命中/閃避、LUK→爆傷;HP/MP 隨時間回復。
- **裝備系統**:武器分類(單/雙手、法杖、盾、法球…)、稀有度(白→橙)、前後綴詞綴 + Tier(物等決定 Tier 機率)、屬性與戰鬥數值分離。
- **加工 / 做裝石頭(類 POE 通貨)**:升階石(稀有度↑)、指定前/後綴、淨化、群組重鑄、前/後綴精煉(Tier 交換);加工費依**物等 × 總加工次數**指數成長。
- **技能**:3 槽主被動共用、主動 CD+MP 觸發、被動常駐;掉技能書取得。
- **地圖 / Boss**:六區域(各強化一屬性)→ 區域王 → 世界王(升地圖等級,怪等 +5);Boss 有狂暴 / 週期重擊;自由選地圖等級與區域,可切「自動打王 / 循環同一關卡」。
- **經濟**:怪物掉金、裝備販賣價(物等 + 稀有度 + 詞綴數 + Tier)、金幣擴充背包。
- **倉庫**:類別 / 稀有度篩選 + 排序、我的最愛(★ 防誤賣)、批量販賣/丟棄、裝備比對。
- **設定 / 開發者面板**:刷怪模式開關;隱藏 dev 面板(經驗/掉落倍率、無限金錢/加工石、重置/清倉)。

## 技術

- **Electron 31**(main 主程序 + preload contextBridge + renderer)
- **TypeScript**(strict;`tsc --noEmit` 型別檢查)
- **esbuild**(打包多個進入點 + 複製 html/css)
- **electron-builder**(產出 Windows 可執行檔)

## 開發 / 執行

> 程式碼在 `v0.1/` 子目錄;需先安裝 [Node.js](https://nodejs.org/)(建議 18+)。

```bash
cd v0.1
npm install          # 安裝依賴(node_modules 不入庫,clone 後需重裝)
npm run build        # esbuild 打包到 dist/
npm start            # 啟動 Electron
npx tsc --noEmit     # 型別檢查(選用)
```

## 打包(Windows)

```bash
cd v0.1
npm run pack:win     # 產出未壓縮資料夾 release/win-unpacked/
npm run dist:win     # 產出安裝檔 / 可散布版
```

> 可玩的打包檔請放到本 repo 的 **Releases** 附件,不要入庫(建置產物可重生、且檔案過大)。

## 專案結構(摘要)

```
GAME/
├─ README.md / REQUIREMENTS.md / ARCHITECTURE.md / DEV_LOG.md   # 文件
└─ v0.1/
   ├─ src/
   │  ├─ core/     # 純 TS 遊戲核心(狀態 / 公式 / 戰鬥 / 物品 / 地圖)
   │  ├─ data/     # 可調平衡資料(balance / affixes / skills / stones)
   │  ├─ shell/    # Electron 主程序 + 存檔
   │  ├─ preload/  # contextBridge IPC
   │  └─ ui/       # renderer(overlay 懸浮視窗 / main 主視窗)
   ├─ esbuild.config.mjs / package.json / tsconfig.json
   └─ dist/ release/ node_modules/   # 建置產物 / 依賴(皆不入庫)
```

詳細設計見 **[REQUIREMENTS.md](REQUIREMENTS.md)**(需求 / 數值),架構見 **[ARCHITECTURE.md](ARCHITECTURE.md)**,開發歷程見 **[DEV_LOG.md](DEV_LOG.md)**。

## 狀態

開發中(v0.1)。核心系統皆已可運作,數值平衡持續調整中。
