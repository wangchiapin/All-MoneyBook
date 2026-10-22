# 財務資產（All-MoneyBook）→ Google 試算表 同步腳本（Apps Script）

- 檔案：`finance-sync.gs`（貼進 Google Apps Script 專案，進入點 `syncAllFinance`）
- 讀的資料（Firebase 專案 `moneybook-50481`）：`financeAssets/{uid}`、`stockAssets/{uid}`、`insuranceAssets/{uid}`、`overviewMonthly/{uid}`
- 指令碼屬性：`FIREBASE_PROJECT_ID`、`MONEYBOOK_UID`、`FIREBASE_PRIVATE_KEY`、`FIREBASE_CLIENT_EMAIL`；需要 OAuth2 程式庫
- 這份是 2026-10-19 Ben 貼給 Claude 的版本（一字未改）存檔

## ⚠️ 改了下面這些，就要同步改這支腳本（並提醒 Ben 重新貼到 Apps Script）
- 上述四份文件的欄位名稱、結構（例如 `state.dates／values／bankItems`、`stocks`、`stockSales`、`stockBuys`、`lendingIncomeRows`、`dividendEstimates`、`exRightsInfo`、`snapshots`、`policies`、`months`…）
- 集合名稱或文件路徑
- 清空重置（「清空雲端」）會刪掉這四份文件；前面幾個函式讀不到文件會中斷

## weekly-report.gs（每週資產週報）
每週日晚上 8 點（台北時間）寄「全部資產一覽」週報。獨立一個檔案，貼成 Apps Script 的新檔案 `WeeklyReport` 即可，不動原本的同步程式。
- 上方數字取自 Firestore `overviewMonthly`（打開「全部資產一覽」分頁時自動記錄），信上會註明更新時間，超過一週沒更新會警告；「股票配置（依證券帳戶）」與「每年被動收入」另外讀 `stockAssets`（持股、歷史股利、借券、媽的永豐）。
- 圖表用 Apps Script 內建 Charts 服務畫成圖片嵌入信件；任何一張畫失敗只會少那一張。
- 先執行 `previewWeeklyReport` 試寄，再執行 `installWeeklyReportTrigger` 設定排程；`removeWeeklyReportTrigger` 取消。
- 收件人一定要先到「專案設定 → 指令碼屬性」新增 `REPORT_EMAIL`（值填收件信箱），沒設會停下來提醒；信箱不寫在程式碼裡（倉庫是公開的）。重新貼新版程式不會清掉屬性。
- 若改動 `overviewMonthly` 或 `stockAssets`（stocks、pastColumns、lendingIncomeRows…）的欄位，記得同步修改這支。
