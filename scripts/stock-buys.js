    /* ====== 股票買進分頁｜stockBuys ＋ 先買先賣（批次）計算 ======
       跟 stock-sales.js 一樣，沿用 stock.js 頂部宣告的全域狀態（stocks / stockBuys …），
       index.html 要放在 stock.js 後面載入。

       ── 資料 ──
       stockBuys[]：{ id, date(民國 1151016), account, name, code, shares, price, amount, fee, cost,
                     type('一般'|'定期定額'), note, source('manual' 或對帳單 statementId), holdingId }
       持股 stocks[] 每檔多一個 lots[]（批次清單），先買先賣用：
         { id, kind('base'|'buy'|'stockDiv'), buyId?, date, origShares, origCost, shares, cost }
         - base     第一批：開始用批次之前就有的股數和成本（手動改持股的差額也一律算進這批）
         - buy      某一筆「股票買進」帶進來的批次（buyId 對應 stockBuys.id）
         - stockDiv 配股，成本 0
         shares / cost 是「還剩下」的股數和成本，origShares / origCost 是當初買進的。

       ── 規則 ──
       - 新增買進：找同帳戶＋同一檔的持股（沒有就自動新增一檔），股數、成本加上去，多一批
       - 改買進：持股只加減差額；改了帳戶或名稱，就從舊持股搬到新持股
       - 刪買進：持股扣回「這批還剩下的」；已賣掉一部分會先提醒
       - 賣出（先買先賣）：從最早那批開始扣，扣掉的成本含買進手續費
       - 持股的股數、成本被手動改過：差額在下次用到批次時自動算進第一批 ====== */

    let buysSubTab = 'list'; // 'list' 買進明細, 'lots' 剩餘批次

    function sbRound(n) { return Math.round((Number(n) || 0) * 1e6) / 1e6; }
    function sbNormName(s) { return String(s || '').replace(/\s+/g, ''); }
    function sbDateKey(d) {
      const s = String(d || '').replace(/[^0-9]/g, '');
      return s ? s.padStart(7, '0') : '';
    }

    /* ---------- 持股對應 ---------- */
    function sbFindHolding(account, name, code) {
      const n = sbNormName(name);
      const c = String(code || '').trim();
      return stocks.find(s => s.account === account && (
        (c && String(s.code || '').trim() === c) || (n && sbNormName(s.name) === n)
      ));
    }

    function sbGuessCategory(account, code) {
      if (account === '美股複委託') return '美股';
      if (String(code || '').trim().startsWith('00')) return 'ETF';
      return '台股';
    }

    // 股數、成本加減到持股上；市值跟著股數等比例調整（每股現價不變）
    function sbAdjustHolding(h, dShares, dCost, priceHint) {
      const oldShares = Number(h.shares) || 0;
      const newShares = sbRound(oldShares + dShares);
      let price = Number(h.currentPrice) || 0;
      if (!price && oldShares > 0) price = (Number(h.marketVal) || 0) / oldShares;
      if (!price && priceHint) price = Number(priceHint) || 0;
      h.shares = newShares;
      h.totalCost = newShares <= 0 ? 0 : sbRound((Number(h.totalCost) || 0) + dCost);
      if (price > 0) {
        h.currentPrice = price;
        h.marketVal = sbRound(price * Math.max(newShares, 0));
      }
    }

    /* ---------- 批次（先買先賣） ---------- */
    function sbSortedLots(h) {
      // 第一批永遠最早；其餘依日期，同一天照加入順序
      return h.lots
        .map((l, i) => ({ l, i }))
        .sort((a, b) => {
          if (a.l.kind === 'base') return -1;
          if (b.l.kind === 'base') return 1;
          const da = sbDateKey(a.l.date), db = sbDateKey(b.l.date);
          if (da !== db) return da < db ? -1 : 1;
          return a.i - b.i;
        })
        .map(x => x.l);
    }

    function sbLotSum(h) {
      return h.lots.reduce((s, l) => ({ shares: s.shares + (Number(l.shares) || 0), cost: s.cost + (Number(l.cost) || 0) }), { shares: 0, cost: 0 });
    }

    // 從最早的批次開始扣 n 股（成本照該批每股成本按比例扣），只改批次、不改持股
    function sbTakeFifo(h, n) {
      let left = Number(n) || 0;
      let cost = 0;
      const parts = [];
      for (const lot of sbSortedLots(h)) {
        if (left <= 0) break;
        const have = Number(lot.shares) || 0;
        if (have <= 0) continue;
        const take = Math.min(have, left);
        const c = have > 0 ? (Number(lot.cost) || 0) * take / have : 0;
        lot.shares = sbRound(have - take);
        lot.cost = lot.shares > 0 ? sbRound((Number(lot.cost) || 0) - c) : 0;
        left = sbRound(left - take);
        cost += c;
        parts.push({ lotId: lot.id, kind: lot.kind, date: lot.date, shares: take, cost: sbRound(c) });
      }
      // 配股批次扣完就拿掉；買進批次保留（之後改那筆買進時要知道賣掉多少）
      h.lots = h.lots.filter(l => l.kind !== 'stockDiv' || (Number(l.shares) || 0) > 0);
      return { shares: sbRound((Number(n) || 0) - left), cost: sbRound(cost), short: left, parts };
    }

    // 建立批次清單，並讓「批次加總」對齊「持股目前的股數和成本」
    function sbEnsureLots(h) {
      if (!Array.isArray(h.lots)) h.lots = [];
      let base = h.lots.find(l => l.kind === 'base');
      if (!base) {
        base = { id: 'base', kind: 'base', date: '', origShares: 0, origCost: 0, shares: 0, cost: 0 };
        h.lots.unshift(base);
      }
      const shares = Number(h.shares) || 0;
      const cost = Number(h.totalCost) || 0;

      const dS = sbRound(shares - sbLotSum(h).shares);
      if (dS > 0) base.shares = sbRound((Number(base.shares) || 0) + dS);
      else if (dS < 0) sbTakeFifo(h, -dS);

      const dC = sbRound(cost - sbLotSum(h).cost);
      if (dC !== 0) {
        const target = sbSortedLots(h).find(l => (Number(l.shares) || 0) > 0) || base;
        target.cost = sbRound((Number(target.cost) || 0) + dC);
      }
      base.origShares = base.shares;
      base.origCost = base.cost;
      return h.lots;
    }

    // 只看、不改：算出持股的批次（給畫面顯示、賣出預覽用）
    function sbPreviewLots(h) {
      const copy = JSON.parse(JSON.stringify({ shares: h.shares, totalCost: h.totalCost, lots: h.lots || [] }));
      sbEnsureLots(copy);
      return copy;
    }

    // 預覽：賣 n 股會扣多少成本（不改資料）
    function fifoPreview(h, n) {
      const copy = sbPreviewLots(h);
      return sbTakeFifo(copy, n);
    }

    // 真的賣出：扣批次、扣持股股數和成本；回傳 { shares, cost, short, parts }
    function fifoSell(h, n, sellPrice) {
      sbEnsureLots(h);
      const r = sbTakeFifo(h, n);
      sbAdjustHolding(h, -r.shares, -r.cost, sellPrice);
      return r;
    }

    // 配股：持股股數增加、成本不變，多一批成本 0（第 3 步匯入對帳單會用到）
    function addStockDividendLot(h, date, shares, note) {
      sbEnsureLots(h);
      h.lots.push({ id: 'd' + Date.now() + Math.floor(Math.random() * 1000), kind: 'stockDiv', date: date || '', origShares: Number(shares) || 0, origCost: 0, shares: Number(shares) || 0, cost: 0, note: note || '' });
      sbAdjustHolding(h, Number(shares) || 0, 0);
    }

    /* ---------- 買進 ↔ 持股 ---------- */
    function sbBuyReady(row) {
      return !!(row && row.account && sbNormName(row.name) && (Number(row.shares) || 0) > 0);
    }

    function sbBuyLot(h, row) {
      return (h && Array.isArray(h.lots)) ? h.lots.find(l => l.kind === 'buy' && String(l.buyId) === String(row.id)) : null;
    }

    function sbHoldingOf(row) {
      return row.holdingId != null ? stocks.find(s => String(s.id) === String(row.holdingId)) : null;
    }

    // 這筆買進目前「已經賣掉」多少（給刪除、搬家時提醒用）
    function sbBuySold(row) {
      const h = sbHoldingOf(row);
      if (!h) return { shares: 0, cost: 0, lot: null };
      const view = sbPreviewLots(h);
      const lot = view.lots.find(l => l.kind === 'buy' && String(l.buyId) === String(row.id));
      if (!lot) return { shares: 0, cost: 0, lot: null };
      return { shares: sbRound((Number(lot.origShares) || 0) - (Number(lot.shares) || 0)), cost: sbRound((Number(lot.origCost) || 0) - (Number(lot.cost) || 0)), lot };
    }

    // 把買進接到持股上（sold = 之前已經賣掉的部分，搬家時不再重複加）
    function sbAttachBuy(row, sold) {
      if (!sbBuyReady(row)) { row.holdingId = null; return; }
      let h = sbFindHolding(row.account, row.name, row.code);
      if (!h) {
        h = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: String(row.name).trim(),
          code: String(row.code || '').trim(),
          category: sbGuessCategory(row.account, row.code),
          account: row.account,
          shares: 0, totalCost: 0, currentPrice: Number(row.price) || 0, marketVal: 0,
          cashDividends: 0, stockShares: 0, dividendHistory: [], lentShares: 0,
          lots: [], createdByBuyId: row.id
        };
        stocks.unshift(h);
      }
      sbEnsureLots(h);
      const soldS = sold ? Number(sold.shares) || 0 : 0;
      const soldC = sold ? Number(sold.cost) || 0 : 0;
      const shares = Math.max(sbRound((Number(row.shares) || 0) - soldS), 0);
      const cost = shares > 0 ? Math.max(sbRound((Number(row.cost) || 0) - soldC), 0) : 0;
      h.lots.push({ id: 'b' + row.id, kind: 'buy', buyId: row.id, date: row.date || '', origShares: Number(row.shares) || 0, origCost: Number(row.cost) || 0, shares, cost });
      sbAdjustHolding(h, shares, cost, row.price);
      row.holdingId = h.id;
    }

    // 把買進從持股拿掉（只扣回還剩下的）；自動建立、又空掉的持股一起刪掉
    function sbDetachBuy(row) {
      const h = sbHoldingOf(row);
      row.holdingId = null;
      if (!h) return;
      sbEnsureLots(h);
      const lot = sbBuyLot(h, row);
      if (lot) {
        sbAdjustHolding(h, -(Number(lot.shares) || 0), -(Number(lot.cost) || 0));
        h.lots = h.lots.filter(l => l !== lot);
      }
      const empty = (Number(h.shares) || 0) <= 0
        && !(h.dividendHistory || []).length && !(Number(h.cashDividends) || 0) && !(Number(h.stockShares) || 0);
      const otherBuys = stockBuys.some(b => b !== row && String(b.holdingId) === String(h.id));
      if (String(h.createdByBuyId) === String(row.id) && empty && !otherBuys) {
        stocks = stocks.filter(s => s !== h);
      }
    }

    // 同一檔持股，股數／成本／日期改了：只加減差額
    function sbResizeBuy(row) {
      const h = sbHoldingOf(row);
      if (!h) { sbAttachBuy(row); return; }
      sbEnsureLots(h);
      const lot = sbBuyLot(h, row);
      if (!lot) { sbAttachBuy(row); return; }
      const soldS = sbRound((Number(lot.origShares) || 0) - (Number(lot.shares) || 0));
      const soldC = sbRound((Number(lot.origCost) || 0) - (Number(lot.cost) || 0));
      const newShares = Math.max(sbRound((Number(row.shares) || 0) - soldS), 0);
      const newCost = newShares > 0 ? Math.max(sbRound((Number(row.cost) || 0) - soldC), 0) : 0;
      const dS = sbRound(newShares - (Number(lot.shares) || 0));
      const dC = sbRound(newCost - (Number(lot.cost) || 0));
      lot.origShares = Number(row.shares) || 0;
      lot.origCost = Number(row.cost) || 0;
      lot.shares = newShares;
      lot.cost = newCost;
      lot.date = row.date || '';
      sbAdjustHolding(h, dS, dC, row.price);
      if ((Number(row.shares) || 0) < soldS) {
        showToast(`這批已經賣掉 ${formatNum(soldS, 0)} 股，股數不能比這個少，持股這批算 0 股`, 'error');
      }
    }

    // 新增一筆買進（彈窗、之後的對帳單匯入都走這裡）；不會存檔，呼叫的人自己存
    function addStockBuy(data) {
      const row = {
        id: data.id || (Date.now() + Math.floor(Math.random() * 1000)),
        date: String(data.date || '').trim(),
        account: data.account || '',
        name: String(data.name || '').trim(),
        code: String(data.code || '').trim(),
        shares: data.shares === '' ? '' : (Number(data.shares) || 0),
        price: data.price === '' ? '' : (Number(data.price) || 0),
        amount: 0,
        fee: data.fee === '' ? '' : (Number(data.fee) || 0),
        cost: 0,
        type: data.type || '一般',
        note: data.note || '',
        source: data.source || 'manual',
        holdingId: null
      };
      row.amount = sbRound((Number(row.shares) || 0) * (Number(row.price) || 0));
      row.cost = (data.cost !== undefined && data.cost !== '') ? (Number(data.cost) || 0) : sbRound(row.amount + (Number(row.fee) || 0));
      stockBuys.push(row);
      sbAttachBuy(row);
      yfAutoSortByDate(stockBuys, 'date');
      return row;
    }

    /* ---------- 表格編輯 ---------- */
    function updateBuyRow(index, field, value) {
      const r = stockBuys[index];
      if (!r) return;
      recordSnapshot();
      const before = { account: r.account, name: sbNormName(r.name), code: String(r.code || '').trim(), ready: sbBuyReady(r) };
      const sold = sbBuySold(r);

      if (['date', 'name', 'account', 'type', 'note', 'code'].includes(field)) {
        r[field] = String(value).trim();
      } else {
        r[field] = value === '' ? '' : (parseFloat(value) || 0);
      }
      if (field === 'shares' || field === 'price') {
        r.amount = sbRound((Number(r.shares) || 0) * (Number(r.price) || 0));
      }
      if (field === 'shares' || field === 'price' || field === 'fee') {
        r.cost = sbRound((Number(r.amount) || 0) + (Number(r.fee) || 0));
      }

      const moved = before.account !== r.account || before.name !== sbNormName(r.name) || before.code !== String(r.code || '').trim();
      if (moved || !before.ready || !sbBuyReady(r)) {
        if (moved && sold.shares > 0 && !confirm(`這批已經賣掉 ${formatNum(sold.shares, 0)} 股。\n改了帳戶／名稱後，新的持股只會加上還沒賣掉的 ${formatNum(Math.max((Number(r.shares) || 0) - sold.shares, 0), 0)} 股，確定嗎？`)) {
          undo();
          return;
        }
        sbDetachBuy(r);
        sbAttachBuy(r, sold);
      } else if (['shares', 'price', 'fee', 'cost', 'date'].includes(field)) {
        sbResizeBuy(r);
      }

      if (field === 'date') yfAutoSortByDate(stockBuys, 'date');
      saveToStorage();
      renderTabs();
      renderTable();
    }

    function deleteStockBuy(index) {
      const r = stockBuys[index];
      if (!r) return;
      const sold = sbBuySold(r);
      const remain = Math.max(sbRound((Number(r.shares) || 0) - sold.shares), 0);
      let msg = `確定要刪除這筆買進嗎？\n\n${r.date || ''} ${r.name || ''} ${formatNum(r.shares, 0)} 股`;
      if (r.holdingId != null) {
        msg += sold.shares > 0
          ? `\n\n⚠️ 這批已經賣掉 ${formatNum(sold.shares, 0)} 股，刪掉後持股只扣回剩下的 ${formatNum(remain, 0)} 股。`
          : `\n\n持股會扣回 ${formatNum(remain, 0)} 股、成本 $${formatNum(sold.lot ? sold.lot.cost : r.cost, 0)}。`;
      }
      if (!confirm(msg)) return;
      recordSnapshot();
      sbDetachBuy(r);
      stockBuys.splice(index, 1);
      saveToStorage();
      renderTabs();
      renderTable();
      showToast('已刪除買進紀錄');
    }

    function handleBuyKey(e, rowIndex, colIndex) {
      if (e.isComposing || e.keyCode === 229) return;
      const cols = [0, 1, 2, 3, 4, 6, 7, 8, 9];
      const cur = cols.indexOf(colIndex);
      const el = e.target;
      const isText = el.type === 'text';
      const go = (r, c) => focusCellSafely(`[data-buy-idx="${r}"][data-col="${c}"]`);
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (cur < cols.length - 1) go(rowIndex, cols[cur + 1]);
        else if (rowIndex < stockBuys.length - 1) go(rowIndex + 1, cols[0]);
      } else if (e.key === 'ArrowRight') {
        if (isText && el.selectionStart !== null && el.selectionEnd !== el.value.length) return;
        if (cur < cols.length - 1) { e.preventDefault(); go(rowIndex, cols[cur + 1]); }
      } else if (e.key === 'ArrowLeft') {
        if (isText && el.selectionStart !== null && el.selectionStart !== 0) return;
        if (cur > 0) { e.preventDefault(); go(rowIndex, cols[cur - 1]); }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); go(rowIndex + 1, colIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); if (rowIndex > 0) go(rowIndex - 1, colIndex);
      }
    }

    /* ---------- 子分頁切換 ---------- */
    function setBuysSubTab(subTab) {
      buysSubTab = subTab;
      const a = document.getElementById('subBtnBuyList');
      const b = document.getElementById('subBtnBuyLots');
      if (a) a.classList.toggle('active', subTab === 'list');
      if (b) b.classList.toggle('active', subTab === 'lots');
      renderTable();
      saveNavState();
    }

    /* ---------- 畫表：買進明細 ---------- */
    function renderStockBuysTable(thead, tbody, isFreshTabEntry) {
      refreshStockNameDatalist();
      thead.innerHTML = `
        <tr>
          <th style="width: 90px;">日期</th>
          <th style="width: 110px;">證券帳戶</th>
          <th style="width: 120px;">名稱</th>
          <th style="width: 90px;">股數</th>
          <th style="width: 90px;">成交價</th>
          <th style="width: 110px;">成交金額</th>
          <th style="width: 80px;">手續費</th>
          <th style="width: 110px;">成本 ($)</th>
          <th style="width: 100px;">類型</th>
          <th style="width: 140px;">備註</th>
          <th style="width: 60px;">操作</th>
        </tr>
      `;

      yfAutoSortByDate(stockBuys, 'date');
      const searchBox = document.getElementById('searchBox');
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
      const accounts = getAllAccounts();

      const monthPalette = ['#f5eee0', '#eef0e6', '#e9e4da', '#ece2c4', '#eaeef0', '#f4ecd4'];
      let monthIdx = -1, lastMonth = null;
      const monthColor = d => {
        const k = sbDateKey(d).slice(0, 5);
        if (!k) return '';
        if (k !== lastMonth) { lastMonth = k; monthIdx++; }
        return monthPalette[monthIdx % monthPalette.length];
      };

      const rows = stockBuys.map((r, idx) => ({ r, idx })).filter(({ r }) => !query
        || (r.name || '').toLowerCase().includes(query) || (r.date || '').includes(query) || (r.account || '').toLowerCase().includes(query));

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:30px; color:#94a3b8;">${stockBuys.length ? '沒有符合的買進紀錄' : '還沒有買進紀錄，按上面「➕ 新增買進」開始'}</td></tr>`;
        renderSummary();
        return;
      }

      const num = v => (v === undefined || v === '' || v === null) ? '' : v;
      let html = rows.map(({ r, idx }) => {
        const bg = monthColor(r.date);
        const accOpts = (accounts.includes(r.account) || !r.account ? accounts : [r.account, ...accounts])
          .map(a => `<option value="${esc(a)}" ${a === r.account ? 'selected' : ''}>${esc(a)}</option>`).join('');
        const linked = r.holdingId != null && stocks.some(s => String(s.id) === String(r.holdingId));
        const fromStmt = r.source && r.source !== 'manual';
        return `
          <tr${todoRowAttr(r, bg)}>
            <td class="editable-col"><input type="text" class="cell-input font-mono" data-buy-idx="${idx}" data-col="0" value="${esc(r.date || '')}" onfocus="this.select()" onkeydown="handleBuyKey(event, ${idx}, 0)" onchange="updateBuyRow(${idx}, 'date', this.value)" /></td>
            <td class="editable-col"><select class="cell-input" style="background:#fff; border:1px solid #cbd5e1; padding:2px;" data-buy-idx="${idx}" data-col="1" onkeydown="handleBuyKey(event, ${idx}, 1)" onchange="updateBuyRow(${idx}, 'account', this.value)">${accOpts}</select></td>
            <td class="editable-col"><input type="text" class="cell-input" list="stockNameDatalist" style="font-weight:700;" data-buy-idx="${idx}" data-col="2" value="${esc(r.name || '')}" onfocus="this.select()" onkeydown="handleBuyKey(event, ${idx}, 2)" onchange="updateBuyRow(${idx}, 'name', this.value)" /></td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-buy-idx="${idx}" data-col="3" value="${esc(num(r.shares))}" onfocus="this.select()" onkeydown="handleBuyKey(event, ${idx}, 3)" onchange="updateBuyRow(${idx}, 'shares', this.value)" /></td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-buy-idx="${idx}" data-col="4" value="${esc(num(r.price))}" onfocus="this.select()" onkeydown="handleBuyKey(event, ${idx}, 4)" onchange="updateBuyRow(${idx}, 'price', this.value)" /></td>
            <td class="font-mono">$${formatNum(r.amount, 0)}</td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-buy-idx="${idx}" data-col="6" value="${esc(num(r.fee))}" onfocus="this.select()" onkeydown="handleBuyKey(event, ${idx}, 6)" onchange="updateBuyRow(${idx}, 'fee', this.value)" /></td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono font-bold" data-buy-idx="${idx}" data-col="7" value="${esc(num(r.cost))}" onfocus="this.select()" onkeydown="handleBuyKey(event, ${idx}, 7)" onchange="updateBuyRow(${idx}, 'cost', this.value)" /></td>
            <td class="editable-col">
              <select class="cell-input" style="background:#fff; border:1px solid #cbd5e1; padding:2px;" data-buy-idx="${idx}" data-col="8" onkeydown="handleBuyKey(event, ${idx}, 8)" onchange="updateBuyRow(${idx}, 'type', this.value)">
                <option value="一般" ${r.type !== '定期定額' ? 'selected' : ''}>一般</option>
                <option value="定期定額" ${r.type === '定期定額' ? 'selected' : ''}>定期定額</option>
              </select>
            </td>
            <td class="editable-col"><input type="text" class="cell-input" data-buy-idx="${idx}" data-col="9" value="${esc(r.note || '')}" placeholder="${fromStmt ? '對帳單匯入' : ''}" onfocus="this.select()" onkeydown="handleBuyKey(event, ${idx}, 9)" onchange="updateBuyRow(${idx}, 'note', this.value)" /></td>
            <td style="white-space:nowrap;">
              <span title="${linked ? '已加進持股' : '還沒加進持股（帳戶、名稱、股數要填好）'}" style="font-size:0.8rem; opacity:${linked ? 1 : 0.4};">${linked ? '🔗' : '⛓️‍💥'}</span>
              ${todoFlagBtn('buys', r)}
              <button class="btn-del" title="刪除" onclick="deleteStockBuy(${idx})">✕</button>
            </td>
          </tr>`;
      }).join('');

      const list = rows.map(x => x.r);
      const sumAmt = list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const sumFee = list.reduce((s, r) => s + (Number(r.fee) || 0), 0);
      const sumCost = list.reduce((s, r) => s + (Number(r.cost) || 0), 0);
      html += `
        <tr style="background:#f1f5f9; font-weight:800; border-top:2px solid #cbd5e1;">
          <td>小計（${list.length} 筆）</td>
          <td colspan="4">-</td>
          <td class="font-mono">$${formatNum(sumAmt, 0)}</td>
          <td class="font-mono">${formatNum(sumFee, 0)}</td>
          <td class="font-mono">$${formatNum(sumCost, 0)}</td>
          <td colspan="3">-</td>
        </tr>`;

      tbody.innerHTML = todoBannerRow('buys', thead) + html;
      renderSummary();
      if (isFreshTabEntry) {
        const box = document.getElementById('mainTableContainer');
        setTimeout(() => { if (box) box.scrollTop = box.scrollHeight; }, 50);
      }
    }

    /* ---------- 畫表：剩餘批次 ---------- */
    function renderStockLotsTable(thead, tbody) {
      thead.innerHTML = `
        <tr>
          <th style="width: 110px;">證券帳戶</th>
          <th style="width: 120px;">股票名稱</th>
          <th style="width: 110px;">批次</th>
          <th style="width: 90px;">剩餘股數</th>
          <th style="width: 120px;">剩餘成本 ($)</th>
          <th style="width: 100px;">每股成本</th>
          <th style="width: 120px;">當初買進</th>
        </tr>
      `;
      const searchBox = document.getElementById('searchBox');
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
      let list = stocks.filter(s => (Number(s.shares) || 0) > 0);
      if (query) list = list.filter(s => (s.name || '').toLowerCase().includes(query) || (s.code || '').toLowerCase().includes(query) || (s.account || '').toLowerCase().includes(query));
      const accOrder = getAllAccounts();
      list = list.slice().sort((a, b) => (accOrder.indexOf(a.account) - accOrder.indexOf(b.account)) || 0);

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">沒有符合的持股</td></tr>`;
        renderSummary();
        return;
      }

      const band = ['#fdfbf7', '#f5eee0'];
      tbody.innerHTML = list.map((s, sIdx) => {
        const view = sbPreviewLots(s);
        let lots = sbSortedLots(view).filter(l => (Number(l.shares) || 0) > 0);
        if (!lots.length) lots = view.lots.filter(l => l.kind === 'base');
        const unit = isUsStock(s) ? 'US$' : '$';
        const d = isUsStock(s) ? 2 : 0;
        return lots.map((l, i) => {
          const per = (Number(l.shares) || 0) > 0 ? (Number(l.cost) || 0) / Number(l.shares) : 0;
          const label = l.kind === 'base' ? '第一批' : (l.kind === 'stockDiv' ? `配股 ${esc(l.date || '')}` : `買進 ${esc(l.date || '')}`);
          const costCell = l.kind === 'base'
            ? `<input type="number" step="any" class="cell-input font-mono font-bold" value="${esc(sbRound(l.cost))}" title="第一批的成本可以直接改，持股的總成本會跟著變" onfocus="this.select()" onchange="updateBaseLotCost('${esc(String(s.id))}', this.value)" />`
            : `<span class="font-mono">${unit}${formatNum(l.cost, d)}</span>`;
          const orig = l.kind === 'base' ? '<span style="color:#93897a; font-size:0.78rem;">開始記錄前的持股</span>'
            : `<span class="font-mono" style="font-size:0.8rem;">${formatNum(l.origShares, 0)} 股${l.kind === 'buy' ? ' / ' + unit + formatNum(l.origCost, d) : ''}</span>`;
          return `
            <tr style="background:${band[sIdx % 2]};">
              ${i === 0 ? `<td rowspan="${lots.length}" style="vertical-align:middle;">${esc(s.account || '')}</td><td rowspan="${lots.length}" style="vertical-align:middle; font-weight:700;">${esc(s.name || '')}</td>` : ''}
              <td>${label}</td>
              <td class="font-mono">${formatNum(l.shares, 0)}</td>
              <td class="${l.kind === 'base' ? 'editable-col' : ''}">${costCell}</td>
              <td class="font-mono">${unit}${formatNum(per, 2)}</td>
              <td>${orig}</td>
            </tr>`;
        }).join('');
      }).join('');
      renderSummary();
    }

    // 第一批的成本手動改：持股總成本跟著變
    function updateBaseLotCost(stockId, value) {
      const h = stocks.find(s => String(s.id) === String(stockId));
      if (!h) return;
      recordSnapshot();
      sbEnsureLots(h);
      const base = h.lots.find(l => l.kind === 'base');
      const v = parseFloat(value) || 0;
      const d = sbRound(v - (Number(base.cost) || 0));
      base.cost = v;
      base.origCost = v;
      h.totalCost = sbRound((Number(h.totalCost) || 0) + d);
      saveToStorage();
      renderTable();
      showToast(`${h.name} 第一批成本已改，持股成本 ${d >= 0 ? '+' : ''}${formatNum(d, 0)}`);
    }

    /* ---------- 彈窗新增買進 ---------- */
    const BUY_MODAL_ORDER = ['buyModalDate', 'buyModalAccount', 'buyModalName', 'buyModalShares', 'buyModalPrice', 'buyModalFee', 'buyModalCost', 'buyModalType', 'buyModalNote'];
    let buyModalCostManual = false;

    function openAddBuyModal() {
      if (isPageLocked('buys')) { showToast('此分頁已鎖定，請先解鎖', 'error'); return; }
      refreshStockNameDatalist();
      const g = id => document.getElementById(id);
      const now = new Date();
      g('buyModalDate').value = String(now.getFullYear() - 1911) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      const accs = getAllAccounts();
      g('buyModalAccount').innerHTML = accs.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
      ['buyModalName', 'buyModalShares', 'buyModalPrice', 'buyModalFee', 'buyModalCost', 'buyModalNote'].forEach(id => { g(id).value = ''; });
      g('buyModalType').value = '一般';
      buyModalCostManual = false;
      onBuyModalInput();
      g('addBuyModal').classList.add('open');
      setTimeout(() => g('buyModalName').focus(), 50);
    }

    function closeAddBuyModal() {
      const m = document.getElementById('addBuyModal');
      if (m) m.classList.remove('open');
    }

    function onBuyModalInput(field) {
      const g = id => document.getElementById(id);
      if (field === 'cost') buyModalCostManual = g('buyModalCost').value !== '';
      const shares = Number(g('buyModalShares').value) || 0;
      const price = Number(g('buyModalPrice').value) || 0;
      const fee = Number(g('buyModalFee').value) || 0;
      const amount = sbRound(shares * price);
      g('buyModalAmount').textContent = '$' + formatNum(amount, 0);
      if (!buyModalCostManual && field !== 'cost') g('buyModalCost').value = (shares || price || fee) ? sbRound(amount + fee) : '';

      // 預覽：會加到哪一檔持股
      const info = g('buyModalHoldingInfo');
      const acc = g('buyModalAccount').value;
      const name = g('buyModalName').value.trim();
      if (!info) return;
      if (!name) { info.textContent = '填好帳戶、名稱、股數後，會自動加進持股。'; return; }
      const h = sbFindHolding(acc, name, '');
      const cost = Number(g('buyModalCost').value) || 0;
      if (h) {
        info.textContent = `會加到「${acc}・${h.name}」：${formatNum(h.shares, 0)} 股 → ${formatNum((Number(h.shares) || 0) + shares, 0)} 股，成本 +$${formatNum(cost, 0)}`;
      } else {
        info.textContent = `持股裡「${acc}」還沒有「${name}」，會自動新增一檔。`;
      }
    }

    function handleBuyModalKey(e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      const cur = BUY_MODAL_ORDER.indexOf(e.target.id);
      if (cur >= 0 && cur < BUY_MODAL_ORDER.length - 1) {
        const next = document.getElementById(BUY_MODAL_ORDER[cur + 1]);
        if (next) { next.focus(); if (next.select) next.select(); }
      }
    }

    function submitAddBuyModal() {
      const g = id => document.getElementById(id);
      const date = g('buyModalDate').value.trim();
      const account = g('buyModalAccount').value;
      const name = g('buyModalName').value.trim();
      const shares = Number(g('buyModalShares').value) || 0;
      if (!date) { showToast('請輸入日期', 'error'); g('buyModalDate').focus(); return; }
      if (!name) { showToast('請輸入股票名稱', 'error'); g('buyModalName').focus(); return; }
      if (shares <= 0) { showToast('請輸入股數', 'error'); g('buyModalShares').focus(); return; }
      const num = id => g(id).value === '' ? '' : (parseFloat(g(id).value) || 0);

      recordSnapshot();
      const holdingBefore = sbFindHolding(account, name, '');
      addStockBuy({
        date, account, name, shares,
        price: num('buyModalPrice'), fee: num('buyModalFee'), cost: num('buyModalCost'),
        type: g('buyModalType').value, note: g('buyModalNote').value
      });
      saveToStorage();
      closeAddBuyModal();
      renderTabs();
      renderTable();
      showToast(holdingBefore ? `已新增買進，持股「${name}」加 ${formatNum(shares, 0)} 股` : `已新增買進，並新增持股「${name}」`);
    }
