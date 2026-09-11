/* ====== 懸浮小提醒卡片 (tips widget) ======
   顯示範圍：整個 App（股票管理 + 財務總覽）皆可見，position:fixed，不受分頁切換影響。
   資料完全來自本機已載入的全域狀態變數（stocks / dividendEstimates / exRightsInfo /
   stockSales / pastColumns / dcaRows / yfOverview / latestColCalcs），不額外呼叫任何外部 API。
   此檔案沿用其他 script 檔案的慣例：直接讀取 stock.js / dividends.js / finance.js /
   stock-yf.js 頂層宣告的全域變數與函式，靠瀏覽器對 classic <script> 標籤的共用全域作用域運作。

   行為：
   - 每 4 秒自動換下一張卡片，滑鼠移入/拖曳時暫停
   - 可拖曳（不記憶位置，每次重新整理頁面都回到左下角預設位置）
   - 右上角可「縮小」(縮成小圓點，再點一下展開) 或「關閉」(本次瀏覽階段關閉，重新整理頁面會再出現)
   ====== */

let tipsWidgetCards = [];
let tipsWidgetIndex = 0;
let tipsWidgetTimer = null;
let tipsWidgetClosed = false;
let tipsWidgetDragging = false;

/* 投資心法：先放一組通用金句當預設，之後可以直接改這個陣列替換成你自己想放的話 */
const TIPS_WIDGET_QUOTES = [
  '投資是一場馬拉松，不是短跑，耐心比速度重要。',
  '好公司在便宜的時候買，比在興奮的時候買重要。',
  '股利入袋為安，但別忘了公司體質才是根本。',
  '分散不是為了多賺，是為了少賠。',
  '市場先生每天都會報價，你不必每天都回應。',
  '存股存的是紀律，不是情緒。',
  '本金願意愈滾愈大，時間才是複利真正的朋友。',
  '賣出的理由，應該跟當初買進的理由一樣清楚。'
];

function tipsWidgetFmtMoney(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + 'NT$' + Math.abs(v).toLocaleString('zh-TW');
}

