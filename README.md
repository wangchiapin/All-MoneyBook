# 個人財務資產管理

> 帳戶、股票、保險、定期定額與股利紀錄

- **網址：** https://wangchiapin.github.io/All-MoneyBook/
- **Firebase 專案：** moneybook-50481
- **登入方式：** Email / 密碼
- **狀態：** 使用中
- **備註：** 資料在 `financeAssets` 等集合。與 `moneybook` 共用同一個 Firebase 專案。
- **雲端資料：** `financeAssets`（財務總覽）、`stockAssets`（股票管理＋美元匯率設定）、`insuranceAssets`（保險總覽）、`overviewMonthly`（資產總覽每月紀錄），每個帳號各一份
- **自動股價：** GitHub Action「每日更新收盤價」（`.github/workflows/prices.yml`）週一到週五 16:10 抓台股（上市、上櫃、ETF）當天收盤價與美股前一晚收盤價，存成 `data/prices.json`。美股代號列在 `data/us-symbols.txt`（一行一個）。股票管理的「🔄 更新股價」讀這個檔案，順便更新媽的永豐現值。可在 Actions 頁面手動按「Run workflow」立刻抓一次
- **資產總覽：** 合併財務總覽最新一欄（現金）、股票管理（股票）、保險總覽（保險）的現在狀態，每月自動記錄一次，上個月用 Action 存的月底收盤價（`data/month-end/`）重算股票現值，顯示「比上月」增減；可匯出 PDF
