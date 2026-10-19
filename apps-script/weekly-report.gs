/**
 * All-MoneyBook 每週資產週報（獨立新檔案，不影響原本的同步程式）
 *
 * 放法：Apps Script 左邊「檔案」旁按「＋」→「指令碼」→ 取名 WeeklyReport → 把這整份貼進去 → 存檔。
 * 它會借用「程式碼」檔案裡原本就有的 fetchFirestoreDoc 和 fsValueToJs，所以不用再設任何金鑰。
 *
 * 用法：
 *   1. 先執行 previewWeeklyReport：馬上寄一封【試寄】給自己，確認長相。
 *   2. 沒問題再執行 installWeeklyReportTrigger：從此每週日晚上 8 點（台北時間）自動寄。
 *   3. 想停止：執行 removeWeeklyReportTrigger。
 * 收件人預設 a2224907@gmail.com；想改，到「專案設定 → 指令碼屬性」新增 REPORT_EMAIL。
 * 提醒：專案時區要是 Asia/Taipei（專案設定 → 時區），不然「晚上 8 點」會差幾小時。
 */
const WR_APP_NAME = 'All-MoneyBook';
const WR_DEFAULT_EMAIL = 'a2224907@gmail.com';

function wrLoadMonths_() {
  const doc = fetchFirestoreDoc('overviewMonthly');
  return (doc && doc.fields && doc.fields.months) ? fsValueToJs(doc.fields.months) : {};
}

// 股票管理（持股、歷史股利、借券、媽的永豐）；讀不到就回傳 null，週報會少那兩張圖但照常寄出
function wrLoadStock_() {
  try {
    const doc = fetchFirestoreDoc('stockAssets');
    return doc && doc.fields ? fsValueToJs({ mapValue: { fields: doc.fields } }) : null;
  } catch (e) { Logger.log('讀取股票管理失敗：' + e); return null; }
}
// ===== 以下是週報的排版（兩個 App 共用同一套，只有最上面的「讀資料」不同）=====
// 數字來源：Firebase 的 overviewMonthly（每次打開「全部資產一覽」分頁就會自動更新的每月紀錄）。
// 所以信裡的數字 = 你最後一次打開那個分頁時的數字，信上會註明更新時間。

function wrEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function wrN_(x) { const n = Number(x); return isNaN(n) ? 0 : n; }
function wrMoney_(x) { return 'NT$' + Math.round(wrN_(x)).toLocaleString('en-US'); }
function wrUsd_(x) { return 'US$' + wrN_(x).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function wrSigned_(d, fmt) { return (d > 0 ? '+' : d < 0 ? '-' : '') + fmt(Math.abs(d)); }
function wrPct_(x) { return (x * 100).toFixed(1) + '%'; }
function wrMonthLabel_(k) { const p = String(k).split('-'); return p[0] + ' 年 ' + Number(p[1]) + ' 月'; }
function wrTaipei_(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
}


// ===== 從「股票管理」整理出：股票配置（依證券帳戶）與每年被動收入 =====
function wrIsUs_(s) { return !!s && (s.account === '美股複委託' || s.category === '美股'); }
function wrRocYear_(y) {
  if (!y) return '其他';
  const s = String(y).trim();
  if (s.indexOf('-') >= 0) return s;
  let n = parseInt(s, 10);
  if (isNaN(n)) return s;
  if (n > 1900) n -= 1911;
  return String(n);
}
function wrDateInt_(val) { // 同網頁 yfParseDateInt：民國或西元日期 → 西元 yyyymmdd，看不懂回 99999999
  if (!val) return 99999999;
  const str = String(val).trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return parseInt(m[1] + m[2] + m[3], 10);
  const d = str.replace(/[^0-9]/g, '');
  if (d.length >= 8 && d.indexOf('20') === 0) return parseInt(d.substring(0, 8), 10);
  if (d.length === 7 || d.length === 6) return parseInt((parseInt(d.substring(0, d.length - 4), 10) + 1911) + d.substring(d.length - 4), 10);
  return 99999999;
}
function wrStockAccounts_(sd, rate) {
  const map = {}, order = [];
  ((sd && sd.stocks) || []).forEach(s => {
    const fx = wrIsUs_(s) ? rate : 1;
    const acc = s.account || '未分類';
    if (!map[acc]) { map[acc] = { name: acc, value: 0, cost: 0 }; order.push(acc); }
    map[acc].value += wrN_(s.shares) * wrN_(s.currentPrice) * fx;
    map[acc].cost += wrN_(s.totalCost) * fx;
  });
  const yfO = (sd && sd.yfOverview) || {};
  const yfV = wrN_(yfO.currentValue), yfC = wrN_(yfO.appCost);
  const yfS = ((sd && sd.yfDetail) || []).reduce((t, r) => t + wrN_(r.shares), 0);
  if (yfV || yfC || yfS) map['媽的永豐'] = { name: '媽的永豐', value: yfV, cost: yfC };
  return Object.keys(map).map(k => map[k]).sort((a, b) => b.value - a.value);
}
function wrPassive_(sd, rate) {
  const by = {};
  const add = (yr, field, amt) => {
    if (!yr || !amt) return;
    if (!by[yr]) by[yr] = { year: yr, dividend: 0, yf: 0, lending: 0 };
    by[yr][field] += amt;
  };
  if (!sd) return [];
  (sd.pastColumns || []).forEach(col => {
    const k = wrRocYear_(col.year);
    if (/^\d{2,3}$/.test(k)) add(k, 'dividend', (col.items || []).reduce((t, it) => t + wrN_(it.amount), 0));
  });
  (sd.stocks || []).forEach(st => {
    const fx = wrIsUs_(st) ? rate : 1;
    (st.dividendHistory || []).forEach(dh => {
      const k = wrRocYear_(dh.year);
      if (/^\d{2,3}$/.test(k)) add(k, 'dividend', wrN_(dh.cash) * fx);
    });
  });
  // 借券：有明細的年度以明細加總（實際收入＝收入－手續費），否則用手動記錄的年度數字
  const auto = {};
  (sd.lendingIncomeRows || []).forEach(r => {
    const d = String((r && r.paymentDate) || '').replace(/[^0-9]/g, '');
    const y = d.length === 7 ? d.slice(0, 3) : d.length === 6 ? d.slice(0, 2) : null;
    if (y) auto[y] = (auto[y] || 0) + wrN_(r.income) - wrN_(r.serviceFee);
  });
  const manual = sd.lendingIncomeManualYearly || {};
  Object.keys(manual).forEach(y => { if (auto[y] === undefined) add(String(y), 'lending', wrN_(manual[y])); });
  Object.keys(auto).forEach(y => add(y, 'lending', auto[y]));
  // 媽的永豐股利：除息日當時持有的股數 × 每股現金股利
  const detail = sd.yfDetail || [];
  (sd.yfDividendRows || []).forEach(r => {
    const ex = wrDateInt_(r.exDate);
    if (ex === 99999999) return;
    let sh = 0;
    detail.forEach(d => { if (wrDateInt_(d.date) < ex) sh += wrN_(d.shares); });
    add(String(Math.floor(ex / 10000) - 1911), 'yf', Math.round(wrN_(r.cashPerShare) * sh));
  });
  return Object.keys(by).map(k => by[k]).sort((a, b) => Number(a.year) - Number(b.year));
}

// ===== 畫圖：用 Apps Script 內建的圖表服務畫成圖片，再嵌進信裡 =====
// 任何一張圖畫失敗都只會少那一張，不會讓整封信寄不出去
function wrTable_(cols, rows) {
  const b = Charts.newDataTable();
  cols.forEach(c => b.addColumn(c[0] === 's' ? Charts.ColumnType.STRING : Charts.ColumnType.NUMBER, c[1]));
  rows.forEach(r => b.addRow(r));
  return b.build();
}
function wrSafe_(name, fn) {
  try { return fn(); } catch (e) { Logger.log('圖表「' + name + '」畫失敗，已略過：' + e); return null; }
}
const WR_FONT = { pie: ['#7d9a8c', '#a9c2b6', '#b08d57', '#8a93a8'] };
function wrPieBlob_(parts, total) {
  return wrSafe_('資產配置', () => {
    const rows = parts.map(p => [p[0] + ' ' + wrPct_(total ? p[1] / total : 0), Math.round(p[1])]);
    return Charts.newPieChart().setDataTable(wrTable_([['s', '項目'], ['n', '金額']], rows))
      .setColors(parts.map(p => p[2])).setDimensions(560, 260)
      .setOption('pieHole', 0.55).setOption('legend.position', 'right').setOption('legend.textStyle.fontSize', 13)
      .setOption('pieSliceText', 'none').setOption('chartArea.width', '95%').setOption('chartArea.height', '90%')
      .build().getAs('image/png').setName('pie.png');
  });
}
function wrAccountBlob_(accounts) {
  return wrSafe_('股票配置', () => {
    if (!accounts.length) return null;
    const rows = accounts.map(a => [a.name, Math.round(a.value), Math.round(a.cost)]);
    return Charts.newBarChart().setDataTable(wrTable_([['s', '證券帳戶'], ['n', '現值'], ['n', '成本']], rows))
      .setColors(['#b08d57', '#ddd5c4']).setDimensions(560, Math.max(180, accounts.length * 56 + 70))
      .setOption('legend.position', 'top').setOption('hAxis.format', 'short').setOption('chartArea.left', 110)
      .build().getAs('image/png').setName('account.png');
  });
}
function wrPassiveBlob_(years, thisRoc) {
  return wrSafe_('被動收入', () => {
    if (!years.length) return null;
    const rows = years.map(y => [y.year + (y.year === thisRoc ? '（至今）' : ''), Math.round(y.dividend), Math.round(y.yf), Math.round(y.lending)]);
    return Charts.newColumnChart().setDataTable(wrTable_([['s', '年'], ['n', '股利'], ['n', '媽的永豐股利'], ['n', '借券']], rows))
      .setStacked().setColors(['#b08d57', '#d9b98a', '#7d9a8c']).setDimensions(560, 280)
      .setOption('legend.position', 'top').setOption('vAxis.format', 'short')
      .build().getAs('image/png').setName('passive.png');
  });
}
function wrTrendBlob_(keys, months) {
  return wrSafe_('總資產趨勢', () => {
    const ks = keys.slice(-12);
    if (ks.length < 2) return null;
    const rows = ks.map(k => [k, Math.round(wrN_((months[k] || {}).total))]);
    return Charts.newColumnChart().setDataTable(wrTable_([['s', '月份'], ['n', '總資產']], rows))
      .setColors(['#b08d57']).setDimensions(560, 240)
      .setOption('legend.position', 'none').setOption('vAxis.format', 'short')
      .build().getAs('image/png').setName('trend.png');
  });
}

// 增減小字（漲＝綠、跌＝紅，跟網頁一樣）
function wrDelta_(now, prev, fmt, label) {
  if (prev === undefined || prev === null) return '';
  const d = wrN_(now) - wrN_(prev);
  const flat = Math.round(d) === 0;
  const color = flat ? '#93897a' : (d > 0 ? '#4a7c59' : '#b6533c');
  const pct = (!flat && wrN_(prev) !== 0) ? '（' + (d >= 0 ? '+' : '-') + Math.abs(d / prev * 100).toFixed(1) + '%）' : '';
  return '<div style="font-size:12px;color:' + color + ';margin-top:2px">比' + wrEsc_(label) + ' ' + wrSigned_(d, fmt) + pct + '</div>';
}

function wrKpi_(label, value, sub, extra) {
  return '<td valign="top" style="width:50%;padding:6px"><div style="background:#fdfbf7;border:1px solid #e8e0d0;border-radius:8px;padding:10px 12px">' +
    '<div style="font-size:12px;color:#93897a">' + label + '</div>' +
    '<div style="font-size:19px;font-weight:bold;color:#3c362e;margin-top:2px">' + value + '</div>' +
    (sub ? '<div style="font-size:12px;color:#93897a;margin-top:2px">' + sub + '</div>' : '') + (extra || '') + '</div></td>';
}

function wrBar_(label, value, total, color) {
  const p = total > 0 ? Math.max(0, value / total) : 0;
  const w = Math.max(p * 100, p > 0 ? 1 : 0);
  return '<tr><td style="padding:4px 0;font-size:13px;width:92px;color:#3c362e">' + label + '</td>' +
    '<td style="padding:4px 6px"><div style="background:#f1ece0;border-radius:4px"><div style="width:' + w.toFixed(1) + '%;height:14px;background:' + color + ';border-radius:4px"></div></div></td>' +
    '<td style="padding:4px 0;font-size:13px;text-align:right;width:150px;color:#3c362e">' + wrMoney_(value) + '（' + wrPct_(p) + '）</td></tr>';
}

function wrCard_(title, inner) {
  return '<div style="background:#fff;border:1px solid #e8e0d0;border-radius:10px;padding:14px 16px;margin:12px 0">' +
    '<div style="font-size:15px;font-weight:bold;color:#3c362e;margin-bottom:8px">' + title + '</div>' + inner + '</div>';
}

// months：overviewMonthly 的 months；stockDoc：stockAssets 文件（可為 null）；回傳 { subject, html, images }
function wrBuild_(months, stockDoc, appName) {
  const keys = Object.keys(months || {}).sort();
  if (!keys.length) {
    return { subject: '【' + appName + '週報】目前沒有任何每月紀錄',
      images: {}, html: '<p>Firebase 裡還沒有「全部資產一覽」的每月紀錄。請先在 ' + wrEsc_(appName) + ' 打開一次「全部資產一覽」分頁。</p>' };
  }
  const key = keys[keys.length - 1];
  const r = months[key] || {};
  const prevKey = keys.length > 1 ? keys[keys.length - 2] : null;
  const p = prevKey ? months[prevKey] : null;
  const label = prevKey ? '上月' : '';
  const dl = (now, f, fmt) => p ? wrDelta_(now, p[f], fmt || wrMoney_, label) : '';

  const total = wrN_(r.total);
  const profit = wrN_(r.stockValue) - wrN_(r.stockCost);
  const roi = wrN_(r.stockCost) > 0 ? profit / wrN_(r.stockCost) : 0;
  const usStock = (r.holdings || []).reduce((s, h) => s + (h && h.us ? wrN_(h.v) : 0), 0);
  const foreign = total > 0 ? (wrN_(r.cashUsdTwd) + usStock) / total : 0;
  const upColor = profit >= 0 ? '#4a7c59' : '#b6533c';

  // 資料新舊提醒
  const saved = r.savedAt ? wrTaipei_(r.savedAt) : '';
  const ageDays = r.savedAt ? (Date.now() - new Date(r.savedAt).getTime()) / 86400000 : 999;
  let stale = '';
  if (ageDays > 8) {
    stale = '<div style="background:#fff3e0;border:1px solid #f0c987;border-radius:8px;padding:8px 12px;margin:10px 0;font-size:13px;color:#8a5a00">' +
      '⚠️ 這份數字是 ' + wrEsc_(saved) + ' 記下的，已經超過一週沒更新。打開「全部資產一覽」分頁，數字就會更新。</div>';
  }

  const head = '<div style="font-size:20px;font-weight:bold;color:#3c362e">📊 全部資產一覽・' + wrEsc_(appName) + '週報</div>' +
    '<div style="font-size:12px;color:#93897a;margin-top:4px">' + wrMonthLabel_(key) + ' 的紀錄・數字更新於 ' + wrEsc_(saved || '不明') +
    '・美元匯率 ' + wrEsc_(r.usdRate || '') + '</div>' +
    '<div style="font-size:12px;color:#93897a;margin-top:2px">' +
    (prevKey ? '增減比較對象：' + wrMonthLabel_(prevKey) + ' 月底' + (p && p.monthEndPriced === false ? '（當月最後記錄）' : '')
             : '還沒有更早的月份，下個月起會顯示「比上月」增減') + '</div>' + stale;

  const kpis = '<table width="100%" cellspacing="0" cellpadding="0" style="margin:8px -6px;border-collapse:separate"><tr>' +
    wrKpi_('總資產（現值）', wrMoney_(total), '呆帳 ' + wrMoney_(r.badDebt) + ' 另計，不列入', dl(total, 'total')) +
    wrKpi_('現金・台幣', wrMoney_(r.cashTwd), '佔 ' + wrPct_(total ? wrN_(r.cashTwd) / total : 0), dl(r.cashTwd, 'cashTwd')) +
    '</tr><tr>' +
    wrKpi_('現金・美元', wrUsd_(r.cashUsd), '約 ' + wrMoney_(r.cashUsdTwd), dl(r.cashUsd, 'cashUsd', wrUsd_)) +
    wrKpi_('股票現值', wrMoney_(r.stockValue), '佔 ' + wrPct_(total ? wrN_(r.stockValue) / total : 0), dl(r.stockValue, 'stockValue')) +
    '</tr><tr>' +
    wrKpi_('股票成本', wrMoney_(r.stockCost), '未實現 <span style="color:' + upColor + '">' + wrSigned_(profit, wrMoney_) + '（' + (roi >= 0 ? '+' : '') + (roi * 100).toFixed(1) + '%）</span>', dl(r.stockCost, 'stockCost')) +
    wrKpi_('保險現值', wrMoney_(r.insurance), '', dl(r.insurance, 'insurance')) +
    '</tr><tr>' +
    wrKpi_('外幣佔比', wrPct_(foreign), '美元現金＋美股 ' + wrMoney_(wrN_(r.cashUsdTwd) + usStock), '') +
    '<td></td></tr></table>';

  const images = {};
  const rate = wrN_(r.usdRate) || 29;
  const parts = [['現金・台幣', wrN_(r.cashTwd), '#7d9a8c'], ['現金・美元', wrN_(r.cashUsdTwd), '#a9c2b6'], ['股票', wrN_(r.stockValue), '#b08d57'], ['保險', wrN_(r.insurance), '#8a93a8']].filter(x => x[1] > 0);
  const img = (cid, blob, alt) => { if (!blob) return ''; images[cid] = blob; return '<img src="cid:' + cid + '" alt="' + alt + '" style="width:100%;max-width:560px;display:block;margin:0 auto">'; };
  const pieImg = img('pie', wrPieBlob_(parts, total), '資產配置');
  const alloc = wrCard_('資產配置', pieImg || ('<table width="100%" cellspacing="0" cellpadding="0">' +
    wrBar_('現金・台幣', wrN_(r.cashTwd), total, '#7d9a8c') +
    wrBar_('現金・美元', wrN_(r.cashUsdTwd), total, '#a9c2b6') +
    wrBar_('股票', wrN_(r.stockValue), total, '#b08d57') +
    wrBar_('保險', wrN_(r.insurance), total, '#8a93a8') + '</table>'));

  // 股票配置（依證券帳戶）— 取自「股票管理」，用最新股價
  const accounts = wrStockAccounts_(stockDoc, rate);
  let accCard = '';
  if (accounts.length) {
    const accRows = accounts.map(a => {
      const pl = a.value - a.cost;
      return '<tr><td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px">' + wrEsc_(a.name) + '</td>' +
        '<td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px;text-align:right">' + wrMoney_(a.value) + '</td>' +
        '<td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px;text-align:right">' + wrMoney_(a.cost) + '</td>' +
        '<td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px;text-align:right;color:' + (pl >= 0 ? '#4a7c59' : '#b6533c') + '">' + wrSigned_(pl, wrMoney_) + '</td></tr>';
    }).join('');
    accCard = wrCard_('股票配置（依證券帳戶）',
      img('account', wrAccountBlob_(accounts), '股票配置') +
      '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px"><tr style="color:#93897a;font-size:12px"><td>證券帳戶</td><td style="text-align:right">現值</td><td style="text-align:right">成本</td><td style="text-align:right">損益</td></tr>' + accRows + '</table>');
  }

  // 每年被動收入（股利＋媽的永豐股利＋借券）
  const thisRoc = String(new Date().getFullYear() - 1911);
  const passiveYears = wrPassive_(stockDoc, rate);
  let passiveCard = '';
  if (passiveYears.length) {
    const ty = passiveYears.filter(y => y.year === thisRoc)[0] || { dividend: 0, yf: 0, lending: 0 };
    const tyTotal = ty.dividend + ty.yf + ty.lending;
    passiveCard = wrCard_('每年被動收入（股利・媽的永豐股利・借券）',
      '<div style="font-size:13px;color:#3c362e;margin-bottom:6px">' + thisRoc + ' 年至今：<b>' + wrMoney_(tyTotal) + '</b>（股利 ' + wrMoney_(ty.dividend + ty.yf) + '・借券 ' + wrMoney_(ty.lending) + '）</div>' +
      img('passive', wrPassiveBlob_(passiveYears.slice(-8), thisRoc), '每年被動收入'));
  }

  // 持股（記錄當時的股數和現值，依現值由大到小）
  const hs = (r.holdings || []).filter(h => h && (h.c || wrN_(h.v))).slice().sort((a, b) => wrN_(b.v) - wrN_(a.v));
  let holdRows = hs.map(h =>
    '<tr><td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px">' + wrEsc_(h.c || '—') + (h.us ? ' <span style="color:#93897a;font-size:11px">美股</span>' : '') + '</td>' +
    '<td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px;text-align:right">' + wrN_(h.s).toLocaleString('en-US') + ' 股</td>' +
    '<td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px;text-align:right">' + wrMoney_(h.v) + '</td></tr>').join('');
  if (r.yf && (wrN_(r.yf.v) || wrN_(r.yf.s))) {
    holdRows += '<tr><td style="padding:5px 0;font-size:13px">媽的永豐 <span style="color:#93897a;font-size:11px">00878</span></td>' +
      '<td style="padding:5px 0;font-size:13px;text-align:right">' + wrN_(r.yf.s).toLocaleString('en-US') + ' 股</td>' +
      '<td style="padding:5px 0;font-size:13px;text-align:right">' + wrMoney_(r.yf.v) + '</td></tr>';
  }
  const holdings = holdRows ? wrCard_('持股明細（' + hs.length + (r.yf && wrN_(r.yf.v) ? ' 檔＋媽的永豐' : ' 檔') + '）',
    '<table width="100%" cellspacing="0" cellpadding="0"><tr style="color:#93897a;font-size:12px"><td>代號</td><td style="text-align:right">股數</td><td style="text-align:right">現值</td></tr>' + holdRows + '</table>') : '';

  // 最近 6 個月總資產
  const recent = keys.slice(-6).reverse();
  const trendRows = recent.map((k, i) => {
    const m = months[k] || {};
    const before = months[keys[keys.indexOf(k) - 1]];
    const d = before ? wrN_(m.total) - wrN_(before.total) : null;
    const c = d === null ? '#93897a' : (Math.round(d) === 0 ? '#93897a' : d > 0 ? '#4a7c59' : '#b6533c');
    return '<tr><td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px">' + k + (i === 0 ? ' <span style="color:#93897a;font-size:11px">（本月）</span>' : '') + '</td>' +
      '<td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px;text-align:right">' + wrMoney_(m.total) + '</td>' +
      '<td style="padding:5px 0;border-bottom:1px solid #f1ece0;font-size:13px;text-align:right;color:' + c + '">' + (d === null ? '—' : wrSigned_(d, wrMoney_)) + '</td></tr>';
  }).join('');
  const trend = wrCard_('最近幾個月的總資產',
    img('trend', wrTrendBlob_(keys, months), '總資產趨勢') +
    '<table style="margin-top:8px" width="100%" cellspacing="0" cellpadding="0"><tr style="color:#93897a;font-size:12px"><td>月份</td><td style="text-align:right">總資產</td><td style="text-align:right">比前一個月</td></tr>' + trendRows + '</table>');

  const foot = '<div style="font-size:11px;color:#93897a;margin-top:14px;line-height:1.6">' +
    '這封信由 Apps Script 每週日晚上 8 點自動寄出。上方數字取自「全部資產一覽」的每月紀錄；股票配置與被動收入取自「股票管理」最新資料，可能和上方數字有小差異。<br>' +
    '銀行帳戶、保單的詳細明細，請打開網頁的「全部資產一覽」分頁查看。</div>';

  const html = '<div style="font-family:-apple-system,\'Noto Sans TC\',\'Microsoft JhengHei\',sans-serif;max-width:640px;margin:0 auto;padding:12px;background:#f7f3ea;color:#3c362e">' +
    head + kpis + alloc + accCard + passiveCard + holdings + trend + foot + '</div>';
  const dsub = p ? '（' + wrSigned_(total - wrN_(p.total), wrMoney_) + '）' : '';
  return { subject: '【' + appName + '週報】總資產 ' + wrMoney_(total) + dsub, html: html, images: images };
}

// ===== 寄信、試寄、排程 =====
function wrRecipient_() {
  return (PropertiesService.getScriptProperties().getProperty('REPORT_EMAIL') || WR_DEFAULT_EMAIL).trim();
}

// 每週日 20:00 自動執行的就是這個
function sendWeeklyReport() {
  const rep = wrBuild_(wrLoadMonths_(), wrLoadStock_(), WR_APP_NAME);
  MailApp.sendEmail({ to: wrRecipient_(), subject: rep.subject, htmlBody: rep.html, inlineImages: rep.images, name: WR_APP_NAME + ' 週報' });
}

// 試寄：主旨前面加【試寄】，寄給「正在執行的這個 Google 帳號」自己（不會寄給正式收件人）
function previewWeeklyReport() {
  const rep = wrBuild_(wrLoadMonths_(), wrLoadStock_(), WR_APP_NAME);
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: me, subject: '【試寄】' + rep.subject, htmlBody: rep.html, inlineImages: rep.images, name: WR_APP_NAME + ' 週報' });
  Logger.log('已試寄到 ' + me);
}

// 設定排程：每週日晚上 8 點（會先清掉舊的，重複執行不會寄兩封）
function installWeeklyReportTrigger() {
  removeWeeklyReportTrigger();
  ScriptApp.newTrigger('sendWeeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).nearMinute(0).create();
  Logger.log('已設定：每週日 20:00 寄給 ' + wrRecipient_() + '（專案時區：' + Session.getScriptTimeZone() + '）');
}
function removeWeeklyReportTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sendWeeklyReport').forEach(t => ScriptApp.deleteTrigger(t));
}
