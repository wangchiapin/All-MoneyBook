/* ====== 🔄 更新股價（按了才抓，抓完仍可手動改市值） ======
   來源：證交所 OpenAPI（上市股票與 ETF 的最近一個交易日收盤價），
         櫃買中心 OpenAPI（上櫃股票，抓不到就跳過）。
   比對方式：用持股的「股票代號」對應。美股、沒填代號、找不到的持股維持原本的數字不動。
   更新內容：現價 + 市值（市值 = 收盤價 × 持有股數），跟手動改市值的結果一樣會存檔、同步雲端，
   也可以用「復原」(Ctrl+Z) 回到更新前。 */

async function fetchTwPriceMap() {
  const prices = {};   // { '00878': { price: 35.34, date: '1151013' } }
  let ok = false;

  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
    const list = await res.json();
    if (Array.isArray(list)) {
      list.forEach(r => {
        const p = parseFloat(String(r.ClosingPrice || '').replace(/,/g, ''));
        if (r.Code && p > 0) prices[String(r.Code).trim().toUpperCase()] = { price: p, date: r.Date || '' };
      });
      ok = true;
    }
  } catch (e) {
    console.warn('證交所收盤價抓取失敗', e);
  }

  try {
    const res2 = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes');
    const list2 = await res2.json();
    if (Array.isArray(list2)) {
      list2.forEach(r => {
        const code = String(r.SecuritiesCompanyCode || r.Code || '').trim().toUpperCase();
        const p = parseFloat(String(r.Close || r.ClosingPrice || '').replace(/,/g, ''));
        if (code && p > 0 && !prices[code]) prices[code] = { price: p, date: r.Date || '' };
      });
      ok = true;
    }
  } catch (e) {
    // 上櫃來源抓不到就跳過，不影響上市資料
    console.warn('櫃買中心收盤價抓取失敗', e);
  }

  return ok ? prices : null;
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
      showToast('⚠️ 抓取失敗，連不上證交所網站，股價沒有變動', 'error');
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
