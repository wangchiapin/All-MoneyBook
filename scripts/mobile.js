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
   第二階段：
   - 股票管理上面多一排「持股／賣出／借出／股利／永豐／定期定額／紀錄」，
     證券帳戶篩選只在持股出現；其他分頁不顯示全體數字卡和搜尋框，改顯示該分頁自己的數字卡
   - 賣出、借出、借卷收入、定期定額、各股紀錄、歷年紀錄改成卡片，點卡片滑出面板修改
   - 每日買賣紀錄小計、非持股股利改成「一個月份／年度一個區塊」；年度預估股利改成一檔一張卡片
   - 保險總覽改成保單卡片；投資小知識一開始縮成小圓鈕
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
const MB_SPECIAL_FILTERS = ['STOCK_BUYS', 'STOCK_SALES', 'STOCK_LENDING_TAB', 'DIVIDENDS_TAB', 'YONG_FENG_TAB', 'DCA_TAB', 'SNAPSHOT_LOGS', 'PAST_DIVIDENDS'];

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

  let list = mbHoldingsList();
  // 已全數賣出的排到最下面
  const soldOut = s => typeof isSoldOut === 'function' && isSoldOut(s);
  list = list.filter(s => !soldOut(s)).concat(list.filter(soldOut));
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
      <div class="mb-stock-card${soldOut(s) ? ' mb-sold-out' : ''}" onclick="mbOpenStockEditor('${mbEsc(String(s.id))}')">
        <div class="mb-sc-r1"><span class="mb-sc-name">${mbEsc(s.name)} <small>${mbEsc(s.code || '')}</small>${soldOut(s) ? ' <span class="sold-out-tag">已全數賣出</span>' : ''}</span><span class="mb-sc-val">${mvText}</span></div>
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

/* ==================== 第二階段：股票管理上排大分頁 ====================
   手機上把「持股／賣出／借出／股利／永豐／定期定額／紀錄」獨立成一排，
   證券帳戶篩選（全部持股、富邦…）只在「持股」裡出現。
   按鈕一樣是呼叫原本的 setFilter()，被「隱藏子分頁」設定藏起來的，這裡也不顯示。 */
const MB_SECTIONS = [
  { id: 'HOLDINGS', label: '持股' },
  { id: 'STOCK_BUYS', label: '買進' },
  { id: 'STOCK_SALES', label: '賣出' },
  { id: 'STOCK_LENDING_TAB', label: '借出' },
  { id: 'DIVIDENDS_TAB', label: '股利' },
  { id: 'YONG_FENG_TAB', label: '永豐' },
  { id: 'DCA_TAB', label: '定期定額' },
  { id: 'SNAPSHOT_LOGS', label: '紀錄' }
];
let mbLastHoldingsFilter = 'ALL';

function mbRenderSectionBar() {
  const view = document.getElementById('stockView');
  if (!view || typeof currentFilter === 'undefined') return;
  let bar = document.getElementById('mbSectionBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mbSectionBar';
    bar.className = 'mb-section-bar';
    const header = view.querySelector('.header');
    if (header) header.insertAdjacentElement('afterend', bar);
    else view.insertAdjacentElement('afterbegin', bar);
  }
  const holdings = mbIsHoldingsView();
  view.classList.toggle('mb-special', !holdings);
  if (holdings) mbLastHoldingsFilter = currentFilter;
  const hidden = id => typeof isTabHidden === 'function' && isTabHidden(id);
  bar.innerHTML = MB_SECTIONS
    .filter(s => s.id === 'HOLDINGS' || !hidden(s.id))
    .map(s => {
      const active = s.id === 'HOLDINGS' ? holdings : currentFilter === s.id;
      return `<button type="button" class="${active ? 'active' : ''}" onclick="mbGoSection('${s.id}')">${s.label}</button>`;
    }).join('');
  // 選到的那顆如果在畫面外，橫向捲過去（只捲這一排，不動整頁）
  const act = bar.querySelector('.active');
  if (act && mbIsMobile()) {
    const left = act.offsetLeft - 8;
    const right = act.offsetLeft + act.offsetWidth - bar.clientWidth + 8;
    if (bar.scrollLeft > left) bar.scrollLeft = left;
    else if (bar.scrollLeft < right) bar.scrollLeft = right;
  }
}

function mbGoSection(id) {
  let target = id;
  if (id === 'HOLDINGS') {
    const ok = ['ALL', 'ETF', '台股'].includes(mbLastHoldingsFilter) || (typeof getAllAccounts === 'function' && getAllAccounts().includes(mbLastHoldingsFilter));
    target = ok ? mbLastHoldingsFilter : 'ALL';
  }
  if (target === currentFilter) return;
  // 手機在其他分頁不顯示搜尋框，先清掉，免得持股的搜尋字悄悄把其他分頁的資料也篩掉
  const sb = document.getElementById('searchBox');
  if (sb && sb.value && id !== 'HOLDINGS') sb.value = '';
  mbCloseSheet();
  setFilter(target);
  window.scrollTo(0, 0);
}

