/* ========================================================================
   股票管理 — 匯入備份 (Excel)
   讀取「📊 匯出全部資料 (Excel)」所產生的 .xlsx 備份檔，依工作表名稱自動
   辨識屬於股票管理的哪個分頁，並將該分頁的欄位資料寫回對應的資料陣列。
   採「依欄位標題自動比對欄位」的方式解析，欄位順序被使用者調整過也不影響。
   ------------------------------------------------------------------------
   涵蓋範圍：股票管理的所有分頁（全部持股、股票賣出明細表、股票賣出歷年紀錄、
   股利-非持股歷史、股利-年度預估、股票借出-出借持股列表、股票借出-借卷收入、
   定期定額、媽的永豐、各股紀錄）。
   「股利-歷年總合」為彙總檢視表（數字皆由其他分頁加總而成），沒有可回寫的
   原始欄位，因此不提供匯入；其資料已完整涵蓋在「股利-非持股歷史」與各股票
   的「現金股利」欄位中。
   ======================================================================== */

const XLSX_IMPORT_SHEETS = [
  { key: 'holdings', sheetNames: ['全部持股'], label: '📈 全部持股' },
  { key: 'salesList', sheetNames: ['股票賣出明細表'], label: '💰 股票賣出明細表' },
  { key: 'salesHistory', sheetNames: ['股票賣出歷年紀錄'], label: '📅 股票賣出歷年紀錄' },
  { key: 'dividendPast', sheetNames: ['股利-非持股歷史'], label: '🎁 股利-非持股歷史' },
  { key: 'dividendEstimate', sheetNames: ['股利-年度預估'], label: '🔮 股利-年度預估' },
  { key: 'lendingHoldings', sheetNames: ['股票借出-出借持股列表'], label: '📦 股票借出-出借持股列表' },
  { key: 'lendingIncome', sheetNames: ['股票借出-借卷收入'], label: '💵 股票借出-借卷收入' },
  { key: 'dca', sheetNames: ['定期定額'], label: '📆 定期定額' },
  { key: 'yf', sheetNames: ['媽的永豐'], label: '🏦 媽的永豐' },
  { key: 'snapshots', sheetNames: ['各股紀錄'], label: '🗂️ 各股紀錄' }
];

let pendingImportWorkbook = null;
let pendingImportSelections = {};

function triggerExcelImport() {
  const input = document.getElementById('excelImportFileInput');
  if (input) input.click();
}

async function handleExcelImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (typeof ExcelJS === 'undefined') {
    alert('Excel 套件尚未載入完成，請稍後再試一次。');
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    pendingImportWorkbook = wb;
    openExcelImportModal(wb);
  } catch (e) {
    console.error('讀取 Excel 檔案失敗', e);
    alert('讀取 Excel 檔案失敗，請確認這是有效的 .xlsx 檔案。');
  }
}

function openExcelImportModal(wb) {
  const foundSheetNames = wb.worksheets.map(ws => ws.name);
  const list = document.getElementById('excelImportList');
  if (!list) return;
  pendingImportSelections = {};

  const rowsHtml = XLSX_IMPORT_SHEETS.map(def => {
    const foundName = def.sheetNames.find(n => foundSheetNames.includes(n));
    const disabled = !foundName;
    pendingImportSelections[def.key] = !!foundName;
    return `
      <label class="excel-import-row${disabled ? ' disabled' : ''}">
        <input type="checkbox" ${foundName ? 'checked' : ''} ${disabled ? 'disabled' : ''}
          onchange="pendingImportSelections['${def.key}']=this.checked" />
        <span>${def.label}</span>
        <span class="excel-import-status">${foundName ? '✅ 檔案中已找到' : '－未包含此分頁－'}</span>
      </label>
    `;
  }).join('');

  const knownNames = XLSX_IMPORT_SHEETS.flatMap(def => def.sheetNames);
  const unknown = foundSheetNames.filter(n => n !== '財務總覽' && !knownNames.includes(n));
  const unknownHtml = unknown.length
    ? `<div class="excel-import-note">⚠️ 無法辨識、將略過的分頁：${unknown.join('、')}</div>`
    : '';

  list.innerHTML = rowsHtml + unknownHtml;
  const modal = document.getElementById('excelImportModal');
  if (modal) modal.classList.add('open');
}

