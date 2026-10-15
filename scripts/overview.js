/* ====================================================================
   📊 資產總覽 (overviewView) —— 只看不改，把三個分頁的資料合成「現在」的整體資產：
     - 現金（台幣／美元）、呆帳：財務總覽「最新一欄」
     - 股票（現值／成本，依證券帳戶）：股票管理（現價 × 股數，美股 × 💵 美元匯率），
       媽的永豐算一個帳戶（現值、APP 顯示成本）
     - 保險：保險總覽（未封存保單的目前現值）
   美元一律用標題列的「💵 美元匯率」換算。跟財務總覽數字不同時，上方黃色小字會寫出差多少。

   每月紀錄（跟上個月比）：
     - 每次重算都會把「這個月」的各項總數記下來（同一個月只留一筆，用最新的覆蓋），
       存在本機 (OVERVIEW_MONTHLY_V1)，登入後同步到雲端 overviewMonthly/{uid}。
     - 進入新的月份後，上個月那筆會用 GitHub Action 存的「月底收盤價」
       (data/month-end/YYYY-MM.json) × 當時記錄的持股股數，重算成月底的股票現值，然後固定下來。
       現金和保險維持當月最後記錄的數字。

   跟其他檔案一樣，沿用全域變數：state / getVal（finance.js）、stocks / yfOverview / yfDetail
   （stock.js）、insurancePolicies（insurance.js）、getUsdRate / isUsStock / fbDb / fbUser（shared.js）。
   ==================================================================== */

const OV_MONTHLY_KEY = 'OVERVIEW_MONTHLY_V1';
const OV_CLOUD_COLLECTION = 'overviewMonthly';
const OV_YF_ACCOUNT = '媽的永豐';
const OV_YF_CODE = '00878';

let ovCharts = {};
let ovLastCalc = null;
let ovLastRenderedAt = null;
let ovCloudLoaded = false;
let ovCloudSaveTimer = null;
let ovFinalizing = false;