/* ==================== 第二階段：寬表格在手機改成卡片 ====================
   不改原本的表格程式：表格照常畫好（藏起來），這裡再「讀」畫好的表格，排成卡片。
   卡片裡要編輯的欄位，是把表格裡的輸入框「複製」一份放進面板，
   所以輸入框原本的 onchange（updateSaleRow…）照樣會跑，存檔方式跟電腦版完全一樣。

   三種排法：
   - rows    一列一張卡片，點卡片從下方滑出面板，看全部欄位、修改、刪除
   - groups  月份／年度並排的表（每日買賣紀錄小計、非持股股利）→ 一個月份（年度）一個區塊
   - columns 股票排成橫向欄位的表（年度預估股利）→ 一檔股票一張卡片 */

function mbNorm(s) { return String(s || '').replace(/\s+/g, '').replace(/[（(]\$?[)）]/g, ''); }

/* 把表格的列（含 rowspan／colspan 合併儲存格）攤平成格子陣列 */
function mbGridOf(trs) {
  const grid = [];
  trs.forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(tr.cells).forEach(td => {
      while (grid[r][c]) c++;
      const rs = Math.max(1, td.rowSpan || 1);
      const cs = Math.max(1, td.colSpan || 1);
      for (let i = 0; i < rs; i++) {
        if (r + i >= trs.length) break;
        grid[r + i] = grid[r + i] || [];
        for (let j = 0; j < cs; j++) grid[r + i][c + j] = { td, own: i === 0 && j === 0, colPart: j > 0 };
      }
      c += cs;
    });
  });
  return grid;
}

function mbHeaders(table) {
  const trs = Array.from(table.tHead ? table.tHead.rows : []);
  if (!trs.length) return [];
  const grid = mbGridOf(trs);
  const last = grid[grid.length - 1] || [];
  return last.map((cell, c) => {
    const bottom = cell ? cell.td.textContent.replace(/\s+/g, ' ').trim() : '';
    const topCell = grid.length > 1 && grid[0][c] && grid[0][c].td !== (cell && cell.td) ? grid[0][c].td : null;
    return { label: bottom, group: topCell ? topCell.textContent.replace(/\s+/g, ' ').trim() : '' };
  });
}

function mbHasCtl(el) { return !!el.querySelector('input, select, textarea, button'); }
function mbHasInput(el) { return !!el.querySelector('input, select, textarea'); }

function mbCellText(td) {
  if (!td) return '';
  const ctl = td.querySelector('input:not([type=hidden]), select, textarea');
  if (ctl) {
    if (ctl.tagName === 'SELECT') { const o = ctl.options[ctl.selectedIndex]; return o ? o.text.trim() : ''; }
    return String(ctl.value || '').trim();
  }
  const btn = td.querySelector('button');
  const t = td.textContent.replace(/\s+/g, ' ').trim();
  if (btn && t === btn.textContent.replace(/\s+/g, ' ').trim() && /^[✕✖🗑📝🗒️✏️🗄️\s]*$/u.test(t)) return '';
  return t;
}
function mbCellColor(td) {
  if (!td) return '';
  return td.style.color || (td.firstElementChild && td.firstElementChild.style && td.firstElementChild.style.color) || '';
}
function mbEmptyVal(v) { return v === '' || v === '-' || v === '—' || v === '－'; }

/* 把一個儲存格的內容複製一份（含輸入框），拿掉鍵盤導覽與 id，免得跟表格裡的重複 */
function mbCloneCell(td) {
  const frag = document.createElement('div');
  frag.className = 'mb-cell-clone';
  Array.from(td.childNodes).forEach(n => frag.appendChild(n.cloneNode(true)));
  frag.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  frag.querySelectorAll('[onkeydown]').forEach(el => el.removeAttribute('onkeydown'));
  frag.querySelectorAll('input[type=number]').forEach(el => el.setAttribute('inputmode', 'decimal'));
  frag.querySelectorAll('[style]').forEach(el => { if (el.matches('input, select, textarea')) el.removeAttribute('style'); });
  // 表格裡 select 的「目前選項」是屬性 selected，複製後要再設一次值
  const srcSel = td.querySelectorAll('select');
  frag.querySelectorAll('select').forEach((s, i) => { if (srcSel[i]) s.value = srcSel[i].value; });
  const srcIn = td.querySelectorAll('input, textarea');
  frag.querySelectorAll('input, textarea').forEach((s, i) => { if (srcIn[i]) s.value = srcIn[i].value; });
  return frag;
}

