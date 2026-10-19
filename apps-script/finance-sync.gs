// ===== 設定區 =====
const FINANCE_SHEET_ID = '1BskbFv_ycu1gPIGUyzcwkCchYeB3MBcHubdPUZJ0Bh4';
function syncAllFinance() {
  syncPeriodOverview();
  syncBankAssets();
  syncInsuranceAssets();
  syncStockOverview();
  syncBadDebtItems();
  syncStockHoldings();
  syncStockSales();
  syncStockLending();
  syncDividendInfo();
  syncDcaRows();
  syncSalesHistory();
  syncYfAccount();
  syncSnapshots();
  // ↓ 2026-10 新增：對帳單匯入相關、保險總覽、資產總覽
  syncStockBuys();
  syncInsurancePolicies();
  syncOverviewMonthly();
}
// ===== 通用工具：把 Firestore 回傳的欄位格式轉成一般 JS 資料 =====
function fsValueToJs(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return '';
  if (value.mapValue !== undefined) {
    const obj = {};
    const fields = value.mapValue.fields || {};
    Object.keys(fields).forEach(k => obj[k] = fsValueToJs(fields[k]));
    return obj;
  }
  if (value.arrayValue !== undefined) {
    const values = value.arrayValue.values || [];
    return values.map(fsValueToJs);
  }
  return '';
}

// ===== 取得或建立分頁 =====
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clearContents();
  }
  return sheet;
}

// ===== 民國年月日字串（如 "1150226"）轉西元日期字串 =====
function rocDateToAd(rocStr) {
  if (!rocStr || rocStr.length !== 7) return rocStr;
  const rocYear = Number(rocStr.substring(0, 3));
  const month = rocStr.substring(3, 5);
  const day = rocStr.substring(5, 7);
  const adYear = rocYear + 1911;
  return adYear + '-' + month + '-' + day;
}

// ===== 主要同步函式（第一階段：期別總覽）=====
function syncPeriodOverview() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/financeAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const state = doc.fields.state ? fsValueToJs(doc.fields.state) : {};
  const dates = state.dates || [];
  const rates = state.rates || [];
  const colNotes = state.colNotes || [];

  const rows = dates.map((rocDate, idx) => {
    return [
      idx + 1,                    // 期序（第幾期，方便之後其他表格對照）
      rocDate,                    // 原始民國格式
      rocDateToAd(rocDate),       // 西元日期
      rates[idx] !== undefined ? rates[idx] : '',
      colNotes[idx] !== undefined ? colNotes[idx] : ''
    ];
  });

  const sheet = getOrCreateSheet(ss, '期別總覽');
  sheet.appendRow(['期序', '民國日期', '西元日期', '美金匯率', '備註']);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }

  Logger.log('同步完成：期別總覽 ' + rows.length + ' 期');
}