function closeExcelImportModal() {
  const modal = document.getElementById('excelImportModal');
  if (modal) modal.classList.remove('open');
  pendingImportWorkbook = null;
}

function confirmExcelImport() {
  const wb = pendingImportWorkbook;
  if (!wb) return;
  recordSnapshot();

  const importedLabels = [];
  const failedLabels = [];

  XLSX_IMPORT_SHEETS.forEach(def => {
    if (!pendingImportSelections[def.key]) return;
    const foundName = def.sheetNames.find(n => wb.worksheets.some(ws => ws.name === n));
    if (!foundName) return;
    const ws = wb.getWorksheet(foundName);
    try {
      XLSX_IMPORT_HANDLERS[def.key](ws);
      importedLabels.push(def.label);
    } catch (e) {
      console.error('匯入「' + def.label + '」時發生錯誤', e);
      failedLabels.push(def.label);
    }
  });

  saveToStorage();
  if (typeof renderTabs === 'function') renderTabs();
  if (typeof renderTable === 'function') renderTable();
  closeExcelImportModal();

  let msg = '';
  if (importedLabels.length) msg += '✅ 匯入完成：\n' + importedLabels.join('\n');
  if (failedLabels.length) msg += (msg ? '\n\n' : '') + '❌ 匯入失敗（格式可能不符）：\n' + failedLabels.join('\n');
  if (!msg) msg = '沒有選擇任何可匯入的分頁。';
  alert(msg);
}

/* ------------------------------------------------------------------------
   共用小工具
   ------------------------------------------------------------------------ */
function xlRowsOf(ws) {
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      vals[colNumber - 1] = xlCellText(cell);
    });
    rows.push(vals);
  });
  return rows;
}
function xlCellText(cell) {
  let v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (typeof v.text === 'string') return v.text;
    if (v.result !== undefined) return v.result;
    if (v instanceof Date) {
      const y = v.getFullYear(), m = v.getMonth() + 1, d = v.getDate();
      return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    }
  }
  return v;
}
function xlNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function xlStr(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}
function xlHeaderIndex(headerRow, labelsToField) {
  const idx = {};
  (headerRow || []).forEach((h, i) => {
    const key = xlStr(h);
    if (labelsToField[key] !== undefined) idx[labelsToField[key]] = i;
  });
  return idx;
}
function xlIsBlankRow(row) {
  return !row || row.every(v => v === '' || v === undefined || v === null);
}

/* ------------------------------------------------------------------------
   各分頁匯入邏輯
   ------------------------------------------------------------------------ */

/* 全部持股 → stocks[]（依代號或名稱+帳戶比對既有資料進行更新，找不到則新增，
   不會動到既有的「分類」與「歷年股利明細」） */
function importHoldingsSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const idx = xlHeaderIndex(rows[0], {
    '帳戶': 'account', '股票名稱': 'name', '代號': 'code', '現價': 'currentPrice',
    '市值': 'marketVal', '成本': 'totalCost', '持有股數': 'shares',
    '現金股利': 'cashDividends', '股票股利': 'stockDivVal', '出借張數': 'lentShares'
  });

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (xlIsBlankRow(row)) continue;
    const name = idx.name !== undefined ? xlStr(row[idx.name]) : '';
    if (!name) continue;

    const account = idx.account !== undefined ? xlStr(row[idx.account]) : '';
    const code = idx.code !== undefined ? xlStr(row[idx.code]) : '';
    const isUS = account === '美股複委託';
    const fx = isUS ? 29 : 1;

    const shares = idx.shares !== undefined ? xlNum(row[idx.shares]) : 0;
    const totalCost = idx.totalCost !== undefined ? xlNum(row[idx.totalCost]) / fx : 0;
    const marketVal = idx.marketVal !== undefined ? xlNum(row[idx.marketVal]) / fx : 0;
    const cashDividends = idx.cashDividends !== undefined ? xlNum(row[idx.cashDividends]) / fx : 0;
    const currentPrice = shares > 0 ? (marketVal / shares) : 0;
    const lentShares = idx.lentShares !== undefined ? xlNum(row[idx.lentShares]) : 0;

    let stockShares = 0;
    if (idx.stockDivVal !== undefined && currentPrice > 0) {
      stockShares = Math.round((xlNum(row[idx.stockDivVal]) / fx) / currentPrice);
    }

    let existing = null;
    if (code) existing = stocks.find(s => xlStr(s.code) === code && (s.account || '') === account);
    if (!existing) existing = stocks.find(s => s.name === name && (s.account || '') === account);
    if (!existing) existing = stocks.find(s => s.name === name);

    if (existing) {
      existing.account = account || existing.account;
      existing.name = name;
      if (code) existing.code = code;
      existing.shares = shares;
      existing.totalCost = totalCost;
      existing.marketVal = marketVal;
      existing.currentPrice = currentPrice;
      existing.cashDividends = cashDividends;
      existing.stockShares = stockShares;
      existing.lentShares = lentShares;
    } else {
      const category = isUS ? '美股' : (code && code.startsWith('00') ? 'ETF' : '台股');
      stocks.push({
        id: Date.now() + Math.floor(Math.random() * 1000) + r,
        name, code, category, account, shares, totalCost, currentPrice, marketVal,
        cashDividends, stockShares, dividendHistory: [], lentShares
      });
    }
  }
}

/* 股票賣出明細表 → stockSales[]（整批取代） */
function importSalesListSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const idx = xlHeaderIndex(rows[0], {
    '日期': 'date', '名稱': 'name', '股數': 'shares', '買進價格': 'buyPrice', '賣出價格': 'sellPrice',
    '成本': 'cost', '賣出': 'sellAmt', '價差': 'spread', '報酬率': 'returnRate',
    '買進手續費': 'buyFee', '賣出手續費': 'sellFee', '交易稅': 'tax', '狀態': 'status'
  });

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (xlIsBlankRow(row)) continue;
    const name = idx.name !== undefined ? xlStr(row[idx.name]) : '';
    const dateVal = idx.date !== undefined ? xlStr(row[idx.date]) : '';
    if (dateVal === '小計' || name === '小計') continue;
    if (!name && !dateVal) continue;
    out.push({
      date: dateVal, name,
      shares: idx.shares !== undefined ? xlNum(row[idx.shares]) : 0,
      buyPrice: idx.buyPrice !== undefined ? xlNum(row[idx.buyPrice]) : 0,
      sellPrice: idx.sellPrice !== undefined ? xlNum(row[idx.sellPrice]) : 0,
      cost: idx.cost !== undefined ? xlNum(row[idx.cost]) : 0,
      sellAmt: idx.sellAmt !== undefined ? xlNum(row[idx.sellAmt]) : 0,
      spread: idx.spread !== undefined ? xlNum(row[idx.spread]) : 0,
      returnRate: idx.returnRate !== undefined ? xlNum(row[idx.returnRate]) : 0,
      buyFee: idx.buyFee !== undefined ? xlNum(row[idx.buyFee]) : 0,
      sellFee: idx.sellFee !== undefined ? xlNum(row[idx.sellFee]) : 0,
      tax: idx.tax !== undefined ? xlNum(row[idx.tax]) : 0,
      status: idx.status !== undefined ? xlStr(row[idx.status]) : '',
      dayTotal: null, note: '', note2: ''
    });
  }
  if (out.length) stockSales = out;
}

