/* ====== 🔄 更新股價（按了才更新，更新後仍可手動改市值） ======
   資料來源：GitHub Action（.github/workflows/prices.yml）每週一到週五 16:10
   自動去證交所、櫃買中心抓收盤價，存成本網站的 data/prices.json，這裡只讀這個檔案，
   不直接連證交所（避免被擋）。
   比對方式：用持股的「股票代號」對應。美股、沒填代號、找不到的持股維持原本的數字不動。
   更新內容：現價 + 市值（市值 = 收盤價 × 持有股數），跟手動改市值的結果一樣會存檔、同步雲端，
   也可以用「復原」(Ctrl+Z) 回到更新前。 */

/* 回傳 { '00878': { price: 35.34, date: '1151013' } }；讀不到回傳 null */
async function fetchTwPriceMap() {
  try {
    // 加上時間參數，避免瀏覽器拿到舊的快取檔案
    const res = await fetch('data/prices.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const prices = {};
    Object.entries((json && json.prices) || {}).forEach(([code, v]) => {
      const p = Number(v && v.p);
      if (p > 0) prices[String(code).trim().toUpperCase()] = { price: p, date: (v && v.d) || '' };
    });
    return Object.keys(prices).length ? prices : null;
  } catch (e) {
    console.warn('讀取 data/prices.json 失敗', e);
    return null;
  }
}

function formatRocDate(d) {
  const s = String(d || '');
  return /^\d{7}$/.test(s) ? `${s.slice(0, 3)}/${s.slice(3, 5)}/${s.slice(5, 7)}` : s;
}

async function updateStockPrices() {
  const btn = document.getElementById('btnUpdatePrices');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 抓取中…'; }
  try {
    const prices = await fetchTwPriceMap();
    if (!prices) {
      showToast('⚠️ 讀不到股價資料（data/prices.json），股價沒有變動。第一次使用請先到 GitHub Actions 手動執行「每日更新收盤價」', 'error');
      return;
    }

    let updated = 0;
    const missing = [];
    const dates = new Set();
    recordSnapshot();
    stocks.forEach(s => {
      if (s.archived || isUsStock(s)) return;
      const code = String(s.code || '').trim().toUpperCase();
      const hit = code && prices[code];
      if (!hit) { missing.push(s.name || code || '（未命名）'); return; }
      s.currentPrice = hit.price;
      s.marketVal = Math.round(hit.price * (Number(s.shares) || 0) * 100) / 100;
      if (hit.date) dates.add(hit.date);
      updated++;
    });

    if (updated === 0) {
      showToast('沒有找到可以更新的台股，請確認持股有填「股票代號」', 'error');
      return;
    }
    saveToStorage();
    renderTable();

    const dateText = dates.size ? `（收盤日 ${[...dates].map(formatRocDate).join('、')}）` : '';
    let msg = `✅ 已更新 ${updated} 檔股價${dateText}`;
    if (missing.length) msg += `；${missing.length} 檔沒找到，維持原本數字：${missing.slice(0, 5).join('、')}${missing.length > 5 ? '…' : ''}`;
    showToast(msg, 'success');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 更新股價'; }
  }
}