// ===== 取得存取權杖 =====
function getAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const rawKey = props.getProperty('FIREBASE_PRIVATE_KEY');
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const service = OAuth2.createService('Firestore')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setPrivateKey(privateKey)
    .setIssuer(props.getProperty('FIREBASE_CLIENT_EMAIL'))
    .setPropertyStore(props)
    .setScope('https://www.googleapis.com/auth/datastore');

  service.reset();

  if (!service.hasAccess()) {
    Logger.log('詳細錯誤：' + service.getLastError());
  }
  return service.getAccessToken();
}
// ===== 主要同步函式（第二階段：銀行資產明細）=====
function syncBankAssets() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/financeAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const state = doc.fields.state ? fsValueToJs(doc.fields.state) : {};
  const dates = state.dates || [];
  const bankItems = state.bankItems || [];
  const values = state.values || {};

  const rows = [];

  bankItems.forEach(bank => {
    const twdArr = values[bank.id] || [];
    const usdArr = values[bank.id + '_usd']; // 有些外幣帳戶會有原幣金額的獨立陣列

    dates.forEach((rocDate, idx) => {
      const twdAmount = twdArr[idx] !== undefined ? twdArr[idx] : '';
      const usdAmount = usdArr ? (usdArr[idx] !== undefined ? usdArr[idx] : '') : '';
      rows.push([
        idx + 1,
        rocDateToAd(rocDate),
        bank.name || '',
        bank.isForeign ? '是' : '',
        twdAmount,
        usdAmount
      ]);
    });
  });

  const sheet = getOrCreateSheet(ss, '銀行資產明細');
  sheet.appendRow(['期序', '西元日期', '銀行/帳戶', '外幣帳戶', '台幣餘額', '原幣餘額(若有)']);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }

  Logger.log('同步完成：銀行資產明細 ' + rows.length + ' 筆');
}
// ===== 主要同步函式（第三階段：保險資產明細）=====
function syncInsuranceAssets() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/financeAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const state = doc.fields.state ? fsValueToJs(doc.fields.state) : {};
  const dates = state.dates || [];
  const insuranceItems = state.insuranceItems || [];
  const values = state.values || {};

  const rows = [];

  insuranceItems.forEach(ins => {
    const twdArr = values[ins.id] || [];
    const usdArr = values[ins.id + '_usd']; // 美金計價保單（如 i1）會有這個

    dates.forEach((rocDate, idx) => {
      const twdAmount = twdArr[idx] !== undefined ? twdArr[idx] : '';
      const usdAmount = usdArr ? (usdArr[idx] !== undefined ? usdArr[idx] : '') : '';
      rows.push([
        idx + 1,
        rocDateToAd(rocDate),
        ins.name || '',
        ins.isUSD ? '是' : '',
        twdAmount,
        usdAmount
      ]);
    });
  });

  const sheet = getOrCreateSheet(ss, '保險資產明細');
  sheet.appendRow(['期序', '西元日期', '保單名稱', '美金計價', '台幣現值', '美金原值(若有)']);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }

  Logger.log('同步完成：保險資產明細 ' + rows.length + ' 筆');
}
// ===== 主要同步函式（第四階段：股票資產明細）=====
function syncStockOverview() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/financeAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const state = doc.fields.state ? fsValueToJs(doc.fields.state) : {};
  const dates = state.dates || [];
  const stockItems = state.stockItems || [];
  const values = state.values || {};

  const rows = [];

  stockItems.forEach(stock => {
    const isUSD = !!stock.isUSD;
    const valueKey = isUSD ? (stock.id + '_usdval') : stock.id;
    const costKey = isUSD ? (stock.id + '_usdcost') : (stock.id + '_cost');
    const profitKey = stock.id + '_profit';

    const valueArr = values[valueKey] || [];
    const costArr = values[costKey] || [];
    const profitArr = values[profitKey] || [];

    dates.forEach((rocDate, idx) => {
      rows.push([
        idx + 1,
        rocDateToAd(rocDate),
        stock.name || '',
        isUSD ? '美金' : '台幣',
        valueArr[idx] !== undefined ? valueArr[idx] : '',
        costArr[idx] !== undefined ? costArr[idx] : '',
        profitArr[idx] !== undefined ? profitArr[idx] : ''
      ]);
    });
  });

  const sheet = getOrCreateSheet(ss, '股票資產明細');
  sheet.appendRow(['期序', '西元日期', '股票名稱', '計價幣別', '市值', '成本', '損益']);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  Logger.log('同步完成：股票資產明細 ' + rows.length + ' 筆');
}
// ===== 主要同步函式（第五階段：呆帳明細）=====
function syncBadDebtItems() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/financeAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const state = doc.fields.state ? fsValueToJs(doc.fields.state) : {};
  const dates = state.dates || [];
  const badDebtItems = state.badDebtItems || [];
  const values = state.values || {};

  const rows = [];

  badDebtItems.forEach(item => {
    const arr = values[item.id] || [];
    dates.forEach((rocDate, idx) => {
      rows.push([
        idx + 1,
        rocDateToAd(rocDate),
        item.name || '',
        arr[idx] !== undefined ? arr[idx] : ''
      ]);
    });
  });

  const sheet = getOrCreateSheet(ss, '呆帳明細');
  sheet.appendRow(['期序', '西元日期', '項目', '金額']);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }

  Logger.log('同步完成：呆帳明細 ' + rows.length + ' 筆');
}
// ===== 股票管理 - 階段1：持股總表 =====
function syncStockHoldings() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const stocks = doc.fields.stocks ? fsValueToJs(doc.fields.stocks) : [];

  // ---- 持股總表 ----
  const holdingRows = stocks.map(s => [
    s.id || '',
    s.code || '',
    s.name || '',
    s.category || '',
    s.account || '',
    s.shares || 0,
    s.stockShares || 0,
    s.lentShares || 0,
    s.totalCost || 0,
    s.currentPrice || 0,
    s.marketVal || 0,
    s.cashDividends || 0
  ]);

  const holdingSheet = getOrCreateSheet(ss, '持股總表');
  holdingSheet.appendRow(['ID', '代號', '名稱', '類別', '券商帳戶', '股數', '未實現股票股利股數', '出借股數', '總成本', '現價', '市值', '累計現金股利']);
  if (holdingRows.length > 0) {
    holdingSheet.getRange(2, 1, holdingRows.length, 12).setValues(holdingRows);
  }

  // ---- 歷年股利明細（展開巢狀 dividendHistory）----
  const divRows = [];
  stocks.forEach(s => {
    const history = s.dividendHistory || [];
    history.forEach(h => {
      divRows.push([
        s.code || '',
        s.name || '',
        h.year || '',
        h.cash || 0,
        h.cashDate || '',
        h.stockShares || 0,
        h.stockDate || ''
      ]);
    });
  });

  const divSheet = getOrCreateSheet(ss, '持股_歷年股利明細');
  divSheet.appendRow(['代號', '名稱', '年度', '現金股利', '發放日', '股票股利股數', '股票股利發放日']);
  if (divRows.length > 0) {
    divSheet.getRange(2, 1, divRows.length, 7).setValues(divRows);
  }

  Logger.log('同步完成：持股總表 ' + holdingRows.length + ' 檔，歷年股利明細 ' + divRows.length + ' 筆');
}
// ===== 股票管理 - 階段2：買賣明細 =====
function syncStockSales() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const sales = doc.fields.stockSales ? fsValueToJs(doc.fields.stockSales) : [];

  // 固定欄位順序（英文欄位名 → 中文標題）
  const columnMap = [
    ['date', '日期'],
    ['name', '股票名稱'],
    ['status', '狀態'],
    ['shares', '股數'],
    ['buyPrice', '買進價'],
    ['buyFee', '買進手續費'],
    ['cost', '成本'],
    ['sellPrice', '賣出價'],
    ['sellFee', '賣出手續費'],
    ['tax', '證交稅'],
    ['sellAmt', '賣出金額'],
    ['spread', '價差'],
    ['returnRate', '報酬率'],
    ['dayTotal', '當日損益總計'],
    ['note', '備註'],
    ['note2', '備註2'],
    ['todo', '待修改']            // 2026-10 新增：對帳單匯入時標的「⚠️ 待修改」原因
  ];

  const sheet = getOrCreateSheet(ss, '股票買賣明細');
  sheet.appendRow(columnMap.map(c => c[1]));

  const rows = sales.map(s => columnMap.map(c => (s[c[0]] !== undefined ? s[c[0]] : '')));

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    sheet.getRange(2 + i, 1, batch.length, columnMap.length).setValues(batch);
  }

  Logger.log('同步完成：股票買賣明細 ' + rows.length + ' 筆');
}
// ===== 股票管理 - 階段3：股票借出 + 借券收入 =====
function syncStockLending() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  // ---- 股票出借中 ----
  const lending = doc.fields.stockLending ? fsValueToJs(doc.fields.stockLending) : [];
  const lendingRows = lending.map(l => [l.id || '', l.name || '', l.lentShares || 0, l.cost || 0]);

  const lendingSheet = getOrCreateSheet(ss, '股票出借中');
  lendingSheet.appendRow(['ID', '股票名稱', '出借股數', '成本']);
  if (lendingRows.length > 0) {
    lendingSheet.getRange(2, 1, lendingRows.length, 4).setValues(lendingRows);
  }

  // ---- 借券收入明細 ----
  const incomeRows_raw = doc.fields.lendingIncomeRows ? fsValueToJs(doc.fields.lendingIncomeRows) : [];
  const columnMap = [
    ['name', '股票名稱'],
    ['lendDate', '出借日'],
    ['returnDate', '還券日'],
    ['paymentDate', '撥款日'],
    ['lentShares', '出借張數'],
    ['feeRate', '費率'],
    ['income', '收入'],
    ['serviceFee', '服務費'],
    ['contractNo', '合約編號'],   // 2026-10 新增：對帳單匯入的借券合約
    ['stmtMonth', '對帳單月份'],
    ['todo', '待修改']
  ];

  const incomeSheet = getOrCreateSheet(ss, '借券收入明細');
  incomeSheet.appendRow(columnMap.map(c => c[1]));

  const incomeRows = incomeRows_raw.map(r => columnMap.map(c => (r[c[0]] !== undefined ? r[c[0]] : '')));
  const BATCH_SIZE = 500;
  for (let i = 0; i < incomeRows.length; i += BATCH_SIZE) {
    const batch = incomeRows.slice(i, i + BATCH_SIZE);
    incomeSheet.getRange(2 + i, 1, batch.length, columnMap.length).setValues(batch);
  }

  // ---- 借券收入_歷史年度（110~114手動填入）----
  const manualYearly = doc.fields.lendingIncomeManualYearly ? fsValueToJs(doc.fields.lendingIncomeManualYearly) : {};
  const yearlyRows = Object.keys(manualYearly).map(year => [year, manualYearly[year]]);

  const yearlySheet = getOrCreateSheet(ss, '借券收入_歷史年度');
  yearlySheet.appendRow(['年度', '手動填入總額']);
  if (yearlyRows.length > 0) {
    yearlySheet.getRange(2, 1, yearlyRows.length, 2).setValues(yearlyRows);
  }

  Logger.log('同步完成：出借中 ' + lendingRows.length + ' 檔，借券收入明細 ' + incomeRows.length + ' 筆，歷史年度 ' + yearlyRows.length + ' 筆');
}
// ===== 股票管理 - 階段4：歷史股利 + 除權息資訊 + 預估股利 =====
function syncDividendInfo() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  // ---- 歷史股利發放：pastColumns（按年分組，展開成一列一筆）----
  const pastColumns = doc.fields.pastColumns ? fsValueToJs(doc.fields.pastColumns) : [];
  const pastRows = [];
  pastColumns.forEach(col => {
    const year = col.year || '';
    const items = col.items || [];
    items.forEach(item => {
      pastRows.push([year, item.stock || '', item.amount || 0, item.cashDate || '']);
    });
  });

  const pastSheet = getOrCreateSheet(ss, '歷史股利發放');
  pastSheet.appendRow(['年度', '股票/項目', '金額', '發放日']);
  if (pastRows.length > 0) {
    pastSheet.getRange(2, 1, pastRows.length, 4).setValues(pastRows);
  }

  // ---- 除權息資訊：exRightsInfo（Map，key是股票代號）----
  const exRightsInfo = doc.fields.exRightsInfo ? fsValueToJs(doc.fields.exRightsInfo) : {};
  const exRightsRows = Object.keys(exRightsInfo).map(code => {
    const info = exRightsInfo[code];
    return [
      code,
      info.exDate || '',
      info.exType || '',
      info.cashDividend !== undefined ? info.cashDividend : '',
      info.stockDividend !== undefined ? info.stockDividend : '',
      info.source || '',
      info.fetchedAt || ''
    ];
  });

  const exRightsSheet = getOrCreateSheet(ss, '除權息資訊');
  exRightsSheet.appendRow(['股票代號', '除權息日', '類型', '現金股利', '股票股利', '資料來源', '更新時間']);
  if (exRightsRows.length > 0) {
    exRightsSheet.getRange(2, 1, exRightsRows.length, 7).setValues(exRightsRows);
  }

  // ---- 預估股利：dividendEstimates（Map，key是股票代號）----
  const dividendEstimates = doc.fields.dividendEstimates ? fsValueToJs(doc.fields.dividendEstimates) : {};
  const estimateRows = Object.keys(dividendEstimates).map(code => {
    const est = dividendEstimates[code];
    return [code, est.expCash || 0, est.expStock || 0];
  });

  const estimateSheet = getOrCreateSheet(ss, '預估股利');
  estimateSheet.appendRow(['股票代號', '預估現金股利', '預估股票股利']);
  if (estimateRows.length > 0) {
    estimateSheet.getRange(2, 1, estimateRows.length, 3).setValues(estimateRows);
  }

  Logger.log('同步完成：歷史股利 ' + pastRows.length + ' 筆，除權息資訊 ' + exRightsRows.length + ' 檔，預估股利 ' + estimateRows.length + ' 檔');
}
// ===== 股票管理 - 階段5：定期定額設定 =====
function syncDcaRows() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const dcaRows_raw = doc.fields.dcaRows ? fsValueToJs(doc.fields.dcaRows) : [];

  const rows = dcaRows_raw.map(d => {
    const dates = (d.dates || []).join('、');
    return [d.id || '', d.name || '', d.amount || 0, dates];
  });

  const sheet = getOrCreateSheet(ss, '定期定額設定');
  sheet.appendRow(['ID', '股票名稱', '每次扣款金額', '扣款日(每月)']);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }

  Logger.log('同步完成：定期定額設定 ' + rows.length + ' 筆');
}
// ===== 股票管理 - 階段6：逐年損益總表 =====
function syncSalesHistory() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const salesHistory = doc.fields.salesHistory ? fsValueToJs(doc.fields.salesHistory) : [];

  const rows = salesHistory.map(s => [
    s.year || '',
    s.totalCost || 0,
    s.totalSell || 0,
    s.spread || 0,
    s.returnRate || 0,
    s.isManual ? '是' : '否'
  ]);

  const sheet = getOrCreateSheet(ss, '逐年損益總表');
  sheet.appendRow(['年度', '總成本', '總賣出金額', '價差', '報酬率', '手動輸入']);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }

  Logger.log('同步完成：逐年損益總表 ' + rows.length + ' 年');
}
// ===== 股票管理 - 階段7：媽的永豐(00878)專區 =====
function syncYfAccount() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  // ---- 總覽卡片 ----
  const overview = doc.fields.yfOverview ? fsValueToJs(doc.fields.yfOverview) : {};
  const overviewSheet = getOrCreateSheet(ss, '永豐00878_總覽');
  overviewSheet.appendRow(['項目', '數值']);
  const overviewFields = [
    ['stockName', '股票名稱'], ['shares', '股數'], ['cost', '實際扣款成本'],
    ['appCost', 'App顯示成本'], ['price', '現值'], ['totalDividend', '總股利'],
    ['totalDiv', '總股利(小數)'], ['currentValue', '目前市值'], ['goal', '目標金額']
  ];
  const overviewRows = overviewFields.map(f => [f[1], overview[f[0]] !== undefined ? overview[f[0]] : '']);
  overviewSheet.getRange(2, 1, overviewRows.length, 2).setValues(overviewRows);

  // ---- 股利明細 ----
  const divRows_raw = doc.fields.yfDividendRows ? fsValueToJs(doc.fields.yfDividendRows) : [];
  const divSheet = getOrCreateSheet(ss, '永豐00878_股利明細');
  divSheet.appendRow(['除息日', '發放日', '每股現金股利', '持有股數', '本次股利', '累計股利']);
  const divRows = divRows_raw.map(d => [
    d.exDate || '', d.payDate || '', d.cashPerShare || 0, d.heldShares || 0, d.divAmount || 0, d.cumulative || 0
  ]);
  if (divRows.length > 0) {
    divSheet.getRange(2, 1, divRows.length, 6).setValues(divRows);
  }

  // ---- 資金帳戶進出 ----
  const accountRows_raw = doc.fields.yfAccount ? fsValueToJs(doc.fields.yfAccount) : [];
  const accountSheet = getOrCreateSheet(ss, '永豐00878_資金帳戶');
  accountSheet.appendRow(['日期', '類型', '項目', '金額', '餘額', '備註']);
  const accountRows = accountRows_raw.map(a => [
    a.date || '', a.type || '', a.detail || '', a.amount || 0, a.balance || 0, a.note || ''
  ]);
  if (accountRows.length > 0) {
    accountSheet.getRange(2, 1, accountRows.length, 6).setValues(accountRows);
  }

  // ---- 買進明細 ----
  const detailRows_raw = doc.fields.yfDetail ? fsValueToJs(doc.fields.yfDetail) : [];
  const detailSheet = getOrCreateSheet(ss, '永豐00878_買進明細');
  detailSheet.appendRow(['日期', '股數', '買進價', '成本']);
  const detailRows = detailRows_raw.map(d => [d.date || '', d.shares || 0, d.price || 0, d.cost || 0]);
  if (detailRows.length > 0) {
    detailSheet.getRange(2, 1, detailRows.length, 4).setValues(detailRows);
  }

  Logger.log('同步完成：永豐總覽 + 股利明細 ' + divRows.length + ' 筆 + 資金帳戶 ' + accountRows.length + ' 筆 + 買進明細 ' + detailRows.length + ' 筆');
}
// ===== 股票管理 - 階段8：持股快照歷史 =====
function syncSnapshots() {
  const token = getAccessToken();
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const uid = PropertiesService.getScriptProperties().getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stockAssets/${uid}`;

  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const doc = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const snapshots = doc.fields.snapshots ? fsValueToJs(doc.fields.snapshots) : [];

  const rows = [];
  snapshots.forEach(snap => {
    const date = snap.date || '';
    const items = snap.items || [];
    items.forEach(item => {
      rows.push([
        date,
        item.code || '',
        item.name || '',
        item.account || '',
        item.shares || 0,
        item.currentPrice || 0,
        item.totalCost || 0,
        item.marketVal || 0,
        item.profit || 0
      ]);
    });
  });

  const sheet = getOrCreateSheet(ss, '持股快照歷史');
  sheet.appendRow(['快照日期', '代號', '名稱', '券商帳戶', '股數', '當時現價', '總成本', '市值', '損益']);

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    sheet.getRange(2 + i, 1, batch.length, 9).setValues(batch);
  }

  Logger.log('同步完成：持股快照歷史 ' + rows.length + ' 筆（共 ' + snapshots.length + ' 次快照）');
}

// ===================================================================
// 2026-10 新增
// ===================================================================

// ===== 通用工具：讀一份 Firestore 文件（文件不存在時回傳 null，不會讓整支程式停掉）=====
function fetchFirestoreDoc(collection) {
  const token = getAccessToken();
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('FIREBASE_PROJECT_ID');
  const uid = props.getProperty('MONEYBOOK_UID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${uid}`;
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 404) {
    Logger.log(collection + '：雲端還沒有這份資料，略過');
    return null;
  }
  if (code !== 200) throw new Error(collection + ' 讀取失敗（' + code + '）：' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}