/* 股票賣出歷年紀錄 → salesHistory[]（依年度比對更新，找不到則新增） */
function importSalesHistorySheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const idx = xlHeaderIndex(rows[0], {
    '年度': 'year', '總成本': 'totalCost', '總賣出': 'totalSell', '價差': 'spread',
    '報酬率': 'returnRate', '狀態': 'status'
  });

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (xlIsBlankRow(row)) continue;
    const year = idx.year !== undefined ? xlStr(row[idx.year]) : '';
    if (!year) continue;
    const status = idx.status !== undefined ? xlStr(row[idx.status]) : '';
    const entry = {
      year,
      totalCost: idx.totalCost !== undefined ? xlNum(row[idx.totalCost]) : 0,
      totalSell: idx.totalSell !== undefined ? xlNum(row[idx.totalSell]) : 0,
      spread: idx.spread !== undefined ? xlNum(row[idx.spread]) : 0,
      returnRate: idx.returnRate !== undefined ? xlNum(row[idx.returnRate]) : 0
    };
    if (status.includes('手動')) entry.isManual = true;

    const exIdx = salesHistory.findIndex(h => xlStr(h.year) === year);
    if (exIdx >= 0) salesHistory[exIdx] = Object.assign({}, salesHistory[exIdx], entry);
    else salesHistory.push(entry);
  }
}

/* 股利-非持股歷史 → pastColumns[]（依「年度」欄位群組重建，格式：年度｜股票｜現金股利 反覆排列） */
function importDividendPastSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 3) return;
  const headRow1 = rows[0];

  const yearBlocks = [];
  for (let c = 1; c < headRow1.length; c++) {
    const label = xlStr(headRow1[c]);
    if (label && label.includes('年度')) {
      yearBlocks.push({ year: label.replace('年度', '').trim(), stockCol: c, cashCol: c + 1 });
    }
  }
  if (!yearBlocks.length) return;

  const newColumns = yearBlocks.map(b => ({ year: b.year, items: [] }));
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const firstCell = xlStr(row[0]);
    if (firstCell === '合計') break;
    yearBlocks.forEach((b, i) => {
      const stock = xlStr(row[b.stockCol]);
      const amountRaw = row[b.cashCol];
      if (!stock && (amountRaw === '' || amountRaw === undefined)) return;
      newColumns[i].items.push({ stock, amount: xlNum(amountRaw), cashDate: '' });
    });
  }
  if (newColumns.some(c => c.items.length)) pastColumns = newColumns;
}

/* 股利-年度預估 → dividendEstimates{}（欄位為各股票，列為「預估除息」「預估除權」） */
function importDividendEstimateSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const header = rows[0];

  const colKeys = [];
  for (let c = 1; c < header.length; c++) {
    const label = xlStr(header[c]);
    if (!label) { colKeys[c] = null; continue; }
    const m = label.match(/^(.*)\(([^)]+)\)$/);
    colKeys[c] = m ? m[2].trim() : label;
  }

  let expCashRow = null, expStockRow = null;
  for (let r = 1; r < rows.length; r++) {
    const label = xlStr(rows[r][0]);
    if (label === '預估除息') expCashRow = rows[r];
    else if (label === '預估除權') expStockRow = rows[r];
  }
  if (!expCashRow && !expStockRow) return;

  colKeys.forEach((key, c) => {
    if (!key) return;
    if (!dividendEstimates[key]) dividendEstimates[key] = { expCash: 0, expStock: 0 };
    if (expCashRow) dividendEstimates[key].expCash = xlNum(expCashRow[c]);
    if (expStockRow) dividendEstimates[key].expStock = xlNum(expStockRow[c]);
  });
}