/* ---------- 小工具 ---------- */
function ovNum(n) { return Number(n) || 0; }
function ovMoney(n, prefix = 'NT$') {
  const v = Math.round(ovNum(n));
  return (v < 0 ? '-' : '') + prefix + Math.abs(v).toLocaleString('zh-TW');
}
function ovUsd(n) {
  const v = ovNum(n);
  return (v < 0 ? '-' : '') + 'US$' + Math.abs(v).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function ovPct(n, digits = 1) { return (ovNum(n) * 100).toFixed(digits) + '%'; }
function ovSigned(n, fmt) {
  const v = ovNum(n);
  if (Math.round(v) === 0) return '±0';
  return (v > 0 ? '+' : '-') + fmt(Math.abs(v)).replace(/^-/, '');
}
function ovEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ovMonthKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function ovPrevMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
function ovMonthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${y - 1911}/${String(m).padStart(2, '0')}`;
}

/* ---------- 1. 計算目前的整體資產 ---------- */
function ovComputeNow() {
  const rate = (typeof getUsdRate === 'function') ? getUsdRate() : 29;

  // 現金與呆帳：財務總覽最新一欄
  const fs = (typeof state !== 'undefined' && state) ? state : { dates: [], rates: [], bankItems: [], badDebtItems: [], insuranceItems: [], stockItems: [] };
  const col = (fs.dates || []).length - 1;
  const hasFinance = col >= 0;
  const colRate = hasFinance ? (typeof resolveCellNumber === 'function' ? resolveCellNumber(fs.rates[col]) : Number(fs.rates[col])) || 31.0 : rate;
  const gv = (key) => (hasFinance && typeof getVal === 'function') ? getVal(key, col) : 0;

  const cashAccounts = [];
  let cashTwd = 0, cashUsd = 0;
  (fs.bankItems || []).filter(b => !b.archived).forEach(b => {
    if (b.isUSD) {
      const usd = gv(b.id + '_usd');
      cashUsd += usd;
      cashAccounts.push({ name: b.name, usd, twd: usd * rate });
    } else {
      const twd = gv(b.id);
      cashTwd += twd;
      cashAccounts.push({ name: b.name, usd: null, twd });
    }
  });
  const cashUsdTwd = cashUsd * rate;

  let badDebt = 0;
  const badDebts = [];
  (fs.badDebtItems || []).filter(b => !b.archived).forEach(b => {
    const twd = b.isUSD ? gv(b.id + '_usd') * rate : gv(b.id);
    badDebt += twd;
    badDebts.push({ name: b.name, twd });
  });

  // 財務總覽這一欄的股票、保險、美元現金（用該欄自己的匯率），只用來比對差異
  let finStockVal = 0, finIns = 0;
  (fs.stockItems || []).filter(s => !s.archived).forEach(s => { finStockVal += s.isUSD ? gv(s.id + '_usdval') * colRate : gv(s.id); });
  (fs.insuranceItems || []).filter(i => !i.archived).forEach(i => { finIns += i.isUSD ? gv(i.id + '_usd') * colRate : gv(i.id); });

  // 股票：股票管理，依證券帳戶
  const accMap = new Map();
  const holdings = [];
  let stockValue = 0, stockCost = 0, usStockValue = 0;
  (typeof stocks !== 'undefined' ? stocks : []).forEach(s => {
    const isUS = (typeof isUsStock === 'function') ? isUsStock(s) : false;
    const fx = isUS ? rate : 1;
    const shares = ovNum(s.shares);
    const value = shares * ovNum(s.currentPrice) * fx;
    const cost = ovNum(s.totalCost) * fx;
    const acc = s.account || '未分類';
    if (!accMap.has(acc)) accMap.set(acc, { name: acc, value: 0, cost: 0, count: 0, items: [] });
    const a = accMap.get(acc);
    a.value += value; a.cost += cost; a.count++;
    a.items.push({ name: s.name, code: s.code || '', value, cost, isUS });
    stockValue += value; stockCost += cost;
    if (isUS) usStockValue += value;
    holdings.push({ c: String(s.code || '').trim().toUpperCase(), s: shares, us: isUS ? 1 : 0, v: Math.round(value) });
  });

  // 媽的永豐：一個帳戶
  const yfO = (typeof yfOverview !== 'undefined' && yfOverview) ? yfOverview : {};
  const yfShares = (typeof yfDetail !== 'undefined' ? yfDetail : []).reduce((sum, r) => sum + ovNum(r.shares), 0);
  const yfValue = ovNum(yfO.currentValue);
  const yfCost = ovNum(yfO.appCost);
  if (yfValue || yfCost || yfShares) {
    accMap.set(OV_YF_ACCOUNT, { name: OV_YF_ACCOUNT, value: yfValue, cost: yfCost, count: 1,
      items: [{ name: yfO.stockName || OV_YF_CODE, code: OV_YF_CODE, value: yfValue, cost: yfCost, isUS: false }] });
    stockValue += yfValue; stockCost += yfCost;
  }
  const accounts = Array.from(accMap.values()).sort((a, b) => b.value - a.value);

  // 保險：保險總覽
  const policies = (typeof insurancePolicies !== 'undefined' ? insurancePolicies : []).filter(p => !p.archived);
  const freqTimes = { '年繳': 1, '半年繳': 2, '季繳': 4, '月繳': 12, '躉繳': 0 };
  let insurance = 0, annualPremium = 0;
  policies.forEach(p => {
    insurance += ovNum(p.currentValue);
    if ((p.status || '有效') === '有效') annualPremium += ovNum(p.premium) * (freqTimes[p.paymentFrequency] ?? 1);
  });

  // 被動收入（股利＋媽的永豐股利＋借券），依民國年
  const passive = new Map();
  const addPassive = (yr, field, amt) => {
    if (!yr || !amt) return;
    if (!passive.has(yr)) passive.set(yr, { year: yr, dividend: 0, yf: 0, lending: 0 });
    passive.get(yr)[field] += amt;
  };
  try {
    getFullAssetYearlyDividendSummary().forEach(r => { if (/^\d{2,3}$/.test(r.rawKey)) addPassive(r.rawKey, 'dividend', ovNum(r.totalAmount)); });
  } catch (e) { /* 股票管理還沒載入 */ }
  try {
    getLendingYearlyTotals().forEach(r => addPassive(String(r.year), 'lending', ovNum(r.amount)));
  } catch (e) { /* 略過 */ }
  try {
    if (typeof computeYfDividendDistribution === 'function') computeYfDividendDistribution();
    (typeof yfDividendRows !== 'undefined' ? yfDividendRows : []).forEach(r => {
      const d = yfParseDateInt(r.exDate);
      if (d !== 99999999) addPassive(String(Math.floor(d / 10000) - 1911), 'yf', ovNum(r.divAmount));
    });
  } catch (e) { /* 略過 */ }
  const passiveYears = Array.from(passive.values()).sort((a, b) => Number(a.year) - Number(b.year));
  const thisRoc = String(new Date().getFullYear() - 1911);
  const thisYear = passive.get(thisRoc) || { dividend: 0, yf: 0, lending: 0 };

  const total = cashTwd + cashUsdTwd + stockValue + insurance;
  return {
    rate, colRate, hasFinance, financeDate: hasFinance ? fs.dates[col] : '',
    cashTwd, cashUsd, cashUsdTwd, cashAccounts, badDebt, badDebts,
    stockValue, stockCost, usStockValue, accounts, holdings, yfShares, yfValue,
    insurance, annualPremium, policies,
    finStockVal, finIns,
    passiveYears, thisRoc, thisYear,
    total,
    foreignRatio: total > 0 ? (cashUsdTwd + usStockValue) / total : 0
  };
}

/* ---------- 2. 每月紀錄 ---------- */
function ovLoadMonthly() {
  try { return JSON.parse(localStorage.getItem(OV_MONTHLY_KEY)) || { months: {} }; } catch (e) { return { months: {} }; }
}
function ovSaveMonthlyLocal(store) {
  try { localStorage.setItem(OV_MONTHLY_KEY, JSON.stringify(store)); } catch (e) { /* 略過 */ }
}
function ovRecordFrom(calc) {
  return {
    month: ovMonthKey(), savedAt: new Date().toISOString(), usdRate: calc.rate,
    cashTwd: Math.round(calc.cashTwd), cashUsd: Math.round(calc.cashUsd * 100) / 100, cashUsdTwd: Math.round(calc.cashUsdTwd),
    stockValue: Math.round(calc.stockValue), stockCost: Math.round(calc.stockCost),
    insurance: Math.round(calc.insurance), badDebt: Math.round(calc.badDebt), total: Math.round(calc.total),
    holdings: calc.holdings, yf: { s: calc.yfShares, v: Math.round(calc.yfValue) },
    finalized: false
  };
}
const OV_COMPARE_FIELDS = ['cashTwd', 'cashUsd', 'stockValue', 'stockCost', 'insurance', 'total'];
function ovSameNumbers(a, b) {
  return a && b && OV_COMPARE_FIELDS.every(f => a[f] === b[f]) && JSON.stringify(a.holdings) === JSON.stringify(b.holdings);
}
/* 兩份紀錄合併：同月份以「已固定」優先，其次取較新的 */
function ovMergeMonthly(a, b) {
  const out = { months: Object.assign({}, (a && a.months) || {}) };
  Object.entries((b && b.months) || {}).forEach(([k, rec]) => {
    const cur = out.months[k];
    if (!cur) { out.months[k] = rec; return; }
    if (rec.finalized && !cur.finalized) { out.months[k] = rec; return; }
    if (cur.finalized && !rec.finalized) return;
    if ((rec.savedAt || '') > (cur.savedAt || '')) out.months[k] = rec;
  });
  return out;
}

/* 把這個月的數字記下來（數字有變才存） */
function ovUpsertCurrentMonth(calc) {
  if (!(calc.total > 0)) return; // 還沒有任何資料（例如剛開啟、雲端還沒載入）就不記
  const store = ovLoadMonthly();
  const key = ovMonthKey();
  const rec = ovRecordFrom(calc);
  if (ovSameNumbers(store.months[key], rec)) return;
  store.months[key] = rec;
  ovSaveMonthlyLocal(store);
  ovScheduleCloudSave();
}

/* 過去月份還沒固定的，用月底收盤價重算股票現值後固定 */
async function ovFinalizePastMonths() {
  if (ovFinalizing) return false;
  ovFinalizing = true;
  let changed = false;
  try {
    const store = ovLoadMonthly();
    const nowKey = ovMonthKey();
    for (const [key, rec] of Object.entries(store.months)) {
      if (key >= nowKey || rec.finalized) continue;
      let prices = null;
      try {
        const res = await fetch(`data/month-end/${key}.json?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) prices = (await res.json()).p || null;
      } catch (e) { prices = null; }
      if (prices) {
        let stockValue = 0;
        (rec.holdings || []).forEach(h => {
          const p = h.c && ovNum(prices[h.c]);
          stockValue += p ? h.s * p * (h.us ? ovNum(rec.usdRate) || 29 : 1) : ovNum(h.v);
        });
        const yfP = ovNum(prices[OV_YF_CODE]);
        stockValue += (rec.yf && rec.yf.s && yfP) ? rec.yf.s * yfP : ovNum(rec.yf && rec.yf.v);
        rec.stockValue = Math.round(stockValue);
        rec.total = rec.cashTwd + rec.cashUsdTwd + rec.stockValue + rec.insurance;
        rec.monthEndPriced = true;
      } else {
        rec.monthEndPriced = false; // 那個月 Action 沒有跑過，沿用當月最後記錄的數字
      }
      rec.finalized = true;
      rec.savedAt = new Date().toISOString();
      changed = true;
    }
    if (changed) { ovSaveMonthlyLocal(store); ovScheduleCloudSave(); }
  } finally {
    ovFinalizing = false;
  }
  return changed;
}

