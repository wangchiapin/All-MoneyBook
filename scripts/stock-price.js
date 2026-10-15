/* ====== 🔄 更新股價（按了才更新，更新後仍可手動改市值） ======
   資料來源：GitHub Action（.github/workflows/prices.yml）每週一到週五 16:10
   自動抓收盤價，存成本網站的 data/prices.json，這裡只讀這個檔案，不直接連外部網站：
     - 台股（上市、上櫃、ETF）：當天收盤價
     - 美股：data/us-symbols.txt 列的代號，前一個美股交易日的收盤價（美元）
   比對方式：用持股的「股票代號」對應（美股要填 BTI 這種代號）。沒填代號、找不到的維持原本數字不動。
   更新內容：
     - 各持股：現價 + 市值（市值 = 收盤價 × 持有股數；美股以美元存，畫面用「💵 美元匯率」換台幣）
     - 🌸 媽的永豐：現值 = 00878 收盤價 × 明細表的持有股數合計
   跟手動修改一樣會存檔、同步雲端，可以用「復原」(Ctrl+Z) 回到更新前，之後也仍可手動改。 */

const YF_STOCK_CODE = '00878'; // 媽的永豐固定只有這一支

/* 回傳 { '00878': { price, date, us:false }, 'BTI': { price, date, us:true } }；讀不到回傳 null */
async function fetchPriceMap() {
  try {
    // 加上時間參數，避免瀏覽器拿到舊的快取檔案
    const res = await fetch('data/prices.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const prices = {};
    Object.entries((json && json.prices) || {}).forEach(([code, v]) => {
      const p = Number(v && v.p);
      if (p > 0) prices[String(code).trim().toUpperCase()] = { price: p, date: (v && v.d) || '', us: !!(v && v.us) };
    });
    return Object.keys(prices).length ? prices : null;
  } catch (e) {
    console.warn('讀取 data/prices.json 失敗', e);
    return null;
  }
}

function formatPriceDate(d) {
  const s = String(d || '');
  if (/^\d{7}$/.test(s)) return `${s.slice(0, 3)}/${s.slice(3, 5)}/${s.slice(5, 7)}`; // 民國 1151015 → 115/10/15
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})$/);                                       // 美股 2026-10-14 → 10/14
  return m ? `${m[1]}/${m[2]}` : s;
}

async function updateStockPrices() {
  const btn = document.getElementById('btnUpdatePrices');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 更新中…'; }
  try {
    const prices = await fetchPriceMap();
    if (!prices) {
      showToast('⚠️ 讀不到股價資料（data/prices.json），股價沒有變動。第一次使用請先到 GitHub Actions 手動執行「每日更新收盤價」', 'error');
      return;
    }

    // 先找出要改的，確定有東西可改才記錄復原點
    const changes = [];
    const missing = [];
    stocks.forEach(s => {
      if (s.archived) return;
      const isUS = isUsStock(s);
      const code = String(s.code || '').trim().toUpperCase();
      const hit = code && prices[code];
      if (!hit || hit.us !== isUS) { missing.push(s.name || code || '（未命名）'); return; }
      changes.push({ s, hit, isUS });
    });

    const yfHit = prices[YF_STOCK_CODE];
    const yfShares = (yfDetail || []).reduce((sum, r) => sum + (Number(r.shares) || 0), 0);
    const yfNewValue = (yfHit && !yfHit.us && yfShares > 0) ? Math.round(yfHit.price * yfShares) : null;

    if (changes.length === 0 && yfNewValue === null) {
      showToast('沒有找到可以更新的持股，請確認持股有填「股票代號」', 'error');
      return;
    }

    recordSnapshot();
    const twDates = new Set(), usDates = new Set();
    let twCount = 0, usCount = 0;
    changes.forEach(({ s, hit, isUS }) => {
      s.currentPrice = hit.price;
      s.marketVal = Math.round(hit.price * (Number(s.shares) || 0) * 100) / 100;
      if (isUS) { usCount++; if (hit.date) usDates.add(hit.date); }
      else { twCount++; if (hit.date) twDates.add(hit.date); }
    });
    if (yfNewValue !== null) {
      yfOverview.currentValue = yfNewValue;
      if (yfHit.date) twDates.add(yfHit.date);
    }
    saveToStorage();
    renderTable();
    if (typeof renderYfOverview === 'function') renderYfOverview();

    const fmt = set => set.size ? `（${[...set].map(formatPriceDate).join('、')}）` : '';
    const parts = [];
    if (twCount) parts.push(`台股 ${twCount} 檔${fmt(twDates)}`);
    if (usCount) parts.push(`美股 ${usCount} 檔${fmt(usDates)}`);
    if (yfNewValue !== null) parts.push('媽的永豐現值');
    let msg = `✅ 已更新：${parts.join('、')}`;
    if (missing.length) msg += `；${missing.length} 檔沒找到，維持原本數字：${missing.slice(0, 5).join('、')}${missing.length > 5 ? '…' : ''}`;
    showToast(msg, 'success');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 更新股價'; }
  }
}