function tipsWidgetFmtPct(n) {
  const v = Number(n) || 0;
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function tipsWidgetEsc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ====== 各類卡片的資料收集 (每一種都獨立包 try/catch，單一項目算錯不會拖垮其他卡片) ====== */

function tipsWidgetBuildExRights() {
  const cards = [];
  try {
    if (typeof getUniqueEstimateStocks !== 'function' || typeof exRightsInfo === 'undefined') return cards;
    if (typeof yfParseDateInt !== 'function') return cards;
    const today = new Date();
    const list = [];
    getUniqueEstimateStocks().forEach(us => {
      const key = us.code || us.name;
      const info = exRightsInfo[key];
      if (!info || !info.exDate) return;
      const exInt = yfParseDateInt(info.exDate);
      if (exInt >= 99999999) return;
      const y = Math.floor(exInt / 10000), m = Math.floor((exInt % 10000) / 100) - 1, d = exInt % 100;
      const exDateObj = new Date(y, m, d);
      const diffDays = Math.round((exDateObj - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
      if (diffDays < 0 || diffDays > 30) return;
      list.push({ us, info, diffDays });
    });
    list.sort((a, b) => a.diffDays - b.diffDays);
    list.slice(0, 5).forEach(({ us, info, diffDays }) => {
      const hasCash = info.exType && info.exType.indexOf('息') !== -1;
      const hasStock = info.exType && info.exType.indexOf('權') !== -1;
      const typeLabel = hasCash && hasStock ? '除權息' : (hasStock ? '除權' : '除息');
      let detail = '';
      if (hasCash && info.cashDividend) detail += `現金股利每股 ${info.cashDividend} 元`;
      if (hasStock && info.stockDividend) detail += (detail ? '、' : '') + `股票股利每股 ${info.stockDividend} 元`;
      cards.push({
        icon: '📅',
        title: `即將${typeLabel}`,
        lines: [
          `${us.name}${us.code ? '（' + us.code + '）' : ''} ${diffDays === 0 ? '就是今天' : diffDays + ' 天後'}${typeLabel}（${info.exDate}）`,
          detail || '詳細金額待公告'
        ]
      });
    });
  } catch (e) { console.warn('tipsWidget: 除權息卡片計算失敗', e); }
  return cards;
}

function tipsWidgetBuildHoldings() {
  const cards = [];
  try {
    if (typeof stocks === 'undefined' || !stocks.length || typeof isUsStock !== 'function') return cards;
    let totalCost = 0, totalVal = 0;
    const perStock = [];
    stocks.forEach(s => {
      const fx = isUsStock(s) ? 29 : 1;
      const cost = (Number(s.totalCost) || 0) * fx;
      const val = (Number(s.shares) || 0) * (Number(s.currentPrice) || 0) * fx;
      totalCost += cost; totalVal += val;
      if (cost > 0) perStock.push({ name: s.name, rate: (val - cost) / cost * 100 });
    });
    if (totalCost > 0) {
      const profit = totalVal - totalCost;
      const rate = profit / totalCost * 100;
      cards.push({
        icon: '📊',
        title: '持股總覽',
        lines: [`目前股票總市值 ${tipsWidgetFmtMoney(totalVal)}`, `未實現損益 ${tipsWidgetFmtMoney(profit)}（${tipsWidgetFmtPct(rate)}）`]
      });
    }
    if (perStock.length >= 2) {
      perStock.sort((a, b) => b.rate - a.rate);
      const best = perStock[0], worst = perStock[perStock.length - 1];
      cards.push({ icon: '🏆', title: '報酬率最高持股', lines: [`${best.name} 目前報酬率 ${tipsWidgetFmtPct(best.rate)}`] });
      if (worst.name !== best.name) {
        cards.push({ icon: '📉', title: '報酬率最低持股', lines: [`${worst.name} 目前報酬率 ${tipsWidgetFmtPct(worst.rate)}`] });
      }
    }
  } catch (e) { console.warn('tipsWidget: 持股總覽卡片計算失敗', e); }
  return cards;
}

function tipsWidgetBuildDividendEstimate() {
  try {
    if (typeof dividendEstimates === 'undefined' || typeof getUniqueEstimateStocks !== 'function') return [];
    let totalEstCash = 0;
    getUniqueEstimateStocks().forEach(us => {
      const key = us.code || us.name;
      const est = dividendEstimates[key];
      if (est && est.expCash) totalEstCash += (Number(est.expCash) || 0) * (Number(us.shares) || 0);
    });
    if (totalEstCash <= 0) return [];
    return [{ icon: '💰', title: '股利預估', lines: [`依目前填寫的預估股利計算，全年現金股利約 ${tipsWidgetFmtMoney(totalEstCash)}`] }];
  } catch (e) { console.warn('tipsWidget: 股利預估卡片計算失敗', e); return []; }
}

function tipsWidgetBuildAllTimeDividend() {
  try {
    if (typeof stocks === 'undefined' || typeof pastColumns === 'undefined' || typeof isUsStock !== 'function') return [];
    let totalDiv = 0;
    stocks.forEach(s => { totalDiv += (Number(s.cashDividends) || 0) * (isUsStock(s) ? 29 : 1); });
    const realized = pastColumns.reduce((sum, col) => sum + col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0), 0);
    const combined = totalDiv + realized;
    if (combined <= 0) return [];
    return [{ icon: '🪙', title: '累積股利', lines: [`歷年累積已收現金股利 ${tipsWidgetFmtMoney(combined)}`] }];
  } catch (e) { console.warn('tipsWidget: 累積股利卡片計算失敗', e); return []; }
}

function tipsWidgetBuildLastSale() {
  try {
    if (typeof stockSales === 'undefined' || !stockSales.length) return [];
    const sorted = stockSales.filter(r => r.date).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const last = sorted[0];
    if (!last) return [];
    const cost = Number(last.cost) || 0;
    const spread = Number(last.spread) || 0;
    const rate = cost > 0 ? spread / cost * 100 : 0;
    return [{ icon: '💹', title: '最近一筆賣出', lines: [`${last.date} 賣出 ${last.name}`, `獲利 ${tipsWidgetFmtMoney(spread)}（${tipsWidgetFmtPct(rate)}）`] }];
  } catch (e) { console.warn('tipsWidget: 賣出卡片計算失敗', e); return []; }
}

function tipsWidgetBuildFinance() {
  try {
    if (typeof latestColCalcs === 'undefined' || !latestColCalcs.length) return [];
    const last = latestColCalcs[latestColCalcs.length - 1];
    const prev = latestColCalcs.length >= 2 ? latestColCalcs[latestColCalcs.length - 2] : null;
    const lines = [`目前總資產 ${tipsWidgetFmtMoney(last.totalVal)}`];
    if (prev) {
      const diff = last.totalVal - prev.totalVal;
      lines.push(`較上次記錄${diff >= 0 ? '增加' : '減少'} ${tipsWidgetFmtMoney(Math.abs(diff))}`);
    }
    return [{ icon: '📋', title: '財務總覽', lines }];
  } catch (e) { console.warn('tipsWidget: 財務總覽卡片計算失敗', e); return []; }
}

function tipsWidgetBuildDca() {
  try {
    if (typeof dcaRows === 'undefined' || !dcaRows.length) return [];
    const today = new Date();
    const day = today.getDate();
    let best = null;
    dcaRows.forEach(r => {
      (r.dates || []).forEach(d => {
        const dNum = Number(d);
        if (!dNum) return;
        let diff = dNum - day;
        if (diff < 0) diff += 30; // 粗略估算跨月天數，不精算每月實際天數
        if (best === null || diff < best.diff) best = { name: r.name, day: dNum, amount: r.amount, diff };
      });
    });
    if (!best || best.diff > 10) return [];
    return [{ icon: '🔁', title: '定期定額', lines: [`${best.name} 每月 ${best.day} 號扣款 ${tipsWidgetFmtMoney(best.amount)}`] }];
  } catch (e) { console.warn('tipsWidget: 定期定額卡片計算失敗', e); return []; }
}

function tipsWidgetBuildYfGoal() {
  try {
    if (typeof yfOverview === 'undefined' || !yfOverview || !yfOverview.stockName) return [];
    const goal = 100000;
    const appCost = Number(yfOverview.appCost) || 0;
    const currentVal = Number(yfOverview.currentValue) || 0;
    if (appCost <= 0 && currentVal <= 0) return [];
    const remain = Math.max(0, goal - appCost);
    return [{
      icon: '🎯', title: '存股計畫進度',
      lines: [`${yfOverview.stockName} 現值 ${tipsWidgetFmtMoney(currentVal)}`,
        remain > 0 ? `距離 10 萬元目標還差 ${tipsWidgetFmtMoney(remain)}` : '已達成 10 萬元存股目標！']
    }];
  } catch (e) { console.warn('tipsWidget: 存股計畫卡片計算失敗', e); return []; }
}

function tipsWidgetBuildLending() {
  try {
    if (typeof stocks === 'undefined') return [];
    const totalLent = stocks.reduce((s, st) => s + (Number(st.lentShares) || 0), 0);
    if (totalLent <= 0) return [];
    return [{ icon: '🤝', title: '股票出借', lines: [`目前出借中 ${totalLent.toLocaleString('zh-TW')} 股`] }];
  } catch (e) { console.warn('tipsWidget: 出借卡片計算失敗', e); return []; }
}

function tipsWidgetBuildTopDividendStockThisYear() {
  try {
    if (typeof stocks === 'undefined' || !stocks.length || typeof isUsStock !== 'function') return [];
    const thisYear = new Date().getFullYear();
    let best = null;
    stocks.forEach(s => {
      const fx = isUsStock(s) ? 29 : 1;
      const sum = (s.dividendHistory || [])
        .filter(h => Number(h.year) === thisYear)
        .reduce((acc, h) => acc + (Number(h.cash) || 0), 0) * fx;
      if (sum > 0 && (!best || sum > best.sum)) best = { name: s.name, sum };
    });
    if (!best) return [];
    return [{ icon: '👑', title: `${thisYear} 年已收現金股利之最`, lines: [`${best.name} 今年已入帳 ${tipsWidgetFmtMoney(best.sum)}`] }];
  } catch (e) { console.warn('tipsWidget: 年度股利之最卡片計算失敗', e); return []; }
}

function tipsWidgetBuildTopYieldStock() {
  try {
    if (typeof stocks === 'undefined' || typeof getUniqueEstimateStocks !== 'function' || typeof dividendEstimates === 'undefined') return [];
    let best = null;
    getUniqueEstimateStocks().forEach(us => {
      const key = us.code || us.name;
      const est = dividendEstimates[key];
      if (!est || !est.expCash || !us.currentPrice) return;
      const yieldPct = est.expCash / us.currentPrice * 100;
      if (!best || yieldPct > best.yieldPct) best = { name: us.name, yieldPct };
    });
    if (!best) return [];
    return [{ icon: '🌟', title: '現金殖利率最高持股', lines: [`${best.name} 預估現金殖利率約 ${best.yieldPct.toFixed(2)}%`] }];
  } catch (e) { console.warn('tipsWidget: 最高殖利率卡片計算失敗', e); return []; }
}

function tipsWidgetBuildDividendYoY() {
  try {
    if (typeof stocks === 'undefined' || typeof pastColumns === 'undefined' || typeof yfParseDateInt !== 'function' || typeof isUsStock !== 'function') return [];
    const today = new Date();
    const todayInt = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const lastYearSameDayInt = (today.getFullYear() - 1) * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const yearStartInt = today.getFullYear() * 10000 + 101;
    const lastYearStartInt = (today.getFullYear() - 1) * 10000 + 101;

    let thisYearSum = 0, lastYearSum = 0;
    stocks.forEach(s => {
      const fx = isUsStock(s) ? 29 : 1;
      (s.dividendHistory || []).forEach(h => {
        if (!h.cashDate || !h.cash) return;
        const d = yfParseDateInt(h.cashDate);
        if (d >= 99999999) return;
        if (d >= yearStartInt && d <= todayInt) thisYearSum += (Number(h.cash) || 0) * fx;
        else if (d >= lastYearStartInt && d <= lastYearSameDayInt) lastYearSum += (Number(h.cash) || 0) * fx;
      });
    });
    pastColumns.forEach(col => {
      (col.items || []).forEach(it => {
        if (!it.cashDate || !it.amount) return;
        const d = yfParseDateInt(it.cashDate);
        if (d >= 99999999) return;
        if (d >= yearStartInt && d <= todayInt) thisYearSum += Number(it.amount) || 0;
        else if (d >= lastYearStartInt && d <= lastYearSameDayInt) lastYearSum += Number(it.amount) || 0;
      });
    });

    if (thisYearSum <= 0 && lastYearSum <= 0) return [];
    if (lastYearSum <= 0) {
      return [{ icon: '📈', title: '股利年增比較', lines: [`今年至今已收 ${tipsWidgetFmtMoney(thisYearSum)}（去年同期無資料可比較）`] }];
    }
    const growth = (thisYearSum - lastYearSum) / lastYearSum * 100;
    return [{ icon: '📈', title: '股利年增比較', lines: [`今年至今已收 ${tipsWidgetFmtMoney(thisYearSum)}`, `較去年同期 ${tipsWidgetFmtPct(growth)}`] }];
  } catch (e) { console.warn('tipsWidget: 股利年增比較卡片計算失敗', e); return []; }
}

function tipsWidgetBuildOverallYield() {
  try {
    if (typeof stocks === 'undefined' || typeof getUniqueEstimateStocks !== 'function' || typeof dividendEstimates === 'undefined' || typeof isUsStock !== 'function') return [];
    let totalEstCash = 0, totalCost = 0;
    stocks.forEach(s => { totalCost += (Number(s.totalCost) || 0) * (isUsStock(s) ? 29 : 1); });
    getUniqueEstimateStocks().forEach(us => {
      const key = us.code || us.name;
      const est = dividendEstimates[key];
      if (est && est.expCash) {
        const stock = stocks.find(s => (s.code || s.name) === key);
        const fx = stock && isUsStock(stock) ? 29 : 1;
        totalEstCash += (Number(est.expCash) || 0) * (Number(us.shares) || 0) * fx;
      }
    });
    if (totalCost <= 0 || totalEstCash <= 0) return [];
    const yieldPct = totalEstCash / totalCost * 100;
    return [{ icon: '📐', title: '整體投資組合殖利率', lines: [`依目前成本計算，整體現金殖利率約 ${yieldPct.toFixed(2)}%`] }];
  } catch (e) { console.warn('tipsWidget: 整體殖利率卡片計算失敗', e); return []; }
}

function tipsWidgetBuildConcentration() {
  try {
    if (typeof stocks === 'undefined' || !stocks.length || typeof isUsStock !== 'function') return [];
    let totalVal = 0;
    const perStock = [];
    stocks.forEach(s => {
      const fx = isUsStock(s) ? 29 : 1;
      const val = (Number(s.shares) || 0) * (Number(s.currentPrice) || 0) * fx;
      totalVal += val;
      perStock.push({ name: s.name, val });
    });
    if (totalVal <= 0) return [];
    perStock.sort((a, b) => b.val - a.val);
    const top = perStock[0];
    const pct = top.val / totalVal * 100;
    if (pct < 30) return [];
    return [{ icon: '⚠️', title: '持股集中度提醒', lines: [`${top.name} 佔總市值 ${pct.toFixed(1)}%，集中度偏高，留意風險分散`] }];
  } catch (e) { console.warn('tipsWidget: 集中度提醒卡片計算失敗', e); return []; }
}

function tipsWidgetBuildAccountAllocation() {
  try {
    if (typeof stocks === 'undefined' || !stocks.length || typeof isUsStock !== 'function') return [];
    let totalVal = 0;
    const byAccount = {};
    stocks.forEach(s => {
      const fx = isUsStock(s) ? 29 : 1;
      const val = (Number(s.shares) || 0) * (Number(s.currentPrice) || 0) * fx;
      totalVal += val;
      const acc = s.account || '未分類';
      byAccount[acc] = (byAccount[acc] || 0) + val;
    });
    const accounts = Object.keys(byAccount);
    if (totalVal <= 0 || accounts.length < 2) return [];
    const sorted = accounts.map(a => ({ name: a, val: byAccount[a] })).sort((a, b) => b.val - a.val);
    const top = sorted[0];
    return [{ icon: '🗂️', title: '帳戶市值分布', lines: [`${top.name} 佔總市值 ${(top.val / totalVal * 100).toFixed(1)}%（最大部位帳戶）`] }];
  } catch (e) { console.warn('tipsWidget: 帳戶分布卡片計算失敗', e); return []; }
}

function tipsWidgetBuildHoldingCount() {
  try {
    if (typeof getUniqueEstimateStocks !== 'function') return [];
    const n = getUniqueEstimateStocks().length;
    if (n <= 0) return [];
    return [{ icon: '🧺', title: '持股分散度', lines: [`目前持有 ${n} 檔股票`] }];
  } catch (e) { console.warn('tipsWidget: 持股檔數卡片計算失敗', e); return []; }
}

function tipsWidgetBuildAccountReturnCompare() {
  try {
    if (typeof stocks === 'undefined' || !stocks.length || typeof isUsStock !== 'function') return [];
    const byAccount = {};
    stocks.forEach(s => {
      const fx = isUsStock(s) ? 29 : 1;
      const cost = (Number(s.totalCost) || 0) * fx;
      const val = (Number(s.shares) || 0) * (Number(s.currentPrice) || 0) * fx;
      if (cost <= 0) return;
      const acc = s.account || '未分類';
      if (!byAccount[acc]) byAccount[acc] = { cost: 0, val: 0 };
      byAccount[acc].cost += cost;
      byAccount[acc].val += val;
    });
    const groups = Object.keys(byAccount).map(a => ({
      name: a, rate: (byAccount[a].val - byAccount[a].cost) / byAccount[a].cost * 100
    }));
    if (groups.length < 2) return [];
    groups.sort((a, b) => b.rate - a.rate);
    const best = groups[0], worst = groups[groups.length - 1];
    return [{ icon: '⚖️', title: '帳戶報酬率比較', lines: [`${best.name} ${tipsWidgetFmtPct(best.rate)}`, `${worst.name} ${tipsWidgetFmtPct(worst.rate)}`] }];
  } catch (e) { console.warn('tipsWidget: 帳戶報酬率比較卡片計算失敗', e); return []; }
}

function tipsWidgetBuildLendingThisMonth() {
  try {
    if (typeof lendingIncomeRows === 'undefined' || !lendingIncomeRows.length || typeof yfParseDateInt !== 'function') return [];
    const today = new Date();
    const ym = today.getFullYear() * 100 + (today.getMonth() + 1);
    const sum = lendingIncomeRows.reduce((acc, r) => {
      if (!r.paymentDate) return acc;
      const d = yfParseDateInt(r.paymentDate);
      if (d >= 99999999) return acc;
      const rowYm = Math.floor(d / 100);
      return rowYm === ym ? acc + (Number(r.income) || 0) : acc;
    }, 0);
    if (sum <= 0) return [];
    return [{ icon: '💵', title: '本月出借收入', lines: [`本月已收到出借利息 ${tipsWidgetFmtMoney(sum)}`] }];
  } catch (e) { console.warn('tipsWidget: 本月出借收入卡片計算失敗', e); return []; }
}

function tipsWidgetBuildLendingAllTime() {
  try {
    if (typeof lendingIncomeRows === 'undefined' || !lendingIncomeRows.length) return [];
    const sum = lendingIncomeRows.reduce((acc, r) => acc + (Number(r.income) || 0), 0);
    if (sum <= 0) return [];
    return [{ icon: '🏦', title: '歷年出借累積收入', lines: [tipsWidgetFmtMoney(sum)] }];
  } catch (e) { console.warn('tipsWidget: 歷年出借收入卡片計算失敗', e); return []; }
}

function tipsWidgetBuildAssetTrend() {
  try {
    let snapshots = [];
    try { snapshots = JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'); } catch (e) { snapshots = []; }
    if (snapshots.length < 2) return [];
    // snapshots[0] 是最新（unshift 加入），依日期由新到舊排序更保險
    const sorted = snapshots.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const totalOf = sp => (sp.items || []).reduce((s, it) => s + (Number(it.marketVal) || 0), 0);
    const latest = sorted[0];
    const latestTotal = totalOf(latest);
    const latestDate = new Date(latest.date);
    // 找最接近 7 天前的快照來算「本週」走勢；找不到就退而求其次比對上一筆快照
    let ref = sorted.slice(1).find(sp => {
      const diffDays = Math.round((latestDate - new Date(sp.date)) / 86400000);
      return diffDays >= 5;
    }) || sorted[1];
    const refTotal = totalOf(ref);
    if (refTotal <= 0) return [];
    const diffDays = Math.round((latestDate - new Date(ref.date)) / 86400000);
    const growth = (latestTotal - refTotal) / refTotal * 100;
    return [{ icon: '📈', title: '資產走勢', lines: [`近 ${diffDays} 天資產變化 ${tipsWidgetFmtPct(growth)}`, `目前市值 ${tipsWidgetFmtMoney(latestTotal)}`] }];
  } catch (e) { console.warn('tipsWidget: 資產走勢卡片計算失敗', e); return []; }
}

function tipsWidgetBuildPendingAnnounce() {
  try {
    if (typeof getUniqueEstimateStocks !== 'function' || typeof exRightsInfo === 'undefined') return [];
    const names = [];
    getUniqueEstimateStocks().forEach(us => {
      const key = us.code || us.name;
      const info = exRightsInfo[key];
      if (info && info.exDate && info.cashDividend === null) names.push(us.name);
    });
    if (!names.length) return [];
    return [{ icon: '⏳', title: '除權息金額待公告', lines: [`${names.slice(0, 3).join('、')} 已排定除息，正式金額待證交所公告，記得之後回來看`] }];
  } catch (e) { console.warn('tipsWidget: 待公告提醒卡片計算失敗', e); return []; }
}

function tipsWidgetBuildDcaMonthlyTotal() {
  try {
    if (typeof dcaRows === 'undefined' || !dcaRows.length) return [];
    let sum = 0, count = 0;
    dcaRows.forEach(r => {
      const n = (r.dates || []).length;
      if (n > 0) { sum += n * (Number(r.amount) || 0); count += n; }
    });
    if (sum <= 0) return [];
    return [{ icon: '📆', title: '定期定額本月合計', lines: [`本月共 ${count} 筆，合計扣款 ${tipsWidgetFmtMoney(sum)}`] }];
  } catch (e) { console.warn('tipsWidget: 定期定額合計卡片計算失敗', e); return []; }
}

function tipsWidgetBuildMilestone() {
  try {
    if (typeof stocks === 'undefined' || typeof pastColumns === 'undefined' || typeof isUsStock !== 'function') return [];
    let totalDiv = 0;
    stocks.forEach(s => { totalDiv += (Number(s.cashDividends) || 0) * (isUsStock(s) ? 29 : 1); });
    const realized = pastColumns.reduce((sum, col) => sum + col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0), 0);
    const combined = totalDiv + realized;
    const milestones = [1000000, 500000, 300000, 100000, 50000, 10000];
    const hit = milestones.find(m => combined >= m);
    if (!hit) return [];
    return [{ icon: '🎉', title: '里程碑', lines: [`累積股利已經突破 ${tipsWidgetFmtMoney(hit)}！`] }];
  } catch (e) { console.warn('tipsWidget: 里程碑卡片計算失敗', e); return []; }
}

function tipsWidgetBuildYfGoalMilestone() {
  try {
    if (typeof yfOverview === 'undefined' || !yfOverview || !yfOverview.stockName) return [];
    const goal = 100000;
    const appCost = Number(yfOverview.appCost) || 0;
    if (appCost <= 0) return [];
    const progress = appCost / goal * 100;
    if (progress >= 100) return [{ icon: '🏁', title: '存股計畫里程碑', lines: [`${yfOverview.stockName} 已達成 10 萬元存股目標！`] }];
    if (progress >= 80) return [{ icon: '🎯', title: '存股計畫里程碑', lines: [`${yfOverview.stockName} 已達成 80% 進度`] }];
    if (progress >= 50) return [{ icon: '🎯', title: '存股計畫里程碑', lines: [`${yfOverview.stockName} 已達成 50% 進度`] }];
    return [];
  } catch (e) { console.warn('tipsWidget: 存股里程碑卡片計算失敗', e); return []; }
}

function tipsWidgetBuildFinanceAllocation() {
  try {
    if (typeof latestColCalcs === 'undefined' || !latestColCalcs.length) return [];
    const last = latestColCalcs[latestColCalcs.length - 1];
    if (!last.totalVal || last.totalVal <= 0) return [];
    const cashPct = (last.cashDisplayTotal || last.cashTotal || 0) / last.totalVal * 100;
    const stockPct = (last.stockValTotal || 0) / last.totalVal * 100;
    const insPct = (last.insTotal || 0) / last.totalVal * 100;
    return [{ icon: '🥧', title: '資產配置比重', lines: [`現金 ${cashPct.toFixed(0)}% ・ 股票 ${stockPct.toFixed(0)}% ・ 保險 ${insPct.toFixed(0)}%`] }];
  } catch (e) { console.warn('tipsWidget: 資產配置比重卡片計算失敗', e); return []; }
}

function tipsWidgetBuildYfHoldingsDetail() {
  try {
    if (typeof yfDetail === 'undefined' || !yfDetail.length || typeof yfOverview === 'undefined') return [];
    const totalShares = yfDetail.reduce((s, r) => s + (Number(r.shares) || 0), 0);
    if (totalShares <= 0) return [];
    const appCost = Number(yfOverview.appCost) || 0;
    const avgPrice = appCost > 0 ? appCost / totalShares : 0;
    return [{
      icon: '📦', title: '00878 庫存明細',
      lines: [`累積庫存 ${totalShares.toLocaleString('zh-TW')} 股`, avgPrice > 0 ? `平均成本約 ${avgPrice.toFixed(2)} 元/股` : ''].filter(Boolean)
    }];
  } catch (e) { console.warn('tipsWidget: 00878 庫存明細卡片計算失敗', e); return []; }
}

const TIPS_WIDGET_EDUCATION = [
  '「除息」是公司把現金股利發給股東，股價會同步扣掉這筆金額，開盤價通常會比前一天低。',
  '「除權」是公司發放股票股利（配股），股數變多、股價依比例往下調整，總市值理論上不變。',
  '「殖利率」= 每股現金股利 ÷ 股價，是用來衡量「配息相對於股價」划不划算的指標，不是投資報酬率本身。',
  '「填息」是指股價在除息之後，慢慢漲回除息前的價位；「填權」則是股票股利的版本。',
  '股利發放通常會經過「董事會擬議」→「股東會通過」→「除權息」→「實際入帳」這幾個階段，中間可能會拖上好幾個月。',
  '同一天如果同時發放現金股利跟股票股利，會叫做「除權息」，股價會同時扣掉這兩者的金額。'
];

function tipsWidgetBuildEducationCards() {
  return TIPS_WIDGET_EDUCATION.map(q => ({ icon: '📖', title: '投資小知識', lines: [q] }));
}

function tipsWidgetBuildQuotes() {
  return TIPS_WIDGET_QUOTES.map(q => ({ icon: '💡', title: '投資心法', lines: [q] }));
}

function tipsWidgetBuildAllCards() {
  let cards = [];
  cards = cards.concat(tipsWidgetBuildExRights());
  cards = cards.concat(tipsWidgetBuildHoldings());
  cards = cards.concat(tipsWidgetBuildDividendEstimate());
  cards = cards.concat(tipsWidgetBuildAllTimeDividend());
  cards = cards.concat(tipsWidgetBuildLastSale());
  cards = cards.concat(tipsWidgetBuildFinance());
  cards = cards.concat(tipsWidgetBuildDca());
  cards = cards.concat(tipsWidgetBuildYfGoal());
  cards = cards.concat(tipsWidgetBuildLending());
  cards = cards.concat(tipsWidgetBuildTopDividendStockThisYear());
  cards = cards.concat(tipsWidgetBuildTopYieldStock());
  cards = cards.concat(tipsWidgetBuildDividendYoY());
  cards = cards.concat(tipsWidgetBuildOverallYield());
  cards = cards.concat(tipsWidgetBuildConcentration());
  cards = cards.concat(tipsWidgetBuildAccountAllocation());
  cards = cards.concat(tipsWidgetBuildHoldingCount());
  cards = cards.concat(tipsWidgetBuildAccountReturnCompare());
  cards = cards.concat(tipsWidgetBuildLendingThisMonth());
  cards = cards.concat(tipsWidgetBuildLendingAllTime());
  cards = cards.concat(tipsWidgetBuildAssetTrend());
  cards = cards.concat(tipsWidgetBuildPendingAnnounce());
  cards = cards.concat(tipsWidgetBuildDcaMonthlyTotal());
  cards = cards.concat(tipsWidgetBuildMilestone());
  cards = cards.concat(tipsWidgetBuildYfGoalMilestone());
  cards = cards.concat(tipsWidgetBuildFinanceAllocation());
  cards = cards.concat(tipsWidgetBuildYfHoldingsDetail());
  cards = cards.concat(tipsWidgetBuildEducationCards());
  cards = cards.concat(tipsWidgetBuildQuotes());
  return cards;
}

/* ====== 渲染 / 輪播 ====== */

function tipsWidgetRenderCurrent() {
  if (!tipsWidgetCards.length) return;
  if (tipsWidgetIndex >= tipsWidgetCards.length) tipsWidgetIndex = 0;
  const card = tipsWidgetCards[tipsWidgetIndex];
  const iconEl = document.getElementById('tipsWidgetIcon');
  const titleEl = document.getElementById('tipsWidgetTitle');
  const bodyEl = document.getElementById('tipsWidgetBody');
  const dotsEl = document.getElementById('tipsWidgetDots');
  if (iconEl) iconEl.textContent = card.icon;
  if (titleEl) titleEl.textContent = card.title;
  if (bodyEl) bodyEl.innerHTML = card.lines.map(l => `<div class="tips-widget-line">${tipsWidgetEsc(l)}</div>`).join('');
  if (dotsEl) {
    dotsEl.innerHTML = tipsWidgetCards.map((_, i) =>
      `<span class="tips-widget-dot ${i === tipsWidgetIndex ? 'active' : ''}" onclick="tipsWidgetGoTo(${i})"></span>`
    ).join('');
  }
}

function tipsWidgetGoTo(i) {
  tipsWidgetIndex = i;
  tipsWidgetRenderCurrent();
  tipsWidgetResetTimer();
}

function tipsWidgetAdvance() {
  // 每次輪播前重新收集資料，這樣使用者在這次瀏覽期間編輯資料，卡片內容也會跟著更新
  const fresh = tipsWidgetBuildAllCards();
  if (fresh.length) tipsWidgetCards = fresh;
  if (!tipsWidgetCards.length) return;
  tipsWidgetIndex = tipsWidgetRandomIndex();
  tipsWidgetRenderCurrent();
}

/* 隨機挑一張卡片；卡片數 >1 時避免連續兩次抽到同一張 */
function tipsWidgetRandomIndex() {
  const n = tipsWidgetCards.length;
  if (n <= 1) return 0;
  let next;
  do { next = Math.floor(Math.random() * n); } while (next === tipsWidgetIndex);
  return next;
}

function tipsWidgetResetTimer() {
  if (tipsWidgetTimer) clearInterval(tipsWidgetTimer);
  tipsWidgetTimer = setInterval(tipsWidgetAdvance, 4000);
}

function tipsWidgetPause() {
  if (tipsWidgetTimer) { clearInterval(tipsWidgetTimer); tipsWidgetTimer = null; }
}

function tipsWidgetResume() {
  if (!tipsWidgetTimer && !tipsWidgetClosed) tipsWidgetResetTimer();
}

/* ====== 關閉 / 縮小展開 ====== */

function tipsWidgetClose() {
  tipsWidgetClosed = true;
  tipsWidgetPause();
  const el = document.getElementById('tipsWidget');
  const bubble = document.getElementById('tipsWidgetBubble');
  if (el) el.style.display = 'none';
  if (bubble) bubble.style.display = 'none';
}

function tipsWidgetToggleMinimize() {
  const el = document.getElementById('tipsWidget');
  const bubble = document.getElementById('tipsWidgetBubble');
  if (!el || !bubble) return;
  const isCurrentlyMinimized = el.style.display === 'none';
  if (isCurrentlyMinimized) {
    el.style.display = 'flex';
    bubble.style.display = 'none';
    tipsWidgetResume();
    if (typeof closeOtherFloatingWidgetsOnMobile === 'function') closeOtherFloatingWidgetsOnMobile('tips');
  } else {
    el.style.display = 'none';
    bubble.style.display = 'flex';
    tipsWidgetPause();
  }
}

/* ====== 拖曳 (不記憶位置，重新整理頁面會回到左下角預設位置) ====== */

function tipsWidgetInitDrag() {
  const el = document.getElementById('tipsWidget');
  const header = document.getElementById('tipsWidgetHeader');
  if (!el || !header) return;

  let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tips-widget-btn')) return; // 按鈕不觸發拖曳
    dragging = true;
    tipsWidgetDragging = true;
    const rect = el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    startX = e.clientX;
    startY = e.clientY;
    el.style.left = startLeft + 'px';
    el.style.top = startTop + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    try { header.setPointerCapture(e.pointerId); } catch (err) {}
    tipsWidgetPause();
  });

  header.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    const maxLeft = Math.max(8, window.innerWidth - el.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - el.offsetHeight - 8);
    newLeft = Math.min(Math.max(8, newLeft), maxLeft);
    newTop = Math.min(Math.max(8, newTop), maxTop);
    el.style.left = newLeft + 'px';
    el.style.top = newTop + 'px';
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    tipsWidgetDragging = false;
    tipsWidgetResume();
  };
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);
}