// ===== 通用工具：寫一張表（標題＋資料，500 列一批）=====
function writeTable(ss, sheetName, headers, rows) {
  const sheet = getOrCreateSheet(ss, sheetName);
  sheet.appendRow(headers);
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    sheet.getRange(2 + i, 1, batch.length, headers.length).setValues(batch);
  }
}

function v(x) { return x !== undefined && x !== null ? x : ''; }

// ===== 股票管理 - 階段9：股票買進明細 + 持股剩餘批次（先買先賣用）=====
function syncStockBuys() {
  const doc = fetchFirestoreDoc('stockAssets');
  if (!doc) return;
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  // ---- 股票買進明細 ----
  const buys = doc.fields.stockBuys ? fsValueToJs(doc.fields.stockBuys) : [];
  const buyRows = buys.map(b => [
    v(b.id), v(b.date), v(b.account), v(b.name), v(b.code),
    v(b.shares), v(b.price), v(b.amount), v(b.fee), v(b.cost),
    v(b.type), v(b.note),
    b.source && b.source !== 'manual' ? '對帳單' : '手動',
    v(b.todo)
  ]);
  writeTable(ss, '股票買進明細',
    ['ID', '日期', '證券帳戶', '股票名稱', '代號', '股數', '買進價', '金額', '手續費', '成本', '類型', '備註', '來源', '待修改'],
    buyRows);

  // ---- 持股剩餘批次（每檔持股的 lots 展開）----
  const KIND = { base: '期初', buy: '買進', stockDiv: '配股' };
  const stocks = doc.fields.stocks ? fsValueToJs(doc.fields.stocks) : [];
  const lotRows = [];
  stocks.forEach(s => {
    (s.lots || []).forEach(l => {
      lotRows.push([
        v(s.code), v(s.name), v(s.account),
        v(l.date), KIND[l.kind] || v(l.kind),
        v(l.origShares), v(l.origCost), v(l.shares), v(l.cost)
      ]);
    });
  });
  writeTable(ss, '持股_剩餘批次',
    ['代號', '名稱', '券商帳戶', '批次日期', '類型', '原始股數', '原始成本', '剩餘股數', '剩餘成本'],
    lotRows);

  Logger.log('同步完成：股票買進明細 ' + buyRows.length + ' 筆，剩餘批次 ' + lotRows.length + ' 批');
}