/* 股票借出-出借持股列表 → stockLending[]（整批取代，並同步出借張數回持股列） */
function importLendingHoldingsSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const idx = xlHeaderIndex(rows[0], { '股票名稱': 'name', '出借張數': 'lentShares', '成本': 'cost' });

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (xlIsBlankRow(row)) continue;
    const name = idx.name !== undefined ? xlStr(row[idx.name]) : '';
    if (!name) continue;
    out.push({
      name,
      lentShares: idx.lentShares !== undefined ? xlNum(row[idx.lentShares]) : 0,
      cost: idx.cost !== undefined ? xlNum(row[idx.cost]) : 0
    });
  }
  if (out.length) {
    stockLending = out;
    if (typeof syncLentSharesToHoldings === 'function') syncLentSharesToHoldings();
  }
}

/* 股票借出-借卷收入 → lendingIncomeRows[] + lendingIncomeManualYearly{}（歷史年度手動加總） */
function importLendingIncomeSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const idx = xlHeaderIndex(rows[0], {
    '出借股票': 'name', '出借日期': 'lendDate', '出借張數': 'lentShares', '出借費率': 'feeRate',
    '還卷日期': 'returnDate', '收入': 'income', '服務費': 'serviceFee', '入款日期': 'paymentDate'
  });

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const label0 = xlStr(row[0]);
    if (!label0) continue;
    if (label0.includes('年度借卷收入總計')) continue;
    if (/^\d+年.*自動加總/.test(label0)) continue;

    const manualMatch = label0.match(/^(\d+)年.*手動記錄/);
    if (manualMatch) {
      const amtCol = idx.income !== undefined ? idx.income : 7;
      lendingIncomeManualYearly[manualMatch[1]] = xlNum(row[amtCol]);
      continue;
    }

    out.push({
      id: Date.now() + r,
      name: label0,
      lendDate: idx.lendDate !== undefined ? xlStr(row[idx.lendDate]) : '',
      lentShares: idx.lentShares !== undefined ? xlNum(row[idx.lentShares]) : 0,
      feeRate: idx.feeRate !== undefined ? xlNum(row[idx.feeRate]) : 0,
      returnDate: idx.returnDate !== undefined ? xlStr(row[idx.returnDate]) : '',
      income: idx.income !== undefined ? xlNum(row[idx.income]) : 0,
      serviceFee: idx.serviceFee !== undefined ? xlNum(row[idx.serviceFee]) : 0,
      paymentDate: idx.paymentDate !== undefined ? xlStr(row[idx.paymentDate]) : ''
    });
  }
  if (out.length) lendingIncomeRows = out;
}

/* 定期定額 → dcaRows[]（「日期(扣款日)」欄位文字如「1日、15日、20日」會被解析回每月扣款日陣列） */
function importDcaSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const idx = xlHeaderIndex(rows[0], {
    '股票名稱': 'name', '日期(扣款日)': 'datesText', '扣款金額': 'amount'
  });

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (xlIsBlankRow(row)) continue;
    const name = idx.name !== undefined ? xlStr(row[idx.name]) : '';
    if (!name || name === '小計') continue;
    const datesText = idx.datesText !== undefined ? xlStr(row[idx.datesText]) : '';
    const dates = (datesText.match(/\d+/g) || [])
      .map(n => parseInt(n, 10))
      .filter(n => n >= 1 && n <= 31);
    out.push({
      id: Date.now() + r,
      name,
      dates,
      amount: idx.amount !== undefined ? xlNum(row[idx.amount]) : 0
    });
  }
  if (out.length) dcaRows = out;
}

/* 媽的永豐 → yfDetail[] / yfAccount[] / yfDividendRows[] / yfOverview{}
   （版面是三張表並排：買賣明細 col0-3、帳戶明細 col4-9、除息資訊 col10-12；
     餘額/持有股數/股利/累計等為程式自動計算欄位，不從檔案讀入） */
function importYfSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 3) return;

  const titleText = xlStr(rows[0][0]);
  const nameMatch = titleText.replace('股票投資概況：', '').trim();
  if (nameMatch) yfOverview.stockName = nameMatch;

  const ovHead = rows[1] || [];
  const ovVals = rows[2] || [];
  const curIdx = ovHead.findIndex(h => xlStr(h) === '現值');
  if (curIdx >= 0 && ovVals[curIdx] !== undefined && ovVals[curIdx] !== '') {
    yfOverview.currentValue = xlNum(ovVals[curIdx]);
  }

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (xlStr(rows[i][0]) === '日期' && xlStr(rows[i][1]) === '股數') { headerIdx = i; break; }
  }
  if (headerIdx === -1) return;

  const newDetail = [], newAccount = [], newDividend = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (row[0] !== undefined && row[0] !== '') {
      newDetail.push({ date: xlStr(row[0]), shares: xlNum(row[1]), price: xlNum(row[2]), cost: xlNum(row[3]) });
    }
    if (row[4] !== undefined && row[4] !== '') {
      newAccount.push({ date: xlStr(row[4]), type: xlStr(row[5]), detail: xlStr(row[6]), amount: xlNum(row[7]), balance: 0, note: xlStr(row[9]) });
    }
    if (row[10] !== undefined && row[10] !== '') {
      newDividend.push({ exDate: xlStr(row[10]), cashPerShare: xlNum(row[11]), payDate: xlStr(row[12]), heldShares: 0, divAmount: 0, cumulative: 0 });
    }
  }
  if (newDetail.length) yfDetail = newDetail;
  if (newAccount.length) yfAccount = newAccount;
  if (newDividend.length) yfDividendRows = newDividend;
}

/* 各股紀錄 → localStorage 的資產快照 (ASSET_SNAPSHOTS_V1)，依「快照日期」分組重建 */
function importSnapshotsSheet(ws) {
  const rows = xlRowsOf(ws);
  if (rows.length < 2) return;
  const idx = xlHeaderIndex(rows[0], {
    '快照日期': 'date', '帳戶': 'account', '股票名稱': 'name', '代號': 'code',
    '持有股數': 'shares', '成本': 'totalCost', '現價': 'currentPrice', '市值': 'marketVal', '未實現損益': 'profit'
  });

  const byDate = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (xlIsBlankRow(row)) continue;
    const date = idx.date !== undefined ? xlStr(row[idx.date]) : '';
    if (!date) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({
      account: idx.account !== undefined ? xlStr(row[idx.account]) : '',
      name: idx.name !== undefined ? xlStr(row[idx.name]) : '',
      code: idx.code !== undefined ? xlStr(row[idx.code]) : '',
      shares: idx.shares !== undefined ? xlNum(row[idx.shares]) : 0,
      totalCost: idx.totalCost !== undefined ? xlNum(row[idx.totalCost]) : 0,
      currentPrice: idx.currentPrice !== undefined ? xlNum(row[idx.currentPrice]) : 0,
      marketVal: idx.marketVal !== undefined ? xlNum(row[idx.marketVal]) : 0,
      profit: idx.profit !== undefined ? xlNum(row[idx.profit]) : 0
    });
  }

  const snaps = Object.keys(byDate).map(date => ({ date, items: byDate[date] }));
  if (snaps.length) {
    try { localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(snaps)); } catch (e) { /* 略過 */ }
  }
}

const XLSX_IMPORT_HANDLERS = {
  holdings: importHoldingsSheet,
  salesList: importSalesListSheet,
  salesHistory: importSalesHistorySheet,
  dividendPast: importDividendPastSheet,
  dividendEstimate: importDividendEstimateSheet,
  lendingHoldings: importLendingHoldingsSheet,
  lendingIncome: importLendingIncomeSheet,
  dca: importDcaSheet,
  yf: importYfSheet,
  snapshots: importSnapshotsSheet
};
