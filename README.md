# 個人財務資產管理

> 帳戶、股票、保險、定期定額與股利紀錄

- **網址：** https://wangchiapin.github.io/All-MoneyBook/
- **Firebase 專案：** moneybook-50481
- **登入方式：** Email / 密碼
- **狀態：** 使用中
- **備註：** 資料在 `financeAssets` 等集合。與 `moneybook` 共用同一個 Firebase 專案。
- **雲端資料：** `financeAssets`（財務總覽）、`stockAssets`（股票管理＋美元匯率設定）、`insuranceAssets`（保險總覽），每個帳號各一份
- **自動股價：** GitHub Action「每日更新收盤價」（`.github/workflows/prices.yml`）週一到週五 16:10 抓證交所／櫃買中心收盤價，存成 `data/prices.json`；股票管理的「🔄 更新股價」按鈕讀這個檔案。可在 Actions 頁面手動按「Run workflow」立刻抓一次