/* 找比較對象：上個月；沒有的話找最近一筆更早的月份 */
function ovFindCompareRecord() {
  const store = ovLoadMonthly();
  const nowKey = ovMonthKey();
  const keys = Object.keys(store.months).filter(k => k < nowKey).sort();
  if (!keys.length) return null;
  const key = keys[keys.length - 1];
  return { key, rec: store.months[key], isLastMonth: key === ovPrevMonthKey(nowKey) };
}

/* ---------- 3. 雲端 ---------- */
function ovDocRef() {
  if (typeof fbDb === 'undefined' || !fbDb || typeof fbUser === 'undefined' || !fbUser) return null;
  return fbDb.collection(OV_CLOUD_COLLECTION).doc(fbUser.uid);
}
async function ovLoadFromCloud() {
  const ref = ovDocRef();
  if (!ref) return;
  try {
    const snap = await ref.get();
    const cloud = snap.exists ? { months: snap.data().months || {} } : { months: {} };
    ovSaveMonthlyLocal(ovMergeMonthly(ovLoadMonthly(), cloud));
    ovCloudLoaded = true;
    await ovPushToCloud();
  } catch (e) {
    console.warn('讀取資產總覽每月紀錄失敗', e);
  }
}
async function ovPushToCloud() {
  const ref = ovDocRef();
  if (!ref || !ovCloudLoaded) return;
  try {
    // 先讀雲端再合併，避免蓋掉另一台裝置記的月份
    const snap = await ref.get();
    const merged = ovMergeMonthly(snap.exists ? { months: snap.data().months || {} } : { months: {} }, ovLoadMonthly());
    ovSaveMonthlyLocal(merged);
    await ref.set({ months: merged.months, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('資產總覽每月紀錄同步失敗', e);
    const hint = (e && e.code === 'permission-denied') ? '（Firebase 規則尚未開放 overviewMonthly）' : '';
    if (typeof showToast === 'function') showToast('⚠️ 資產總覽每月紀錄雲端同步失敗' + hint + '，本機已儲存', 'error');
  }
}
function ovScheduleCloudSave() {
  if (typeof fbUser === 'undefined' || !fbUser || !ovCloudLoaded) return;
  clearTimeout(ovCloudSaveTimer);
  ovCloudSaveTimer = setTimeout(ovPushToCloud, 3000);
}
if (typeof fbAuth !== 'undefined' && fbAuth) {
  fbAuth.onAuthStateChanged(async (user) => {
    if (!user) { ovCloudLoaded = false; return; }
    await ovLoadFromCloud();
    // 其他分頁的雲端資料讀完後再重算一次
    setTimeout(() => { if (ovIsVisible()) renderOverview(); }, 2500);
  });
}

/* ---------- 4. 畫面 ---------- */
function ovIsVisible() {
  const el = document.getElementById('overviewView');
  return !!el && el.style.display !== 'none';
}

function ovDeltaHtml(now, prev, fmt) {
  if (prev === undefined || prev === null) return '';
  const d = ovNum(now) - ovNum(prev);
  const cls = Math.round(d) === 0 ? 'ov-flat' : (d > 0 ? 'ov-up' : 'ov-down');
  const pct = ovNum(prev) !== 0 ? `（${d >= 0 ? '+' : '-'}${Math.abs(d / prev * 100).toFixed(1)}%）` : '';
  return `<div class="ov-delta ${cls}">比上月 ${ovSigned(d, fmt)}${Math.round(d) === 0 ? '' : pct}</div>`;
}

function ovNotesHtml(calc) {
  const notes = [];
  if (!calc.hasFinance) notes.push('財務總覽還沒有任何日期欄位，現金暫時以 0 計算');
  const ds = calc.stockValue - calc.finStockVal;
  if (calc.hasFinance && Math.abs(ds) >= 1) notes.push(`股票用股票管理的最新股價計算，比財務總覽${ds > 0 ? '多' : '少'} ${ovMoney(Math.abs(ds))}`);
  const di = calc.insurance - calc.finIns;
  if (calc.hasFinance && Math.abs(di) >= 1) notes.push(`保險用保險總覽的現值計算，比財務總覽${di > 0 ? '多' : '少'} ${ovMoney(Math.abs(di))}`);
  if (calc.cashUsd && Math.abs(calc.rate - calc.colRate) > 1e-9) {
    const dr = calc.cashUsd * (calc.rate - calc.colRate);
    notes.push(`美元現金用匯率 ${calc.rate} 換算，財務總覽這欄是 ${calc.colRate}，台幣${dr > 0 ? '多' : '少'} ${ovMoney(Math.abs(dr))}`);
  }
  return notes.length ? `<div class="ov-note">ⓘ ${notes.map(ovEsc).join('；')}</div>` : '';
}

function renderOverview() {
  const root = document.getElementById('overviewContent');
  if (!root) return;
  const calc = ovComputeNow();
  ovLastCalc = calc;
  ovLastRenderedAt = new Date();
  ovUpsertCurrentMonth(calc);

  const cmp = ovFindCompareRecord();
  const prev = cmp ? cmp.rec : null;
  const cmpLabel = cmp ? (cmp.isLastMonth ? '上月' : ovMonthLabel(cmp.key)) : '';
  const delta = (now, field, fmt = ovMoney) => prev ? ovDeltaHtml(now, prev[field], fmt).replace('比上月', '比' + cmpLabel) : '';

  const profit = calc.stockValue - calc.stockCost;
  const roi = calc.stockCost > 0 ? profit / calc.stockCost : 0;
  const ty = calc.thisYear;
  const passiveTotal = ty.dividend + ty.yf + ty.lending;
  const stamp = ovLastRenderedAt.toLocaleString('zh-TW', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  const cmpInfo = cmp
    ? `<span class="ov-sub">增減比較對象：${ovMonthLabel(cmp.key)} 月底${cmp.rec.monthEndPriced === false ? '（當月最後記錄）' : ''}</span>`
    : `<span class="ov-sub">從下個月開始會顯示「比上月」增減（這個月的數字已自動記錄）</span>`;

  const k = (label, value, sub, extra = '') => `
    <div class="ov-kpi">
      <div class="ov-kpi-label">${label}</div>
      <div class="ov-kpi-value">${value}</div>
      ${sub ? `<div class="ov-kpi-sub">${sub}</div>` : ''}
      ${extra}
    </div>`;

  const accRows = calc.accounts.map(a => `
      <tr><td>${ovEsc(a.name)}<span class="ov-muted">（${a.count} 檔）</span></td>
      <td class="r">${ovMoney(a.value)}</td><td class="r">${ovMoney(a.cost)}</td>
      <td class="r ${a.value - a.cost >= 0 ? 'ov-up' : 'ov-down'}">${ovSigned(a.value - a.cost, ovMoney)}</td></tr>`).join('');
  const stockItemRows = calc.accounts.map(a => a.items.map(it => `
      <tr><td>${ovEsc(it.name)}${it.code ? ` <span class="ov-muted">${ovEsc(it.code)}</span>` : ''}</td><td class="ov-muted">${ovEsc(a.name)}</td>
      <td class="r">${ovMoney(it.value)}</td><td class="r">${ovMoney(it.cost)}</td></tr>`).join('')).join('');
  const cashRows = calc.cashAccounts.map(c => `
      <tr><td>${ovEsc(c.name)}</td><td class="r">${c.usd !== null ? ovUsd(c.usd) : '—'}</td><td class="r">${ovMoney(c.twd)}</td></tr>`).join('');
  const insRows = calc.policies.map(p => `
      <tr><td>${ovEsc(p.name || '（未命名保單）')}</td><td>${ovEsc(p.status || '—')}</td>
      <td class="r">${p.premium ? ovMoney(p.premium) + ' / ' + ovEsc(p.paymentFrequency || '') : '—'}</td><td class="r">${ovMoney(p.currentValue)}</td></tr>`).join('');
  const badRows = calc.badDebts.map(b => `<tr><td>${ovEsc(b.name)}</td><td class="r">${ovMoney(b.twd)}</td></tr>`).join('');

  root.innerHTML = `
    <div class="ov-head">
      <div>
        <div class="ov-title">📊 資產總覽</div>
        <div class="ov-sub">最後更新 ${stamp}・美元匯率 ${calc.rate}${calc.financeDate ? `・現金取自財務總覽「${ovEsc(calc.financeDate)}」欄` : ''}</div>
      </div>
      <div class="ov-actions">
        <button class="btn btn-outline" id="ovRefreshBtn" onclick="refreshOverview()">🔄 更新</button>
        <button class="btn btn-outline" onclick="exportOverviewPdf()">📄 匯出 PDF</button>
      </div>
    </div>
    ${ovNotesHtml(calc)}
    <div class="ov-cmp-line">${cmpInfo}</div>

    <div class="ov-kpis ov-kpis-main">
      ${k('總資產（現值）', ovMoney(calc.total), `呆帳 ${ovMoney(calc.badDebt)} 另計，不列入`, delta(calc.total, 'total'))}
      ${k('現金・台幣', ovMoney(calc.cashTwd), `佔 ${ovPct(calc.total ? calc.cashTwd / calc.total : 0)}`, delta(calc.cashTwd, 'cashTwd'))}
      ${k('現金・美元', ovUsd(calc.cashUsd), `約 ${ovMoney(calc.cashUsdTwd)}`, delta(calc.cashUsd, 'cashUsd', ovUsd))}
      ${k('股票現值', ovMoney(calc.stockValue), `佔 ${ovPct(calc.total ? calc.stockValue / calc.total : 0)}`, delta(calc.stockValue, 'stockValue'))}
      ${k('股票成本', ovMoney(calc.stockCost), `未實現 <span class="${profit >= 0 ? 'ov-up' : 'ov-down'}">${ovSigned(profit, ovMoney)}（${roi >= 0 ? '+' : ''}${(roi * 100).toFixed(1)}%）</span>`, delta(calc.stockCost, 'stockCost'))}
      ${k('保險現值', ovMoney(calc.insurance), `有效保單年繳保費 ${ovMoney(calc.annualPremium)}`, delta(calc.insurance, 'insurance'))}
      ${k(`${calc.thisRoc} 年被動收入`, ovMoney(passiveTotal), `股利 ${ovMoney(ty.dividend + ty.yf)}・借券 ${ovMoney(ty.lending)}`)}
      ${k('外幣佔比', ovPct(calc.foreignRatio), `美元現金＋美股 ${ovMoney(calc.cashUsdTwd + calc.usStockValue)}`)}
    </div>

    <div class="ov-grid">
      <div class="ov-card"><div class="ov-card-title">資產配置</div><div class="ov-chart ov-chart-pie"><canvas id="ovPieChart"></canvas></div></div>
      <div class="ov-card"><div class="ov-card-title">股票配置（依證券帳戶）</div><div class="ov-chart" style="height:${Math.max(160, calc.accounts.length * 46 + 50)}px"><canvas id="ovAccountChart"></canvas></div></div>
      <div class="ov-card ov-card-wide"><div class="ov-card-title">每年被動收入（股利・媽的永豐股利・借券）</div><div class="ov-chart"><canvas id="ovPassiveChart"></canvas></div></div>
    </div>

    <div class="ov-card">
      <div class="ov-card-title">各類明細</div>
      <details class="ov-detail"><summary><span>現金・銀行帳戶（${calc.cashAccounts.length} 個）</span><span class="ov-muted">財務總覽最新一欄</span><b>${ovMoney(calc.cashTwd + calc.cashUsdTwd)}</b></summary>
        <table class="ov-table"><tr><th>帳戶</th><th class="r">美元</th><th class="r">台幣</th></tr>${cashRows || '<tr><td colspan="3" class="ov-muted">沒有帳戶</td></tr>'}</table></details>
      <details class="ov-detail"><summary><span>股票（${calc.accounts.length} 個帳戶）</span><span class="ov-muted">股票管理</span><b>${ovMoney(calc.stockValue)}</b></summary>
        <table class="ov-table"><tr><th>證券帳戶</th><th class="r">現值</th><th class="r">成本</th><th class="r">損益</th></tr>${accRows || '<tr><td colspan="4" class="ov-muted">沒有持股</td></tr>'}</table>
        <table class="ov-table" style="margin-top:10px"><tr><th>持股</th><th>帳戶</th><th class="r">現值</th><th class="r">成本</th></tr>${stockItemRows}</table></details>
      <details class="ov-detail"><summary><span>保險（${calc.policies.length} 張）</span><span class="ov-muted">保險總覽</span><b>${ovMoney(calc.insurance)}</b></summary>
        <table class="ov-table"><tr><th>保單</th><th>狀態</th><th class="r">保費</th><th class="r">現值</th></tr>${insRows || '<tr><td colspan="4" class="ov-muted">沒有保單</td></tr>'}</table></details>
      <details class="ov-detail"><summary><span class="ov-muted">呆帳（不列入總資產）</span><span class="ov-muted">財務總覽</span><b class="ov-muted">${ovMoney(calc.badDebt)}</b></summary>
        <table class="ov-table">${badRows || '<tr><td class="ov-muted">沒有呆帳</td></tr>'}</table></details>
    </div>`;

  ovDrawCharts(calc);
}

function ovDrawCharts(calc) {
  if (typeof Chart === 'undefined') return;
  Object.values(ovCharts).forEach(c => { try { c.destroy(); } catch (e) { /* 略過 */ } });
  ovCharts = {};
  const css = getComputedStyle(document.documentElement);
  const textColor = (css.getPropertyValue('--text-main') || '#3c362e').trim();
  const mutedColor = (css.getPropertyValue('--text-muted') || '#93897a').trim();
  const gridColor = 'rgba(118,108,90,0.15)';
  const C = { cashTwd: '#7d9a8c', cashUsd: '#a9c2b6', stock: '#b08d57', insurance: '#8a93a8', cost: '#ddd5c4', div: '#b08d57', yf: '#d9b98a', lend: '#7d9a8c' };
  const money = v => 'NT$' + Math.round(v).toLocaleString('zh-TW');
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  const pieEl = document.getElementById('ovPieChart');
  if (pieEl) {
    const parts = [['現金・台幣', calc.cashTwd, C.cashTwd], ['現金・美元', calc.cashUsdTwd, C.cashUsd], ['股票', calc.stockValue, C.stock], ['保險', calc.insurance, C.insurance]].filter(p => p[1] > 0);
    ovCharts.pie = new Chart(pieEl, {
      type: 'doughnut',
      data: { labels: parts.map(p => p[0]), datasets: [{ data: parts.map(p => Math.round(p[1])), backgroundColor: parts.map(p => p[2]), borderWidth: 2, borderColor: '#fdfbf7' }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '58%',
        plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 12, padding: 10,
          generateLabels: ch => ch.data.labels.map((l, i) => ({ text: `${l} ${calc.total ? (ch.data.datasets[0].data[i] / calc.total * 100).toFixed(1) : 0}%`, fillStyle: ch.data.datasets[0].backgroundColor[i], strokeStyle: 'transparent', fontColor: textColor, index: i })) } },
          tooltip: { callbacks: { label: c => `${c.label}：${money(c.raw)}` } } } }
    });
  }

  const accEl = document.getElementById('ovAccountChart');
  if (accEl) {
    ovCharts.acc = new Chart(accEl, {
      type: 'bar',
      data: { labels: calc.accounts.map(a => a.name), datasets: [
        { label: '現值', data: calc.accounts.map(a => Math.round(a.value)), backgroundColor: C.stock, borderRadius: 3 },
        { label: '成本', data: calc.accounts.map(a => Math.round(a.cost)), backgroundColor: C.cost, borderRadius: 3 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: textColor, boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}：${money(c.raw)}` } } },
        scales: { x: { ticks: { color: mutedColor, callback: v => (v / 10000).toLocaleString('zh-TW') + '萬' }, grid: { color: gridColor } },
                  y: { ticks: { color: textColor }, grid: { display: false } } } }
    });
  }

  const pEl = document.getElementById('ovPassiveChart');
  if (pEl) {
    const ys = calc.passiveYears.slice(-8);
    ovCharts.passive = new Chart(pEl, {
      type: 'bar',
      data: { labels: ys.map(y => y.year + (y.year === calc.thisRoc ? '（至今）' : '')), datasets: [
        { label: '股利', data: ys.map(y => Math.round(y.dividend)), backgroundColor: C.div, stack: 's' },
        { label: '媽的永豐股利', data: ys.map(y => Math.round(y.yf)), backgroundColor: C.yf, stack: 's' },
        { label: '借券', data: ys.map(y => Math.round(y.lending)), backgroundColor: C.lend, stack: 's' }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: textColor, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}：${money(c.raw)}`,
            footer: items => '合計：' + money(items.reduce((s, i) => s + i.raw, 0)) } } },
        scales: { x: { stacked: true, ticks: { color: textColor }, grid: { display: false } },
                  y: { stacked: true, ticks: { color: mutedColor, callback: v => (v / 10000).toLocaleString('zh-TW') + '萬' }, grid: { color: gridColor } } } }
    });
  }
}

