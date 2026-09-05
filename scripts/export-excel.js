/* ====================================================================
   全部資料匯出 (Excel) — 依照畫面上各表格的欄位與配色，輸出成一個多分頁 .xlsx
   使用 ExcelJS（純前端、支援儲存格顏色/字型），透過 CDN 載入。
   本檔案讀取 finance.js / stock.js 已經存在的全域變數與函式，不重新計算邏輯，
   確保匯出的數字跟畫面上完全一致。
   ==================================================================== */

const XLSX_COLORS = {
  secHeaderBg: '4A4438', secHeaderText: 'F4F0E8',
  bankLabel: 'EEF0E6', bankCell: 'F5F6F0',
  insLabel: 'EAEEF0', insCell: 'F2F4F5',
  stockLabel: 'F5EEE0', stockCell: 'F9F5EB',
  redLabel: 'DDC4B3', redCell: 'EFDFD4', redText: '6E3D2C',
  yellowLabel: 'ECE2C4', yellowCell: 'F4ECD4',
  summaryLabel: 'E9E4DA', summaryCell: 'F2EFE8',
  usdLabel: 'ECE7EA', usdCell: 'F4F2F3',
  rateLabel: 'DDE3DC', rateCell: 'E8EDE6',
  ratioLabel: 'E6E9E2', ratioCell: 'F1F3EE',
  badDebtLabel: 'E6E2DA', badDebtCell: 'EFECE5', badDebtText: '8A8378',
  upRed: 'B6533C', downGreen: '4A7C59',
  headerBg: 'ECE6D9', headerText: '3C362E',
  totalBg: 'F1F5F9',
  white: 'FFFFFF'
};

function xlFill(hex) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } }; }
function xlFont(opts) {
  const { color, ...rest } = opts;
  return Object.assign({ color: { argb: 'FF' + (color || '3C362E') } }, rest);
}

function xlSetRow(row, { bg, color, bold, align = 'center', size } = {}) {
  row.eachCell({ includeEmpty: true }, cell => {
    if (bg) cell.fill = xlFill(bg);
    cell.font = xlFont({ bold: !!bold, color: color, size: size || 11 });
    cell.alignment = { vertical: 'middle', horizontal: align };
  });
}

function xlBorderThin(ws) {
  ws.eachRow(row => {
    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDD5C4' } },
        left: { style: 'thin', color: { argb: 'FFDDD5C4' } },
        bottom: { style: 'thin', color: { argb: 'FFDDD5C4' } },
        right: { style: 'thin', color: { argb: 'FFDDD5C4' } }
      };
    });
  });
}