/* 每個分頁卡片上要顯示哪些欄位（用表頭文字對應；沒設定的就用前幾欄） */
const MB_ROW_CFG = {
  'STOCK_BUYS|list': { title: ['名稱'], sub: ['日期', '證券帳戶'], keys: ['股數', '成交價', '成本', '類型'] },
  'STOCK_BUYS|lots': { title: ['股票名稱'], sub: ['證券帳戶', '批次'], keys: ['剩餘股數', '剩餘成本', '每股成本'] },
  'STOCK_SALES|list': { title: ['名稱'], sub: ['日期', '狀態'], keys: ['股數', '賣出價格', '價差', '報酬率'] },
  'STOCK_SALES|history': { title: ['年份'], keys: ['總成本', '總賣出', '價差', '報酬率'] },
  'STOCK_LENDING_TAB|holdings': { title: ['股票名稱'], keys: ['出借張數', '市值', '成本', '未實現損益'] },
  'STOCK_LENDING_TAB|income': { title: ['出借股票'], sub: ['入款日期'], keys: ['出借張數', '出借費率', '實際收入', '每月總收入'] },
  'DCA_TAB|': { title: ['股票名稱'], keys: ['日期(扣款日)', '扣款金額', '每月扣款總金額'] }
};
const MB_SKIP_COLS = ['操作', '備考'];

function mbContextKey() {
  if (typeof currentFilter === 'undefined') return '';
  if (currentFilter === 'STOCK_BUYS') return 'STOCK_BUYS|' + buysSubTab;
  if (currentFilter === 'STOCK_SALES') return 'STOCK_SALES|' + salesSubTab;
  if (currentFilter === 'STOCK_LENDING_TAB') return 'STOCK_LENDING_TAB|' + lendingSubTab;
  if (currentFilter === 'DIVIDENDS_TAB') return 'DIVIDENDS_TAB|' + dividendsSubTab;
  return currentFilter + '|';
}
function mbModeFor(key) {
  if (key === 'STOCK_SALES|summary' || key === 'DIVIDENDS_TAB|past') return 'groups';
  if (key === 'DIVIDENDS_TAB|estimate') return 'columns';
  if (key === 'DIVIDENDS_TAB|summary') return 'table';   // 歷年股利總合只有三欄，維持表格＋折線圖
  return 'rows';
}

function mbColIndex(headers, names) {
  const out = [];
  (names || []).forEach(n => {
    const nn = mbNorm(n);
    const i = headers.findIndex(h => mbNorm(h.label) === nn);
    const j = i >= 0 ? i : headers.findIndex(h => mbNorm(h.label).startsWith(nn));
    if (j >= 0) out.push(j);
  });
  return out;
}

/* 目前畫在卡片裡的表格，記下來給面板「重新整理數字」用 */
const mbCardState = {};   // boxId -> { table, key, rows: [tr...] }
let mbSheetRef = null;     // { boxId, rowIdx, title }
let mbPendingNew = null;   // { boxId, prints:Set } —— 按了「新增一列」之後，自動打開新的那一列

function mbRowPrint(tr) {
  return Array.from(tr.cells).map(td => mbCellText(td)).join('|');
}

/* 主函式：把 table 畫成卡片放進 box */
function mbCardify(table, box, key, cfgOverride) {
  if (!table || !box) return;
  const mode = mbModeFor(key);
  // 重畫前記住正在輸入的格子，畫完再放回去（不然手機鍵盤會突然收起來）
  const active = document.activeElement;
  let refocus = null;
  if (active && box.contains(active) && active.matches('input, select, textarea')) {
    refocus = Array.from(active.attributes).filter(a => a.name.startsWith('data-') || a.name === 'onchange').map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
  }

  const headers = mbHeaders(table);
  const trs = Array.from(table.tBodies[0] ? table.tBodies[0].rows : []);
  const footTrs = table.tFoot ? Array.from(table.tFoot.rows).filter(tr => tr.cells.length) : [];
  box.innerHTML = '';

  if (mode === 'rows') mbBuildRows(box, headers, trs.concat(footTrs), key, cfgOverride);
  else if (mode === 'groups') mbBuildGroups(box, headers, trs, key);
  else if (mode === 'columns') mbBuildColumns(box, table, key);

  mbCardState[box.id] = { table, key, rows: trs.concat(footTrs), headers };

  if (refocus) {
    try { const el = box.querySelector(refocus); if (el) el.focus({ preventScroll: true }); } catch (e) { /* 略過 */ }
  }
  mbRefreshSheet(box.id);
  mbOpenPendingNew(box.id);
}