/* 「🔄 更新」：登入時先從雲端拉最新資料，再重算 */
async function refreshOverview() {
  const btn = document.getElementById('ovRefreshBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 更新中…'; }
  try {
    if (typeof fbUser !== 'undefined' && fbUser) {
      const jobs = [];
      if (typeof loadFromCloud === 'function') jobs.push(loadFromCloud());
      if (typeof loadStockFromCloud === 'function') jobs.push(loadStockFromCloud());
      if (typeof loadInsuranceFromCloud === 'function') jobs.push(loadInsuranceFromCloud());
      jobs.push(ovLoadFromCloud());
      await Promise.allSettled(jobs);
    }
    await ovFinalizePastMonths();
    renderOverview();
    if (typeof showToast === 'function') showToast('📊 資產總覽已更新', 'success');
  } finally {
    const b = document.getElementById('ovRefreshBtn');
    if (b) { b.disabled = false; b.textContent = '🔄 更新'; }
  }
}

/* 進入分頁時呼叫：先畫，再補固定過去月份（有變動就重畫） */
function showOverview() {
  renderOverview();
  ovFinalizePastMonths().then(changed => { if (changed && ovIsVisible()) renderOverview(); });
}

/* 匯出 PDF：用瀏覽器的列印，選「另存為 PDF」。
   列印前把每張圖表轉成圖片（跟著紙張寬度縮放，不會跑版），印完再還原 */
function exportOverviewPdf() {
  document.querySelectorAll('#overviewView details.ov-detail').forEach(d => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
  Object.values(ovCharts).forEach(c => {
    try {
      const img = document.createElement('img');
      img.className = 'ov-print-img';
      img.src = c.toBase64Image('image/png', 1);
      c.canvas.parentNode.appendChild(img);
    } catch (e) { /* 略過 */ }
  });
  document.body.classList.add('ov-printing');
  const done = () => {
    document.body.classList.remove('ov-printing');
    document.querySelectorAll('#overviewView .ov-print-img').forEach(i => i.remove());
    document.querySelectorAll('#overviewView details.ov-detail').forEach(d => { d.open = d.dataset.wasOpen === '1'; });
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 150);
}