// ===== 保險總覽：每張保單 + 附約 =====
function syncInsurancePolicies() {
  const doc = fetchFirestoreDoc('insuranceAssets');
  if (!doc) return;
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const policies = doc.fields.policies ? fsValueToJs(doc.fields.policies) : [];

  // ---- 保單 ----
  const policyRows = policies.map(p => {
    const riders = p.riders || [];
    const riderTotal = riders.reduce((sum, r) => sum + (Number(r.coverage) || 0), 0);
    return [
      v(p.id), v(p.name), v(p.insurer), v(p.type), v(p.policyNumber),
      v(p.insuredPerson), v(p.policyHolder), v(p.beneficiary),
      v(p.effectiveDate), v(p.paymentPeriod),
      v(p.premium), v(p.paymentFrequency), v(p.paymentMethod), v(p.paymentDate),
      v(p.mainCoverage), riders.length, riderTotal, (Number(p.mainCoverage) || 0) + riderTotal,
      v(p.status), v(p.currentValue), v(p.note),
      p.archived ? '是' : ''
    ];
  });
  writeTable(ss, '保險總覽_保單',
    ['ID', '保單名稱', '保險公司', '險種', '保單號碼', '被保險人', '要保人', '受益人',
     '生效日', '繳費年期', '保費', '繳費頻率', '繳費方式', '扣款日期',
     '主約保額', '附約數', '附約保額合計', '總保額', '狀態', '目前現值', '備註', '已封存'],
    policyRows);

  // ---- 附約（一個附約一列）----
  const riderRows = [];
  policies.forEach(p => {
    (p.riders || []).forEach(r => {
      riderRows.push([v(p.id), v(p.name), v(p.insuredPerson), v(r.name), v(r.coverage), p.archived ? '是' : '']);
    });
  });
  writeTable(ss, '保險總覽_附約',
    ['保單ID', '保單名稱', '被保險人', '附約名稱', '附約保額', '保單已封存'],
    riderRows);

  Logger.log('同步完成：保險總覽 ' + policyRows.length + ' 張保單，附約 ' + riderRows.length + ' 筆');
}