function mbBuildRows(box, headers, trs, key, cfgOverride) {
  const cfg = cfgOverride || MB_ROW_CFG[key] || {};
  const grid = mbGridOf(trs);
  const nCols = headers.length;
  const skip = headers.map(h => MB_SKIP_COLS.includes(mbNorm(h.label)));
  let titleCols = mbColIndex(headers, cfg.title);
  if (!titleCols.length) titleCols = [0];
  const subCols = mbColIndex(headers, cfg.sub);
  let keyCols = mbColIndex(headers, cfg.keys);
  if (!keyCols.length) {
    keyCols = headers.map((h, i) => i).filter(i => !titleCols.includes(i) && !skip[i]).slice(0, 4);
  }
  const valOf = (r, c) => {
    const cell = grid[r] && grid[r][c];
    if (!cell || cell.colPart) return '';
    return mbCellText(cell.td);
  };

  const parts = [];
  trs.forEach((tr, r) => {
    const tds = Array.from(tr.cells);
    if (!tds.length) return;
    // 1) 只有一格、橫跨整列：提示文字／分區標題／鎖定畫面
    if (tds.length === 1 && (tds[0].colSpan || 1) >= nCols - 1) {
      const isHint = !mbHasCtl(tds[0]) && /尚無|目前|沒有/.test(tds[0].textContent);
      const d = mbDiv(isHint ? 'mb-empty' : 'mb-row-heading', null, tds[0]);
      d.innerHTML = d.innerHTML.replace(/[，,]\s*往右滑可看金額/, '');
      parts.push({ el: d });
      return;
    }
    // 2) 兩三格、有合併：像「115年 ＄6,610」這種一行的小結
    if (tds.length <= 3 && tds.some(td => (td.colSpan || 1) > 1) && nCols > 4) {
      const line = document.createElement('div');
      line.className = 'mb-inline-row';
      const lab = document.createElement('div');
      lab.className = 'mb-inline-label';
      lab.innerHTML = tds[0].innerHTML;
      line.appendChild(lab);
      tds.slice(1).forEach(td => {
        if (!mbHasCtl(td) && mbEmptyVal(td.textContent.trim())) return;
        const v = mbHasInput(td) ? mbCloneCell(td) : mbDiv('mb-inline-val', td.textContent.replace(/\s+/g, ' ').trim());
        v.classList.add('mb-inline-val');
        line.appendChild(v);
      });
      parts.push({ el: line });
      return;
    }
    const first = valOf(r, 0);
    const isTotal = /^(小計|合計|總計|當日共計)/.test(first) || (!mbHasCtl(tr) && /小計|合計|總計/.test(first));
    const tappable = mbHasCtl(tr) && !isTotal;

    const card = document.createElement('div');
    card.className = 'mb-tcard' + (isTotal ? ' mb-tcard-total' : '') + (tappable ? ' mb-tappable' : '');
    const title = titleCols.map(c => valOf(r, c)).filter(v => !mbEmptyVal(v)).join('・') || (isTotal ? first : '（未填名稱）');
    const sub = subCols.map(c => valOf(r, c)).filter(v => !mbEmptyVal(v)).join('・');

    let cols = keyCols;
    if (isTotal) cols = headers.map((h, i) => i).filter(i => !titleCols.includes(i) && !skip[i] && i !== 0);
    const kv = cols.map(c => {
      const v = valOf(r, c);
      if (mbEmptyVal(v)) return '';
      const cell = grid[r][c];
      const color = mbCellColor(cell && cell.td);
      return `<div class="mb-kv"><span>${mbEsc(headers[c] ? headers[c].label : '')}</span><b${color ? ` style="color:${mbEsc(color)}"` : ''}>${mbEsc(v)}</b></div>`;
    }).join('');

    const rowBg = tr.style.background || tr.style.backgroundColor;
    card.innerHTML = `
      <div class="mb-tc-head"><span class="mb-tc-title">${mbEsc(isTotal ? first : title)}</span>${sub ? `<span class="mb-tc-sub">${mbEsc(sub)}</span>` : ''}${tappable ? '<span class="mb-tc-arrow">›</span>' : ''}</div>
      ${kv ? `<div class="mb-kvs">${kv}</div>` : ''}`;
    if (rowBg && !isTotal) card.style.borderLeft = `5px solid ${rowBg}`;
    if (tappable) card.addEventListener('click', () => mbOpenRowSheet(box.id, r));
    parts.push({ el: card });
  });
  if (!parts.length) parts.push({ el: mbDiv('mb-empty', '目前沒有資料') });
  parts.forEach(p => box.appendChild(p.el));
}

function mbDiv(cls, text, fromTd) {
  const d = document.createElement('div');
  d.className = cls;
  if (fromTd) Array.from(fromTd.childNodes).forEach(n => d.appendChild(n.cloneNode(true)));
  else if (text != null) d.textContent = text;
  return d;
}

