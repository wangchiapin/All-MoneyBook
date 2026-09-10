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
  tipsWidgetIndex = (tipsWidgetIndex + 1) % tipsWidgetCards.length;
  tipsWidgetRenderCurrent();
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
  tipsWidgetIndex = 0;
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
