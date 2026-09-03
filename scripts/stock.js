    /* 股票管理模組共用主殼層 (個人財務資產狀況管理) 已初始化好的 fbAuth / fbDb，
       不在這裡重複 initializeApp，避免 Firebase 重複初始化錯誤。 */
    const CLOUD_COLLECTION = 'stockAssets';
    let stockCloudSyncTimer = null;

    const STORAGE_KEY_STOCKS = 'STOCK_INVESTMENT_EXCEL_PRO_V32_STOCKS';
    const STORAGE_KEY_PAST = 'STOCK_INVESTMENT_EXCEL_PRO_V32_PAST';
    const STORAGE_KEY_CUSTOM_ACCOUNTS = 'STOCK_INVESTMENT_EXCEL_PRO_V32_ACCOUNTS';
    const STORAGE_KEY_STOCK_SALES = 'STOCK_INVESTMENT_EXCEL_PRO_V32_STOCK_SALES';
    const STORAGE_KEY_SALES_HISTORY = 'STOCK_INVESTMENT_EXCEL_PRO_V32_SALES_HISTORY';

    const INITIAL_DATA = [
      {"id": 1, "name": "元大高股息", "code": "0056", "category": "ETF", "account": "富邦證券", "shares": 7562, "totalCost": 250794, "currentPrice": 52.27, "cashDividends": 90698, "stockShares": 0, "dividendHistory": [{"year": 2024, "cashDate": "2024-08-15", "cash": 50000, "stockDate": "", "stockShares": 0}, {"year": 2025, "cashDate": "2025-08-15", "cash": 40698, "stockDate": "", "stockShares": 0}], "lentShares": 0},
      {"id": 2, "name": "國泰台灣科技龍頭", "code": "00881", "category": "ETF", "account": "富邦證券", "shares": 6730, "totalCost": 127907, "currentPrice": 48.47, "cashDividends": 110860, "stockShares": 0, "dividendHistory": [{"year": 2024, "cashDate": "2024-08-10", "cash": 60000, "stockDate": "", "stockShares": 0}, {"year": 2025, "cashDate": "2025-08-10", "cash": 50860, "stockDate": "", "stockShares": 0}], "lentShares": 11000},
      {"id": 3, "name": "台泥", "code": "1101", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 36, "currentPrice": 23.0, "cashDividends": 69, "stockShares": 0, "dividendHistory": [{"year": 2024, "cashDate": "2024-07-20", "cash": 69, "stockDate": "", "stockShares": 0}], "lentShares": 0},
      {"id": 4, "name": "大成", "code": "1210", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 54, "currentPrice": 52.0, "cashDividends": 436, "stockShares": 0, "dividendHistory": [{"year": 2024, "cashDate": "2024-08-01", "cash": 436, "stockDate": "", "stockShares": 0}], "lentShares": 0},
      {"id": 5, "name": "卜蜂", "code": "1215", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 155, "currentPrice": 111.0, "cashDividends": 939, "stockShares": 0, "dividendHistory": [{"year": 2024, "cashDate": "2024-08-05", "cash": 939, "stockDate": "", "stockShares": 0}], "lentShares": 0},
      {"id": 6, "name": "愛之味", "code": "1217", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 11, "currentPrice": 9.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 7, "name": "聯華", "code": "1229", "category": "台股", "account": "富邦證券", "shares": 715, "totalCost": 18623, "currentPrice": 42.21, "cashDividends": 57662, "stockShares": 0, "dividendHistory": [{"year": 2023, "cashDate": "2023-08-25", "cash": 25000, "stockDate": "", "stockShares": 0}, {"year": 2024, "cashDate": "2024-08-25", "cash": 32662, "stockDate": "", "stockShares": 0}], "lentShares": 5000},
      {"id": 8, "name": "大魯閣", "code": "1432", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 21, "currentPrice": 14.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 9, "name": "台肥", "code": "1722", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 52, "currentPrice": 45.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 10, "name": "正隆", "code": "1904", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 30, "currentPrice": 24.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 11, "name": "中鋼", "code": "2002", "category": "台股", "account": "富邦證券", "shares": 10, "totalCost": 290, "currentPrice": 19.3, "cashDividends": 3563, "stockShares": 0, "dividendHistory": [{"year": 2024, "cashDate": "2024-08-28", "cash": 3563, "stockDate": "", "stockShares": 0}], "lentShares": 0},
      {"id": 12, "name": "聯電", "code": "2303", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 49, "currentPrice": 115.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 13, "name": "鴻海", "code": "2317", "category": "台股", "account": "富邦證券", "shares": 123, "totalCost": 28423, "currentPrice": 244.41, "cashDividends": 26, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 14, "name": "台積電", "code": "2330", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 2293, "currentPrice": 2400.0, "cashDividends": 850, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 15, "name": "佳世達", "code": "2352", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 24, "currentPrice": 27.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 16, "name": "山隆", "code": "2616", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 18, "currentPrice": 12.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 17, "name": "王品", "code": "2727", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 248, "currentPrice": 236.0, "cashDividends": 231, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 18, "name": "彰銀", "code": "2801", "category": "台股", "account": "富邦證券", "shares": 10, "totalCost": 203, "currentPrice": 24.0, "cashDividends": 528, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 19, "name": "臺企銀", "code": "2834", "category": "台股", "account": "富邦證券", "shares": 19000, "totalCost": 176657, "currentPrice": 16.48, "cashDividends": 522, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 20, "name": "華南金", "code": "2880", "category": "台股", "account": "富邦證券", "shares": 500, "totalCost": 14185, "currentPrice": 39.43, "cashDividends": 11495, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 21, "name": "富邦金", "code": "2881", "category": "台股", "account": "富邦證券", "shares": 230, "totalCost": 20837, "currentPrice": 133.41, "cashDividends": 541, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 22, "name": "凱基金", "code": "2883", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 15, "currentPrice": 30.0, "cashDividends": 3095, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 23, "name": "玉山金", "code": "2884", "category": "台股", "account": "富邦證券", "shares": 15306, "totalCost": 338553, "currentPrice": 37.83, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 24, "name": "元大金", "code": "2885", "category": "台股", "account": "富邦證券", "shares": 11300, "totalCost": 246130, "currentPrice": 63.72, "cashDividends": 24120, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 25, "name": "兆豐金", "code": "2886", "category": "台股", "account": "富邦證券", "shares": 1590, "totalCost": 63033, "currentPrice": 46.74, "cashDividends": 19795, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 26, "name": "永豐金", "code": "2890", "category": "台股", "account": "富邦證券", "shares": 10, "totalCost": 219, "currentPrice": 39.4, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 27, "name": "中信金", "code": "2891", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 41, "currentPrice": 64.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 28, "name": "第一金", "code": "2892", "category": "台股", "account": "富邦證券", "shares": 1310, "totalCost": 37114, "currentPrice": 33.5, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 29, "name": "富采", "code": "3714", "category": "台股", "account": "富邦證券", "shares": 1, "totalCost": 48, "currentPrice": 56.0, "cashDividends": 12017, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 30, "name": "合庫金", "code": "5880", "category": "台股", "account": "富邦證券", "shares": 310, "totalCost": 7438, "currentPrice": 24.94, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 31, "name": "富邦台50", "code": "006208", "category": "ETF", "account": "國泰證券", "shares": 48, "totalCost": 11048, "currentPrice": 238.9, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 32, "name": "富邦NASDAQ", "code": "00662", "category": "ETF", "account": "國泰證券", "shares": 77, "totalCost": 9192, "currentPrice": 119.7, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 33, "name": "國泰永續高股息", "code": "00878", "category": "ETF", "account": "國泰證券", "shares": 16169, "totalCost": 321974, "currentPrice": 32.34, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 34, "name": "富邦半導體", "code": "00892", "category": "ETF", "account": "國泰證券", "shares": 240, "totalCost": 9871, "currentPrice": 38.99, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 35, "name": "群益台灣精選", "code": "00919", "category": "ETF", "account": "國泰證券", "shares": 1732, "totalCost": 42070, "currentPrice": 30.76, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 36, "name": "卜蜂", "code": "1215", "category": "台股", "account": "國泰證券", "shares": 45, "totalCost": 5169, "currentPrice": 111.6, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 37, "name": "台積電", "code": "2330", "category": "台股", "account": "國泰證券", "shares": 11, "totalCost": 18411, "currentPrice": 2402.0, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 38, "name": "京元電子", "code": "2449", "category": "台股", "account": "國泰證券", "shares": 82, "totalCost": 20820, "currentPrice": 231.2, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 39, "name": "華南金", "code": "2880", "category": "台股", "account": "國泰證券", "shares": 50, "totalCost": 1978, "currentPrice": 39.48, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 40, "name": "神基", "code": "3005", "category": "台股", "account": "國泰證券", "shares": 175, "totalCost": 18819, "currentPrice": 123.26, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 41, "name": "寶雅", "code": "5904", "category": "台股", "account": "國泰證券", "shares": 10, "totalCost": 781, "currentPrice": 74.2, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 42, "name": "可口可樂", "code": "KO", "category": "美股", "account": "美股複委託", "shares": 0, "totalCost": 0, "currentPrice": 68.5, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0},
      {"id": 43, "name": "BTI", "code": "BTI", "category": "美股", "account": "美股複委託", "shares": 50, "totalCost": 2006.24, "currentPrice": 38.2, "cashDividends": 0, "stockShares": 0, "dividendHistory": [], "lentShares": 0}
    ];

    const INITIAL_REALIZED_EXCEL_COLUMNS = [
      {"year": "104-107", "items": [{"stock": "中聯資源", "amount": 490, "cashDate": ""}, {"stock": "得力", "amount": 2190, "cashDate": ""}, {"stock": "統一", "amount": 2236, "cashDate": ""}, {"stock": "山隆", "amount": 3758, "cashDate": ""}, {"stock": "長虹", "amount": 1230, "cashDate": ""}, {"stock": "潤弘104", "amount": 1115, "cashDate": ""}, {"stock": "潤弘105", "amount": 1600, "cashDate": ""}, {"stock": "潤弘106", "amount": 1390, "cashDate": ""}, {"stock": "潤弘107", "amount": 813, "cashDate": ""}, {"stock": "惠普", "amount": 24301, "cashDate": ""}]},
      {"year": "108", "items": [{"stock": "美食KY", "amount": 490, "cashDate": ""}, {"stock": "仁寶", "amount": 2390, "cashDate": ""}, {"stock": "中聯資源", "amount": 1390, "cashDate": ""}, {"stock": "得力", "amount": 4490, "cashDate": ""}, {"stock": "統一", "amount": 490, "cashDate": ""}, {"stock": "山隆", "amount": 2390, "cashDate": ""}, {"stock": "長虹", "amount": 2090, "cashDate": ""}, {"stock": "潤弘", "amount": 4790, "cashDate": ""}, {"stock": "惠普", "amount": 10006, "cashDate": ""}]},
      {"year": "109", "items": [{"stock": "美食KY", "amount": 440, "cashDate": ""}, {"stock": "仁寶", "amount": 3590, "cashDate": ""}, {"stock": "中聯資源", "amount": 1990, "cashDate": ""}, {"stock": "得力", "amount": 4994, "cashDate": ""}, {"stock": "統一", "amount": 490, "cashDate": ""}, {"stock": "台橡", "amount": 1490, "cashDate": ""}, {"stock": "山隆", "amount": 2870, "cashDate": ""}, {"stock": "長虹", "amount": 2157, "cashDate": ""}, {"stock": "潤弘", "amount": 4490, "cashDate": ""}, {"stock": "惠普", "amount": 10534, "cashDate": ""}]},
      {"year": "110", "items": [{"stock": "美食KY", "amount": 1310, "cashDate": ""}, {"stock": "康全電訊", "amount": 985, "cashDate": ""}, {"stock": "台積電", "amount": 626, "cashDate": ""}, {"stock": "中聯資源", "amount": 2440, "cashDate": ""}, {"stock": "得力", "amount": 1520, "cashDate": ""}, {"stock": "統一", "amount": 557, "cashDate": ""}, {"stock": "榮成", "amount": 650, "cashDate": ""}, {"stock": "台橡", "amount": 1178, "cashDate": ""}, {"stock": "山隆", "amount": 3510, "cashDate": ""}, {"stock": "長虹", "amount": 2590, "cashDate": ""}, {"stock": "潤弘", "amount": 6490, "cashDate": ""}, {"stock": "群創", "amount": 811, "cashDate": ""}, {"stock": "大樹", "amount": 134, "cashDate": ""}, {"stock": "惠普", "amount": 10534, "cashDate": ""}, {"stock": "富邦半導體", "amount": 1515, "cashDate": ""}]},
      {"year": "111", "items": [{"stock": "美食KY", "amount": 1785, "cashDate": ""}, {"stock": "仁寶", "amount": 1990, "cashDate": ""}, {"stock": "康全電訊", "amount": 580, "cashDate": ""}, {"stock": "中聯資源", "amount": 3090, "cashDate": ""}, {"stock": "中信綠能電動車", "amount": 566, "cashDate": ""}, {"stock": "永豐ESG", "amount": 1195, "cashDate": ""}, {"stock": "台積電", "amount": 1262, "cashDate": ""}, {"stock": "得力", "amount": 1340, "cashDate": ""}, {"stock": "統一", "amount": 584, "cashDate": ""}, {"stock": "榮成", "amount": 518, "cashDate": ""}, {"stock": "台橡", "amount": 8426, "cashDate": ""}, {"stock": "山隆", "amount": 4240, "cashDate": ""}, {"stock": "長虹", "amount": 2516, "cashDate": ""}, {"stock": "潤弘", "amount": 11150, "cashDate": ""}, {"stock": "群創", "amount": 4262, "cashDate": ""}, {"stock": "大樹", "amount": 848, "cashDate": ""}, {"stock": "惠普", "amount": 111852, "cashDate": ""}, {"stock": "富邦半導體", "amount": 3278, "cashDate": ""}]},
      {"year": "112", "items": [{"stock": "美食KY", "amount": 127, "cashDate": ""}, {"stock": "桂盟", "amount": 215, "cashDate": ""}, {"stock": "融程電", "amount": 113, "cashDate": ""}, {"stock": "中信綠能電動車", "amount": 690, "cashDate": ""}, {"stock": "永豐ESG", "amount": 1667, "cashDate": ""}, {"stock": "國際中橡", "amount": 190, "cashDate": ""}, {"stock": "台積電", "amount": 1295, "cashDate": ""}, {"stock": "富邦媒", "amount": 770, "cashDate": ""}, {"stock": "鐿鈦", "amount": 12806, "cashDate": ""}, {"stock": "承業醫", "amount": 94, "cashDate": ""}, {"stock": "長佳", "amount": 908, "cashDate": ""}, {"stock": "台灣高鐵", "amount": 160, "cashDate": ""}, {"stock": "全科", "amount": 651, "cashDate": ""}, {"stock": "華紙", "amount": 641, "cashDate": ""}, {"stock": "寶島科", "amount": 33, "cashDate": ""}, {"stock": "三陽工業", "amount": 2240, "cashDate": ""}, {"stock": "生達", "amount": 15, "cashDate": ""}, {"stock": "森崴能源", "amount": 1065, "cashDate": ""}, {"stock": "六角", "amount": 766, "cashDate": ""}, {"stock": "駐龍", "amount": 95, "cashDate": ""}, {"stock": "亞翔", "amount": 112, "cashDate": ""}, {"stock": "漢來美食", "amount": 983, "cashDate": ""}, {"stock": "盛弘", "amount": 100, "cashDate": ""}, {"stock": "台積電", "amount": 67, "cashDate": ""}, {"stock": "得力", "amount": 2190, "cashDate": ""}, {"stock": "統一", "amount": 210, "cashDate": ""}, {"stock": "榮成", "amount": 15, "cashDate": ""}, {"stock": "台橡", "amount": 3894, "cashDate": ""}, {"stock": "山隆", "amount": 310, "cashDate": ""}, {"stock": "長虹", "amount": 3840, "cashDate": ""}, {"stock": "潤弘", "amount": 10990, "cashDate": ""}, {"stock": "大樹", "amount": 2349, "cashDate": ""}, {"stock": "惠普", "amount": 13385, "cashDate": ""}, {"stock": "元大台灣價值高息", "amount": 40, "cashDate": ""}, {"stock": "復華台灣科技", "amount": 40, "cashDate": ""}, {"stock": "統一台灣高息", "amount": 40, "cashDate": ""}, {"stock": "富邦半導體", "amount": 4409, "cashDate": ""}]},
      {"year": "113", "items": [{"stock": "台積電", "amount": 25, "cashDate": ""}, {"stock": "台積電", "amount": 54, "cashDate": ""}, {"stock": "八貫", "amount": 4140, "cashDate": ""}, {"stock": "豐達科", "amount": 101, "cashDate": ""}, {"stock": "六角", "amount": 4172, "cashDate": ""}, {"stock": "美食KY", "amount": 2772, "cashDate": ""}, {"stock": "台積電", "amount": 152, "cashDate": ""}, {"stock": "潤弘", "amount": 530, "cashDate": ""}, {"stock": "鴻海", "amount": 589, "cashDate": ""}, {"stock": "鐿鈦", "amount": 11764, "cashDate": ""}, {"stock": "宏全", "amount": 43, "cashDate": ""}, {"stock": "至上", "amount": 433, "cashDate": ""}, {"stock": "中探針", "amount": 48, "cashDate": ""}, {"stock": "京元電子", "amount": 6, "cashDate": ""}, {"stock": "生達", "amount": 111, "cashDate": ""}, {"stock": "森崴能源", "amount": 101, "cashDate": ""}, {"stock": "彰銀", "amount": 292, "cashDate": ""}, {"stock": "大樹", "amount": 360, "cashDate": ""}, {"stock": "台積電", "amount": 255, "cashDate": ""}, {"stock": "六角", "amount": 3779, "cashDate": ""}, {"stock": "惠普", "amount": 11710, "cashDate": ""}, {"stock": "富邦半導體", "amount": 3862, "cashDate": ""}, {"stock": "元大台灣價值高息", "amount": 507, "cashDate": ""}, {"stock": "復華台灣科技", "amount": 1051, "cashDate": ""}, {"stock": "統一台灣高息", "amount": 775, "cashDate": ""}]},
      {"year": "114", "items": [{"stock": "台積電", "amount": 258, "cashDate": ""}, {"stock": "台積電", "amount": 319, "cashDate": ""}, {"stock": "六角", "amount": 2490, "cashDate": ""}, {"stock": "台積電", "amount": 359, "cashDate": ""}, {"stock": "元大台灣價值高息", "amount": 178, "cashDate": ""}, {"stock": "富邦半導體", "amount": 376, "cashDate": ""}, {"stock": "復華台灣科技", "amount": 1132, "cashDate": ""}, {"stock": "統一台灣高息", "amount": 449, "cashDate": ""}, {"stock": "統一台灣高息", "amount": 136, "cashDate": ""}]},
      {"year": "115", "items": [{"stock": "台積電", "amount": 20, "cashDate": ""}, {"stock": "台積電", "amount": 25, "cashDate": ""}, {"stock": "神基", "amount": 37, "cashDate": ""}, {"stock": "台積電", "amount": 43, "cashDate": ""}, {"stock": "佳世達", "amount": 1, "cashDate": ""}]}
    ];

    const INITIAL_STOCK_SALES = [
      {"date": "1150102", "name": "京元電子", "shares": 5, "buyPrice": 249.5, "sellPrice": 268.5, "cost": 1248, "sellAmt": 1338, "spread": 90, "returnRate": 0.072115, "buyFee": 0, "sellFee": 1, "tax": 8, "status": "獲益", "dayTotal": 435, "note": "", "note2": ""},
      {"date": "1150102", "name": "京元電子", "shares": 5, "buyPrice": 247, "sellPrice": 268.5, "cost": 1236, "sellAmt": 1338, "spread": 102, "returnRate": 0.082524, "buyFee": 0, "sellFee": 0, "tax": 0, "status": "", "dayTotal": null, "note": "", "note2": ""},
      {"date": "1150102", "name": "神基", "shares": 1000, "buyPrice": 116.5, "sellPrice": 117, "cost": 116541, "sellAmt": 116784, "spread": 243, "returnRate": 0.002085, "buyFee": 41, "sellFee": 41, "tax": 175, "status": "當沖", "dayTotal": null, "note": "", "note2": ""},
      {"date": "1150105", "name": "卜蜂", "shares": 5000, "buyPrice": 132, "sellPrice": 132.5, "cost": 660235, "sellAmt": 661271, "spread": 1036, "returnRate": 0.001569, "buyFee": 235, "sellFee": 236, "tax": 993, "status": "當沖", "dayTotal": -3012, "note": "", "note2": ""},
      {"date": "1150105", "name": "卜蜂", "shares": 1000, "buyPrice": 133, "sellPrice": 133.5, "cost": 133047, "sellAmt": 133253, "spread": 206, "returnRate": 0.001548, "buyFee": 47, "sellFee": 47, "tax": 200, "status": "當沖", "dayTotal": null, "note": "", "note2": ""},
      {"date": "1150105", "name": "神基", "shares": 1000, "buyPrice": 113.5, "sellPrice": 113.5, "cost": 113540, "sellAmt": 113289, "spread": -251, "returnRate": -0.00221, "buyFee": 40, "sellFee": 40, "tax": 170, "status": "當沖", "dayTotal": null, "note": "", "note2": ""},
      {"date": "1150105", "name": "神基", "shares": 1000, "buyPrice": 113.5, "sellPrice": 113.5, "cost": 113540, "sellAmt": 113289, "spread": -251, "returnRate": -0.00221, "buyFee": 40, "sellFee": 40, "tax": 170, "status": "當沖", "dayTotal": null, "note": "", "note2": ""},
      {"date": "1150105", "name": "神基", "shares": 1000, "buyPrice": 113.5, "sellPrice": 113.5, "cost": 113540, "sellAmt": 113289, "spread": -251, "returnRate": -0.00221, "buyFee": 40, "sellFee": 40, "tax": 170, "status": "當沖", "dayTotal": null, "note": "", "note2": ""},
      {"date": "1150105", "name": "神基", "shares": 1000, "buyPrice": 115.5, "sellPrice": 113.5, "cost": 115541, "sellAmt": 113290, "spread": -2251, "returnRate": -0.01948, "buyFee": 41, "sellFee": 40, "tax": 170, "status": "當沖", "dayTotal": null, "note": "", "note2": ""},
      {"date": "1150105", "name": "神基", "shares": 1000, "buyPrice": 114.5, "sellPrice": 113.5, "cost": 114540, "sellAmt": 113290, "spread": -1250, "returnRate": -0.01091, "buyFee": 40, "sellFee": 42, "tax": 171, "status": "當沖", "dayTotal": null, "note": "", "note2": ""}
    ];

    const INITIAL_SALES_HISTORY = [
      {"year": "115", "totalCost": 19347163, "totalSell": 19237985, "spread": -109178, "returnRate": -0.0056},
      {"year": "114", "totalCost": 174855651, "totalSell": 174259914, "spread": -595737, "returnRate": -0.0034},
      {"year": "113", "totalCost": 252624364, "totalSell": 251889895, "spread": -785981, "returnRate": -0.0031},
      {"year": "112", "totalCost": 209644677, "totalSell": 209098913, "spread": -554478, "returnRate": -0.0026},
      {"year": "111", "totalCost": 31464741, "totalSell": 31542502, "spread": 77761, "returnRate": 0.0025},
      {"year": "110", "totalCost": 1143589, "totalSell": 1206890, "spread": 63301, "returnRate": 0.0554},
      {"year": "109", "totalCost": 659407, "totalSell": 692619, "spread": 33212, "returnRate": 0.0504},
      {"year": "108", "totalCost": 443181, "totalSell": 492060, "spread": 48879, "returnRate": 0.1103},
      {"year": "107", "totalCost": 278860, "totalSell": 310378, "spread": 11306, "returnRate": 0.0405}
    ];

    // 媽的永豐 獨立資料變數 (完全安全的 JSON 序列化載入) —— 買賣明細 / 帳戶明細 / 除息資訊 三表 + 總覽
    let yfDetail = JSON.parse(localStorage.getItem('YONG_FENG_DETAIL_V1') || JSON.stringify([
      { date: '1130726', shares: 30, price: 30.00, cost: 900 },
      { date: '1130815', shares: 30, price: 30.00, cost: 900 },
      { date: '1131216', shares: 30, price: 30.00, cost: 900 },
      { date: '1131217', shares: 30, price: 30.00, cost: 900 },
      { date: '1141106', shares: 30, price: 30.00, cost: 900 },
      { date: '1141208', shares: 30, price: 30.00, cost: 900 },
      { date: '1150706', shares: 30, price: 30.00, cost: 900 },
      { date: '1150730', shares: 60, price: 30.00, cost: 1800 }
    ]));
    let yfAccount = JSON.parse(localStorage.getItem('YONG_FENG_ACCOUNT_V1') || JSON.stringify([
      { date: '1130528', type: '入帳', detail: '媽媽的錢', amount: 20000, balance: 0, note: '' },
      { date: '1130606', type: '出帳', detail: '國泰永續高股息', amount: -990, balance: 0, note: '' },
      { date: '1130617', type: '出帳', detail: '國泰永續高股息', amount: -982, balance: 0, note: '' },
      { date: '1130621', type: '入帳', detail: '利息', amount: 8, balance: 0, note: '' },
      { date: '1130626', type: '出帳', detail: '國泰永續高股息', amount: -995, balance: 0, note: '' }
    ]));
    let yfDividendRows = JSON.parse(localStorage.getItem('YONG_FENG_DIVIDEND_V1') || JSON.stringify([
      { exDate: '1130816', cashPerShare: 0.55, payDate: '1130911', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1131118', cashPerShare: 0.55, payDate: '1131212', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1140220', cashPerShare: 0.50, payDate: '1140318', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1140519', cashPerShare: 0.47, payDate: '1140613', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1140818', cashPerShare: 0.40, payDate: '1140911', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1141118', cashPerShare: 0.40, payDate: '1141212', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1150226', cashPerShare: 0.42, payDate: '1150323', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1150519', cashPerShare: 0.66, payDate: '1150612', heldShares: 0, divAmount: 0, cumulative: 0 },
      { exDate: '1150818', cashPerShare: 1.01, payDate: '1150911', heldShares: 0, divAmount: 0, cumulative: 0 }
    ]));
    let yfOverview = JSON.parse(localStorage.getItem('YONG_FENG_OVERVIEW_V2') || JSON.stringify({ stockName: '國泰永續高股息00878', currentValue: 0, goal: 100000 }));

    let stocks = [];
    let pastColumns = [];
    let customAccounts = [];
    let stockSales = [];
    let salesHistory = [];
    let dividendEstimates = {};
    let historyStack = [];
    let currentFilter = 'ALL';
    let salesSubTab = 'list';
    let dividendsSubTab = 'summary'; // 'summary', 'past', 'estimate'
    let selectedSummaryYear = '115';
    let selectedSnapshotDate = null;
    let currentEditingStockId = null;
    let currentModalType = 'cash';
    let draggedStockId = null;

    function init() {
      try {
        const savedStocks = localStorage.getItem(STORAGE_KEY_STOCKS);
        stocks = savedStocks ? JSON.parse(savedStocks) : INITIAL_DATA;

        const savedAccounts = localStorage.getItem(STORAGE_KEY_CUSTOM_ACCOUNTS);
        customAccounts = savedAccounts ? JSON.parse(savedAccounts) : [];

        stocks.forEach(s => {
          if (s.stockShares === undefined) {
            const totalShares = (s.dividendHistory || []).reduce((sum, h) => sum + (Number(h.stockShares) || (Number(h.stock) || 0)), 0);
            s.stockShares = totalShares;
          }
        });

        const savedPast = localStorage.getItem(STORAGE_KEY_PAST);
        pastColumns = savedPast ? JSON.parse(savedPast) : INITIAL_REALIZED_EXCEL_COLUMNS;

        const savedSales = localStorage.getItem(STORAGE_KEY_STOCK_SALES);
        stockSales = savedSales ? JSON.parse(savedSales) : INITIAL_STOCK_SALES;

        const savedHistory = localStorage.getItem(STORAGE_KEY_SALES_HISTORY);
        salesHistory = savedHistory ? JSON.parse(savedHistory) : INITIAL_SALES_HISTORY;

        const savedEst = localStorage.getItem('STOCK_INVESTMENT_DIVIDEND_ESTIMATES_V1');
        dividendEstimates = savedEst ? JSON.parse(savedEst) : {};
      } catch (e) {
        stocks = INITIAL_DATA;
        customAccounts = [];
        pastColumns = INITIAL_REALIZED_EXCEL_COLUMNS;
        stockSales = INITIAL_STOCK_SALES;
        salesHistory = INITIAL_SALES_HISTORY;
        dividendEstimates = {};
      }

      setupScrollSync();
      renderTabs();
      renderTable();
      setupGlobalShortcuts();
      setupSettingDropdownClose();
      setupCalculatorDrag();
    }

    function recordSnapshot() {
      try {
        historyStack.push(JSON.stringify({ stocks, pastColumns, customAccounts, stockSales, salesHistory, dividendEstimates, yfDetail, yfAccount, yfDividendRows, yfOverview }));
        if (historyStack.length > 50) historyStack.shift();
      } catch(e) {}
    }

    function undo() {
      if (historyStack.length > 0) {
        try {
          const prev = JSON.parse(historyStack.pop());
          stocks = prev.stocks;
          pastColumns = prev.pastColumns;
          if (prev.customAccounts) customAccounts = prev.customAccounts;
          if (prev.stockSales) stockSales = prev.stockSales;
          if (prev.salesHistory) salesHistory = prev.salesHistory;
          if (prev.dividendEstimates) dividendEstimates = prev.dividendEstimates;
          if (prev.yfDetail) yfDetail = prev.yfDetail;
          if (prev.yfAccount) yfAccount = prev.yfAccount;
          if (prev.yfDividendRows) yfDividendRows = prev.yfDividendRows;
          if (prev.yfOverview) yfOverview = prev.yfOverview;
          saveToStorage();
          renderTabs();
          renderTable();
        } catch(e) {}
      }
    }

    function setupGlobalShortcuts() {
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          undo();
        }
      });
    }

    function saveToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY_STOCKS, JSON.stringify(stocks));
        localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastColumns));
        localStorage.setItem(STORAGE_KEY_CUSTOM_ACCOUNTS, JSON.stringify(customAccounts));
        localStorage.setItem(STORAGE_KEY_STOCK_SALES, JSON.stringify(stockSales));
        localStorage.setItem(STORAGE_KEY_SALES_HISTORY, JSON.stringify(salesHistory));
        localStorage.setItem('STOCK_INVESTMENT_DIVIDEND_ESTIMATES_V1', JSON.stringify(dividendEstimates));
        localStorage.setItem('YONG_FENG_DETAIL_V1', JSON.stringify(yfDetail));
        localStorage.setItem('YONG_FENG_ACCOUNT_V1', JSON.stringify(yfAccount));
        localStorage.setItem('YONG_FENG_DIVIDEND_V1', JSON.stringify(yfDividendRows));
        localStorage.setItem('YONG_FENG_OVERVIEW_V2', JSON.stringify(yfOverview));
      } catch(e) {}
      renderSummary();
      scheduleCloudSync();
    }

    /* ====== Firebase 雲端同步 ====== */
    function gatherAllData() {
      return {
        stocks, pastColumns, customAccounts, stockSales, salesHistory,
        dividendEstimates, yfDetail, yfAccount, yfDividendRows, yfOverview,
        snapshots: JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'),
        updatedAt: new Date().toISOString()
      };
    }

    function applyAllData(data) {
      if (!data) return;
      if (data.stocks) stocks = data.stocks;
      if (data.pastColumns) pastColumns = data.pastColumns;
      if (data.customAccounts) customAccounts = data.customAccounts;
      if (data.stockSales) stockSales = data.stockSales;
      if (data.salesHistory) salesHistory = data.salesHistory;
      if (data.dividendEstimates) dividendEstimates = data.dividendEstimates;
      if (data.yfDetail) yfDetail = data.yfDetail;
      if (data.yfAccount) yfAccount = data.yfAccount;
      if (data.yfDividendRows) yfDividendRows = data.yfDividendRows;
      if (data.yfOverview) yfOverview = data.yfOverview;
      if (data.snapshots) localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(data.snapshots));

      localStorage.setItem(STORAGE_KEY_STOCKS, JSON.stringify(stocks));
      localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastColumns));
      localStorage.setItem(STORAGE_KEY_CUSTOM_ACCOUNTS, JSON.stringify(customAccounts));
      localStorage.setItem(STORAGE_KEY_STOCK_SALES, JSON.stringify(stockSales));
      localStorage.setItem(STORAGE_KEY_SALES_HISTORY, JSON.stringify(salesHistory));
      localStorage.setItem('STOCK_INVESTMENT_DIVIDEND_ESTIMATES_V1', JSON.stringify(dividendEstimates));
      localStorage.setItem('YONG_FENG_DETAIL_V1', JSON.stringify(yfDetail));
      localStorage.setItem('YONG_FENG_ACCOUNT_V1', JSON.stringify(yfAccount));
      localStorage.setItem('YONG_FENG_DIVIDEND_V1', JSON.stringify(yfDividendRows));
      localStorage.setItem('YONG_FENG_OVERVIEW_V2', JSON.stringify(yfOverview));

      renderTabs();
      renderTable();
    }

    function stockDocRef() {
      if (!fbDb || !fbUser) return null;
      return fbDb.collection(CLOUD_COLLECTION).doc(fbUser.uid);
    }

    async function loadStockFromCloud() {
      const ref = stockDocRef();
      if (!ref) return;
      try {
        const snap = await ref.get();
        if (snap.exists) {
          applyAllData(snap.data());
        } else {
          await ref.set(gatherAllData());
        }
      } catch (e) {
        console.warn('讀取股票雲端資料失敗', e);
      }
    }

    function scheduleCloudSync() {
      if (!fbUser) return;
      clearTimeout(stockCloudSyncTimer);
      stockCloudSyncTimer = setTimeout(() => {
        const ref = stockDocRef();
        if (!ref) return;
        ref.set(gatherAllData()).catch((err) => console.warn('股票資料自動同步失敗', err));
      }, 2000);
    }

    if (typeof fbAuth !== 'undefined' && fbAuth) {
      fbAuth.onAuthStateChanged((user) => {
        if (user) loadStockFromCloud();
      });
    }

    /* ====== 懸浮計算機邏輯與拖曳 ====== */
    function toggleCalculator() {
      const calc = document.getElementById('floatingCalculator');
      if (calc) {
        const isVisible = calc.style.display === 'block';
        calc.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) calc.focus();
      }
    }

    let calcExpression = '0';
    function calcUpdateScreen() {
      const screen = document.getElementById('calcScreen');
      if (screen) screen.textContent = calcExpression;
    }
    function calcClear() {
      calcExpression = '0';
      calcUpdateScreen();
    }
    function calcAppend(val) {
      if (calcExpression === '0' && val !== '.') {
        calcExpression = val;
      } else {
        calcExpression += val;
      }
      calcUpdateScreen();
    }
    function calcBackspace() {
      if (calcExpression.length > 1) {
        calcExpression = calcExpression.slice(0, -1);
      } else {
        calcExpression = '0';
      }
      calcUpdateScreen();
    }
    function calcEvaluate() {
      try {
        let res = eval(calcExpression.replace(/×/g, '*').replace(/÷/g, '/'));
        calcExpression = String(res);
      } catch (e) {
        calcExpression = '錯誤';
      }
      calcUpdateScreen();
    }

    window.addEventListener('keydown', (e) => {
      const calc = document.getElementById('floatingCalculator');
      const activeEl = document.activeElement;
      const isInTableInput = activeEl && activeEl.classList && activeEl.classList.contains('cell-input');

      if (calc && calc.style.display === 'block' && !isInTableInput) {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
          calcAppend(e.key);
          e.preventDefault();
        } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
          calcAppend(e.key);
          e.preventDefault();
        } else if (e.key === 'Enter' || e.key === '=') {
          calcEvaluate();
          e.preventDefault();
        } else if (e.key === 'Backspace') {
          calcBackspace();
          e.preventDefault();
        } else if (e.key.toLowerCase() === 'c' || e.key === 'Delete') {
          calcClear();
          e.preventDefault();
        }
      }
    });

    function setupCalculatorDrag() {
      const calc = document.getElementById('floatingCalculator');
      const header = document.getElementById('calcDragHandle');
      if (!calc || !header) return;

      let isDragging = false;
      let startX, startY, initialX, initialY;

      header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = calc.offsetLeft;
        initialY = calc.offsetTop;
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let dx = e.clientX - startX;
        let dy = e.clientY - startY;
        calc.style.left = (initialX + dx) + 'px';
        calc.style.top = (initialY + dy) + 'px';
        calc.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    function getAllAccounts() {
      const defaultAccs = ['富邦證券', '國泰證券', '美股複委託'];
      const set = new Set([...defaultAccs, ...customAccounts]);
      stocks.forEach(s => {
        if (s.account && !defaultAccs.includes(s.account) && !s.account.includes('+')) {
          set.add(s.account);
        }
      });
      return Array.from(set);
    }

    function toggleSettingDropdown(e) {
      e.stopPropagation();
      const dropdown = document.getElementById('settingDropdown');
      dropdown.classList.toggle('active');
    }

    function setupSettingDropdownClose() {
      window.addEventListener('click', () => {
        const dropdown = document.getElementById('settingDropdown');
        if (dropdown) dropdown.classList.remove('active');
      });
    }

    function renderTabs() {
      const allAccs = getAllAccounts();
      const tabs = [
        { id: 'ALL', label: '全部持股' },
        ...allAccs.map(acc => ({ id: acc, label: acc, isAccount: true, isCustom: !['富邦證券', '國泰證券', '美股複委託'].includes(acc) })),
        { id: 'ETF', label: 'ETF' },
        { id: '台股', label: '台股個股 (合併)' },
        { id: 'STOCK_SALES', label: '📉 股票賣出', isSales: true },
        { id: 'DIVIDENDS_TAB', label: '📊 股利', isDividends: true },
        { id: 'YONG_FENG_TAB', label: '🌸 媽的永豐', isYF: true },
        { id: 'SNAPSHOT_LOGS', label: '📋 各股紀錄', isSnapshot: true }
      ];

      const tabContainer = document.getElementById('tabGroup');
      if (!tabContainer) return;

      tabContainer.innerHTML = tabs.map(t => {
        let countText = '';
        if (t.id === 'DIVIDENDS_TAB' || t.id === 'STOCK_SALES' || t.id === 'SNAPSHOT_LOGS' || t.id === 'YONG_FENG_TAB') {
          countText = '';
        } else {
          countText = ` (${countByFilter(t.id)})`;
        }

        if (t.isCustom) {
          return `
            <div class="tab-pill-group ${currentFilter === t.id ? 'active' : ''}">
              <button class="tab-pill-btn" onclick="setFilter('${t.id}')">${t.label}${countText}</button>
              <button class="tab-pill-del" title="刪除此證券帳戶" onclick="deleteCustomAccount(event, '${t.id}')">✕</button>
            </div>
          `;
        } else {
          return `
            <button class="tab-btn ${currentFilter === t.id ? 'active' : ''} ${t.isDividends ? 'tab-btn-dividends' : ''} ${t.isYF ? 'tab-btn-yf' : ''} ${t.isSnapshot ? 'tab-btn-snapshot' : ''} ${t.isSales ? 'tab-btn-sales' : ''}" onclick="setFilter('${t.id}')">
              ${t.label}${countText}
            </button>
          `;
        }
      }).join('');
    }

    function countByFilter(filterId) {
      if (filterId === 'ALL') return stocks.length;
      if (filterId === '台股') {
        const uniqueSymbols = new Set(stocks.filter(s => s.category === '台股').map(s => s.code || s.name));
        return uniqueSymbols.size;
      }
      return stocks.filter(s => s.account === filterId || s.category === filterId).length;
    }

    function setFilter(filterId) {
      currentFilter = filterId;
      if (filterId === 'STOCK_SALES') {
        salesSubTab = 'list';
      }
      if (filterId === 'DIVIDENDS_TAB') {
        dividendsSubTab = 'summary';
      }
      renderTabs();
      renderTable();
    }

    function setSalesSubTab(subTab) {
      salesSubTab = subTab;
      document.getElementById('subBtnList').classList.toggle('active', subTab === 'list');
      document.getElementById('subBtnSummary').classList.toggle('active', subTab === 'summary');
      document.getElementById('subBtnHistory').classList.toggle('active', subTab === 'history');
      renderTable();
    }

    function setDividendsSubTab(subTab) {
      dividendsSubTab = subTab;
      document.getElementById('subBtnDivSummary').classList.toggle('active', subTab === 'summary');
      document.getElementById('subBtnDivPast').classList.toggle('active', subTab === 'past');
      document.getElementById('subBtnDivEst').classList.toggle('active', subTab === 'estimate');
      renderTable();
    }

    function changeSummaryYear(yr) {
      selectedSummaryYear = yr;
      renderTable();
    }

    function getMergedTaiwanStocks() {
      const twStocks = stocks.filter(s => s.category === '台股');
      const map = new Map();

      twStocks.forEach(s => {
        const key = s.code ? s.code.trim() : s.name.trim();
        if (!map.has(key)) {
          map.set(key, {
            id: `merged_${key}`,
            name: s.name,
            code: s.code,
            category: '台股',
            account: s.account,
            accounts: [s.account],
            shares: Number(s.shares) || 0,
            totalCost: Number(s.totalCost) || 0,
            currentPrice: Number(s.currentPrice) || 0,
            cashDividends: Number(s.cashDividends) || 0,
            stockShares: Number(s.stockShares) || 0,
            lentShares: Number(s.lentShares) || 0,
            dividendHistory: JSON.parse(JSON.stringify(s.dividendHistory || [])),
            isMerged: false,
            sourceIds: [s.id]
          });
        } else {
          const existing = map.get(key);
          existing.isMerged = true;
          if (!existing.accounts.includes(s.account)) {
            existing.accounts.push(s.account);
          }
          existing.shares += Number(s.shares) || 0;
          existing.totalCost += Number(s.totalCost) || 0;
          existing.cashDividends += Number(s.cashDividends) || 0;
          existing.stockShares += Number(s.stockShares) || 0;
          existing.lentShares += Number(s.lentShares) || 0;
          if (Number(s.currentPrice) > 0) existing.currentPrice = Number(s.currentPrice);
          existing.sourceIds.push(s.id);

          (s.dividendHistory || []).forEach(dh => {
            const matchYear = existing.dividendHistory.find(h => h.year == dh.year);
            if (matchYear) {
              matchYear.cash = (Number(matchYear.cash) || 0) + (Number(dh.cash) || 0);
              matchYear.stockShares = (Number(matchYear.stockShares) || 0) + (Number(dh.stockShares) || (Number(dh.stock) || 0));
              if (!matchYear.cashDate && dh.cashDate) matchYear.cashDate = dh.cashDate;
              if (!matchYear.stockDate && dh.stockDate) matchYear.stockDate = dh.stockDate;
            } else {
              existing.dividendHistory.push({
                year: dh.year,
                cashDate: dh.cashDate || '',
                cash: Number(dh.cash) || 0,
                stockDate: dh.stockDate || '',
                stockShares: Number(dh.stockShares) || (Number(dh.stock) || 0)
              });
            }
          });
        }
      });

      return Array.from(map.values()).map(item => {
        item.account = item.accounts.join(' + ');
        return item;
      });
    }

    function normalizeYearKey(y) {
      if (!y) return '其他';
      let s = String(y).trim();
      if (s.includes('-')) return s;
      let num = parseInt(s);
      if (!isNaN(num)) {
        if (num > 1900) num -= 1911;
        return String(num);
      }
      return s;
    }

    function getFullAssetYearlyDividendSummary() {
      const yearMap = new Map();

      pastColumns.forEach(col => {
        const key = normalizeYearKey(col.year);
        const pastAmt = col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
        yearMap.set(key, {
          displayYear: col.year.includes('-') ? col.year : `${key}(${parseInt(key)+1911})`,
          rawKey: key,
          pastAmount: pastAmt,
          currentAmount: 0,
          totalAmount: pastAmt
        });
      });

      stocks.forEach(st => {
        const p = Number(st.currentPrice) || 0;
        const isUS = st.account === '美股複委託' || st.category === '美股';
        const fxRate = isUS ? 29 : 1;

        (st.dividendHistory || []).forEach(dh => {
          const key = normalizeYearKey(dh.year);
          const stCash = (Number(dh.cash) || 0) * fxRate;
          const stStockVal = (Number(dh.stockShares) || 0) * p * fxRate;
          const stAmt = stCash + stStockVal;

          if (!yearMap.has(key)) {
            const num = parseInt(key);
            const disp = !isNaN(num) ? `${key}(${num+1911})` : key;
            yearMap.set(key, {
              displayYear: disp,
              rawKey: key,
              pastAmount: 0,
              currentAmount: stAmt,
              totalAmount: stAmt
            });
          } else {
            const item = yearMap.get(key);
            item.currentAmount += stAmt;
            item.totalAmount += stAmt;
          }
        });
      });

      const sorted = Array.from(yearMap.values()).sort((a, b) => {
        let numA = parseInt(a.rawKey.split('-')[0]) || 0;
        let numB = parseInt(b.rawKey.split('-')[0]) || 0;
        return numA - numB;
      });

      return sorted;
    }

    function renderTable() {
      renderYfOverview();
      const thead = document.getElementById('stockGridHead');
      const tbody = document.getElementById('stockTableBody');
      const searchBox = document.getElementById('searchBox');
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';

      const btnDel = document.getElementById('btnDelLastRow');
      const btnAddYear = document.getElementById('btnAddYear');
      const btnAddStock = document.getElementById('btnAddNewStock');
      const pastCalcCard = document.getElementById('pastStockCalcCard');
      const snapshotDateBar = document.getElementById('snapshotDateBar');
      const salesSubBar = document.getElementById('salesSubBar');
      const dividendsSubBar = document.getElementById('dividendsSubBar');
      const topScrollWrapper = document.getElementById('topScrollWrapper');
      const mainTableContainer = document.getElementById('mainTableContainer');
      const yfTablesContainer = document.getElementById('yfTablesContainer');

      if (currentFilter === 'DIVIDENDS_TAB') {
        if (dividendsSubBar) dividendsSubBar.style.display = 'flex';
      } else {
        if (dividendsSubBar) dividendsSubBar.style.display = 'none';
      }

      if (currentFilter === 'YONG_FENG_TAB') {
        if (yfTablesContainer) yfTablesContainer.style.display = 'flex';
        if (mainTableContainer) mainTableContainer.style.display = 'none';
        if (btnAddStock) btnAddStock.style.display = 'none';
      } else {
        if (yfTablesContainer) yfTablesContainer.style.display = 'none';
        if (mainTableContainer) mainTableContainer.style.display = '';
        if (btnAddStock) btnAddStock.style.display = '';
      }

      if (currentFilter === 'PAST_DIVIDENDS') {
        if (btnAddStock) btnAddStock.textContent = '➕ 新增一列';
        if (btnDel) btnDel.style.display = 'inline-flex';
        if (btnAddYear) btnAddYear.style.display = 'inline-flex';
        if (pastCalcCard) pastCalcCard.style.display = 'flex';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'block';
        if (mainTableContainer) mainTableContainer.classList.add('with-top-scroll');
      } else if (currentFilter === 'STOCK_SALES') {
        if (btnAddStock) btnAddStock.textContent = salesSubTab === 'history' ? '➕ 新增歷年紀錄列' : '➕ 新增賣出紀錄列';
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'flex';
        
        const yrContainer = document.getElementById('summaryYearSelectorContainer');
        if (yrContainer) yrContainer.style.display = (salesSubTab === 'summary') ? 'flex' : 'none';

        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else if (currentFilter === 'YONG_FENG_TAB') {
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else if (currentFilter === 'DIVIDENDS_TAB') {
        if (btnAddStock) btnAddStock.textContent = dividendsSubTab === 'past' ? '➕ 新增一列' : '➕ 新增股票';
        if (btnDel) btnDel.style.display = dividendsSubTab === 'past' ? 'inline-flex' : 'none';
        if (btnAddYear) btnAddYear.style.display = dividendsSubTab === 'past' ? 'inline-flex' : 'none';
        if (pastCalcCard) pastCalcCard.style.display = dividendsSubTab === 'past' ? 'flex' : 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = dividendsSubTab === 'past' ? 'block' : 'none';
        if (mainTableContainer) {
          if (dividendsSubTab === 'past') mainTableContainer.classList.add('with-top-scroll');
          else mainTableContainer.classList.remove('with-top-scroll');
        }
      } else if (currentFilter === 'SNAPSHOT_LOGS') {
        if (btnAddStock) btnAddStock.textContent = '➕ 新增股票';
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'flex';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else {
        if (btnAddStock) btnAddStock.textContent = '➕ 新增股票';
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      }

      // 0-1. 媽的永豐分頁 (YONG_FENG_TAB) - 三表並排，無分頁切換
      if (currentFilter === 'YONG_FENG_TAB') {
        renderYfTablesAll();
        return;
      }

      // 0-2. 股利分頁 (DIVIDENDS_TAB)
      if (currentFilter === 'DIVIDENDS_TAB') {
        if (dividendsSubTab === 'summary') {
          renderYearlySummaryTable(thead, tbody);
          return;
        }
        if (dividendsSubTab === 'past') {
          renderPastDividendsTable(thead, tbody);
          return;
        }
        if (dividendsSubTab === 'estimate') {
          renderEstimatedDividendsTable(thead, tbody);
          return;
        }
      }

      // 1. 股票賣出紀錄分頁 (STOCK_SALES)
      if (currentFilter === 'STOCK_SALES') {
        if (salesSubTab === 'summary') {
          renderSalesSummaryTable(thead, tbody);
          return;
        }
        if (salesSubTab === 'history') {
          renderSalesHistoryTable(thead, tbody);
          return;
        }

        thead.innerHTML = `
          <tr>
            <th style="width: 90px;">日期</th>
            <th style="width: 120px;">名稱</th>
            <th style="width: 90px;">股數</th>
            <th style="width: 100px;">買進價格</th>
            <th style="width: 100px;">賣出價格</th>
            <th style="width: 110px;">成本 ($)</th>
            <th style="width: 110px;">賣出 ($)</th>
            <th style="width: 100px;">價差</th>
            <th style="width: 90px;">報酬率</th>
            <th style="width: 90px;">買進手續費</th>
            <th style="width: 90px;">賣出手續費</th>
            <th style="width: 90px;">交易稅</th>
            <th style="width: 100px;">狀態</th>
            <th style="width: 100px;">當日共計</th>
            <th style="width: 60px;">操作</th>
          </tr>
        `;

        yfAutoSortByDate(stockSales, 'date');

        let sales = stockSales;
        if (query) {
          sales = sales.filter(r => (r.name && r.name.toLowerCase().includes(query)) || (r.date && r.date.toLowerCase().includes(query)) || (r.status && r.status.toLowerCase().includes(query)));
        }

        let dateCount = {};
        sales.forEach(r => {
          let d = r.date || '';
          dateCount[d] = (dateCount[d] || 0) + 1;
        });

        const monthPalette = ['#f5eee0', '#eef0e6', '#e9e4da', '#ece2c4', '#eaeef0', '#f4ecd4'];
        let monthGroupIdx = -1;
        let lastMonthKey = null;
        function salesMonthColor(dateStr) {
          const digits = String(dateStr || '').replace(/[^0-9]/g, '');
          let monthKey = null;
          if (digits.length === 7) monthKey = digits.slice(0, 5);
          else if (digits.length === 6) monthKey = digits.slice(0, 4);
          else if (digits.length === 5) monthKey = digits.slice(0, 3);
          if (!monthKey) return '';
          if (monthKey !== lastMonthKey) {
            lastMonthKey = monthKey;
            monthGroupIdx++;
          }
          return monthPalette[monthGroupIdx % monthPalette.length];
        }

        let renderedDates = {};

        let rowsHtml = sales.map((r, rIdx) => {
          const retRateStr = r.returnRate !== undefined && !isNaN(r.returnRate) ? (r.returnRate * 100).toFixed(2) + '%' : '0.00%';
          const isPos = (Number(r.spread) || 0) >= 0;
          const dKey = r.date || '';
          let showDayTotalCell = false;
          let spanCount = 1;

          if (dKey && !renderedDates[dKey]) {
            renderedDates[dKey] = true;
            showDayTotalCell = true;
            spanCount = dateCount[dKey];
          }

          let dayTotalHtml = '';
          if (showDayTotalCell) {
            dayTotalHtml = `<td class="font-mono" style="background:#f8fafc; font-weight:700; vertical-align:middle;" ${spanCount > 1 ? `rowspan="${spanCount}"` : ''}>${r.dayTotal !== null && r.dayTotal !== undefined ? '$' + formatNum(r.dayTotal, 0) : '-'}</td>`;
          } else if (!dKey) {
            dayTotalHtml = `<td class="font-mono" style="background:#f8fafc; font-weight:700;">-</td>`;
          }

          const rowBg = salesMonthColor(r.date);

          return `
            <tr${rowBg ? ` style="background:${rowBg};"` : ''}>
              <td class="editable-col"><input type="text" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="0" value="${r.date || ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 0)" onchange="updateSaleRow(${rIdx}, 'date', this.value)" /></td>
              <td class="editable-col"><input type="text" class="cell-input" style="font-weight:700;" data-sale-idx="${rIdx}" data-col="1" value="${r.name || ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 1)" onchange="updateSaleRow(${rIdx}, 'name', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="2" value="${r.shares !== undefined && r.shares !== '' ? r.shares : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 2)" onchange="updateSaleRow(${rIdx}, 'shares', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="3" value="${r.buyPrice !== undefined && r.buyPrice !== '' ? r.buyPrice : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 3)" onchange="updateSaleRow(${rIdx}, 'buyPrice', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="4" value="${r.sellPrice !== undefined && r.sellPrice !== '' ? r.sellPrice : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 4)" onchange="updateSaleRow(${rIdx}, 'sellPrice', this.value)" /></td>
              
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="5" value="${r.cost !== undefined && r.cost !== '' ? r.cost : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 5)" onchange="updateSaleRow(${rIdx}, 'cost', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="6" value="${r.sellAmt !== undefined && r.sellAmt !== '' ? r.sellAmt : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 6)" onchange="updateSaleRow(${rIdx}, 'sellAmt', this.value)" /></td>

              <td class="font-mono" style="font-weight:700; color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(r.spread, 0)}</td>
              <td class="font-mono" style="color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${retRateStr}</td>

              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="9" value="${r.buyFee !== undefined && r.buyFee !== '' ? r.buyFee : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 9)" onchange="updateSaleRow(${rIdx}, 'buyFee', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="10" value="${r.sellFee !== undefined && r.sellFee !== '' ? r.sellFee : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 10)" onchange="updateSaleRow(${rIdx}, 'sellFee', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="11" value="${r.tax !== undefined && r.tax !== '' ? r.tax : ''}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 11)" onchange="updateSaleRow(${rIdx}, 'tax', this.value)" /></td>
              
              <td class="editable-col">
                <select class="cell-input" style="background:#fff; border:1px solid #cbd5e1; padding:2px;" data-sale-idx="${rIdx}" data-col="12" onchange="updateSaleRow(${rIdx}, 'status', this.value)" onkeydown="handleSaleKey(event, ${rIdx}, 12)">
                  <option value="" ${!r.status ? 'selected' : ''}>-</option>
                  <option value="獲益" ${r.status === '獲益' ? 'selected' : ''}>獲益</option>
                  <option value="認賠" ${r.status === '認賠' ? 'selected' : ''}>認賠</option>
                  <option value="當沖" ${r.status === '當沖' ? 'selected' : ''}>當沖</option>
                </select>
              </td>

              ${dayTotalHtml}
              <td>
                <button class="btn-del" title="刪除" onclick="deleteStockSale(${rIdx})">✕</button>
              </td>
            </tr>
          `;
        }).join('');

        let sumCost = sales.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        let sumSellAmt = sales.reduce((s, r) => s + (Number(r.sellAmt) || 0), 0);
        let sumSpread = sales.reduce((s, r) => s + (Number(r.spread) || 0), 0);
        let sumBuyFee = sales.reduce((s, r) => s + (Number(r.buyFee) || 0), 0);
        let sumSellFee = sales.reduce((s, r) => s + (Number(r.sellFee) || 0), 0);
        let sumTax = sales.reduce((s, r) => s + (Number(r.tax) || 0), 0);
        let avgRetRate = sumCost > 0 ? (sumSpread / sumCost * 100).toFixed(2) + '%' : '0.00%';
        let isPosSum = sumSpread >= 0;

        rowsHtml += `
          <tr style="background:#f1f5f9; font-weight:800; border-top:2px solid #cbd5e1;">
            <td>小計</td>
            <td colspan="4">-</td>
            <td class="font-mono">$${formatNum(sumCost, 0)}</td>
            <td class="font-mono">$${formatNum(sumSellAmt, 0)}</td>
            <td class="font-mono" style="color:${isPosSum ? 'var(--up-red)' : 'var(--down-green)'};">${isPosSum ? '+' : ''}$${formatNum(sumSpread, 0)}</td>
            <td class="font-mono" style="color:${isPosSum ? 'var(--up-red)' : 'var(--down-green)'};">${avgRetRate}</td>
            <td class="font-mono">${formatNum(sumBuyFee, 0)}</td>
            <td class="font-mono">${formatNum(sumSellFee, 0)}</td>
            <td class="font-mono">${formatNum(sumTax, 0)}</td>
            <td>-</td>
            <td class="font-mono" style="color:${isPosSum ? 'var(--up-red)' : 'var(--down-green)'};">${isPosSum ? '+' : ''}$${formatNum(sumSpread, 0)}</td>
            <td>-</td>
          </tr>
        `;

        tbody.innerHTML = rowsHtml;
        renderSummary();
        setTimeout(() => {
          if (mainTableContainer) mainTableContainer.scrollTop = mainTableContainer.scrollHeight;
        }, 50);
        return;
      }

      // 2. 各股紀錄分頁 (Snapshot Logs)
      if (currentFilter === 'SNAPSHOT_LOGS') {
        let allSnaps = [];
        const storedSnap = localStorage.getItem('ASSET_SNAPSHOTS_V1');
        if (storedSnap) {
          try { allSnaps = JSON.parse(storedSnap); } catch (e) {}
        }

        const pillsContainer = document.getElementById('snapshotDatePillsContainer');
        if (allSnaps.length === 0) {
          if (pillsContainer) pillsContainer.innerHTML = `<span style="font-size:0.8rem; color:#64748b;">尚無快照紀錄，請點擊上方【📸 一鍵紀錄】</span>`;
          thead.innerHTML = `<tr><th>提示</th></tr>`;
          tbody.innerHTML = `<tr><td style="padding:40px; color:#94a3b8;">目前尚無任何快照紀錄</td></tr>`;
          renderSummary();
          return;
        }

        if (!selectedSnapshotDate || !allSnaps.some(s => s.date === selectedSnapshotDate)) {
          selectedSnapshotDate = allSnaps[0].date;
        }

        if (pillsContainer) {
          pillsContainer.innerHTML = allSnaps.map(sp => `
            <div class="snapshot-pill-group ${selectedSnapshotDate === sp.date ? 'active' : ''}">
              <button class="snapshot-date-btn" onclick="selectSnapshotDate('${sp.date}')">
                📅 ${sp.date} (${sp.items.length} 檔)
              </button>
              <button class="snapshot-date-del" title="刪除此日期快照" onclick="deleteEntireSnapshot('${sp.date}')">
                ✕
              </button>
            </div>
          `).join('');
        }

        thead.innerHTML = `
          <tr>
            <th style="width: 150px;">證券帳戶</th>
            <th style="width: 180px;">股票名稱</th>
            <th style="width: 110px;">代號</th>
            <th style="width: 110px;">持有股數</th>
            <th style="width: 140px;">成本 ($)</th>
            <th style="width: 120px;">現價 ($)</th>
            <th style="width: 150px;">市值 ($)</th>
            <th style="width: 150px;">未實現損益</th>
            <th style="width: 60px;">操作</th>
          </tr>
        `;

        const activeSnap = allSnaps.find(sp => sp.date === selectedSnapshotDate) || allSnaps[0];
        let items = activeSnap.items;

        if (query) {
          items = items.filter(r => r.name.toLowerCase().includes(query) || r.code.toLowerCase().includes(query) || r.account.toLowerCase().includes(query));
        }

        tbody.innerHTML = items.map((r, rIdx) => {
          const isP = r.profit >= 0;
          return `
            <tr>
              <td>${r.account}</td>
              <td style="font-weight:700;">${r.name}</td>
              <td style="color:#64748b;">${r.code}</td>
              <td class="font-mono">${formatNum(r.shares, 0)}</td>
              <td class="font-mono">$${formatNum(r.totalCost, 0)}</td>
              <td class="font-mono">$${formatNum(r.currentPrice, 2)}</td>
              <td class="font-mono font-bold">$${formatNum(r.marketVal, 0)}</td>
              <td class="font-mono" style="font-weight:700; color:${isP ? 'var(--up-red)' : 'var(--down-green)'};">
                ${isP ? '+' : ''}$${formatNum(r.profit, 0)}
              </td>
              <td>
                <button class="btn-del" title="刪除此快照筆數" onclick="deleteSnapshotItem('${activeSnap.date}', ${rIdx})">✕</button>
              </td>
            </tr>
          `;
        }).join('');

        renderSummary();
        return;
      }

      // 3. 標準持股表頭 (所有證券帳戶分頁皆支援 ☰ 拖曳排序)
      const allAccs = getAllAccounts();
      const isAccountTab = allAccs.includes(currentFilter);

      thead.innerHTML = `
        <tr>
          ${isAccountTab ? '<th style="min-width: 50px; width: 50px;">排序</th>' : ''}
          <th style="min-width: 140px; width: 140px;">股票名稱</th>
          <th class="editable-col" style="min-width: 90px; width: 90px; color: #2563eb;">現價 ($) ✏️</th>
          <th style="min-width: 100px; width: 100px;">市值</th>
          <th class="editable-col" style="min-width: 100px; width: 100px; color: #2563eb;">成本 ($) ✏️</th>
          <th class="editable-col" style="min-width: 90px; width: 90px; color: #2563eb;">持有股數 ✏️</th>
          <th style="min-width: 110px; width: 110px;">未實現損益</th>
          <th style="min-width: 100px; width: 100px;">平均每股成本</th>
          <th style="min-width: 115px; width: 115px; color: #d97706;">現金股利 ($) 💰</th>
          <th style="min-width: 125px; width: 125px; color: #1d4ed8;">股票股利 ($) 📈</th>
          <th class="highlight-cell" style="min-width: 105px; width: 105px;">含息每股成本</th>
          <th class="editable-col" style="min-width: 90px; width: 90px; color: #2563eb;">出借張數 ✏️</th>
          <th style="min-width: 50px; width: 50px;">操作</th>
        </tr>
      `;

      let displayList = [];
      if (currentFilter === '台股') {
        displayList = getMergedTaiwanStocks();
      } else {
        displayList = stocks.filter(s => (currentFilter === 'ALL') || (s.account === currentFilter) || (s.category === currentFilter));
      }

      if (query) {
        displayList = displayList.filter(s => 
          s.name.toLowerCase().includes(query) || 
          (s.code && s.code.toLowerCase().includes(query)) || 
          s.account.toLowerCase().includes(query)
        );
      }

      if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAccountTab ? 13 : 12}" style="text-align:center; padding:30px; color:#94a3b8;">無相符股票標的</td></tr>`;
        renderSummary();
        return;
      }

      tbody.innerHTML = displayList.map((s, rowIndex) => {
        const isUS = s.account === '美股複委託' || s.category === '美股';
        const fxRate = isUS ? 29 : 1;

        const totalCost = (Number(s.totalCost) || 0) * fxRate;
        const shares = Number(s.shares) || 0;
        const currentPrice = (Number(s.currentPrice) || 0) * fxRate;
        const cashDiv = (Number(s.cashDividends) || 0) * fxRate;
        const stockShares = Number(s.stockShares) || 0;
        const stockDivVal = stockShares * currentPrice;
        const totalDiv = cashDiv + stockDivVal;
        const lentShares = Number(s.lentShares) || 0;

        const avgCostPerShare = shares > 0 ? (totalCost / shares) : 0;
        const marketVal = shares * currentPrice;
        const profit = marketVal - totalCost;
        const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
        const netCostPerShare = shares > 0 ? ((totalCost - totalDiv) / shares) : 0;
        const isProfit = profit >= 0;
        const isMergedRow = Boolean(s.isMerged);

        const enableDrag = isAccountTab && !query && !isMergedRow;
        const unitSymbol = isUS ? 'US$' : '$';

        return `
          <tr data-id="${s.id}" ${enableDrag ? 'draggable="true" ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, ' + s.id + ')" ondragend="onDragEnd(event)"' : ''}>
            ${isAccountTab ? `
              <td>
                ${enableDrag ? `<span class="drag-handle" title="按住拖曳排序">☰</span>` : `<span style="color:#94a3b8; font-size:0.75rem;">-</span>`}
              </td>
            ` : ''}

            <td>
              <div style="font-weight:700;">${s.name} <span style="font-size:0.75rem; color:#64748b;">${s.code ? '(' + s.code + ')' : ''}</span></div>
              <div style="font-size:0.72rem; color:${isMergedRow ? '#766c5a' : '#b3a998'}; font-weight:${isMergedRow ? '700' : 'normal'};">
                ${s.account} ${isMergedRow ? '⚡' : ''} ${isUS ? '(美金)' : ''}
              </div>
            </td>

            <td class="editable-col">
              ${isMergedRow ? `<span class="font-mono font-bold">${unitSymbol}${formatNum(Number(s.currentPrice) || 0, isUS ? 2 : 2)}</span>` : `
                <input type="number" step="any" class="cell-input font-bold" data-row="${rowIndex}" data-col="0" data-field="currentPrice" value="${Number(s.currentPrice) || 0}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 0)" onchange="updateValue(${s.id}, 'currentPrice', this.value)" />
              `}
            </td>

            <td class="font-mono font-bold">${unitSymbol}${formatNum(marketVal / fxRate, isUS ? 2 : 0)}</td>

            <td class="editable-col">
              ${isMergedRow ? `<span class="font-mono font-bold">${unitSymbol}${formatNum(Number(s.totalCost) || 0, isUS ? 2 : 0)}</span>` : `
                <input type="number" step="any" class="cell-input font-bold" data-row="${rowIndex}" data-col="1" data-field="totalCost" value="${Number(s.totalCost) || 0}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 1)" onchange="updateValue(${s.id}, 'totalCost', this.value)" />
              `}
            </td>

            <td class="editable-col">
              ${isMergedRow ? `<span class="font-mono font-bold">${formatNum(shares, 0)}</span>` : `
                <input type="number" step="any" class="cell-input" data-row="${rowIndex}" data-col="2" data-field="shares" value="${shares}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 2)" onchange="updateValue(${s.id}, 'shares', this.value)" />
              `}
            </td>

            <td class="font-mono">
              <div style="font-weight:700; color:${isProfit ? 'var(--up-red)' : 'var(--down-green)'};">
                ${isProfit ? '+' : ''}${unitSymbol}${formatNum(profit / fxRate, isUS ? 2 : 0)}
              </div>
              <div style="font-size:0.72rem; font-weight:600; color:${isProfit ? 'var(--up-red)' : 'var(--down-green)'};">
                ${isProfit ? '+' : ''}${profitRate.toFixed(2)}%
              </div>
            </td>

            <td class="font-mono text-slate-500">${unitSymbol}${formatNum(avgCostPerShare / fxRate, 2)}</td>

            <td>
              <button class="btn-cash-pill" onclick="openDividendModal('${s.id}', 'cash')">
                ${unitSymbol}${formatNum((Number(cashDiv) || 0) / fxRate, isUS ? 2 : 0)} 💰
              </button>
            </td>

            <td>
              <button class="btn-stock-pill" onclick="openDividendModal('${s.id}', 'stock')">
                <span>${unitSymbol}${formatNum(stockDivVal / fxRate, isUS ? 2 : 0)} 📈</span>
                <span style="font-size:0.7rem; font-weight:normal; opacity:0.85;">(${formatNum(stockShares, 0)} 股)</span>
              </button>
            </td>

            <td class="font-mono font-bold highlight-cell" style="color:${netCostPerShare < 0 ? '#4a7c59' : 'inherit'};">
              ${unitSymbol}${formatNum(netCostPerShare / fxRate, 2)}
            </td>

            <td class="editable-col">
              ${isMergedRow ? `<span class="font-mono">${formatNum(lentShares, 0)}</span>` : `
                <input type="number" step="any" class="cell-input" style="color:#64748b;" data-row="${rowIndex}" data-col="3" data-field="lentShares" value="${lentShares}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 3)" onchange="updateValue(${s.id}, 'lentShares', this.value)" />
              `}
            </td>

            <td>
              ${isMergedRow ? `<span style="font-size:0.75rem; color:#94a3b8;">唯讀</span>` : `
                <button class="btn-del" title="刪除" onclick="deleteStock(${s.id})">✕</button>
              `}
            </td>
          </tr>
        `;
      }).join('');

      renderSummary();
    }

    /* ====== 媽的永豐 四個獨立子部分渲染函數 ====== */
    /* ====== 媽的永豐：共用工具函式 (日期解析/民國轉換/格式化) ====== */
    function yfParseDateInt(val) {
      if (!val) return 99999999;
      let str = String(val).trim();
      let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return parseInt(match[1] + match[2] + match[3], 10);
      let numStr = str.replace(/[^0-9]/g, '');
      if (numStr.length >= 8 && numStr.startsWith('20')) {
        return parseInt(numStr.substring(0, 8), 10);
      } else if (numStr.length === 7 || numStr.length === 6) {
        let cutIndex = numStr.length - 4;
        let rocYear = parseInt(numStr.substring(0, cutIndex), 10);
        let westernYear = rocYear + 1911;
        return parseInt(westernYear + numStr.substring(cutIndex), 10);
      }
      return 99999999;
    }

    function yfToROCString(val) {
      if (!val) return val;
      let str = String(val).trim();
      let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        let rocYear = parseInt(match[1], 10) - 1911;
        return String(rocYear) + match[2] + match[3];
      }
      return str;
    }

    function yfParseNum(str) {
      if (str === null || str === undefined || str === '') return 0;
      return parseFloat(String(str).replace(/,/g, '')) || 0;
    }

    function yfAutoSortByDate(arr, dateField) {
      const withDate = [];
      const withoutDate = [];
      arr.forEach(r => {
        const v = r[dateField];
        if (v && String(v).trim() !== '' && yfParseDateInt(v) !== 99999999) {
          withDate.push(r);
        } else {
          withoutDate.push(r);
        }
      });
      withDate.sort((a, b) => yfParseDateInt(a[dateField]) - yfParseDateInt(b[dateField]));
      const newArr = withDate.concat(withoutDate);
      arr.length = 0;
      newArr.forEach(r => arr.push(r));
    }

    /* ====== 媽的永豐：除息股利自動分配 (依買進日期 < 除息日 加總持有股數) ====== */
    function computeYfDividendDistribution() {
      const exRows = yfDividendRows
        .map((r, idx) => ({ idx, val: yfParseDateInt(r.exDate) }))
        .filter(r => r.val !== 99999999)
        .sort((a, b) => a.val - b.val);

      let cumulative = 0;
      exRows.forEach(({ idx, val: exDate }) => {
        const row = yfDividendRows[idx];
        let sumShares = 0;
        yfDetail.forEach(d => {
          if (yfParseDateInt(d.date) < exDate) sumShares += Number(d.shares) || 0;
        });
        const cashPerShare = Number(row.cashPerShare) || 0;
        const divAmt = Math.round(cashPerShare * sumShares);
        cumulative += divAmt;
        row.heldShares = sumShares;
        row.divAmount = divAmt;
        row.cumulative = cumulative;
      });

      // 沒有有效除息日的列，歸零顯示
      yfDividendRows.forEach(r => {
        if (yfParseDateInt(r.exDate) === 99999999) {
          r.heldShares = 0;
          r.divAmount = 0;
          r.cumulative = 0;
        }
      });

      return cumulative;
    }

    /* ====== 媽的永豐：帳戶餘額累計 ====== */
    function computeYfAccountBalance() {
      let running = 0;
      yfAccount.forEach(r => {
        if (r.amount !== '' && r.amount !== null && r.amount !== undefined) {
          running += Number(r.amount) || 0;
          r.balance = running;
        } else if (r.date) {
          r.balance = running;
        } else {
          r.balance = 0;
        }
      });
    }

    /* ====== 媽的永豐：買賣明細列的除息區間底色 (視覺輔助，依 MUJI 色調) ====== */
    function yfDetailRowColor(tradeDateStr, exDivDates) {
      if (!tradeDateStr || String(tradeDateStr).trim() === '') return '';
      const tradeDate = yfParseDateInt(tradeDateStr);
      const palette = ['#f5eee0', '#eef0e6', '#e9e4da', '#ece2c4', '#eaeef0'];
      let colorIndex = exDivDates.length;
      for (let i = 0; i < exDivDates.length; i++) {
        if (tradeDate < exDivDates[i]) { colorIndex = i; break; }
      }
      return palette[colorIndex % palette.length];
    }

    /* ====== 媽的永豐：買賣明細表 ====== */
    function renderYfDetailTable() {
      const thead = document.getElementById('yfDetailHead');
      const tbody = document.getElementById('yfDetailBody');
      if (!thead || !tbody) return;

      thead.innerHTML = `
        <tr>
          <th style="width:24%;">日期</th>
          <th style="width:18%;">股數</th>
          <th style="width:20%;">成交價</th>
          <th style="width:26%;">投資成本</th>
          <th style="width:12%;">操作</th>
        </tr>
      `;

      const exDivDates = yfDividendRows
        .map(r => yfParseDateInt(r.exDate))
        .filter(v => v !== 99999999)
        .sort((a, b) => a - b);

      let totalShares = 0, totalCost = 0;
      tbody.innerHTML = yfDetail.map((r, idx) => {
        totalShares += Number(r.shares) || 0;
        totalCost += Number(r.cost) || 0;
        const bg = yfDetailRowColor(r.date, exDivDates);
        return `
        <tr${bg ? ` style="background:${bg};"` : ''}>
          <td class="editable-col"><input type="text" class="cell-input font-mono" data-yf-table="detail" data-row="${idx}" data-col="0" value="${r.date || ''}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 0)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'date', this.value), 0)" onchange="updateYfDetail(${idx}, 'date', this.value)" /></td>
          <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-yf-table="detail" data-row="${idx}" data-col="1" value="${r.shares || 0}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 1)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'shares', this.value), 0)" onchange="updateYfDetail(${idx}, 'shares', this.value)" /></td>
          <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-yf-table="detail" data-row="${idx}" data-col="2" value="${r.price || 0}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 2)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'price', this.value), 0)" onchange="updateYfDetail(${idx}, 'price', this.value)" /></td>
          <td class="editable-col"><input type="number" step="any" class="cell-input font-mono font-bold" data-yf-table="detail" data-row="${idx}" data-col="3" value="${r.cost || 0}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 3)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'cost', this.value), 0)" onchange="updateYfDetail(${idx}, 'cost', this.value)" /></td>
          <td><button class="btn-del" onclick="deleteYfDetailRow(${idx})">✕</button></td>
        </tr>
      `;
      }).join('');

      const footRow = document.getElementById('yfDetailFoot');
      if (footRow) {
        footRow.innerHTML = `<td class="font-bold">小計</td><td class="font-mono font-bold">${formatNum(totalShares, 0)}</td><td></td><td class="font-mono font-bold">${formatNum(totalCost, 0)}</td><td></td>`;
      }
    }

    function updateYfDetail(idx, field, val) {
      recordSnapshot();
      if (!yfDetail[idx]) return;
      if (field === 'date') {
        yfDetail[idx].date = yfToROCString(val);
        yfAutoSortByDate(yfDetail, 'date');
      } else {
        yfDetail[idx][field] = parseFloat(val) || 0;
      }
      computeYfDividendDistribution();
      yfOverview.totalDividend = yfDividendRows.length ? yfDividendRows[yfDividendRows.length - 1].cumulative || 0 : 0;
      saveToStorage();
      renderTable();
    }

    function deleteYfDetailRow(idx) {
      if (confirm('確定刪除此筆買賣明細？')) {
        recordSnapshot();
        yfDetail.splice(idx, 1);
        computeYfDividendDistribution();
        saveToStorage();
        renderTable();
      }
    }

    function addYfDetailRow() {
      recordSnapshot();
      yfDetail.push({ date: '', shares: 0, price: 0, cost: 0 });
      saveToStorage();
      renderTable();
    }

    /* ====== 媽的永豐：永豐帳戶明細表 ====== */
    function renderYfAccountTable() {
      const thead = document.getElementById('yfAccountHead');
      const tbody = document.getElementById('yfAccountBody');
      if (!thead || !tbody) return;

      thead.innerHTML = `
        <tr>
          <th style="width:15%;">日期</th>
          <th style="width:11%;">款項</th>
          <th style="width:22%;">明細</th>
          <th style="width:14%;">金額</th>
          <th style="width:14%;">餘額</th>
          <th style="width:16%;">備考</th>
          <th style="width:8%;">操作</th>
        </tr>
      `;

      tbody.innerHTML = yfAccount.map((r, idx) => `
        <tr>
          <td class="editable-col"><input type="text" class="cell-input font-mono" data-yf-table="account" data-row="${idx}" data-col="0" value="${r.date || ''}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 0)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'date', this.value), 0)" onchange="updateYfAccount(${idx}, 'date', this.value)" /></td>
          <td class="editable-col">
            <select class="cell-input" data-yf-table="account" data-row="${idx}" data-col="1" onkeydown="handleYfTableKey(event, 'account', ${idx}, 1)" onchange="updateYfAccount(${idx}, 'type', this.value)">
              <option value="入帳" ${r.type === '入帳' ? 'selected' : ''}>入帳</option>
              <option value="出帳" ${r.type === '出帳' ? 'selected' : ''}>出帳</option>
            </select>
          </td>
          <td class="editable-col"><input type="text" class="cell-input" data-yf-table="account" data-row="${idx}" data-col="2" value="${r.detail || ''}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 2)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'detail', this.value), 0)" onchange="updateYfAccount(${idx}, 'detail', this.value)" /></td>
          <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-yf-table="account" data-row="${idx}" data-col="3" value="${r.amount || 0}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 3)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'amount', this.value), 0)" onchange="updateYfAccount(${idx}, 'amount', this.value)" /></td>
          <td class="font-mono" style="text-align:right; padding-right:8px; color:var(--text-muted);">${formatNum(r.balance || 0, 0)}</td>
          <td class="editable-col"><input type="text" class="cell-input" data-yf-table="account" data-row="${idx}" data-col="4" value="${r.note || ''}" title="${(r.note || '').replace(/"/g, '&quot;')}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 4)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'note', this.value), 0)" onchange="updateYfAccount(${idx}, 'note', this.value)" /></td>
          <td><button class="btn-del" onclick="deleteYfAccountRow(${idx})">✕</button></td>
        </tr>
      `).join('');
    }

    function updateYfAccount(idx, field, val) {
      recordSnapshot();
      if (!yfAccount[idx]) return;
      if (field === 'date') {
        yfAccount[idx].date = yfToROCString(val);
        yfAutoSortByDate(yfAccount, 'date');
      } else if (field === 'amount') {
        yfAccount[idx][field] = parseFloat(val) || 0;
      } else {
        yfAccount[idx][field] = val;
      }
      computeYfAccountBalance();
      saveToStorage();
      renderTable();
    }

    function deleteYfAccountRow(idx) {
      if (confirm('確定刪除此筆帳戶明細？')) {
        recordSnapshot();
        yfAccount.splice(idx, 1);
        computeYfAccountBalance();
        saveToStorage();
        renderTable();
      }
    }

    function addYfAccountRow() {
      recordSnapshot();
      yfAccount.push({ date: '', type: '入帳', detail: '', amount: 0, balance: 0, note: '' });
      saveToStorage();
      renderTable();
    }

    /* ====== 媽的永豐：除息資訊表 ====== */
    function renderYfDividendTable() {
      const thead = document.getElementById('yfDividendHead');
      const tbody = document.getElementById('yfDividendBody');
      if (!thead || !tbody) return;

      thead.innerHTML = `
        <tr>
          <th style="width:16%;">除息日</th>
          <th style="width:13%;">現金股利</th>
          <th style="width:16%;">發放日</th>
          <th style="width:14%;">持有股數</th>
          <th style="width:12%;">股利</th>
          <th style="width:16%;">累計領取</th>
          <th style="width:13%;">操作</th>
        </tr>
      `;

      tbody.innerHTML = yfDividendRows.map((r, idx) => `
        <tr>
          <td class="editable-col"><input type="text" class="cell-input font-mono" data-yf-table="dividend" data-row="${idx}" data-col="0" value="${r.exDate || ''}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'dividend', ${idx}, 0)" onpaste="setTimeout(() => updateYfDividend(${idx}, 'exDate', this.value), 0)" onchange="updateYfDividend(${idx}, 'exDate', this.value)" /></td>
          <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-yf-table="dividend" data-row="${idx}" data-col="1" value="${r.cashPerShare || 0}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'dividend', ${idx}, 1)" onpaste="setTimeout(() => updateYfDividend(${idx}, 'cashPerShare', this.value), 0)" onchange="updateYfDividend(${idx}, 'cashPerShare', this.value)" /></td>
          <td class="editable-col"><input type="text" class="cell-input font-mono" data-yf-table="dividend" data-row="${idx}" data-col="2" value="${r.payDate || ''}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'dividend', ${idx}, 2)" onpaste="setTimeout(() => updateYfDividend(${idx}, 'payDate', this.value), 0)" onchange="updateYfDividend(${idx}, 'payDate', this.value)" /></td>
          <td class="font-mono" style="text-align:right; padding-right:8px; color:var(--text-muted);">${formatNum(r.heldShares || 0, 0)}</td>
          <td class="font-mono" style="text-align:right; padding-right:8px; color:var(--text-muted);">${formatNum(r.divAmount || 0, 0)}</td>
          <td class="font-mono font-bold" style="text-align:right; padding-right:8px;">${formatNum(r.cumulative || 0, 0)}</td>
          <td><button class="btn-del" onclick="deleteYfDividendRow(${idx})">✕</button></td>
        </tr>
      `).join('');
    }

    function updateYfDividend(idx, field, val) {
      recordSnapshot();
      if (!yfDividendRows[idx]) return;
      if (field === 'exDate' || field === 'payDate') {
        yfDividendRows[idx][field] = yfToROCString(val);
        if (field === 'exDate') yfAutoSortByDate(yfDividendRows, 'exDate');
      } else {
        yfDividendRows[idx][field] = parseFloat(val) || 0;
      }
      computeYfDividendDistribution();
      saveToStorage();
      renderTable();
    }

    function deleteYfDividendRow(idx) {
      if (confirm('確定刪除此筆除息記錄？')) {
        recordSnapshot();
        yfDividendRows.splice(idx, 1);
        computeYfDividendDistribution();
        saveToStorage();
        renderTable();
      }
    }

    function addYfDividendRow() {
      recordSnapshot();
      yfDividendRows.push({ exDate: '', cashPerShare: 0, payDate: '', heldShares: 0, divAmount: 0, cumulative: 0 });
      saveToStorage();
      renderTable();
    }

    /* ====== 媽的永豐：股票投資概況總覽卡片 (成本/股數/總股利自動加總，現值/目標本金手動輸入) ====== */
    function renderYfOverview() {
      const panel = document.getElementById('yfOverviewPanel');
      if (!panel) return;
      if (currentFilter !== 'YONG_FENG_TAB') { panel.style.display = 'none'; return; }
      panel.style.display = 'block';

      const nameEl = document.getElementById('yfOvName');
      const currentEl = document.getElementById('yfOvCurrent');
      if (nameEl && document.activeElement !== nameEl) nameEl.value = yfOverview.stockName || '';
      if (currentEl && document.activeElement !== currentEl) currentEl.value = yfOverview.currentValue || 0;

      const totalShares = yfDetail.reduce((s, r) => s + (Number(r.shares) || 0), 0);
      const totalCost = yfDetail.reduce((s, r) => s + (Number(r.cost) || 0), 0);
      const currentVal = Number(yfOverview.currentValue) || 0;
      const goal = 100000; // 固定目標本金，不提供編輯欄位
      const dividend = computeYfDividendDistribution();
      yfOverview.totalDividend = dividend;

      const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
      const unrealizedPL = currentVal - totalCost;
      const roi = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;

      const costWithDiv = totalCost - dividend;
      const plWithDiv = currentVal - costWithDiv;
      const avgPriceWithDiv = totalShares > 0 ? costWithDiv / totalShares : 0;
      const roiWithDiv = costWithDiv > 0 ? (plWithDiv / costWithDiv) * 100 : 0;
      const debt = goal - totalCost;

      document.getElementById('yfOvCost').textContent = '$' + formatNum(totalCost, 0);
      document.getElementById('yfOvShares').textContent = formatNum(totalShares, 0);
      document.getElementById('yfOvAvgPrice').textContent = formatNum(avgPrice, 2);

      const elProfit = document.getElementById('yfOvProfit');
      elProfit.textContent = '$' + formatNum(unrealizedPL, 0);
      elProfit.style.color = unrealizedPL >= 0 ? 'var(--up-red)' : 'var(--down-green)';
      document.getElementById('yfOvROI').textContent = roi.toFixed(2) + '%';

      document.getElementById('yfOvTotalDiv').textContent = '$' + formatNum(dividend, 0);
      document.getElementById('yfOvCostWithDiv').textContent = '$' + formatNum(costWithDiv, 0);
      const elProfitDiv = document.getElementById('yfOvProfitWithDiv');
      elProfitDiv.textContent = '$' + formatNum(plWithDiv, 0);
      elProfitDiv.style.color = plWithDiv >= 0 ? 'var(--up-red)' : 'var(--down-green)';
      document.getElementById('yfOvAvgPriceWithDiv').textContent = formatNum(avgPriceWithDiv, 2);
      document.getElementById('yfOvROIWithDiv').textContent = roiWithDiv.toFixed(2) + '%';

      document.getElementById('yfOvRemain').textContent = '$' + formatNum(debt, 0);
    }

    function updateYfOverview(field, val) {
      recordSnapshot();
      yfOverview[field] = (field === 'stockName') ? val : (parseFloat(val) || 0);
      saveToStorage();
      renderYfOverview();
    }

    /* ====== 媽的永豐：三表 + 總覽 一次全部渲染 (無分頁切換，並排顯示) ====== */
    /* ====== 渲染「歷年股利總合」子分頁 (股利分頁) ====== */
    function renderYearlySummaryTable(thead, tbody) {
      thead.innerHTML = `
        <tr>
          <th style="width: 170px;">發放年度</th>
          <th style="width: 170px; color:#5c5445;">非持股股利總和 ($)</th>
          <th style="width: 170px; color:#766c5a;">目前持股股利 (含現價折算) ($)</th>
          <th style="width: 200px; color:#9c7c52; font-size:0.95rem;">年度全體總額 ($) 🌟</th>
          <th style="width: 200px;">全體歷年佔比</th>
          <th style="width: 120px;">統計狀態</th>
        </tr>
      `;

      const fullSummaryList = getFullAssetYearlyDividendSummary();
      const grandYearlyTotal = fullSummaryList.reduce((sum, y) => sum + y.totalAmount, 0);

      tbody.innerHTML = fullSummaryList.map(item => {
        const ratio = grandYearlyTotal > 0 ? ((item.totalAmount / grandYearlyTotal) * 100).toFixed(1) : 0;
        return `
          <tr>
            <td style="font-weight:700; font-size:0.92rem;">${item.displayYear}</td>
            <td class="font-mono" style="color:#5c5445;">$${formatNum(item.pastAmount, 0)}</td>
            <td class="font-mono font-bold" style="color:#766c5a;">$${formatNum(item.currentAmount, 0)}</td>
            <td class="font-mono font-bold" style="font-size:1.05rem; color:#9c7c52; background:#f4ecd4;">
              $${formatNum(item.totalAmount, 0)}
            </td>
            <td>
              <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                <div style="width:110px; background:#ece6d9; border-radius:4px; height:8px; overflow:hidden;">
                  <div style="width:${ratio}%; background:#9c7c52; height:100%;"></div>
                </div>
                <span class="font-mono font-bold" style="font-size:0.8rem; color:#93897a;">${ratio}%</span>
              </div>
            </td>
            <td><span style="font-size:0.75rem; background:#eef0e6; color:#3f6b4c; padding:2px 8px; border-radius:4px;">全資產合計</span></td>
          </tr>
        `;
      }).join('');

      renderSummary();
    }

    /* ====== 渲染「年度預估股利」子分頁 (股利分頁) ====== */
    function renderEstimatedDividendsTable(thead, tbody) {
      const uniqueStocksMap = new Map();
      stocks.forEach(s => {
        const key = s.code ? s.code.trim() : s.name.trim();
        if (!uniqueStocksMap.has(key)) {
          uniqueStocksMap.set(key, {
            name: s.name,
            code: s.code || '',
            shares: Number(s.shares) || 0,
            currentPrice: Number(s.currentPrice) || 0,
            account: s.account,
            category: s.category
          });
        } else {
          const ex = uniqueStocksMap.get(key);
          ex.shares += Number(s.shares) || 0;
          if (Number(s.currentPrice) > 0) ex.currentPrice = Number(s.currentPrice);
        }
      });

      const uniqueStocks = Array.from(uniqueStocksMap.values());

      thead.innerHTML = `
        <tr>
          <th style="width: 140px; background:#ece6d9;">項目 / 股票</th>
          ${uniqueStocks.map(us => `<th style="width: 120px;">${us.name} <span style="font-size:0.75rem; color:#93897a;">${us.code ? '(' + us.code + ')' : ''}</span></th>`).join('')}
        </tr>
      `;

      let estRows = [
        { label: '預估除息', field: 'expCash', type: 'input' },
        { label: '預估除權', field: 'expStock', type: 'input' },
        { label: '現金殖利率', field: 'yieldRate', type: 'calc_yield' },
        { label: '預估現金股利', field: 'totCash', type: 'calc_tot_cash' },
        { label: '預估股票股利', field: 'totStock', type: 'calc_tot_stock' },
        { label: '除權息參考價', field: 'refPrice', type: 'calc_ref_price' },
        { label: '除權後股數', field: 'afterShares', type: 'calc_after_shares' },
        { label: '持有股數 (目前)', field: 'shares', type: 'display_shares' }
      ];

      tbody.innerHTML = estRows.map(row => {
        let cellsHtml = uniqueStocks.map((us) => {
          const key = us.code ? us.code : us.name;
          if (!dividendEstimates[key]) {
            dividendEstimates[key] = { expCash: 0, expStock: 0 };
          }
          const est = dividendEstimates[key];
          const price = us.currentPrice;
          const shares = us.shares;

          if (row.type === 'input') {
            const val = est[row.field] !== undefined ? est[row.field] : 0;
            return `
              <td class="editable-col">
                <input type="number" step="any" class="cell-input font-mono font-bold" value="${val}" onchange="updateEstDividend('${key}', '${row.field}', this.value)" />
              </td>
            `;
          } else if (row.type === 'display_shares') {
            return `<td class="font-mono">${formatNum(shares, 0)}</td>`;
          } else if (row.type === 'calc_yield') {
            const c = Number(est.expCash) || 0;
            const y = price > 0 ? (c / price) * 100 : 0;
            return `<td class="font-mono font-bold" style="color:#766c5a;">${y.toFixed(2)}%</td>`;
          } else if (row.type === 'calc_tot_cash') {
            const c = Number(est.expCash) || 0;
            const totC = Math.round(c * shares);
            return `<td class="font-mono font-bold" style="color:#9c7c52;">$${formatNum(totC, 0)}</td>`;
          } else if (row.type === 'calc_tot_stock') {
            const s = Number(est.expStock) || 0;
            const totS = Math.round(s * shares);
            return `<td class="font-mono font-bold" style="color:#5c5445;">${formatNum(totS, 0)} 股</td>`;
          } else if (row.type === 'calc_ref_price') {
            const c = Number(est.expCash) || 0;
            const s = Number(est.expStock) || 0;
            const refP = price > 0 ? (price - c) / (1 + (s / 10)) : price;
            return `<td class="font-mono font-bold">${formatNum(refP, 2)}</td>`;
          } else if (row.type === 'calc_after_shares') {
            const s = Number(est.expStock) || 0;
            const afterSh = Math.round(shares * (1 + (s / 10)));
            return `<td class="font-mono font-bold">${formatNum(afterSh, 0)}</td>`;
          }
          return `<td>-</td>`;
        }).join('');

        return `
          <tr>
            <td style="font-weight:700; background:#fdfbf7; text-align:left; padding-left:12px;">${row.label}</td>
            ${cellsHtml}
          </tr>
        `;
      }).join('');

      renderSummary();
    }

    function updateEstDividend(key, field, value) {
      recordSnapshot();
      if (!dividendEstimates[key]) {
        dividendEstimates[key] = { expCash: 0, expStock: 0 };
      }
      dividendEstimates[key][field] = parseFloat(value) || 0;
      saveToStorage();
      renderTable();
    }

    /* ====== 渲染「非持有/已實現股利」子分頁 (股利分頁) ====== */
    function renderPastDividendsTable(thead, tbody) {
      const query = document.getElementById('searchBox') ? document.getElementById('searchBox').value.trim().toLowerCase() : '';
      const maxRows = Math.max(...pastColumns.map(c => c.items.length), 1);

      let headHtml = `<tr>`;
      pastColumns.forEach((c, idx) => {
        const themeClass = idx % 2 === 0 ? 'year-theme-a-head' : 'year-theme-b-head';
        headHtml += `<th colspan="2" class="${themeClass}">${c.year} 年度</th>`;
      });
      headHtml += `</tr><tr>`;
      pastColumns.forEach((c, idx) => {
        const subTheme = idx % 2 === 0 ? 'year-theme-a-sub' : 'year-theme-b-sub';
        headHtml += `<th class="${subTheme}">股票</th><th class="${subTheme}">現金股利 ($)</th>`;
      });
      headHtml += `</tr>`;
      thead.innerHTML = headHtml;

      let rowsHtml = '';
      for (let r = 0; r < maxRows; r++) {
        rowsHtml += `<tr>`;
        pastColumns.forEach((col, colIdx) => {
          const item = col.items[r] || { stock: '', amount: '', cashDate: '' };
          const isStockHit = query && item.stock && item.stock.toLowerCase().includes(query);
          const cellTheme = colIdx % 2 === 0 ? 'year-theme-a-cell' : 'year-theme-b-cell';

          const stockColIdx = colIdx * 2;
          const amtColIdx = colIdx * 2 + 1;
          const hasDate = Boolean(item.cashDate);

          rowsHtml += `
            <td class="${cellTheme}">
              <div class="stock-cell-wrap">
                <div class="stock-cell-box">
                  <input type="text" class="cell-input ${isStockHit ? 'highlight-cell' : ''}" style="font-weight:700;"
                    data-past-row="${r}" data-past-col="${stockColIdx}" data-year-idx="${colIdx}" data-field="stock"
                    value="${item.stock || ''}" placeholder="-"
                    onfocus="this.select()" onkeydown="handlePastCellKey(event, ${r}, ${stockColIdx})"
                    onchange="updatePastCellValue(${colIdx}, ${r}, 'stock', this.value)" />
                  <button class="btn-cal-icon" title="${hasDate ? '入帳日: ' + item.cashDate : '點擊記錄入帳日'}" onclick="openPastSingleDivModal(${colIdx}, ${r})">
                    ${hasDate ? '📅' : '🗓️'}
                  </button>
                </div>
                ${hasDate ? `<div class="stock-cell-date">${item.cashDate}</div>` : ''}
              </div>
            </td>
            <td class="${cellTheme}">
              <input type="number" step="any" class="cell-input font-mono ${isStockHit ? 'highlight-cell' : ''}"
                data-past-row="${r}" data-past-col="${amtColIdx}" data-year-idx="${colIdx}" data-field="amount"
                value="${item.amount !== '' && item.amount !== undefined ? item.amount : ''}" placeholder="-"
                onfocus="this.select()" onkeydown="handlePastCellKey(event, ${r}, ${amtColIdx})"
                onchange="updatePastCellValue(${colIdx}, ${r}, 'amount', this.value)" />
            </td>
          `;
        });
        rowsHtml += `</tr>`;
      }

      rowsHtml += `<tr>`;
      pastColumns.forEach((col, idx) => {
        const totTheme = idx % 2 === 0 ? 'year-theme-a-tot' : 'year-theme-b-tot';
        const colSum = col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
        rowsHtml += `
          <td class="${totTheme}">合計</td>
          <td class="font-mono ${totTheme}" style="font-size:0.95rem;">${formatNum(colSum, 0)}</td>
        `;
      });
      rowsHtml += `</tr>`;

      tbody.innerHTML = rowsHtml;
      renderSummary();

      setTimeout(() => {
        syncScrollWidth();
        scrollToLatestYear();
      }, 50);
    }

    /* ====== 非持有/已實現股利：儲存單一格資料 ====== */
    function updatePastCellValue(colIdx, row, field, value) {
      recordSnapshot();
      if (!pastColumns[colIdx]) return;
      while (pastColumns[colIdx].items.length <= row) {
        pastColumns[colIdx].items.push({ stock: '', amount: '', cashDate: '' });
      }
      if (field === 'amount') {
        pastColumns[colIdx].items[row][field] = value === '' ? '' : (parseFloat(value) || 0);
      } else {
        pastColumns[colIdx].items[row][field] = value;
      }
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：方向鍵在格子間移動 ====== */
    function handlePastCellKey(event, row, colIdx) {
      let targetRow = row;
      let targetCol = colIdx;
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        targetRow = row + 1;
      } else if (event.key === 'ArrowUp') {
        targetRow = row - 1;
      } else if (event.key === 'ArrowRight') {
        targetCol = colIdx + 1;
      } else if (event.key === 'ArrowLeft') {
        targetCol = colIdx - 1;
      } else {
        return;
      }
      const targetEl = document.querySelector(`[data-past-row="${targetRow}"][data-past-col="${targetCol}"]`);
      if (targetEl) {
        event.preventDefault();
        targetEl.focus();
      }
    }

    /* ====== 非持有/已實現股利：記錄單筆入帳日期彈窗 ====== */
    let pastDivModalTarget = { colIdx: null, row: null };
    function openPastSingleDivModal(colIdx, row) {
      pastDivModalTarget = { colIdx, row };
      const item = (pastColumns[colIdx] && pastColumns[colIdx].items[row]) || { cashDate: '' };
      const input = document.getElementById('pastDivDateInput');
      if (input) input.value = item.cashDate || '';
      const modal = document.getElementById('pastDivDateModal');
      if (modal) modal.classList.add('open');
    }

    function closePastSingleDivModal() {
      const modal = document.getElementById('pastDivDateModal');
      if (modal) modal.classList.remove('open');
    }

    function savePastSingleDivDate() {
      const { colIdx, row } = pastDivModalTarget;
      if (colIdx === null || row === null || !pastColumns[colIdx]) return;
      recordSnapshot();
      const input = document.getElementById('pastDivDateInput');
      const val = input ? input.value.trim() : '';
      while (pastColumns[colIdx].items.length <= row) {
        pastColumns[colIdx].items.push({ stock: '', amount: '', cashDate: '' });
      }
      pastColumns[colIdx].items[row].cashDate = val;
      saveToStorage();
      closePastSingleDivModal();
      renderTable();
    }

    /* ====== 非持有/已實現股利：新增一列 (在最後一個年度欄位加空白列) ====== */
    function handleAddNew() {
      recordSnapshot();
      if (pastColumns.length === 0) {
        pastColumns.push({ year: String(new Date().getFullYear() - 1911), items: [] });
      }
      pastColumns.forEach(col => {
        col.items.push({ stock: '', amount: '', cashDate: '' });
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：刪除最後一列空白列 (若最後一列全部欄位皆為空才刪) ====== */
    function handleDeleteLastPastRow() {
      if (pastColumns.length === 0) return;
      const maxRows = Math.max(...pastColumns.map(c => c.items.length), 0);
      if (maxRows === 0) return;
      const lastRowIdx = maxRows - 1;
      const isLastRowEmpty = pastColumns.every(col => {
        const item = col.items[lastRowIdx];
        if (!item) return true;
        return (!item.stock || item.stock.trim() === '') && (item.amount === '' || item.amount === undefined || Number(item.amount) === 0);
      });
      if (!isLastRowEmpty) {
        alert('最後一列還有資料，無法刪除。請先清空該列內容再試一次。');
        return;
      }
      recordSnapshot();
      pastColumns.forEach(col => {
        if (col.items.length > lastRowIdx) col.items.splice(lastRowIdx, 1);
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：新增新年度欄位 ====== */
    function handleAddYear() {
      const lastYear = pastColumns.length > 0 ? parseInt(pastColumns[pastColumns.length - 1].year) || (new Date().getFullYear() - 1911) : (new Date().getFullYear() - 1911);
      const newYear = prompt('請輸入新年度 (民國年，例如 116)：', String(lastYear + 1));
      if (!newYear) return;
      recordSnapshot();
      const maxRows = Math.max(...pastColumns.map(c => c.items.length), 5);
      pastColumns.push({
        year: newYear.trim(),
        items: Array.from({ length: maxRows }, () => ({ stock: '', amount: '', cashDate: '' }))
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：單一標的歷年現金股利速查 ====== */
    function calculateSingleStockPastDividends() {
      const input = document.getElementById('calcTargetInput');
      const detailEl = document.getElementById('calcDetailText');
      const totalEl = document.getElementById('calcTotalText');
      if (!input || !detailEl || !totalEl) return;
      const query = input.value.trim().toLowerCase();
      if (!query) {
        detailEl.textContent = '請輸入名稱進行速查';
        totalEl.textContent = '$0';
        return;
      }
      let total = 0;
      let count = 0;
      pastColumns.forEach(col => {
        col.items.forEach(item => {
          if (item.stock && item.stock.toLowerCase().includes(query)) {
            total += Number(item.amount) || 0;
            count++;
          }
        });
      });
      detailEl.textContent = `共找到 ${count} 筆紀錄`;
      totalEl.textContent = '$' + formatNum(total, 0);
    }

    /* ====== 渲染每日買賣紀錄小計表 (自動偵測多年份與月份格式，不顯示年份) ====== */
    function renderSalesSummaryTable(thead, tbody) {
      const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

      const yearSet = new Set(['115']);
      stockSales.forEach(r => {
        let dStr = String(r.date || '').trim();
        if (dStr.length >= 5) {
          let yrPart = dStr.length === 7 ? dStr.slice(0, 3) : (dStr.length === 6 ? dStr.slice(0, 2) : dStr.slice(0, 2));
          if (yrPart) yearSet.add(yrPart);
        }
      });
      salesHistory.forEach(h => {
        if (h.year) yearSet.add(String(h.year));
      });

      const sortedYears = Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
      if (!sortedYears.includes(selectedSummaryYear)) {
        selectedSummaryYear = sortedYears[0] || '115';
      }

      const yrSel = document.getElementById('summaryYearSelect');
      if (yrSel) {
        yrSel.innerHTML = sortedYears.map(yr => `<option value="${yr}" ${yr === selectedSummaryYear ? 'selected' : ''}>${yr}年</option>`).join('');
      }

      const monthData = Array.from({length: 12}, () => new Map());

      stockSales.forEach(r => {
        let dStr = String(r.date || '').trim();
        if (dStr.length >= 5) {
          let yrPart = '';
          let mPart = '';
          let dayPart = '';

          if (dStr.length === 7) {
            yrPart = dStr.slice(0, 3);
            mPart = dStr.slice(3, 5);
            dayPart = dStr.slice(5, 7);
          } else if (dStr.length === 6) {
            yrPart = dStr.slice(0, 2);
            mPart = dStr.slice(2, 4);
            dayPart = dStr.slice(4, 6);
          } else if (dStr.length === 5) {
            yrPart = dStr.slice(0, 2);
            mPart = '0' + dStr.slice(2, 3);
            dayPart = dStr.slice(3, 5);
          }

          if (yrPart === selectedSummaryYear) {
            let mNum = parseInt(mPart);
            if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
              let dayKey = `${mNum}/${parseInt(dayPart)}`;
              let amt = Number(r.spread) || 0;
              if (monthData[mNum - 1].has(dayKey)) {
                monthData[mNum - 1].set(dayKey, monthData[mNum - 1].get(dayKey) + amt);
              } else {
                monthData[mNum - 1].set(dayKey, amt);
              }
            }
          }
        }
      });

      const monthArrays = monthData.map(map => {
        let arr = [];
        for (let [dayStr, amount] of map.entries()) {
          arr.push({ dayStr, amount });
        }
        return arr;
      });

      let maxRows = Math.max(...monthArrays.map(arr => arr.length), 1);

      let headHtml = `<tr>`;
      monthNames.forEach((m, idx) => {
        const bgHead = idx % 2 === 0 ? 'background:#eef0e6; color:#5c5445;' : 'background:#f4ecd4; color:#6e5439;';
        headHtml += `<th colspan="2" style="${bgHead} font-size:0.95rem; text-align:center;">${selectedSummaryYear}年 ${m}</th>`;
      });
      headHtml += `</tr><tr>`;
      monthNames.forEach((m, idx) => {
        const bgSub = idx % 2 === 0 ? 'background:#fdfbf7; color:#5c5445;' : 'background:#f4ecd4; color:#6e5439;';
        headHtml += `<th style="${bgSub} width:75px;">日期</th><th style="${bgSub} width:85px;">金額</th>`;
      });
      headHtml += `</tr>`;
      thead.innerHTML = headHtml;

      let rowsHtml = '';
      for (let r = 0; r < maxRows; r++) {
        rowsHtml += `<tr>`;
        monthArrays.forEach((arr, mIdx) => {
          const item = arr[r] || { dayStr: '', amount: '' };
          const cellBg = mIdx % 2 === 0 ? 'background:#fdfbf7;' : 'background:#ffffff;';
          const amtVal = item.amount !== '' && item.amount !== undefined ? item.amount : '';
          const isPos = Number(amtVal) >= 0;
          const amtColor = amtVal !== '' ? (isPos ? 'color:var(--up-red); font-weight:700;' : 'color:var(--down-green); font-weight:700;') : '';

          rowsHtml += `
            <td style="${cellBg} font-family:monospace;">${item.dayStr}</td>
            <td style="${cellBg} font-family:monospace; ${amtColor}">${amtVal !== '' ? (isPos ? '+' : '') + formatNum(amtVal, 0) : ''}</td>
          `;
        });
        rowsHtml += `</tr>`;
      }

      // 小計 row
      rowsHtml += `<tr style="background:#ece7dc; font-weight:700;">`;
      const monthSums = monthArrays.map(arr => arr.reduce((s, it) => s + (Number(it.amount) || 0), 0));
      monthNames.forEach((m, idx) => {
        const sVal = monthSums[idx];
        const isPos = sVal >= 0;
        rowsHtml += `
          <td style="border-top:2px solid #ddd5c4;">小計</td>
          <td class="font-mono" style="border-top:2px solid #ddd5c4; color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(sVal, 0)}</td>
        `;
      });
      rowsHtml += `</tr>`;

      // 總計 row
      const grandTotal = monthSums.reduce((s, v) => s + v, 0);
      rowsHtml += `<tr style="background:#ece6d9; font-weight:800; font-size:0.95rem;">`;
      rowsHtml += `<td colspan="2">總計</td>`;
      rowsHtml += `<td colspan="22" class="font-mono" style="text-align:left; padding-left:16px; color:${grandTotal >= 0 ? 'var(--up-red)' : 'var(--down-green)'};">${grandTotal >= 0 ? '+' : ''}$${formatNum(grandTotal, 0)}</td>`;
      rowsHtml += `</tr>`;

      // 當沖損益 row
      const dayTradeSums = monthData.map((map, mIdx) => {
        let sum = 0;
        stockSales.forEach(r => {
          let dStr = String(r.date || '').trim();
          if (r.status === '當沖' && dStr.startsWith(selectedSummaryYear)) {
            let mPart = dStr.length === 7 ? dStr.slice(3, 5) : (dStr.length === 6 ? dStr.slice(2, 4) : '0' + dStr.slice(2, 3));
            if (parseInt(mPart) === (mIdx + 1)) {
              sum += Number(r.spread) || 0;
            }
          }
        });
        return sum;
      });

      rowsHtml += `<tr style="background:#f4ecd4; font-weight:700;">`;
      monthNames.forEach((m, idx) => {
        const dtVal = dayTradeSums[idx];
        const isPos = dtVal >= 0;
        rowsHtml += `
          <td>當沖損益</td>
          <td class="font-mono" style="color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(dtVal, 0)}</td>
        `;
      });
      rowsHtml += `</tr>`;

      tbody.innerHTML = rowsHtml;
      renderSummary();
    }

    /* ====== 渲染歷年紀錄表格 (自動帶入統計 + 保持可手動修改) ====== */
    function renderSalesHistoryTable(thead, tbody) {
      thead.innerHTML = `
        <tr>
          <th style="width: 100px;">年份</th>
          <th style="width: 200px;">總成本 ($)</th>
          <th style="width: 200px;">總賣出 ($)</th>
          <th style="width: 180px;">價差 ($)</th>
          <th style="width: 120px;">報酬率</th>
          <th style="width: 80px;">操作</th>
        </tr>
      `;

      let yearMap = new Map();

      // 1. 先放入既有紀錄：114年(含)以前一律視為手動固定；115年(含)以後只有使用者明確編輯過 (isManual===true) 才鎖定
      salesHistory.forEach(h => {
        const yr = String(h.year);
        const forceManual = parseInt(yr) <= 114;
        const manual = forceManual || h.isManual === true;
        yearMap.set(yr, {
          year: yr,
          totalCost: Number(h.totalCost) || 0,
          totalSell: Number(h.totalSell) || 0,
          spread: Number(h.spread) || 0,
          returnRate: Number(h.returnRate) || 0,
          isManual: manual
        });
      });

      // 2. 115年(含)以後，尚未被手動鎖定的年份，一律從「股票賣出明細」自動加總 (每次重新計算)
      let autoTotals = new Map();
      stockSales.forEach(r => {
        let dStr = String(r.date || '').trim();
        if (dStr.length < 5) return;
        let yrPart = dStr.length === 7 ? dStr.slice(0, 3) : (dStr.length === 6 ? dStr.slice(0, 2) : dStr.slice(0, 2));
        if (parseInt(yrPart) < 115) return;
        if (!autoTotals.has(yrPart)) {
          autoTotals.set(yrPart, { totalCost: 0, totalSell: 0, spread: 0 });
        }
        const t = autoTotals.get(yrPart);
        t.totalCost += Number(r.cost) || 0;
        t.totalSell += Number(r.sellAmt) || 0;
        t.spread += Number(r.spread) || 0;
      });

      autoTotals.forEach((t, yr) => {
        const existing = yearMap.get(yr);
        if (existing && existing.isManual) return;
        yearMap.set(yr, {
          year: yr,
          totalCost: t.totalCost,
          totalSell: t.totalSell,
          spread: t.spread,
          returnRate: t.totalCost > 0 ? t.spread / t.totalCost : 0,
          isManual: false
        });
      });

      salesHistory = Array.from(yearMap.values()).sort((a, b) => parseInt(b.year) - parseInt(a.year));

      let rowsHtml = salesHistory.map((h, hIdx) => {
        const isPos = (Number(h.spread) || 0) >= 0;
        const retStr = h.returnRate !== undefined && !isNaN(h.returnRate) ? (h.returnRate * 100).toFixed(2) + '%' : '0.00%';
        return `
          <tr>
            <td class="editable-col"><input type="text" class="cell-input font-bold" value="${h.year || ''}" onfocus="this.select()" onchange="updateHistoryRow(${hIdx}, 'year', this.value)" /></td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" value="${h.totalCost !== undefined ? h.totalCost : ''}" onfocus="this.select()" onchange="updateHistoryRow(${hIdx}, 'totalCost', this.value)" /></td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" value="${h.totalSell !== undefined ? h.totalSell : ''}" onfocus="this.select()" onchange="updateHistoryRow(${hIdx}, 'totalSell', this.value)" /></td>
            <td class="font-mono" style="font-weight:700; color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(h.spread, 0)}</td>
            <td class="font-mono" style="color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${retStr}</td>
            <td>
              <button class="btn-del" title="刪除" onclick="deleteHistoryRow(${hIdx})">✕</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rowsHtml;
      renderSummary();
    }

    function updateHistoryRow(index, field, value) {
      recordSnapshot();
      if (!salesHistory[index]) return;
      salesHistory[index].isManual = true;
      if (field === 'year') {
        salesHistory[index].year = value;
      } else {
        salesHistory[index][field] = parseFloat(value) || 0;
        salesHistory[index].spread = Number(salesHistory[index].totalSell) - Number(salesHistory[index].totalCost);
        if (Number(salesHistory[index].totalCost) > 0) {
          salesHistory[index].returnRate = salesHistory[index].spread / Number(salesHistory[index].totalCost);
        } else {
          salesHistory[index].returnRate = 0;
        }
      }
      saveToStorage();
      renderTable();
    }

    function deleteHistoryRow(index) {
      if (confirm('確定要刪除這筆歷年紀錄嗎？')) {
        recordSnapshot();
        salesHistory.splice(index, 1);
        saveToStorage();
        renderTable();
      }
    }

    function addSaleHistoryRow() {
      recordSnapshot();
      salesHistory.push({
        year: String(new Date().getFullYear() - 1911),
        totalCost: 0,
        totalSell: 0,
        spread: 0,
        returnRate: 0,
        isManual: true
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 股票賣出明細即時計算與強健鍵盤導航 (支援 Enter、Tab、方向鍵移動) ====== */
    function updateSaleRow(index, field, value) {
      recordSnapshot();
      const r = stockSales[index];
      if (!r) return;

      if (field === 'date' || field === 'name' || field === 'status') {
        r[field] = value;
      } else {
        r[field] = value === '' ? '' : (parseFloat(value) || 0);
      }

      // 成本 = 股數*買進價格+買進手續費；賣出 = 股數*賣出價格+賣出手續費+交易稅 (自動計算，直接改成本/賣出金額則尊重手動輸入)
      if (field === 'shares' || field === 'buyPrice' || field === 'buyFee') {
        const shares = Number(r.shares) || 0;
        const buyPrice = Number(r.buyPrice) || 0;
        const buyFee = Number(r.buyFee) || 0;
        r.cost = shares * buyPrice + buyFee;
      }
      if (field === 'shares' || field === 'sellPrice' || field === 'sellFee' || field === 'tax') {
        const shares = Number(r.shares) || 0;
        const sellPrice = Number(r.sellPrice) || 0;
        const sellFee = Number(r.sellFee) || 0;
        const tax = Number(r.tax) || 0;
        r.sellAmt = shares * sellPrice - sellFee - tax;
      }

      if (Number(r.cost) > 0 && Number(r.sellAmt) > 0) {
        r.spread = Number(r.sellAmt) - Number(r.cost);
        r.returnRate = r.spread / Number(r.cost);
      }

      if (field === 'date') {
        yfAutoSortByDate(stockSales, 'date');
      }

      recalcSalesDayTotals();

      saveToStorage();
      renderTable();
    }

    /* ====== 依日期重新計算「當日共計」(所有相同日期的列一起加總) ====== */
    function recalcSalesDayTotals() {
      const groups = {};
      stockSales.forEach(r => {
        if (!r.date) return;
        if (!groups[r.date]) groups[r.date] = [];
        groups[r.date].push(r);
      });
      Object.values(groups).forEach(group => {
        const daySum = group.reduce((s, it) => s + (Number(it.spread) || 0), 0);
        group.forEach(it => it.dayTotal = daySum);
      });
    }

    function handleSaleKey(e, rowIndex, colIndex) {
      const cols = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12]; // 可編輯欄位索引 (含狀態下拉選單 12)
      let currentIdxInCols = cols.indexOf(colIndex);

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (currentIdxInCols < cols.length - 1) {
          const nextInput = document.querySelector(`[data-sale-idx="${rowIndex}"][data-col="${cols[currentIdxInCols + 1]}"]`);
          if (nextInput) nextInput.focus();
        } else {
          if (rowIndex === stockSales.length - 1) {
            addStockSaleRow();
          } else {
            const nextRowInput = document.querySelector(`[data-sale-idx="${rowIndex + 1}"][data-col="${cols[0]}"]`);
            if (nextRowInput) nextRowInput.focus();
          }
        }
      } else if (e.key === 'ArrowRight') {
        if (currentIdxInCols < cols.length - 1) {
          e.preventDefault();
          const nextInput = document.querySelector(`[data-sale-idx="${rowIndex}"][data-col="${cols[currentIdxInCols + 1]}"]`);
          if (nextInput) nextInput.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentIdxInCols > 0) {
          e.preventDefault();
          const prevInput = document.querySelector(`[data-sale-idx="${rowIndex}"][data-col="${cols[currentIdxInCols - 1]}"]`);
          if (prevInput) prevInput.focus();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextInput = document.querySelector(`[data-sale-idx="${rowIndex + 1}"][data-col="${cols[currentIdxInCols]}"]`);
        if (nextInput) nextInput.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIndex > 0) {
          const prevInput = document.querySelector(`[data-sale-idx="${rowIndex - 1}"][data-col="${cols[currentIdxInCols]}"]`);
          if (prevInput) prevInput.focus();
        }
      }
    }

    function addStockSaleRow() {
      recordSnapshot();
      stockSales.push({
        date: '',
        name: '',
        shares: '',
        buyPrice: '',
        sellPrice: '',
        cost: '',
        sellAmt: '',
        spread: 0,
        returnRate: 0,
        buyFee: '',
        sellFee: '',
        tax: '',
        status: '',
        dayTotal: null,
        note: '',
        note2: ''
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 媽的永豐三表：方向鍵/Enter 在格子間移動 (Ctrl+C/V 由瀏覽器原生處理，貼上後靠 onpaste 同步資料) ====== */
    function handleYfTableKey(event, tableName, row, col) {
      const key = event.key;
      let targetRow = row;
      let targetCol = col;
      if (key === 'ArrowDown' || key === 'Enter') {
        targetRow = row + 1;
      } else if (key === 'ArrowUp') {
        targetRow = row - 1;
      } else if (key === 'ArrowRight') {
        targetCol = col + 1;
      } else if (key === 'ArrowLeft') {
        targetCol = col - 1;
      } else {
        return;
      }
      const targetEl = document.querySelector(`[data-yf-table="${tableName}"][data-row="${targetRow}"][data-col="${targetCol}"]`);
      if (targetEl) {
        event.preventDefault();
        targetEl.focus();
        if (targetEl.select) targetEl.select();
      }
    }


    function renderYfTablesAll() {
      computeYfAccountBalance();
      computeYfDividendDistribution();
      renderYfOverview();
      renderYfDetailTable();
      renderYfAccountTable();
      renderYfDividendTable();
    }

    /* ====== 調整 renderSummary 以支援 4 個卡片與 YONG_FENG_TAB ====== */
    function renderSummary() {
      let totalCost = 0, totalVal = 0, totalDiv = 0, totalLent = 0;
      stocks.forEach(s => {
        const isUS = s.account === '美股複委託' || s.category === '美股';
        const fxRate = isUS ? 29 : 1;

        const p = (Number(s.currentPrice) || 0) * fxRate;
        const cashD = (Number(s.cashDividends) || 0) * fxRate;
        const stockSh = Number(s.stockShares) || 0;
        const stockDVal = stockSh * p;

        totalCost += (Number(s.totalCost) || 0) * fxRate;
        totalVal += (Number(s.shares) || 0) * p;
        totalDiv += (cashD + stockDVal);
        totalLent += Number(s.lentShares) || 0;
      });

      const realizedGrandTotal = pastColumns.reduce((sum, col) => {
        return sum + col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      }, 0);

      const combinedAllDividends = totalDiv + realizedGrandTotal;

      const totalProfit = totalVal - totalCost;
      const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
      const isProfit = totalProfit >= 0;

      const elSummaryCost = document.getElementById('summaryCost');
      const elSummaryVal = document.getElementById('summaryValue');
      const elSummaryProf = document.getElementById('summaryProfit');
      const elSummaryProfRate = document.getElementById('summaryProfitRate');
      const elSummaryDivs = document.getElementById('summaryDividends');
      const elSummaryLent = document.getElementById('summaryLent');

      if (elSummaryCost) elSummaryCost.textContent = '$' + formatNum(totalCost, 0);
      if (elSummaryVal) elSummaryVal.textContent = '$' + formatNum(totalVal, 0);
      if (elSummaryProf) {
        elSummaryProf.textContent = (isProfit ? '+' : '') + '$' + formatNum(totalProfit, 0);
        elSummaryProf.style.color = isProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      if (elSummaryProfRate) {
        elSummaryProfRate.textContent = '報酬率：' + (isProfit ? '+' : '') + totalProfitRate.toFixed(2) + '%';
        elSummaryProfRate.style.color = isProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      if (elSummaryDivs) elSummaryDivs.textContent = '$' + formatNum(combinedAllDividends, 0);
      if (elSummaryLent) elSummaryLent.textContent = formatNum(totalLent, 0);

      const subDashContainer = document.getElementById('subDashboardContainer');
      const subCardValContainer = document.getElementById('subCardValContainer');

      const allAccs = getAllAccounts();
      let filterStocks = [];
      let labelName = '全部持股';

      if (currentFilter === 'ALL') {
        filterStocks = stocks;
        labelName = '全體持股';
      } else if (allAccs.includes(currentFilter)) {
        filterStocks = stocks.filter(s => s.account === currentFilter);
        labelName = currentFilter;
      } else if (currentFilter === '台股') {
        filterStocks = stocks.filter(s => s.category === '台股');
        labelName = '台股個股';
      } else if (currentFilter === 'STOCK_SALES') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        const totalSalesCost = stockSales.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        const totalSalesSpread = stockSales.reduce((s, r) => s + (Number(r.spread) || 0), 0);
        const totalSalesFees = stockSales.reduce((s, r) => s + (Number(r.buyFee) || 0) + (Number(r.sellFee) || 0) + (Number(r.tax) || 0), 0);
        
        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (elTitle) elTitle.textContent = `📌 [股票賣出] 總成本`;
        if (elCost) elCost.textContent = '$' + formatNum(totalSalesCost, 0);
        if (elCostDesc) elCostDesc.textContent = `共 ${stockSales.length} 筆賣出紀錄`;
        if (elTitleProf) elTitleProf.textContent = `總價差金額`;
        if (elProf) {
          elProf.textContent = (totalSalesSpread >= 0 ? '+' : '') + '$' + formatNum(totalSalesSpread, 0);
          elProf.style.color = totalSalesSpread >= 0 ? 'var(--up-red)' : 'var(--down-green)';
        }
        if (elProfRate) elProfRate.textContent = `賣出獲利統計`;
        if (elTitleDiv) elTitleDiv.textContent = `手續費總計`;
        if (elDivs) elDivs.textContent = '$' + formatNum(totalSalesFees, 0);
        if (elLent) elLent.textContent = `買手續費+賣手續費+交易稅`;
        return;
      } else if (currentFilter === 'YONG_FENG_TAB') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        const totalYfCost = yfDetail.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        const totalYfBal = yfAccount.length > 0 ? Number(yfAccount[yfAccount.length - 1].balance) || 0 : 0;
        const totalYfDiv = yfDividendRows.length > 0 ? Number(yfDividendRows[yfDividendRows.length - 1].cumulative) || 0 : 0;

        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (elTitle) elTitle.textContent = `📌 [媽的永豐] 定期投資總成本`;
        if (elCost) elCost.textContent = '$' + formatNum(totalYfCost, 0);
        if (elCostDesc) elCostDesc.textContent = `共 ${yfDetail.length} 筆買賣紀錄`;
        if (elTitleProf) elTitleProf.textContent = `帳戶最新餘額`;
        if (elProf) {
          elProf.textContent = '$' + formatNum(totalYfBal, 0);
          elProf.style.color = '#3c362e';
        }
        if (elProfRate) elProfRate.textContent = `獨立計算帳戶`;
        if (elTitleDiv) elTitleDiv.textContent = `累計領取股利`;
        if (elDivs) elDivs.textContent = '$' + formatNum(totalYfDiv, 0);
        if (elLent) elLent.textContent = `專屬領息總額`;
        return;
      } else if (currentFilter === 'DIVIDENDS_TAB') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (dividendsSubTab === 'estimate') {
          let totalEstCash = 0;
          let totalEstStockVal = 0;

          const uniqueStocksMap = new Map();
          stocks.forEach(s => {
            const key = s.code ? s.code.trim() : s.name.trim();
            if (!uniqueStocksMap.has(key)) {
              uniqueStocksMap.set(key, {
                shares: Number(s.shares) || 0,
                currentPrice: Number(s.currentPrice) || 0,
                account: s.account,
                category: s.category
              });
            } else {
              const ex = uniqueStocksMap.get(key);
              ex.shares += Number(s.shares) || 0;
              if (Number(s.currentPrice) > 0) ex.currentPrice = Number(s.currentPrice);
            }
          });

          uniqueStocksMap.forEach((us, key) => {
            const est = dividendEstimates[key] || { expCash: 0, expStock: 0 };
            const isUS = us.account === '美股複委託' || us.category === '美股';
            const fxRate = isUS ? 29 : 1;
            const price = (Number(us.currentPrice) || 0) * fxRate;
            const shares = us.shares;

            const c = Number(est.expCash) || 0;
            const stks = Number(est.expStock) || 0;

            totalEstCash += c * shares;
            totalEstStockVal += (stks * shares) * price;
          });

          if (elTitle) elTitle.textContent = `📌 預估總現金股利`;
          if (elCost) elCost.textContent = '$' + formatNum(totalEstCash, 0);
          if (elCostDesc) elCostDesc.textContent = `庫存標的預估現金`;

          if (elTitleProf) elTitleProf.textContent = `預估總股票股利現值`;
          if (elProf) {
            elProf.textContent = '$' + formatNum(totalEstStockVal, 0);
            elProf.style.color = 'var(--up-red)';
          }
          if (elProfRate) elProfRate.textContent = `依現價折算現值`;

          if (elTitleDiv) elTitleDiv.textContent = `預估總股利合計`;
          if (elDivs) elDivs.textContent = '$' + formatNum(totalEstCash + totalEstStockVal, 0);
          if (elLent) elLent.textContent = `現金 + 股票現值`;
          return;
        } else {
          let currentHoldingsDivTotal = 0;
          stocks.forEach(st => {
            const p = Number(st.currentPrice) || 0;
            const isUS = st.account === '美股複委託' || st.category === '美股';
            const fxRate = isUS ? 29 : 1;
            (st.dividendHistory || []).forEach(dh => {
              const stCash = (Number(dh.cash) || 0) * fxRate;
              const stStockVal = (Number(dh.stockShares) || 0) * p * fxRate;
              currentHoldingsDivTotal += (stCash + stStockVal);
            });
          });

          if (elTitle) elTitle.textContent = `📌 非持股股利總和`;
          if (elCost) elCost.textContent = '$' + formatNum(realizedGrandTotal, 0);
          if (elCostDesc) elCostDesc.textContent = `歷史已實現總額`;

          if (elTitleProf) elTitleProf.textContent = `目前持股股利總和`;
          if (elProf) {
            elProf.textContent = '$' + formatNum(currentHoldingsDivTotal, 0);
            elProf.style.color = 'var(--up-red)';
          }
          if (elProfRate) elProfRate.textContent = `在倉持股累計領取`;

          if (elTitleDiv) elTitleDiv.textContent = `年度總股利總和`;
          if (elDivs) elDivs.textContent = '$' + formatNum(combinedAllDividends, 0);
          if (elLent) elLent.textContent = `已實現 + 目前持股`;
          return;
        }
      } else if (currentFilter === 'SNAPSHOT_LOGS') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        document.getElementById('filterTabCostTitle').textContent = `📌 [各股紀錄快照] 統計`;
        document.getElementById('filterCost').textContent = '$' + formatNum(totalCost, 0);
        document.getElementById('filterCostDesc').textContent = `歷史快照累積`;
        document.getElementById('filterProfit').textContent = '$' + formatNum(totalProfit, 0);
        document.getElementById('filterProfitRate').textContent = `歷史紀錄檢視`;
        document.getElementById('filterDividends').textContent = '$' + formatNum(combinedAllDividends, 0);
        document.getElementById('filterLent').textContent = '0';
        return;
      } else {
        filterStocks = stocks.filter(s => (currentFilter === 'ALL') || (s.account === currentFilter) || (s.category === currentFilter));
        labelName = currentFilter === 'ALL' ? '全體持股' : currentFilter;
      }

      if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
      if (subCardValContainer) subCardValContainer.style.display = 'block';

      let fCost = 0, fVal = 0, fDiv = 0, fLent = 0;
      filterStocks.forEach(s => {
        const isUS = s.account === '美股複委託' || s.category === '美股';
        const fxRate = isUS ? 29 : 1;

        const p = (Number(s.currentPrice) || 0) * fxRate;
        const cashD = (Number(s.cashDividends) || 0) * fxRate;
        const stockSh = Number(s.stockShares) || 0;
        const stockDVal = stockSh * p;

        fCost += (Number(s.totalCost) || 0) * fxRate;
        fVal += (Number(s.shares) || 0) * p;
        fDiv += (cashD + stockDVal);
        fLent += Number(s.lentShares) || 0;
      });

      const fProfit = fVal - fCost;
      const fProfitRate = fCost > 0 ? (fProfit / fCost) * 100 : 0;
      const isFProfit = fProfit >= 0;

      const isCurrentUS = currentFilter === '美股複委託';
      const fUnit = isCurrentUS ? 'US$' : '$';
      const fFx = isCurrentUS ? 29 : 1;

      document.getElementById('filterTabCostTitle').textContent = `📌 [${labelName}] 投入成本`;
      document.getElementById('filterCost').textContent = fUnit + formatNum(fCost / fFx, isCurrentUS ? 2 : 0);
      document.getElementById('filterCostDesc').textContent = `佔總資產 ${totalCost > 0 ? ((fCost / totalCost) * 100).toFixed(1) : 0}%`;

      document.getElementById('filterValue').textContent = fUnit + formatNum(fVal / fFx, isCurrentUS ? 2 : 0);
      document.getElementById('filterValDesc').textContent = `該分類現價總值`;

      const elFProf = document.getElementById('filterProfit');
      if (elFProf) {
        elFProf.textContent = (isFProfit ? '+' : '') + fUnit + formatNum(fProfit / fFx, isCurrentUS ? 2 : 0);
        elFProf.style.color = isFProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      const elFProfRate = document.getElementById('filterProfitRate');
      if (elFProfRate) {
        elFProfRate.textContent = (isFProfit ? '+' : '') + fProfitRate.toFixed(2) + '%';
        elFProfRate.style.color = isFProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      document.getElementById('filterDividends').textContent = fUnit + formatNum(fDiv / fFx, isCurrentUS ? 2 : 0);
      document.getElementById('filterLent').textContent = `該分頁借出：${formatNum(fLent, 0)} 張 / 股`;
    }

    function updateValue(id, field, value) {
      recordSnapshot();
      const item = stocks.find(s => s.id === id);
      if (item) {
        item[field] = parseFloat(value) || 0;
        saveToStorage();
        renderTable();
      }
    }

    function deleteStock(id) {
      if (confirm('確定要刪除這筆股票持股嗎？')) {
        recordSnapshot();
        stocks = stocks.filter(s => s.id !== id);
        saveToStorage();
        renderTabs();
        renderTable();
      }
    }

    /* ====== 全部股票表格：方向鍵/Enter 在格子間移動 ====== */
    function handleCellKey(event, row, col) {
      const key = event.key;
      let targetRow = row;
      let targetCol = col;
      if (key === 'ArrowDown' || key === 'Enter') {
        targetRow = row + 1;
      } else if (key === 'ArrowUp') {
        targetRow = row - 1;
      } else if (key === 'ArrowRight') {
        targetCol = col + 1;
      } else if (key === 'ArrowLeft') {
        targetCol = col - 1;
      } else {
        return;
      }
      const targetEl = document.querySelector(`#stockGrid [data-row="${targetRow}"][data-col="${targetCol}"]`);
      if (targetEl) {
        event.preventDefault();
        targetEl.focus();
        if (targetEl.select) targetEl.select();
      }
    }

    function deleteStockSale(index) {
      if (confirm('確定要刪除這筆股票賣出紀錄嗎？')) {
        recordSnapshot();
        stockSales.splice(index, 1);
        saveToStorage();
        renderTabs();
        renderTable();
      }
    }

    /* ====== HTML5 拖曳排序事件處理 ====== */
    function onDragStart(e) {
      const tr = e.target.closest('tr');
      draggedStockId = Number(tr.getAttribute('data-id'));
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }

    function onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const tr = e.target.closest('tr');
      if (tr && !tr.classList.contains('dragging')) {
        tr.classList.add('drag-over');
      }
    }

    function onDragLeave(e) {
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('drag-over');
    }

    function onDrop(e, targetStockId) {
      e.preventDefault();
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('drag-over');

      if (!draggedStockId || draggedStockId === Number(targetStockId)) return;

      const fromIdx = stocks.findIndex(s => s.id === draggedStockId);
      const toIdx = stocks.findIndex(s => s.id === Number(targetStockId));

      if (fromIdx !== -1 && toIdx !== -1) {
        recordSnapshot();
        const [movedItem] = stocks.splice(fromIdx, 1);
        stocks.splice(toIdx, 0, movedItem);
        saveToStorage();
        renderTabs();
        renderTable();
      }
    }

    function onDragEnd(e) {
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('dragging');
      document.querySelectorAll('tr').forEach(row => row.classList.remove('drag-over'));
      draggedStockId = null;
    }

    /* ====== 快照日期標籤切換與整筆刪除 ====== */
    function selectSnapshotDate(dateStr) {
      selectedSnapshotDate = dateStr;
      renderTable();
    }

    function deleteEntireSnapshot(dateStr) {
      if (confirm(`確定要刪除整個【${dateStr}】的資產快照紀錄嗎？`)) {
        let allSnaps = JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]');
        allSnaps = allSnaps.filter(sp => sp.date !== dateStr);
        localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(allSnaps));
        
        if (allSnaps.length > 0) {
          selectedSnapshotDate = allSnaps[0].date;
        } else {
          selectedSnapshotDate = null;
        }
        renderTabs();
        renderTable();
      }
    }

    function deleteSnapshotItem(dateStr, itemIdx) {
      if (confirm('確定要刪除這筆快照紀錄嗎？')) {
        let allSnaps = JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]');
        const snap = allSnaps.find(sp => sp.date === dateStr);
        if (snap) {
          snap.items.splice(itemIdx, 1);
          allSnaps = allSnaps.filter(sp => sp.items.length > 0);
          localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(allSnaps));
          renderTabs();
          renderTable();
        }
      }
    }

    /* ====== 一鍵紀錄資產快照 ====== */
    function takeAssetSnapshot() {
      const today = new Date().toISOString().slice(0, 10);
      const targetAccounts = getAllAccounts();
      const snapshotItems = stocks.filter(s => targetAccounts.includes(s.account));

      if (snapshotItems.length === 0) {
        alert('沒有找到任何持股可供記錄！');
        return;
      }

      let savedSnapshots = [];
      const storedSnap = localStorage.getItem('ASSET_SNAPSHOTS_V1');
      if (storedSnap) {
        try { savedSnapshots = JSON.parse(storedSnap); } catch (e) {}
      }

      let existingSnap = savedSnapshots.find(sp => sp.date === today);
      const newItems = snapshotItems.map(s => ({
        account: s.account,
        name: s.name,
        code: s.code || '-',
        shares: Number(s.shares) || 0,
        totalCost: Number(s.totalCost) || 0,
        currentPrice: Number(s.currentPrice) || 0,
        marketVal: (Number(s.shares) || 0) * (Number(s.currentPrice) || 0),
        profit: ((Number(s.shares) || 0) * (Number(s.currentPrice) || 0)) - (Number(s.totalCost) || 0)
      }));

      if (existingSnap) {
        existingSnap.items = newItems;
      } else {
        savedSnapshots.unshift({
          date: today,
          items: newItems
        });
      }

      localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(savedSnapshots));
      selectedSnapshotDate = today;
      alert(`📸 成功記錄 ${today} 的資產快照！已自動切換至【各股紀錄】分頁。`);
      
      setFilter('SNAPSHOT_LOGS');
    }

    /* ====== 捲動軸同步 ====== */
    function setupScrollSync() {
      const topWrapper = document.getElementById('topScrollWrapper');
      const tableWrapper = document.getElementById('mainTableContainer');
      if (!topWrapper || !tableWrapper) return;

      let isSyncingTop = false;
      let isSyncingTable = false;

      topWrapper.addEventListener('scroll', () => {
        if (!isSyncingTop) {
          isSyncingTable = true;
          tableWrapper.scrollLeft = topWrapper.scrollLeft;
        }
        isSyncingTop = false;
      });

      tableWrapper.addEventListener('scroll', () => {
        if (!isSyncingTable) {
          isSyncingTop = true;
          topWrapper.scrollLeft = tableWrapper.scrollLeft;
        }
        isSyncingTable = false;
      });
    }

    function syncScrollWidth() {
      const grid = document.getElementById('stockGrid');
      const dummy = document.getElementById('topScrollDummy');
      if (grid && dummy) {
        dummy.style.width = grid.scrollWidth + 'px';
      }
    }

    function scrollToLatestYear() {
      const topWrapper = document.getElementById('topScrollWrapper');
      const tableWrapper = document.getElementById('mainTableContainer');
      if (tableWrapper) {
        tableWrapper.scrollLeft = tableWrapper.scrollWidth;
      }
      if (topWrapper) {
        topWrapper.scrollLeft = topWrapper.scrollWidth;
      }
    }

    /* ====== 新增股票與證券帳戶管理 ====== */
    function openAddAccountModal() {
      document.getElementById('newAccountName').value = '';
      document.getElementById('addAccountModal').classList.add('open');
    }

    function closeAddAccountModal() {
      document.getElementById('addAccountModal').classList.remove('open');
    }

    function submitAddAccount() {
      const name = document.getElementById('newAccountName').value.trim();
      if (!name) {
        alert('請輸入證券帳戶名稱！');
        return;
      }
      const allAccs = getAllAccounts();
      if (allAccs.includes(name)) {
        alert('此證券帳戶已存在！');
        return;
      }

      recordSnapshot();
      customAccounts.push(name);
      saveToStorage();
      renderTabs();
      setFilter(name);
      closeAddAccountModal();
      alert(`已成功新增證券帳戶【${name}】！`);
    }

    function deleteCustomAccount(event, accName) {
      event.stopPropagation();
      const hasStocks = stocks.some(s => s.account === accName);
      if (hasStocks) {
        alert(`無法刪除【${accName}】！該帳戶內還有股票標的，請先將標的刪除或移動至其他帳戶。`);
        return;
      }

      if (confirm(`確定要刪除證券帳戶【${accName}】分頁嗎？`)) {
        recordSnapshot();
        customAccounts = customAccounts.filter(a => a !== accName);
        if (currentFilter === accName) {
          currentFilter = 'ALL';
        }
        saveToStorage();
        renderTabs();
        renderTable();
      }
    }

    function openAddStockModal() {
      if (currentFilter === 'DIVIDENDS_TAB' && dividendsSubTab === 'past') {
        handleAddNew();
        return;
      }
      if (currentFilter === 'STOCK_SALES') {
        if (salesSubTab === 'history') {
          addSaleHistoryRow();
        } else {
          addStockSaleRow();
        }
        return;
      }
      document.getElementById('addModalTitle').textContent = '➕ 新增股票標的';
      document.getElementById('newStockName').value = '';
      document.getElementById('newStockCode').value = '';
      document.getElementById('newStockShares').value = '';
      document.getElementById('newStockTotalCost').value = '';
      
      const accSelect = document.getElementById('newStockAccount');
      const allAccs = getAllAccounts();
      accSelect.innerHTML = allAccs.map(acc => `<option value="${acc}">${acc}</option>`).join('');

      if (allAccs.includes(currentFilter)) {
        accSelect.value = currentFilter;
      } else {
        accSelect.value = allAccs[0] || '富邦證券';
      }
      handleAutoDetectCategory();

      document.getElementById('addStockModal').classList.add('open');
    }

    function closeAddStockModal() {
      const modal = document.getElementById('addStockModal');
      if (modal) modal.classList.remove('open');
    }

    function handleAutoDetectCategory() {
      const acc = document.getElementById('newStockAccount').value;
      const code = document.getElementById('newStockCode').value.trim();
      const catSelect = document.getElementById('newStockCategory');
      if (!catSelect) return;

      if (acc === '美股複委託') {
        catSelect.value = '美股';
      } else if (code.startsWith('00')) {
        catSelect.value = 'ETF';
      } else {
        catSelect.value = '台股';
      }
    }

    function submitAddNewStock() {
      const name = document.getElementById('newStockName').value.trim();
      if (!name) {
        alert('請輸入股票/ETF名稱！');
        return;
      }

      const code = document.getElementById('newStockCode').value.trim();
      const account = document.getElementById('newStockAccount').value;
      const category = document.getElementById('newStockCategory').value;
      const shares = parseFloat(document.getElementById('newStockShares').value) || 0;
      const totalCost = parseFloat(document.getElementById('newStockTotalCost').value) || 0;

      recordSnapshot();
      const newItem = {
        id: Date.now(),
        name: name,
        code: code,
        category: category,
        account: account,
        shares: shares,
        totalCost: totalCost,
        currentPrice: 0,
        cashDividends: 0,
        stockShares: 0,
        dividendHistory: [],
        lentShares: 0
      };

      stocks.unshift(newItem);
      saveToStorage();
      renderTabs();
      renderTable();
      closeAddStockModal();
    }

    /* ====== 分離式股利彈窗 ====== */
    function openDividendModal(stockId, type = 'cash') {
      currentModalType = type;
      let target = null;
      let isMerged = false;

      if (typeof stockId === 'string' && stockId.startsWith('merged_')) {
        isMerged = true;
        const mergedList = getMergedTaiwanStocks();
        target = mergedList.find(m => m.id === stockId);
      } else {
        target = stocks.find(s => s.id === Number(stockId));
      }

      if (!target) return;
      currentEditingStockId = stockId;

      const isUS = target.account === '美股複委託' || target.category === '美股';
      const fxRate = isUS ? 29 : 1;
      const unitSymbol = isUS ? 'US$' : '$';

      const curPrice = (Number(target.currentPrice) || 0) * fxRate;
      const modalHead = document.getElementById('dividendModalHead');

      if (type === 'cash') {
        document.getElementById('modalTitle').textContent = `💰 ${target.name} (${target.code || '-'}) - 歷年現金股利明細 ${isMerged ? '(跨帳戶合計)' : ''} ${isUS ? '[美金]' : ''}`;
        document.getElementById('modalSubTitle').textContent = `記錄每年現金股利金額與入帳時間`;
        document.getElementById('modalFooterLabel').textContent = '現金股利總計：';
        modalHead.innerHTML = `
          <tr style="background:#f1f5f9; color:#475569;">
            <th style="width: 100px;">發放年度</th>
            <th style="width: 180px;">現金股利匯入時間</th>
            <th style="width: 180px; color:#d97706;">現金股利金額 (${unitSymbol})</th>
            <th style="width: 60px;">刪除</th>
          </tr>
        `;
      } else {
        document.getElementById('modalTitle').textContent = `📈 ${target.name} (${target.code || '-'}) - 歷年股票股利明細 ${isMerged ? '(跨帳戶合計)' : ''}`;
        document.getElementById('modalSubTitle').textContent = `最新現價：${unitSymbol}${formatNum(curPrice / fxRate, isUS ? 2 : 2)}（依現價折算扣抵市值）`;
        document.getElementById('modalFooterLabel').textContent = '股票股利折算總市值：';
        modalHead.innerHTML = `
          <tr style="background:#f1f5f9; color:#475569;">
            <th style="width: 90px;">發放年度</th>
            <th style="width: 160px;">股票股利匯入時間</th>
            <th style="width: 130px; color:#1d4ed8;">配股股數 (股)</th>
            <th style="width: 150px;">現價折算市值 (${unitSymbol})</th>
            <th style="width: 50px;">刪除</th>
          </tr>
        `;
      }
      
      const history = (target.dividendHistory || []).map(h => ({
        year: h.year || 2024,
        cashDate: h.cashDate || '',
        cash: Number(h.cash !== undefined ? h.cash : 0),
        stockDate: h.stockDate || '',
        stockShares: Number(h.stockShares !== undefined ? h.stockShares : (h.stock || 0))
      }));

      renderDividendModalRows(history, curPrice / fxRate, isReadOnly = isMerged, unitSymbol);
      
      const btnAdd = document.getElementById('btnAddDivRow');
      const btnSave = document.getElementById('btnSaveDivModal');
      if (isMerged) {
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnSave) btnSave.style.display = 'none';
      } else {
        if (btnAdd) btnAdd.style.display = 'block';
        if (btnSave) btnSave.style.display = 'block';
      }

      document.getElementById('dividendModal').classList.add('open');
    }

    function closeDividendModal() {
      document.getElementById('dividendModal').classList.remove('open');
      currentEditingStockId = null;
    }

    function renderDividendModalRows(history, currentPrice, isReadOnly = false, unitSymbol = '$') {
      const tbody = document.getElementById('dividendTableBody');
      let totalAmount = 0;

      if (currentModalType === 'cash') {
        tbody.innerHTML = history.map((item, idx) => {
          const cash = Number(item.cash) || 0;
          totalAmount += cash;

          return `
            <tr>
              <td>
                ${isReadOnly ? `<span class="font-bold">${item.year}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-weight:700;" value="${item.year || 2024}" onchange="updateDividendRow(${idx}, 'year', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span>${item.cashDate || '-'}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-size:0.85rem;" placeholder="YYYY-MM-DD" value="${item.cashDate || ''}" onchange="updateDividendRow(${idx}, 'cashDate', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span class="font-mono font-bold" style="color:#d97706;">${unitSymbol}${formatNum(cash, 0)}</span>` : `
                  <input type="number" step="any" class="cell-input font-mono" style="border:1px solid #cbd5e1; color:#d97706; font-weight:700;" value="${cash}" onchange="updateDividendRow(${idx}, 'cash', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span style="color:#94a3b8;">-</span>` : `
                  <button class="btn-del" title="刪除此年度" onclick="removeDividendRow(${idx})">✕</button>
                `}
              </td>
            </tr>
          `;
        }).join('');

        document.getElementById('modalTotalDiv').style.color = '#9c7c52';
        document.getElementById('modalTotalDiv').textContent = unitSymbol + formatNum(totalAmount, 0);

      } else {
        tbody.innerHTML = history.map((item, idx) => {
          const sShares = Number(item.stockShares) || 0;
          const stockVal = sShares * currentPrice;
          totalAmount += stockVal;

          return `
            <tr>
              <td>
                ${isReadOnly ? `<span class="font-bold">${item.year}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-weight:700;" value="${item.year || 2024}" onchange="updateDividendRow(${idx}, 'year', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span>${item.stockDate || '-'}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-size:0.85rem;" placeholder="YYYY-MM-DD" value="${item.stockDate || ''}" onchange="updateDividendRow(${idx}, 'stockDate', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span class="font-mono font-bold" style="color:#1d4ed8;">${formatNum(sShares, 0)}</span>` : `
                  <input type="number" step="any" class="cell-input font-mono" style="border:1px solid #cbd5e1; color:#1d4ed8; font-weight:700;" value="${sShares}" onchange="updateDividendRow(${idx}, 'stockShares', this.value)" />
                `}
              </td>
              <td class="font-mono font-bold" style="background:#f8fafc; color:#1d4ed8;">
                ${unitSymbol}${formatNum(stockVal, 0)}
              </td>
              <td>
                ${isReadOnly ? `<span style="color:#94a3b8;">-</span>` : `
                  <button class="btn-del" title="刪除此年度" onclick="removeDividendRow(${idx})">✕</button>
                `}
              </td>
            </tr>
          `;
        }).join('');

        document.getElementById('modalTotalDiv').style.color = '#5c5445';
        document.getElementById('modalTotalDiv').textContent = unitSymbol + formatNum(totalAmount, 0);
      }
    }

    function addDividendYear() {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (!stock) return;
      if (!stock.dividendHistory) stock.dividendHistory = [];
      const lastYear = stock.dividendHistory.length > 0 ? Math.max(...stock.dividendHistory.map(h => Number(h.year) || 2024)) + 1 : new Date().getFullYear();
      stock.dividendHistory.push({ year: lastYear, cashDate: '', cash: 0, stockDate: '', stockShares: 0 });
      const isUS = stock.account === '美股複委託' || stock.category === '美股';
      renderDividendModalRows(stock.dividendHistory, Number(stock.currentPrice) || 0, false, isUS ? 'US$' : '$');
    }

    function updateDividendRow(index, field, value) {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (!stock || !stock.dividendHistory[index]) return;
      stock.dividendHistory[index][field] = (field === 'cash' || field === 'stockShares') ? (parseFloat(value) || 0) : value;
      const isUS = stock.account === '美股複委託' || stock.category === '美股';
      renderDividendModalRows(stock.dividendHistory, Number(stock.currentPrice) || 0, false, isUS ? 'US$' : '$');
    }

    function removeDividendRow(index) {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (!stock || !stock.dividendHistory) return;
      stock.dividendHistory.splice(index, 1);
      const isUS = stock.account === '美股複委託' || stock.category === '美股';
      renderDividendModalRows(stock.dividendHistory, Number(stock.currentPrice) || 0, false, isUS ? 'US$' : '$');
    }

    function saveDividendModal() {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (stock) {
        recordSnapshot();
        const cashSum = (stock.dividendHistory || []).reduce((sum, h) => sum + (Number(h.cash) || 0), 0);
        const stockSharesSum = (stock.dividendHistory || []).reduce((sum, h) => sum + (Number(h.stockShares) || 0), 0);
        stock.cashDividends = cashSum;
        stock.stockShares = stockSharesSum;
        saveToStorage();
        renderTable();
      }
      closeDividendModal();
    }

    function exportStockData() {
      const exportObj = {
        stocks: stocks,
        pastColumns: pastColumns,
        customAccounts: customAccounts,
        stockSales: stockSales,
        salesHistory: salesHistory,
        snapshots: JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'),
        yfDetail: yfDetail,
        yfAccount: yfAccount,
        yfDividendRows: yfDividendRows,
        yfOverview: yfOverview,
        version: "V56",
        exportDate: new Date().toISOString()
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
      const dl = document.createElement('a');
      dl.setAttribute("href", dataStr);
      dl.setAttribute("download", `股票資產備份_${new Date().toISOString().slice(0,10)}.json`);
      dl.click();
    }

    function importStockData(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (Array.isArray(imported)) {
            stocks = imported;
          } else if (imported && imported.stocks) {
            stocks = imported.stocks;
            if (imported.pastColumns) pastColumns = imported.pastColumns;
            if (imported.customAccounts) customAccounts = imported.customAccounts;
            if (imported.stockSales) stockSales = imported.stockSales;
            if (imported.salesHistory) salesHistory = imported.salesHistory;
            if (imported.yfDetail) yfDetail = imported.yfDetail;
            if (imported.yfAccount) yfAccount = imported.yfAccount;
            if (imported.yfDividendRows) yfDividendRows = imported.yfDividendRows;
            if (imported.yfOverview) yfOverview = imported.yfOverview;
            if (imported.snapshots) localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(imported.snapshots));
          }
          recordSnapshot();
          saveToStorage();
          renderTabs();
          renderTable();
          alert('匯入成功！');
        } catch (err) {
          alert('匯入失敗：檔案格式不正確');
        }
      };
      reader.readAsText(file);
    }

    function formatNum(num, decimals = 0) {
      if (num === null || num === undefined || isNaN(num)) return '0';
      return Number(num).toLocaleString('zh-TW', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    window.onload = init;