/* 點卡片：從下方滑出面板，列出這一列的每一欄（可以改的就是輸入框） */
function mbOpenRowSheet(boxId, rowIdx) {
  const st = mbCardState[boxId];
  if (!st) return;
  const { rows, headers } = st;
  const tr = rows[rowIdx];
  if (!tr) return;
  const grid = mbGridOf(rows);
  const cfg = MB_ROW_CFG[st.key] || {};
  let titleCols = mbColIndex(headers, cfg.title);
  if (!titleCols.length) titleCols = [0];
  const title = titleCols.map(c => grid[rowIdx][c] && !grid[rowIdx][c].colPart ? mbCellText(grid[rowIdx][c].td) : '').filter(v => v).join('・');

  const overlay = mbOpenSheet(`
    <div class="mb-sheet-title">${mbEsc(title || '（未填名稱）')}</div>
    <div class="mb-sheet-sub">改完按「完成」，或點外面關掉；改的內容會直接存起來</div>
    <div class="mb-fields mb-fields-1" id="mbRowFields"></div>
    <div class="mb-row-btns" id="mbRowExtraBtns"></div>
    <div class="mb-actions" id="mbRowActions"></div>`);
  const fields = overlay.querySelector('#mbRowFields');
  const extra = overlay.querySelector('#mbRowExtraBtns');
  const actions = overlay.querySelector('#mbRowActions');

  headers.forEach((h, c) => {
    const cell = grid[rowIdx][c];
    if (!cell || cell.colPart) return;
    const td = cell.td;
    const norm = mbNorm(h.label);
    if (MB_SKIP_COLS.includes(norm)) {
      // 操作／備考欄的按鈕放到下面
      td.querySelectorAll('button').forEach(b => {
        const nb = b.cloneNode(true);
        nb.removeAttribute('id');
        nb.removeAttribute('class');
        const t = b.textContent.trim();
        if (/^[✕✖]$/.test(t) || b.classList.contains('btn-del')) { nb.textContent = '🗑 刪除'; nb.className = 'mb-danger-btn'; }
        else if (norm === '備考') nb.textContent = t + ' 備註';
        else nb.textContent = (b.title ? b.title + ' ' : '') + t;
        nb.addEventListener('click', () => setTimeout(mbCloseSheet, 0));
        (nb.className === 'mb-danger-btn' ? actions : extra).appendChild(nb);
      });
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'mb-field';
    wrap.dataset.col = c;
    const lab = document.createElement('label');
    lab.textContent = (h.group ? h.group + '・' : '') + h.label;
    wrap.appendChild(lab);
    if (mbHasInput(td)) {
      wrap.appendChild(mbCloneCell(td));
    } else if (td.querySelector('button')) {
      const cl = mbCloneCell(td);
      cl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setTimeout(mbCloseSheet, 0)));
      wrap.appendChild(cl);
    } else {
      const ro = document.createElement('div');
      ro.className = 'mb-ro';
      ro.textContent = mbCellText(td) || '—';
      const color = mbCellColor(td);
      if (color) ro.style.color = color;
      wrap.appendChild(ro);
    }
    fields.appendChild(wrap);
  });
  if (!extra.children.length) extra.remove();
  const done = document.createElement('button');
  done.className = 'mb-primary-btn';
  done.textContent = '完成';
  done.onclick = () => { if (document.activeElement) document.activeElement.blur(); setTimeout(mbCloseSheet, 0); };
  actions.appendChild(done);
  mbSheetRef = { boxId, rowIdx, print: mbRowPrint(tr), titleCols };
}

/* 面板開著時表格重畫了（例如改了股數，價差跟著變）：更新面板裡「自動算」的數字 */
function mbRefreshSheet(boxId) {
  if (!mbSheetRef || mbSheetRef.boxId !== boxId) return;
  const overlay = document.getElementById('mbSheetOverlay');
  const fields = overlay && overlay.querySelector('#mbRowFields');
  if (!fields) { mbSheetRef = null; return; }
  const st = mbCardState[boxId];
  const tr = st && st.rows[mbSheetRef.rowIdx];
  if (!tr) { mbCloseSheet(); return; }
  const grid = mbGridOf(st.rows);
  fields.querySelectorAll('.mb-field').forEach(f => {
    const c = Number(f.dataset.col);
    const cell = grid[mbSheetRef.rowIdx][c];
    if (!cell) return;
    const ro = f.querySelector('.mb-ro');
    if (ro) {
      ro.textContent = mbCellText(cell.td) || '—';
      const color = mbCellColor(cell.td);
      ro.style.color = color || '';
      return;
    }
    // 輸入框：正在打字的那一格不要動，其他的換成表格裡最新的值
    const src = cell.td.querySelectorAll('input, select, textarea');
    f.querySelectorAll('input, select, textarea').forEach((el, i) => {
      if (el === document.activeElement || !src[i]) return;
      el.value = src[i].value;
    });
    // 按鈕（例如定期定額的扣款日）文字也更新
    const srcBtn = cell.td.querySelectorAll('button');
    f.querySelectorAll('button').forEach((b, i) => { if (srcBtn[i]) b.textContent = srcBtn[i].textContent; });
  });
  mbSheetRef.print = mbRowPrint(tr);
}