function tipsWidgetInitHoverPause() {
  const el = document.getElementById('tipsWidget');
  if (!el) return;
  el.addEventListener('mouseenter', tipsWidgetPause);
  el.addEventListener('mouseleave', () => { if (!tipsWidgetDragging) tipsWidgetResume(); });
}

/* ====== 初始化 ======
   用 addEventListener('load', ...) 而不是覆寫 window.onload，
   這樣不會影響 stock.js 原本的 window.onload = init。 */
function tipsWidgetInit() {
  if (tipsWidgetClosed) return;
  tipsWidgetCards = tipsWidgetBuildAllCards();
  if (!tipsWidgetCards.length) return;
  tipsWidgetIndex = Math.floor(Math.random() * tipsWidgetCards.length);
  const el = document.getElementById('tipsWidget');
  if (el) el.style.display = 'flex';
  tipsWidgetRenderCurrent();
  tipsWidgetInitDrag();
  tipsWidgetInitHoverPause();
  tipsWidgetResetTimer();
  if (typeof closeOtherFloatingWidgetsOnMobile === 'function') closeOtherFloatingWidgetsOnMobile('tips');
}

window.addEventListener('load', () => {
  // 延遲一下再啟動，確保 stock.js / finance.js 的 init()／render() 都跑過一輪，資料已經備妥
  setTimeout(() => {
    try { tipsWidgetInit(); } catch (e) { console.warn('tipsWidget: 初始化失敗', e); }
  }, 800);
});