/* 1. 財務總覽 —— 完整比照 index.html 主表：九個區塊 + 各自配色 */
function buildFinanceSheet(wb) {
  const ws = wb.addWorksheet('財務總覽');
  const numCols = state.dates.length;

  const headRow = ws.addRow(['項目 / 紀錄時間', ...state.dates.map(d => d)]);
  xlSetRow(headRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.getColumn(1).width = 28;
  for (let i = 2; i <= numCols + 1; i++) ws.getColumn(i).width = 14;
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const activeBankItems = state.bankItems.filter(b => !b.archived);
  const activeInsuranceItems = state.insuranceItems.filter(ins => !ins.archived);
  const activeStockItems = state.stockItems.filter(s => !s.archived);
  const activeBadDebtItems = state.badDebtItems.filter(d => !d.archived);

  const colCalcs = [];
  for (let c = 0; c < numCols; c++) {
    const rate = Number(state.rates[c]) || 31.0;
    let cashTotal = 0, cashDisplayTotal = 0;
    activeBankItems.forEach(b => { const t = bankTWD(b, c, rate); cashTotal += t; if (!b.isForeign) cashDisplayTotal += t; });
    let insTotal = 0;
    activeInsuranceItems.forEach(ins => { insTotal += insTWD(ins, c, rate); });
    let stockValTotal = 0, stockCostTotal = 0;
    activeStockItems.forEach(s => { stockValTotal += stockValTWD(s, c, rate); stockCostTotal += stockCostTWD(s, c, rate); });
    const totalCost = cashTotal + insTotal + stockCostTotal;
    const totalVal = cashTotal + insTotal + stockValTotal;
    let usdTotalUSD = 0;
    activeBankItems.forEach(b => { if (b.isUSD) usdTotalUSD += getVal(b.id + '_usd', c); });
    activeInsuranceItems.forEach(ins => { if (ins.isUSD) usdTotalUSD += getVal(ins.id + '_usd', c); });
    activeStockItems.forEach(s => { if (s.isUSD) usdTotalUSD += getVal(s.id + '_usdval', c); });
    let stockProfit = 0;
    activeStockItems.forEach(s => {
      const rawProfit = state.values[s.id + '_profit']?.[c];
      if (rawProfit !== undefined && rawProfit !== null && rawProfit !== '') stockProfit += Number(rawProfit);
      else stockProfit += stockValTWD(s, c, rate) - stockCostTWD(s, c, rate);
    });
    const stockRoi = stockCostTotal > 0 ? stockProfit / stockCostTotal : 0;
    colCalcs.push({ rate, cashTotal, cashDisplayTotal, insTotal, stockValTotal, stockCostTotal, totalCost, totalVal, usdTotalUSD, stockProfit, stockRoi });
  }

  function sectionRow(title) {
    const r = ws.addRow([title]);
    ws.mergeCells(r.number, 1, r.number, numCols + 1);
    xlSetRow(r, { bg: XLSX_COLORS.secHeaderBg, color: XLSX_COLORS.secHeaderText, bold: true });
  }

  function dataRow(label, values, { labelBg, cellBg, textColor, bold, numFmt = '#,##0' } = {}) {
    const r = ws.addRow([label, ...values]);
    r.getCell(1).fill = xlFill(labelBg || XLSX_COLORS.white);
    r.getCell(1).font = xlFont({ bold: true, color: XLSX_COLORS.headerText });
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    for (let i = 2; i <= numCols + 1; i++) {
      const cell = r.getCell(i);
      cell.fill = xlFill(cellBg || XLSX_COLORS.white);
      cell.numFmt = numFmt;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = xlFont({ bold: !!bold, color: textColor });
    }
    return r;
  }

  function profitRow(label, values, invert = false) {
    const r = dataRow(label, values, { labelBg: XLSX_COLORS.stockLabel, cellBg: XLSX_COLORS.stockCell, bold: true });
    values.forEach((v, i) => {
      const cell = r.getCell(i + 2);
      if (v === 0 || v === '-' || v === null) return;
      const isUp = invert ? v < 0 : v > 0;
      cell.font = xlFont({ bold: true, color: isUp ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
    });
    return r;
  }

  // 一、銀行
  sectionRow('一、銀行與現金帳戶');
  activeBankItems.forEach(b => {
    const vals = colCalcs.map(cc => bankTWD(b, colCalcs.indexOf(cc), cc.rate));
    dataRow(b.name + (b.isUSD ? ' (USD自動)' : ''), state.dates.map((_, c) => bankTWD(b, c, colCalcs[c].rate)), { labelBg: XLSX_COLORS.bankLabel, cellBg: XLSX_COLORS.bankCell });
  });

  // 呆帳
  if (activeBadDebtItems.length) {
    sectionRow('🚫 呆帳區（不列入資產計算）');
    activeBadDebtItems.forEach(d => {
      dataRow(d.name, state.dates.map((_, c) => getVal(d.id, c)), { labelBg: XLSX_COLORS.badDebtLabel, cellBg: XLSX_COLORS.badDebtCell, textColor: XLSX_COLORS.badDebtText });
    });
  }

  // 二、保險
  sectionRow('二、保險資產 (台幣)');
  activeInsuranceItems.forEach(ins => {
    const vals = state.dates.map((_, c) => insTWD(ins, c, colCalcs[c].rate));
    dataRow(ins.name + (ins.isUSD ? ' (USD自動)' : ''), vals, { labelBg: XLSX_COLORS.insLabel, cellBg: XLSX_COLORS.insCell });
  });

  // 三、股票
  sectionRow('三、股票資產 (台幣現值 / 成本)');
  activeStockItems.forEach(s => {
    dataRow(s.name + ' [現值]' + (s.isUSD ? ' (USD自動)' : ''), state.dates.map((_, c) => stockValTWD(s, c, colCalcs[c].rate)), { labelBg: XLSX_COLORS.stockLabel, cellBg: XLSX_COLORS.stockCell });
    dataRow(s.name + ' [成本]' + (s.isUSD ? ' (USD自動)' : ''), state.dates.map((_, c) => stockCostTWD(s, c, colCalcs[c].rate)), { labelBg: XLSX_COLORS.stockLabel, cellBg: XLSX_COLORS.stockCell });
  });

  // 四、總資產(成本)
  sectionRow('四、總資產 (成本) 統計');
  dataRow('總資產 (成本)', colCalcs.map(cc => cc.totalCost), { labelBg: XLSX_COLORS.redLabel, cellBg: XLSX_COLORS.redCell, textColor: XLSX_COLORS.redText, bold: true });
  dataRow('增減 (成本)', colCalcs.map((cc, c) => c === 0 ? 0 : cc.totalCost - colCalcs[c - 1].totalCost), { labelBg: XLSX_COLORS.yellowLabel, cellBg: XLSX_COLORS.yellowCell, bold: true });
  {
    const r = dataRow('成長率 (成本)', colCalcs.map((cc, c) => (c === 0 || colCalcs[c - 1].totalCost === 0) ? 0 : (cc.totalCost - colCalcs[c - 1].totalCost) / colCalcs[c - 1].totalCost), { labelBg: XLSX_COLORS.yellowLabel, cellBg: XLSX_COLORS.yellowCell, bold: true, numFmt: '0.00%' });
  }

  // 五、總資產(現值)
  sectionRow('五、總資產 (現值/帳面) 統計');
  dataRow('總資產 (現值)', colCalcs.map(cc => cc.totalVal), { labelBg: XLSX_COLORS.redLabel, cellBg: XLSX_COLORS.redCell, textColor: XLSX_COLORS.redText, bold: true });
  dataRow('增減 (現值)', colCalcs.map((cc, c) => c === 0 ? 0 : cc.totalVal - colCalcs[c - 1].totalVal), { labelBg: XLSX_COLORS.yellowLabel, cellBg: XLSX_COLORS.yellowCell, bold: true });
  dataRow('成長率 (現值)', colCalcs.map((cc, c) => (c === 0 || colCalcs[c - 1].totalVal === 0) ? 0 : (cc.totalVal - colCalcs[c - 1].totalVal) / colCalcs[c - 1].totalVal), { labelBg: XLSX_COLORS.yellowLabel, cellBg: XLSX_COLORS.yellowCell, bold: true, numFmt: '0.00%' });

  // 六、分類總額
  sectionRow('六、分類資產總額');
  dataRow('現金總額', colCalcs.map(cc => cc.cashDisplayTotal), { labelBg: XLSX_COLORS.summaryLabel, cellBg: XLSX_COLORS.summaryCell, bold: true });
  dataRow('股票總額 (現值)', colCalcs.map(cc => cc.stockValTotal), { labelBg: XLSX_COLORS.summaryLabel, cellBg: XLSX_COLORS.summaryCell, bold: true });
  dataRow('股票總額 (成本)', colCalcs.map(cc => cc.stockCostTotal), { labelBg: XLSX_COLORS.summaryLabel, cellBg: XLSX_COLORS.summaryCell, bold: true });
  dataRow('外匯總資產 (USD)', colCalcs.map(cc => cc.usdTotalUSD), { labelBg: XLSX_COLORS.summaryLabel, cellBg: XLSX_COLORS.summaryCell, bold: true, numFmt: '#,##0.00' });
  dataRow('保險總額', colCalcs.map(cc => cc.insTotal), { labelBg: XLSX_COLORS.summaryLabel, cellBg: XLSX_COLORS.summaryCell, bold: true });

  // 七、美金區
  sectionRow('七、美金原始金額輸入區 (USD)');
  activeBankItems.forEach(b => { if (b.isUSD) dataRow('↳ ' + b.name + ' (USD)', state.dates.map((_, c) => getVal(b.id + '_usd', c)), { labelBg: XLSX_COLORS.usdLabel, cellBg: XLSX_COLORS.usdCell, numFmt: '#,##0.00' }); });
  activeInsuranceItems.forEach(ins => { if (ins.isUSD) dataRow('↳ ' + ins.name + ' (USD)', state.dates.map((_, c) => getVal(ins.id + '_usd', c)), { labelBg: XLSX_COLORS.usdLabel, cellBg: XLSX_COLORS.usdCell, numFmt: '#,##0.00' }); });
  activeStockItems.forEach(s => {
    if (s.isUSD) {
      dataRow('↳ ' + s.name + ' 現值 (USD)', state.dates.map((_, c) => getVal(s.id + '_usdval', c)), { labelBg: XLSX_COLORS.usdLabel, cellBg: XLSX_COLORS.usdCell, numFmt: '#,##0.00' });
      dataRow('↳ ' + s.name + ' 成本 (USD)', state.dates.map((_, c) => getVal(s.id + '_usdcost', c)), { labelBg: XLSX_COLORS.usdLabel, cellBg: XLSX_COLORS.usdCell, numFmt: '#,##0.00' });
    }
  });
  dataRow('美金匯率', state.rates, { labelBg: XLSX_COLORS.rateLabel, cellBg: XLSX_COLORS.rateCell, bold: true, numFmt: '0.000' });

  // 八、佔比
  sectionRow('八、各分類資產佔比 (依現值)');
  dataRow('股票佔總比例', colCalcs.map(cc => cc.totalVal > 0 ? cc.stockValTotal / cc.totalVal : 0), { labelBg: XLSX_COLORS.ratioLabel, cellBg: XLSX_COLORS.ratioCell, numFmt: '0.00%' });
  dataRow('保險佔總比例', colCalcs.map(cc => cc.totalVal > 0 ? cc.insTotal / cc.totalVal : 0), { labelBg: XLSX_COLORS.ratioLabel, cellBg: XLSX_COLORS.ratioCell, numFmt: '0.00%' });
  dataRow('外幣佔總比例', colCalcs.map(cc => cc.totalVal > 0 ? (cc.usdTotalUSD * cc.rate) / cc.totalVal : 0), { labelBg: XLSX_COLORS.ratioLabel, cellBg: XLSX_COLORS.ratioCell, numFmt: '0.00%' });
  dataRow('活儲佔總比例', colCalcs.map(cc => cc.totalVal > 0 ? cc.cashDisplayTotal / cc.totalVal : 0), { labelBg: XLSX_COLORS.ratioLabel, cellBg: XLSX_COLORS.ratioCell, numFmt: '0.00%' });

  // 九、損益
  sectionRow('九、股票目前帳面損益');
  activeStockItems.forEach(s => {
    const vals = state.dates.map((_, c) => {
      const raw = state.values[s.id + '_profit']?.[c];
      if (raw !== undefined && raw !== null && raw !== '') return Number(raw);
      return stockValTWD(s, c, colCalcs[c].rate) - stockCostTWD(s, c, colCalcs[c].rate);
    });
    profitRow('股票投資損益 (' + s.name + ')', vals);
  });
  profitRow('股票投資總損益', colCalcs.map(cc => cc.stockProfit));
  {
    const r = dataRow('股票未實現損益報酬率', colCalcs.map(cc => cc.stockRoi), { labelBg: XLSX_COLORS.summaryLabel, cellBg: XLSX_COLORS.summaryCell, bold: true, numFmt: '0.00%' });
    colCalcs.forEach((cc, i) => {
      const cell = r.getCell(i + 2);
      if (cc.stockRoi === 0) return;
      cell.font = xlFont({ bold: true, color: cc.stockRoi > 0 ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
    });
  }

  xlBorderThin(ws);
}

/* 2. 全部持股 */
function buildHoldingsSheet(wb) {
  const ws = wb.addWorksheet('全部持股');
  const headers = ['帳戶', '股票名稱', '代號', '現價', '市值', '成本', '持有股數', '未實現損益', '報酬率', '平均每股成本', '現金股利', '股票股利', '含息每股成本', '出借張數'];
  const headRow = ws.addRow(headers);
  xlSetRow(headRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.columns.forEach((col, i) => { col.width = i === 1 ? 22 : 13; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  stocks.forEach(s => {
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
    const profitRate = totalCost > 0 ? (profit / totalCost) : 0;
    const netCostPerShare = shares > 0 ? ((totalCost - totalDiv) / shares) : 0;

    const r = ws.addRow([s.account, s.name, s.code || '', currentPrice, marketVal, totalCost, shares, profit, profitRate, avgCostPerShare, cashDiv, stockDivVal, netCostPerShare, lentShares]);
    r.getCell(4).numFmt = '#,##0.00'; r.getCell(5).numFmt = '#,##0'; r.getCell(6).numFmt = '#,##0';
    r.getCell(7).numFmt = '#,##0'; r.getCell(8).numFmt = '#,##0'; r.getCell(9).numFmt = '0.00%';
    r.getCell(10).numFmt = '#,##0.00'; r.getCell(11).numFmt = '#,##0'; r.getCell(12).numFmt = '#,##0';
    r.getCell(13).numFmt = '#,##0.00'; r.getCell(14).numFmt = '#,##0';
    const isP = profit >= 0;
    r.getCell(8).font = xlFont({ bold: true, color: isP ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
    r.getCell(9).font = xlFont({ bold: true, color: isP ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
  });
  xlBorderThin(ws);
}

/* 3. 股票賣出明細表 */
function buildSalesListSheet(wb) {
  const ws = wb.addWorksheet('股票賣出明細表');
  const headers = ['日期', '名稱', '股數', '買進價格', '賣出價格', '成本', '賣出', '價差', '報酬率', '買進手續費', '賣出手續費', '交易稅', '狀態'];
  const headRow = ws.addRow(headers);
  xlSetRow(headRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.columns.forEach((col, i) => { col.width = i === 1 ? 14 : 11; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  stockSales.forEach(r0 => {
    const isPos = (Number(r0.spread) || 0) >= 0;
    const retRate = r0.returnRate !== undefined && !isNaN(r0.returnRate) ? r0.returnRate : 0;
    const r = ws.addRow([r0.date || '', r0.name || '', r0.shares || 0, r0.buyPrice || 0, r0.sellPrice || 0, r0.cost || 0, r0.sellAmt || 0, r0.spread || 0, retRate, r0.buyFee || 0, r0.sellFee || 0, r0.tax || 0, r0.status || '']);
    [3, 4, 5, 6, 7, 8, 10, 11, 12].forEach(i => { r.getCell(i).numFmt = '#,##0'; });
    r.getCell(9).numFmt = '0.00%';
    r.getCell(8).font = xlFont({ bold: true, color: isPos ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
    r.getCell(9).font = xlFont({ color: isPos ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
  });

  const sumCost = stockSales.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const sumSellAmt = stockSales.reduce((s, r) => s + (Number(r.sellAmt) || 0), 0);
  const sumSpread = stockSales.reduce((s, r) => s + (Number(r.spread) || 0), 0);
  const totalRow = ws.addRow(['小計', '', '', '', '', sumCost, sumSellAmt, sumSpread, sumCost > 0 ? sumSpread / sumCost : 0, '', '', '', '']);
  xlSetRow(totalRow, { bg: XLSX_COLORS.totalBg, bold: true });
  totalRow.getCell(6).numFmt = '#,##0'; totalRow.getCell(7).numFmt = '#,##0'; totalRow.getCell(8).numFmt = '#,##0'; totalRow.getCell(9).numFmt = '0.00%';
  xlBorderThin(ws);
}

/* 4. 股票賣出 - 歷年紀錄 */
function buildSalesHistorySheet(wb) {
  const ws = wb.addWorksheet('股票賣出歷年紀錄');
  const headRow = ws.addRow(['年度', '總成本', '總賣出', '價差', '報酬率', '狀態']);
  xlSetRow(headRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.columns.forEach(c => c.width = 15);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  salesHistory.forEach(h => {
    const isPos = (Number(h.spread) || 0) >= 0;
    const forceManual = parseInt(h.year) <= 114;
    const status = forceManual ? '手動固定(114年以前)' : (h.isManual ? '手動鎖定' : '自動加總');
    const r = ws.addRow([h.year || '', h.totalCost || 0, h.totalSell || 0, h.spread || 0, h.returnRate || 0, status]);
    r.getCell(2).numFmt = '#,##0'; r.getCell(3).numFmt = '#,##0'; r.getCell(4).numFmt = '#,##0'; r.getCell(5).numFmt = '0.00%';
    r.getCell(4).font = xlFont({ bold: true, color: isPos ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
    r.getCell(5).font = xlFont({ color: isPos ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
  });
  xlBorderThin(ws);
}

/* 5. 股利 - 歷年總合 */
function buildDividendSummarySheet(wb) {
  const ws = wb.addWorksheet('股利-歷年總合');
  const headRow = ws.addRow(['發放年度', '非持股股利總和', '目前持股股利(現金股利)', '年度全體總額', '全體歷年佔比']);
  xlSetRow(headRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.columns.forEach((c, i) => c.width = i === 0 ? 16 : 20);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const list = getFullAssetYearlyDividendSummary();
  const grand = list.reduce((s, y) => s + y.totalAmount, 0);
  list.forEach(item => {
    const ratio = grand > 0 ? item.totalAmount / grand : 0;
    const r = ws.addRow([item.displayYear, item.pastAmount, item.currentAmount, item.totalAmount, ratio]);
    r.getCell(2).numFmt = '#,##0'; r.getCell(3).numFmt = '#,##0'; r.getCell(4).numFmt = '#,##0'; r.getCell(5).numFmt = '0.0%';
    r.getCell(4).fill = xlFill(XLSX_COLORS.yellowCell);
    r.getCell(4).font = xlFont({ bold: true });
  });
  xlBorderThin(ws);
}

/* 6. 股利 - 年度預估 (項目 × 股票 的樞紐表) */
function buildDividendEstimateSheet(wb) {
  const ws = wb.addWorksheet('股利-年度預估');
  const uniqueStocksMap = new Map();
  stocks.forEach(s => {
    const key = s.code ? s.code.trim() : s.name.trim();
    if (!uniqueStocksMap.has(key)) uniqueStocksMap.set(key, { name: s.name, code: s.code || '', shares: Number(s.shares) || 0, currentPrice: Number(s.currentPrice) || 0 });
    else { const ex = uniqueStocksMap.get(key); ex.shares += Number(s.shares) || 0; if (Number(s.currentPrice) > 0) ex.currentPrice = Number(s.currentPrice); }
  });
  const uniqueStocks = Array.from(uniqueStocksMap.values());

  const headRow = ws.addRow(['項目 / 股票', ...uniqueStocks.map(us => us.name + (us.code ? `(${us.code})` : ''))]);
  xlSetRow(headRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.getColumn(1).width = 20;
  for (let i = 2; i <= uniqueStocks.length + 1; i++) ws.getColumn(i).width = 16;
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const rowsDef = [
    { label: '預估除息', field: 'expCash', type: 'input' },
    { label: '預估除權', field: 'expStock', type: 'input' },
    { label: '現金殖利率', type: 'yield' },
    { label: '預估現金股利', type: 'totCash' },
    { label: '預估股票股利', type: 'totStock' },
    { label: '除權息參考價', type: 'refPrice' },
    { label: '除權後股數', type: 'afterShares' },
    { label: '持有股數(目前)', type: 'shares' }
  ];

  rowsDef.forEach(rowDef => {
    const vals = uniqueStocks.map(us => {
      const key = us.code ? us.code : us.name;
      const est = dividendEstimates[key] || { expCash: 0, expStock: 0 };
      const price = us.currentPrice, shares = us.shares;
      const c = Number(est.expCash) || 0, s2 = Number(est.expStock) || 0;
      switch (rowDef.type) {
        case 'input': return Number(est[rowDef.field]) || 0;
        case 'yield': return price > 0 ? c / price : 0;
        case 'totCash': return Math.round(c * shares);
        case 'totStock': return Math.round(s2 * shares);
        case 'refPrice': return price > 0 ? (price - c) / (1 + (s2 / 10)) : price;
        case 'afterShares': return Math.round(shares * (1 + (s2 / 10)));
        case 'shares': return shares;
      }
    });
    const r = ws.addRow([rowDef.label, ...vals]);
    r.getCell(1).font = xlFont({ bold: true }); r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    vals.forEach((v, i) => { r.getCell(i + 2).numFmt = rowDef.type === 'yield' ? '0.00%' : '#,##0.00'; });
  });
  xlBorderThin(ws);
}

/* 7. 股利 - 非持股(歷史) */
function buildDividendPastSheet(wb) {
  const ws = wb.addWorksheet('股利-非持股歷史');
  const maxRows = Math.max(...pastColumns.map(c => c.items.length), 1);
  const headRow1 = ws.addRow([]);
  const headRow2 = ws.addRow(['']);
  let colIdx = 2;
  pastColumns.forEach(col => {
    ws.mergeCells(1, colIdx, 1, colIdx + 1);
    ws.getCell(1, colIdx).value = col.year + ' 年度';
    headRow2.getCell(colIdx).value = '股票';
    headRow2.getCell(colIdx + 1).value = '現金股利';
    colIdx += 2;
  });
  xlSetRow(headRow1, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  xlSetRow(headRow2, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.getColumn(1).width = 4;
  for (let i = 2; i <= colIdx; i++) ws.getColumn(i).width = 13;
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  for (let rIdx = 0; rIdx < maxRows; rIdx++) {
    const rowVals = [''];
    pastColumns.forEach(col => {
      const item = col.items[rIdx] || { stock: '', amount: '' };
      rowVals.push(item.stock || '', item.amount !== '' && item.amount !== undefined ? Number(item.amount) : null);
    });
    const r = ws.addRow(rowVals);
    let ci = 2;
    pastColumns.forEach(() => { r.getCell(ci + 1).numFmt = '#,##0'; ci += 2; });
  }
  const totRow = ws.addRow(['合計']);
  let ci = 2;
  pastColumns.forEach(col => {
    const sum = col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    totRow.getCell(ci).value = '合計';
    totRow.getCell(ci + 1).value = sum;
    totRow.getCell(ci + 1).numFmt = '#,##0';
    ci += 2;
  });
  xlSetRow(totRow, { bg: XLSX_COLORS.yellowCell, bold: true });
  xlBorderThin(ws);
}

/* 8. 媽的永豐：三張表並排 + 總覽統計，跟畫面版面一致 */
function buildYfSheet(wb) {
  // 這兩個函式平常只有在使用者切到「媽的永豐」分頁時才會被呼叫，
  // 若匯出當下使用者停留在別的分頁，餘額/累計欄位可能還是舊值，這裡先強制重新計算一次。
  computeYfAccountBalance();
  computeYfDividendDistribution();

  const ws = wb.addWorksheet('媽的永豐');
  ws.views = [{ state: 'frozen', ySplit: 4 }];

  // 總覽統計 (與畫面上方卡片一致)
  const totalShares = yfDetail.reduce((s, r) => s + (Number(r.shares) || 0), 0);
  const totalCost = yfDetail.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const currentVal = Number(yfOverview.currentValue) || 0;
  const dividend = computeYfDividendDistribution();
  const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
  const unrealizedPL = currentVal - totalCost;
  const roi = totalCost > 0 ? unrealizedPL / totalCost : 0;
  const costWithDiv = totalCost - dividend;
  const plWithDiv = currentVal - costWithDiv;
  const avgPriceWithDiv = totalShares > 0 ? costWithDiv / totalShares : 0;
  const roiWithDiv = costWithDiv > 0 ? plWithDiv / costWithDiv : 0;
  const debt = 100000 - totalCost;

  const ovTitle = ws.addRow(['股票投資概況：' + (yfOverview.stockName || '')]);
  ws.mergeCells(1, 1, 1, 6);
  xlSetRow(ovTitle, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true, align: 'left' });

  const ovHead = ws.addRow(['成本', '現值', '均價', '股數', '未實現損益', '投資報酬率']);
  const ovVals = ws.addRow([totalCost, currentVal, avgPrice, totalShares, unrealizedPL, roi]);
  const ovHead2 = ws.addRow(['總股利', '含息成本', '含息損益', '含息均價', '含息報酬率', '尚欠(目標$100,000)']);
  const ovVals2 = ws.addRow([dividend, costWithDiv, plWithDiv, avgPriceWithDiv, roiWithDiv, debt]);
  [ovHead, ovHead2].forEach(r => xlSetRow(r, { bg: XLSX_COLORS.summaryLabel, bold: true }));
  [ovVals, ovVals2].forEach(r => xlSetRow(r, { bg: XLSX_COLORS.summaryCell, bold: true }));
  [ovVals.getCell(1), ovVals.getCell(2), ovVals.getCell(3), ovVals.getCell(4), ovVals2.getCell(1), ovVals2.getCell(2), ovVals2.getCell(3), ovVals2.getCell(4), ovVals2.getCell(6)].forEach(c => c.numFmt = '#,##0');
  ovVals.getCell(5).numFmt = '#,##0'; ovVals.getCell(6).numFmt = '0.00%'; ovVals2.getCell(5).numFmt = '0.00%';
  [ovVals.getCell(5), ovVals2.getCell(3)].forEach(c => { c.font = xlFont({ bold: true, color: (c.value >= 0) ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen }); });

  ws.addRow([]); // 空一行分隔

  const startRow = ws.rowCount + 1;
  const sectionHeadRow = ws.addRow(['買賣明細', '', '', '', '永豐帳戶明細', '', '', '', '', '', '除息資訊']);
  ws.mergeCells(sectionHeadRow.number, 1, sectionHeadRow.number, 4);
  ws.mergeCells(sectionHeadRow.number, 5, sectionHeadRow.number, 10);
  ws.mergeCells(sectionHeadRow.number, 11, sectionHeadRow.number, 16);
  xlSetRow(sectionHeadRow, { bg: XLSX_COLORS.secHeaderBg, color: XLSX_COLORS.secHeaderText, bold: true });

  const colHeadRow = ws.addRow(['日期', '股數', '成交價', '投資成本', '日期', '款項', '明細', '金額', '餘額', '備考', '除息日', '現金股利', '發放日', '持有股數', '股利', '累計領取']);
  xlSetRow(colHeadRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });

  const maxLen = Math.max(yfDetail.length, yfAccount.length, yfDividendRows.length, 1);
  for (let i = 0; i < maxLen; i++) {
    const d = yfDetail[i], a = yfAccount[i], dv = yfDividendRows[i];
    const r = ws.addRow([
      d ? d.date : '', d ? Number(d.shares) || 0 : '', d ? Number(d.price) || 0 : '', d ? Number(d.cost) || 0 : '',
      a ? a.date : '', a ? a.type : '', a ? a.detail : '', a ? Number(a.amount) || 0 : '', a ? Number(a.balance) || 0 : '', a ? (a.note || '') : '',
      dv ? dv.exDate : '', dv ? Number(dv.cashPerShare) || 0 : '', dv ? dv.payDate : '', dv ? Number(dv.heldShares) || 0 : '', dv ? Number(dv.divAmount) || 0 : '', dv ? Number(dv.cumulative) || 0 : ''
    ]);
    [2, 3, 4, 8, 9, 12, 14, 15, 16].forEach(ci => { r.getCell(ci).numFmt = ci === 3 ? '#,##0.00' : '#,##0'; });
  }
  ws.columns.forEach((c, i) => { c.width = [12, 8, 9, 11, 12, 8, 14, 10, 10, 10, 12, 9, 12, 10, 8, 10][i] || 10; });
  xlBorderThin(ws);
}

/* 9. 各股紀錄 (資產快照) */
function buildSnapshotsSheet(wb) {
  let allSnaps = [];
  try { allSnaps = JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'); } catch (e) { allSnaps = []; }
  if (!allSnaps.length) return;

  const ws = wb.addWorksheet('各股紀錄');
  const headRow = ws.addRow(['快照日期', '帳戶', '股票名稱', '代號', '持有股數', '成本', '現價', '市值', '未實現損益']);
  xlSetRow(headRow, { bg: XLSX_COLORS.headerBg, color: XLSX_COLORS.headerText, bold: true });
  ws.columns.forEach((c, i) => c.width = i === 2 ? 20 : 13);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  allSnaps.forEach(snap => {
    (snap.items || []).forEach(item => {
      const isP = item.profit >= 0;
      const r = ws.addRow([snap.date, item.account, item.name, item.code, item.shares, item.totalCost, item.currentPrice, item.marketVal, item.profit]);
      [5, 6, 7, 8, 9].forEach(ci => { r.getCell(ci).numFmt = ci === 7 ? '#,##0.00' : '#,##0'; });
      r.getCell(9).font = xlFont({ bold: true, color: isP ? XLSX_COLORS.upRed : XLSX_COLORS.downGreen });
    });
  });
  xlBorderThin(ws);
}

async function exportAllDataToExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert('Excel 匯出套件尚未載入完成，請稍後再試一次。');
    return;
  }
  const btn = document.getElementById('btnExportExcelAll');
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = '匯出中...'; btn.disabled = true; }

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = '個人財務資產狀況管理';
    wb.created = new Date();

    buildFinanceSheet(wb);
    buildHoldingsSheet(wb);
    buildSalesListSheet(wb);
    buildSalesHistorySheet(wb);
    buildDividendSummarySheet(wb);
    buildDividendEstimateSheet(wb);
    buildDividendPastSheet(wb);
    buildYfSheet(wb);
    buildSnapshotsSheet(wb);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '全部資料匯出_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Excel 匯出失敗', err);
    alert('匯出失敗：' + err.message);
  } finally {
    if (btn) { btn.textContent = originalText; btn.disabled = false; }
  }
}