/* 按「新增一列」後，自動打開新加的那一列，不用自己去找 */
function mbMarkPendingNew(boxId) {
  const st = mbCardState[boxId];
  mbPendingNew = { boxId, prints: new Set(st ? st.rows.map(mbRowPrint) : []), at: Date.now() };
}
function mbOpenPendingNew(boxId) {
  if (!mbPendingNew || mbPendingNew.boxId !== boxId) return;
  const pend = mbPendingNew;
  if (Date.now() - pend.at > 3000) { mbPendingNew = null; return; }
  const st = mbCardState[boxId];
  const idx = st.rows.findIndex(tr => mbHasInput(tr) && !pend.prints.has(mbRowPrint(tr)));
  if (idx < 0) return;
  mbPendingNew = null;
  setTimeout(() => {
    mbOpenRowSheet(boxId, idx);
    const first = document.querySelector('#mbRowFields input:not([type=hidden]), #mbRowFields select');
    if (first) first.focus();
  }, 30);
}

/* groups：月份（年度）並排兩欄一組的表 → 一組一個區塊，最新的在最上面 */
function mbBuildGroups(box, headers, trs, key) {
  const grid = mbGridOf(trs);
  const nGroups = Math.floor(headers.length / 2);
  const editable = key === 'DIVIDENDS_TAB|past';
  const topLines = [];
  const groups = [];
  for (let g = 0; g < nGroups; g++) groups.push({ label: headers[g * 2].group || headers[g * 2].label, sub: [headers[g * 2].label, headers[g * 2 + 1].label], rows: [], foot: [], firstEmpty: null });

  trs.forEach((tr, r) => {
    const tds = Array.from(tr.cells);
    // 「總計」這種整列只有兩格、橫跨全部的
    if (tds.length <= 2 && tds.some(td => (td.colSpan || 1) > 2)) {
      topLines.push({ label: tds[0].textContent.trim(), val: tds[1] ? tds[1].textContent.trim() : '', color: mbCellColor(tds[1]) });
      return;
    }
    groups.forEach((grp, g) => {
      const a = grid[r][g * 2], b = grid[r][g * 2 + 1];
      if (!a || !b) return;
      const at = mbCellText(a.td), bt = mbCellText(b.td);
      if (/^(小計|合計|總計|當沖損益)$/.test(at)) { grp.foot.push({ label: at, td: b.td }); return; }
      if (mbEmptyVal(at) && mbEmptyVal(bt)) {
        if (editable && mbHasInput(a.td) && !grp.firstEmpty) grp.firstEmpty = { a: a.td, b: b.td };
        return;
      }
      grp.rows.push({ a: a.td, b: b.td });
    });
  });

  topLines.forEach(t => {
    const d = document.createElement('div');
    d.className = 'mb-group-top';
    d.innerHTML = `<span>${mbEsc(t.label)}</span><b${t.color ? ` style="color:${mbEsc(t.color)}"` : ''}>${mbEsc(t.val)}</b>`;
    box.appendChild(d);
  });

  const list = groups.slice().reverse();
  let shown = 0;
  list.forEach(grp => {
    const hasData = grp.rows.length > 0;
    if (!hasData && !editable) return;
    shown++;
    const sec = document.createElement('div');
    sec.className = 'mb-group';
    const footHtml = grp.foot.map(f => `<span>${mbEsc(f.label)} <b style="color:${mbEsc(mbCellColor(f.td))}">${mbEsc(mbCellText(f.td))}</b></span>`).join('');
    sec.innerHTML = `<div class="mb-group-head"><span class="mb-group-title">${mbEsc(grp.label)}</span><span class="mb-group-foot">${footHtml}</span></div>`;
    const body = document.createElement('div');
    body.className = 'mb-group-body';
    const addRow = (a, b, isNew) => {
      const line = document.createElement('div');
      line.className = 'mb-pair' + (isNew ? ' mb-pair-new' : '');
      const left = mbHasCtl(a) ? mbCloneCell(a) : mbDiv('mb-pair-text', mbCellText(a));
      const right = mbHasCtl(b) ? mbCloneCell(b) : mbDiv('mb-pair-text', mbCellText(b));
      left.classList.add('mb-pair-a');
      right.classList.add('mb-pair-b');
      const col = mbCellColor(b);
      if (col && !mbHasCtl(b)) right.style.color = col;
      line.appendChild(left);
      line.appendChild(right);
      body.appendChild(line);
    };
    if (editable) {
      const hd = document.createElement('div');
      hd.className = 'mb-pair mb-pair-head';
      hd.innerHTML = `<div>${mbEsc(grp.sub[0])}</div><div>${mbEsc(grp.sub[1])}</div>`;
      body.appendChild(hd);
    }
    grp.rows.forEach(x => addRow(x.a, x.b));
    if (grp.firstEmpty) addRow(grp.firstEmpty.a, grp.firstEmpty.b, true);
    sec.appendChild(body);
    box.appendChild(sec);
  });
  if (!shown && !topLines.length) box.appendChild(mbDiv('mb-empty', '目前沒有資料'));
}