// ===== 資產總覽：每月紀錄 + 每月持股 =====
function syncOverviewMonthly() {
  const doc = fetchFirestoreDoc('overviewMonthly');
  if (!doc) return;
  const ss = SpreadsheetApp.openById(FINANCE_SHEET_ID);

  const months = doc.fields.months ? fsValueToJs(doc.fields.months) : {};
  const keys = Object.keys(months).sort(); // '2026-09'、'2026-10'…由舊到新

  // ---- 每月總數 ----
  const monthRows = keys.map(k => {
    const m = months[k] || {};
    return [
      k, v(m.usdRate),
      v(m.cashTwd), v(m.cashUsd), v(m.cashUsdTwd),
      v(m.stockValue), v(m.stockCost),
      v(m.insurance), v(m.badDebt), v(m.total),
      m.finalized ? '是' : '否', v(m.savedAt)
    ];
  });
  writeTable(ss, '資產總覽_每月',
    ['月份', '美元匯率', '現金台幣', '現金美元', '現金美元(折台幣)', '股票現值', '股票成本',
     '保險', '呆帳', '總資產', '已用月底價定案', '最後記錄時間'],
    monthRows);

  // ---- 每月持股（記錄當時的股數和現值）----
  const holdRows = [];
  keys.forEach(k => {
    const m = months[k] || {};
    (m.holdings || []).forEach(h => {
      holdRows.push([k, v(h.c), h.us ? '美股' : '台股', v(h.s), v(h.v)]);
    });
    if (m.yf && (m.yf.s || m.yf.v)) holdRows.push([k, '00878（媽的永豐）', '台股', v(m.yf.s), v(m.yf.v)]);
  });
  writeTable(ss, '資產總覽_每月持股',
    ['月份', '代號', '市場', '股數', '現值(台幣)'],
    holdRows);

  Logger.log('同步完成：資產總覽 ' + monthRows.length + ' 個月，持股 ' + holdRows.length + ' 筆');
}