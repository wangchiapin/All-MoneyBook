/* ====================================================================
   手機版（螢幕寬度 ≤ 760px）的操作補強 —— 搭配 styles/mobile.css。
   電腦版不受影響：每個功能都先檢查 mbIsMobile()，不是手機就照原本的方式。
   原本的程式不用改：這裡用「包一層」的方式接在 renderTable（股票管理）、
   render（財務總覽）後面，原本的畫完之後，手機再做額外處理。

   做的事：
   - 標題列的 ⋯ 選單（匯率、同步狀態、登入收在裡面）
   - 股票管理：數字卡片「看更多」、工具列「⋯ 更多」、持股表格改成卡片，
     點卡片從下方滑出編輯面板（市值、成本、股數、出借張數）
   - 財務總覽：點左欄名稱叫出選單（改名、上移、下移、封存）；點數字格直接編輯；
     分區標題固定在左邊；一開始不自動打開趨勢圖
   ==================================================================== */

const MB_QUERY = window.matchMedia('(max-width: 760px)');
function mbIsMobile() { return MB_QUERY.matches; }

function mbEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function mbFmt(n, d = 0) {
  return (Number(n) || 0).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/* ---------- 標題列 ⋯ 選單 ---------- */
function mbToggleHeaderMenu(e) {
  if (e) e.stopPropagation();
  const header = document.querySelector('.app-header');
  if (!header) return;
  const open = !header.classList.contains('mb-menu-open');
  header.classList.toggle('mb-menu-open', open);
  if (open) {
    setTimeout(() => document.addEventListener('click', mbCloseHeaderMenuOutside), 0);
  }
}
function mbCloseHeaderMenuOutside(e) {
  const cloud = document.querySelector('.app-header-cloud');
  if (cloud && cloud.contains(e.target)) return;
  document.querySelector('.app-header')?.classList.remove('mb-menu-open');
  document.removeEventListener('click', mbCloseHeaderMenuOutside);
}

/* ---------- 共用：從下方滑出的面板 ---------- */
function mbOpenSheet(innerHtml) {
  mbCloseSheet();
  const overlay = document.createElement('div');
  overlay.className = 'mb-sheet-overlay';
  overlay.id = 'mbSheetOverlay';
  overlay.innerHTML = `<div class="mb-sheet" role="dialog"><div class="mb-sheet-grab"></div>${innerHtml}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) mbCloseSheet(); });
  document.body.appendChild(overlay);
  return overlay;
}
function mbCloseSheet() {
  document.getElementById('mbSheetOverlay')?.remove();
}

/* ==================== 股票管理 ==================== */
const MB_SPECIAL_FILTERS = ['STOCK_SALES', 'STOCK_LENDING_TAB', 'DIVIDENDS_TAB', 'YONG_FENG_TAB', 'DCA_TAB', 'SNAPSHOT_LOGS', 'PAST_DIVIDENDS'];

function mbIsHoldingsView() {
  return typeof currentFilter !== 'undefined' && !MB_SPECIAL_FILTERS.includes(currentFilter);
}

function mbSetupStockChrome() {
  const view = document.getElementById('stockView');
  if (!view) return;

  // 數字卡片「看更多」
  const dash = view.querySelector('.dashboards-wrapper');
  if (dash && !document.getElementById('mbMoreStatsBtn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'mbMoreStatsBtn';
    btn.className = 'mb-more-stats-btn mb-only';
    btn.textContent = '看更多數字 ▾';
    btn.onclick = () => {
      const on = view.classList.toggle('mb-more-stats');
      btn.textContent = on ? '收起 ▴' : '看更多數字 ▾';
    };
    dash.insertAdjacentElement('afterend', btn);
  }

  // 工具列：常用按鈕 + ⋯ 更多
  const bar = view.querySelector('.toolbar-bar');
  if (bar && !bar.querySelector('.mb-toolbar-more')) {
    ['btnUpdatePrices', 'btnAddNewStock', 'btnAddSaleModal'].forEach(id => document.getElementById(id)?.classList.add('mb-primary'));
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'mb-toolbar-more';
    more.textContent = '⋯ 更多';
    more.onclick = () => {
      const on = bar.classList.toggle('mb-open');
      more.textContent = on ? '收起' : '⋯ 更多';
    };
    bar.appendChild(more);
  }

  // 持股卡片的容器（放在表格前面）
  const layout = document.getElementById('tableWithChartLayout');
  if (layout && !document.getElementById('mbStockCards')) {
    const box = document.createElement('div');
    box.id = 'mbStockCards';
    box.className = 'mb-stock-cards';
    box.style.display = 'none';
    const anchor = document.getElementById('topScrollWrapper') || layout;
    anchor.insertAdjacentElement('beforebegin', box);
  }
}

function mbHoldingsList() {
  let list;
  if (currentFilter === '台股') list = getMergedTaiwanStocks();
  else list = stocks.filter(s => currentFilter === 'ALL' || s.account === currentFilter || s.category === currentFilter);
  const q = (document.getElementById('searchBox')?.value || '').trim().toLowerCase();
  if (q) list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q) || (s.account || '').toLowerCase().includes(q));
  return list;
}

function mbLocked(field) { return typeof isFieldLocked === 'function' && isFieldLocked('holdings.' + field); }

function mbRenderStockCards() {
  const view = document.getElementById('stockView');
  const box = document.getElementById('mbStockCards');
  if (!view || !box) return;
  const pageLocked = typeof isPageLocked === 'function' && isPageLocked('holdings');
  const useCards = mbIsMobile() && mbIsHoldingsView() && !pageLocked;
  view.classList.toggle('mb-cards-mode', useCards);
  box.style.display = useCards ? '' : 'none';
  if (!useCards) { box.innerHTML = ''; return; }

  const list = mbHoldingsList();
  if (!list.length) { box.innerHTML = '<div class="mb-empty">沒有符合的股票</div>'; return; }

  box.innerHTML = list.map(s => {
    const isUS = isUsStock(s);
    const fx = isUS ? getUsdRate() : 1;
    const unit = isUS ? 'US$' : '$';
    const d = isUS ? 2 : 0;
    const shares = Number(s.shares) || 0;
    const price = Number(s.currentPrice) || 0;
    const mv = s.isMerged ? shares * price : (Number(s.marketVal) || 0);
    const cost = Number(s.totalCost) || 0;
    const profit = mv - cost;
    const rate = cost > 0 ? profit / cost * 100 : 0;
    const cash = Number(s.cashDividends) || 0;
    const lent = Number(s.lentShares) || 0;
    const lock = '🔒';
    const mvText = mbLocked('marketVal') ? lock : unit + mbFmt(mv, d);
    const priceText = mbLocked('currentPrice') ? lock : unit + mbFmt(price, 2);
    const sharesText = mbLocked('shares') ? lock : mbFmt(shares) + ' 股';
    const profitText = mbLocked('profit') ? lock : `${profit >= 0 ? '+' : ''}${unit}${mbFmt(profit, d)}（${profit >= 0 ? '+' : ''}${rate.toFixed(1)}%）`;
    const extra = [];
    if (cash && !mbLocked('cashDividends')) extra.push(`股利 ${unit}${mbFmt(cash, d)}`);
    if (lent && !mbLocked('lentShares')) extra.push(`出借 ${mbFmt(lent)}`);
    if (s.isMerged) extra.push('⚡ 合併顯示，到各帳戶修改');
    void fx;
    return `
      <div class="mb-stock-card" onclick="mbOpenStockEditor('${mbEsc(String(s.id))}')">
        <div class="mb-sc-r1"><span class="mb-sc-name">${mbEsc(s.name)} <small>${mbEsc(s.code || '')}</small></span><span class="mb-sc-val">${mvText}</span></div>
        <div class="mb-sc-r2"><span>${mbEsc(s.account || '')}・${sharesText}・${priceText}</span><span class="${profit >= 0 ? 'mb-up' : 'mb-down'}">${profitText}</span></div>
        ${extra.length ? `<div class="mb-sc-r3"><span>${extra.map(mbEsc).join('・')}</span></div>` : ''}
      </div>`;
  }).join('');
}

function mbOpenStockEditor(id) {
  const s = stocks.find(x => String(x.id) === String(id))
    || (currentFilter === '台股' ? getMergedTaiwanStocks().find(x => String(x.id) === String(id)) : null);
  if (!s) return;
  const isUS = isUsStock(s);
  const unit = isUS ? 'US$' : '$';
  const shares = Number(s.shares) || 0;
  const cost = Number(s.totalCost) || 0;
  const avg = shares > 0 ? cost / shares : 0;

  if (s.isMerged) {
    mbOpenSheet(`
      <div class="mb-sheet-title">${mbEsc(s.name)}</div>
      <div class="mb-sheet-sub">${mbEsc(s.code || '')}・合併顯示（${mbEsc(s.account || '')}）</div>
      <div class="mb-note">這一列是把多個帳戶的同一檔股票加在一起，請到各證券帳戶的分頁修改。</div>
      <div class="mb-actions"><button onclick="mbCloseSheet()">關閉</button></div>`);
    return;
  }

  const field = (key, label, value, step) => mbLocked(key)
    ? `<div class="mb-field"><label>${label}</label><div class="mb-ro">🔒</div></div>`
    : `<div class="mb-field"><label>${label}</label><input type="number" inputmode="decimal" step="${step}" data-field="${key}" value="${mbEsc(value)}" onfocus="this.select()"></div>`;
  const ro = (key, label, text) => `<div class="mb-field"><label>${label}</label><div class="mb-ro">${mbLocked(key) ? '🔒' : text}</div></div>`;

  mbOpenSheet(`
    <div class="mb-sheet-title">${mbEsc(s.name)}</div>
    <div class="mb-sheet-sub">${mbEsc(s.code || '未填代號')}・${mbEsc(s.account || '')}${isUS ? '・美金' : ''}</div>
    <div class="mb-fields" id="mbStockFields">
      ${field('marketVal', `市值（${unit}）`, Number(s.marketVal) || 0, 'any')}
      ${field('totalCost', `投入成本（${unit}）`, cost, 'any')}
      ${field('shares', '持有股數', shares, 'any')}
      ${field('lentShares', '出借張數', Number(s.lentShares) || 0, 'any')}
      ${ro('currentPrice', '現價（自動）', unit + mbFmt(s.currentPrice, 2))}
      ${ro('avgCost', '平均每股成本', unit + mbFmt(avg, 2))}
    </div>
    <div class="mb-note">現價會用「市值 ÷ 持有股數」自動算出來。</div>
    <div class="mb-row-btns">
      ${mbLocked('cashDividends') ? '' : `<button onclick="mbCloseSheet(); openDividendModal('${mbEsc(String(s.id))}', 'cash')">💰 現金股利</button>`}
      ${mbLocked('stockDividends') ? '' : `<button onclick="mbCloseSheet(); openDividendModal('${mbEsc(String(s.id))}', 'stock')">📈 股票股利</button>`}
    </div>
    <div class="mb-actions">
      <button class="mb-danger-btn" onclick="mbCloseSheet(); deleteStock(${Number(s.id)})">🗑 刪除</button>
      <button onclick="mbCloseSheet()">取消</button>
      <button class="mb-primary-btn" onclick="mbSaveStockEditor('${mbEsc(String(s.id))}')">儲存</button>
    </div>`);
}

function mbSaveStockEditor(id) {
  const s = stocks.find(x => String(x.id) === String(id));
  if (!s) { mbCloseSheet(); return; }
  const inputs = document.querySelectorAll('#mbStockFields input[data-field]');
  const changes = {};
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    const val = isNaN(v) ? 0 : v;
    if ((Number(s[inp.dataset.field]) || 0) !== val) changes[inp.dataset.field] = val;
  });
  mbCloseSheet();
  if (!Object.keys(changes).length) return;
  // 跟表格裡改格子的做法一樣（updateValue），只是一次改多欄、只記一次復原點
  recordSnapshot();
  Object.assign(s, changes);
  if ('marketVal' in changes || 'shares' in changes) {
    const sh = Number(s.shares) || 0;
    s.currentPrice = sh > 0 ? (Number(s.marketVal) || 0) / sh : 0;
  }
  saveToStorage();
  renderTable();
  if (typeof showToast === 'function') showToast('已儲存', 'success');
}

/* ==================== 財務總覽 ==================== */
function mbEnhanceFinance() {
  if (!mbIsMobile()) return;
  // 分區標題的文字包一層，讓它固定在左邊
  document.querySelectorAll('#financeTable td.sec-header').forEach(td => {
    if (td.querySelector('.mb-sec-text')) return;
    const span = document.createElement('span');
    span.className = 'mb-sec-text';
    while (td.firstChild) span.appendChild(td.firstChild);
    td.appendChild(span);
  });
  // 有 ✖（封存）按鈕的項目名稱，可以點開選單
  document.querySelectorAll('#financeTable td.row-label').forEach(td => {
    if (td.querySelector('.del-btn')) td.classList.add('mb-label-tappable');
  });
}

function mbFinanceItemFromLabel(td) {
  const del = td.querySelector('.del-btn');
  const m = del && (del.getAttribute('onclick') || '').match(/deleteItem\('([^']+)',\s*'([^']+)'\)/);
  if (!m) return null;
  const list = findItemArray(m[1]);
  const item = list.find(x => String(x.id) === m[2]);
  return item ? { type: m[1], id: m[2], item, list } : null;
}

function mbOpenFinanceItemMenu(type, id) {
  const list = findItemArray(type);
  const active = list.filter(x => !x.archived);
  const item = list.find(x => String(x.id) === String(id));
  if (!item) return;
  const pos = active.indexOf(item);
  const t = `'${mbEsc(type)}', '${mbEsc(String(id))}'`;
  mbOpenSheet(`
    <div class="mb-sheet-title">${mbEsc(item.name)}</div>
    <div class="mb-sheet-sub">${mbEsc(typeLabel(type))}${item.isUSD ? '・美元計價' : ''}</div>
    <div class="mb-menu-list">
      <button onclick="mbRenameFinanceItem(${t})">✏️ 改名</button>
      ${pos > 0 ? `<button onclick="mbMoveFinanceItem(${t}, -1)">⬆️ 上移</button>` : ''}
      ${pos < active.length - 1 ? `<button onclick="mbMoveFinanceItem(${t}, 1)">⬇️ 下移</button>` : ''}
      <button class="mb-danger-btn" onclick="mbCloseSheet(); deleteItem(${t})">🗄️ 封存</button>
      <button onclick="mbCloseSheet()">取消</button>
    </div>`);
}

function mbRenameFinanceItem(type, id) {
  const item = findItemArray(type).find(x => String(x.id) === String(id));
  mbCloseSheet();
  if (!item) return;
  const name = prompt('新的名稱：', item.name);
  if (name && name.trim() && name.trim() !== item.name) updateItemName(type, item.id, name.trim());
}

/* 上移／下移：跟拖曳排序一樣，在同一類別裡跟「相鄰的未封存項目」交換位置 */
function mbMoveFinanceItem(type, id, dir) {
  const list = findItemArray(type);
  const active = list.filter(x => !x.archived);
  const item = list.find(x => String(x.id) === String(id));
  const pos = active.indexOf(item);
  const other = active[pos + dir];
  if (!item || !other) return;
  const from = list.indexOf(item);
  const to = list.indexOf(other);
  list.splice(from, 1);
  list.splice(to, 0, item);
  saveState();
  render();
  mbOpenFinanceItemMenu(type, id); // 選單留著，方便連續移動
}

/* ==================== 接到原本的畫面流程 ==================== */
function mbWrap(name, after) {
  const orig = window[name];
  if (typeof orig !== 'function' || orig.__mbWrapped) return;
  const wrapped = function () {
    const r = orig.apply(this, arguments);
    try { after(); } catch (e) { console.warn('手機版處理失敗', e); }
    return r;
  };
  wrapped.__mbWrapped = true;
  window[name] = wrapped;
}

function mbInit() {
  mbSetupStockChrome();
  mbWrap('renderTable', mbRenderStockCards);
  mbWrap('render', mbEnhanceFinance);

  // 財務總覽：點名稱叫出選單；點數字格直接進入編輯（手機沒有雙擊）
  const grid = document.getElementById('gridContainer');
  if (grid) {
    grid.addEventListener('click', e => {
      if (!mbIsMobile()) return;
      const label = e.target.closest('td.row-label.mb-label-tappable');
      if (label) {
        const info = mbFinanceItemFromLabel(label);
        if (info) mbOpenFinanceItemMenu(info.type, info.id);
        return;
      }
      if (e.target.closest('.cell-editor')) return;
      const cell = e.target.closest('.grid-cell');
      if (cell && typeof startEditing === 'function') {
        const r = parseInt(cell.getAttribute('data-r'));
        const c = parseInt(cell.getAttribute('data-c'));
        startEditing(r, c);
      }
    });
  }

  // 手機一打開不要自動跳出財務總覽的趨勢圖（會蓋住畫面），要看再按「📈 資產趨勢圖」
  if (mbIsMobile() && typeof toggleChartPanel === 'function') {
    const panel = document.getElementById('floatingChartPanel');
    if (panel && panel.style.display !== 'none') toggleChartPanel(false);
  }

  if (typeof renderTable === 'function') { try { renderTable(); } catch (e) { /* 股票管理還沒初始化 */ } }
  mbEnhanceFinance();

  // 手機／電腦寬度切換（例如平板轉向）時重畫
  const onChange = () => {
    document.querySelector('.app-header')?.classList.remove('mb-menu-open');
    mbCloseSheet();
    try { renderTable(); } catch (e) { /* 略過 */ }
    try { render(); } catch (e) { /* 略過 */ }
  };
  if (MB_QUERY.addEventListener) MB_QUERY.addEventListener('change', onChange);
  else if (MB_QUERY.addListener) MB_QUERY.addListener(onChange);
}

// stock.js 用 window.onload = init 初始化，這裡等它跑完再接上
window.addEventListener('load', () => setTimeout(mbInit, 0));