/* columns：第一欄是項目名稱、每檔股票一欄的表 → 一檔一張卡片 */
function mbBuildColumns(box, table, key) {
  const trs = Array.from(table.tBodies[0] ? table.tBodies[0].rows : []);
  const headRow = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
  const heads = headRow ? Array.from(headRow.cells) : [];
  if (heads.length <= 1) {
    trs.forEach(tr => box.appendChild(mbDiv('mb-empty', null, tr.cells[0] || tr)));
    if (!trs.length) box.appendChild(mbDiv('mb-empty', '目前沒有資料'));
    return;
  }
  const grid = mbGridOf(trs);
  for (let c = 1; c < heads.length; c++) {
    const card = document.createElement('div');
    card.className = 'mb-tcard mb-colcard';
    const head = document.createElement('div');
    head.className = 'mb-tc-head';
    head.innerHTML = `<span class="mb-tc-title">${heads[c].innerHTML}</span>`;
    card.appendChild(head);
    const kvs = document.createElement('div');
    kvs.className = 'mb-kvs mb-kvs-1';
    trs.forEach((tr, r) => {
      const lab = grid[r][0], cell = grid[r][c];
      if (!lab || !cell || cell.colPart) return;
      const row = document.createElement('div');
      row.className = 'mb-kv';
      const sp = document.createElement('span');
      sp.textContent = mbCellText(lab.td);
      row.appendChild(sp);
      if (mbHasInput(cell.td)) row.appendChild(mbCloneCell(cell.td));
      else {
        const b = document.createElement('b');
        b.textContent = mbCellText(cell.td) || '—';
        const color = mbCellColor(cell.td);
        if (color) b.style.color = color;
        row.appendChild(b);
      }
      kvs.appendChild(row);
    });
    card.appendChild(kvs);
    box.appendChild(card);
  }
}

/* 股票管理：決定這次要不要用卡片、用哪一種 */
function mbRenderSpecialCards() {
  const view = document.getElementById('stockView');
  if (!view) return;
  let box = document.getElementById('mbTableCards');
  if (!box) {
    box = document.createElement('div');
    box.id = 'mbTableCards';
    box.className = 'mb-table-cards';
    const layout = document.getElementById('tableWithChartLayout');
    if (layout) layout.insertAdjacentElement('beforebegin', box);
  }
  const key = mbContextKey();
  const special = mbIsMobile() && !mbIsHoldingsView() && currentFilter !== 'YONG_FENG_TAB';
  const mode = mbModeFor(key);
  const use = special && mode !== 'table';
  view.classList.toggle('mb-tcards-mode', use);
  view.classList.toggle('mb-groups-mode', use && mode === 'groups');
  if (!use) {
    box.innerHTML = '';
    if (mbSheetRef && mbSheetRef.boxId === box.id) { mbCloseSheet(); mbSheetRef = null; }
    return;
  }
  mbCardify(document.getElementById('stockGrid'), box, key);
}

/* 分頁專屬數字卡：沒有內容的空卡片在手機上藏起來（例如定期定額只用到兩張） */
function mbTidySubDashboard() {
  const sub = document.getElementById('subDashboardContainer');
  if (!sub) return;
  Array.from(sub.children).forEach(card => {
    const val = card.querySelector('.stat-value');
    const empty = !val || !val.textContent.trim();
    card.classList.toggle('mb-hide-empty', empty);
  });
}

/* 保險總覽：保單卡片，點了選「看詳情／編輯／封存」 */
function mbRenderInsuranceCards() {
  const view = document.getElementById('insuranceView');
  if (!view) return;
  let box = document.getElementById('mbInsCards');
  const tc = view.querySelector('.table-container');
  if (!box && tc) {
    box = document.createElement('div');
    box.id = 'mbInsCards';
    box.className = 'mb-table-cards';
    tc.insertAdjacentElement('beforebegin', box);
  }
  if (!box) return;
  const use = mbIsMobile();
  view.classList.toggle('mb-tcards-mode', use);
  if (!use) { box.innerHTML = ''; return; }
  if (typeof insurancePolicies === 'undefined') return;
  const q = (document.getElementById('insuranceSearchBox')?.value || '').trim().toLowerCase();
  let list = insurancePolicies.filter(p => !p.archived);
  if (q) list = list.filter(p => [p.name, p.insurer, p.type, p.insuredPerson].some(v => (v || '').toLowerCase().includes(q)));
  if (!list.length) {
    box.innerHTML = `<div class="mb-empty">${q ? '沒有符合的保單' : '尚無保單資料，點上方「➕ 新增保單」開始建立'}</div>`;
    return;
  }
  const money = n => (Number(n) ? '$' + mbFmt(n) : '');
  box.innerHTML = list.map(p => {
    const kv = [
      ['保費', p.premium ? `${money(p.premium)}${p.paymentFrequency ? '／' + p.paymentFrequency : ''}` : ''],
      ['扣款', [p.paymentMethod, p.paymentDate].filter(Boolean).join('・')],
      ['目前現值', money(p.currentValue)],
      ['狀態', p.status || '']
    ].filter(x => x[1]).map(x => `<div class="mb-kv"><span>${x[0]}</span><b>${mbEsc(x[1])}</b></div>`).join('');
    return `<div class="mb-tcard mb-tappable" onclick="mbOpenInsuranceMenu('${mbEsc(String(p.id))}')">
      <div class="mb-tc-head"><span class="mb-tc-title">${mbEsc(p.name || '（未命名保單）')}</span><span class="mb-tc-sub">${mbEsc([p.insuredPerson, p.type].filter(Boolean).join('・'))}</span><span class="mb-tc-arrow">›</span></div>
      ${kv ? `<div class="mb-kvs">${kv}</div>` : ''}
    </div>`;
  }).join('');
}
function mbOpenInsuranceMenu(id) {
  const p = typeof findInsurancePolicy === 'function' ? findInsurancePolicy(id) : null;
  if (!p) return;
  const t = `'${mbEsc(String(id))}'`;
  mbOpenSheet(`
    <div class="mb-sheet-title">${mbEsc(p.name || '（未命名保單）')}</div>
    <div class="mb-sheet-sub">${mbEsc([p.insurer, p.insuredPerson, p.type].filter(Boolean).join('・'))}</div>
    <div class="mb-menu-list">
      <button onclick="mbCloseSheet(); openInsuranceDetailModal(${t})">📄 看保單詳情</button>
      <button onclick="mbCloseSheet(); openInsuranceEditModal(${t})">✏️ 編輯</button>
      <button class="mb-danger-btn" onclick="mbCloseSheet(); archiveInsurancePolicy(${t})">🗄️ 封存</button>
      <button onclick="mbCloseSheet()">取消</button>
    </div>`);
}

/* 小知識視窗：手機上一開始先縮成右下角的小圓鈕，要看再點 */
function mbMinimizeTipsOnMobile() {
  if (!mbIsMobile()) return;
  const el = document.getElementById('tipsWidget');
  if (el && el.style.display !== 'none' && typeof tipsWidgetToggleMinimize === 'function') tipsWidgetToggleMinimize();
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
  mbWrap('renderTable', () => {
    mbRenderStockCards();
    mbRenderSectionBar();
    mbRenderSpecialCards();
    mbTidySubDashboard();
  });
  mbWrap('renderTabs', mbRenderSectionBar);
  mbWrap('renderSummary', mbTidySubDashboard);
  mbWrap('render', mbEnhanceFinance);
  mbWrap('renderInsuranceTable', mbRenderInsuranceCards);
  mbWrap('tipsWidgetInit', mbMinimizeTipsOnMobile);
  mbWrap('switchAppView', mbCloseSheet);

  // 在賣出／借出／定期定額按「➕ 新增…列」：新的那一列畫好後自動打開編輯面板
  document.getElementById('btnAddNewStock')?.addEventListener('click', () => {
    // 股票買進是用彈窗新增，不是新增一列，所以不用自動打開面板
    if (mbIsMobile() && !mbIsHoldingsView() && currentFilter !== 'STOCK_BUYS' && mbModeFor(mbContextKey()) === 'rows') mbMarkPendingNew('mbTableCards');
  }, true);

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
  mbRenderInsuranceCards();

  // 手機／電腦寬度切換（例如平板轉向）時重畫
  const onChange = () => {
    document.querySelector('.app-header')?.classList.remove('mb-menu-open');
    mbCloseSheet();
    try { renderTable(); } catch (e) { /* 略過 */ }
    try { render(); } catch (e) { /* 略過 */ }
    mbRenderInsuranceCards();
  };
  if (MB_QUERY.addEventListener) MB_QUERY.addEventListener('change', onChange);
  else if (MB_QUERY.addListener) MB_QUERY.addListener(onChange);
}

// stock.js 用 window.onload = init 初始化，這裡等它跑完再接上
window.addEventListener('load', () => setTimeout(mbInit, 0));
