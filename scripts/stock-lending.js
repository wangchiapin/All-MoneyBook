    /* ====== 股票借出分頁｜stockLending / lendingIncomeRows 相關函式，含 findStockByName / syncLentSharesToHoldings ======
       此檔案從 stock.js 拆分出來（架構重構 Phase 3），沿用 stock.js 頂部宣告的
       全域狀態變數（stocks / customAccounts / dcaRows / yfDetail ... 等），
       靠瀏覽器對 classic <script> 標籤的共用全域作用域運作，
       不需要 import/export，index.html 只要確保這個檔案在 stock.js 之前或之後載入皆可
       （所有呼叫都發生在 window.onload 之後，屆時所有 <script> 都已執行完畢）。 ====== */


    /* ====== 股票借出分頁 (STOCK_LENDING_TAB) - 子分頁一：出借持股列表 ====== */
    function findStockByName(name) {
      if (!name) return null;
      const trimmed = String(name).trim();
      if (!trimmed) return null;
      return stocks.find(s => s.name === trimmed) || null;
    }

    // 把「股票借出」表裡各列的出借張數，依股票名稱加總後，同步回寫到對應持股的「出借張數」欄位
    function syncLentSharesToHoldings() {
      const totals = new Map();
      const matchedIds = new Set();

      stockLending.forEach(r => {
        const matched = findStockByName(r.name);
        if (!matched) return;
        matchedIds.add(matched.id);
        totals.set(matched.id, (totals.get(matched.id) || 0) + (Number(r.lentShares) || 0));
      });

      // 上次同步過、但這次已經不再被任何借出列引用的持股，出借張數歸零
      lendingManagedIds.forEach(id => {
        if (!matchedIds.has(id)) {
          const st = stocks.find(s => s.id === id);
          if (st) st.lentShares = 0;
        }
      });

      matchedIds.forEach(id => {
        const st = stocks.find(s => s.id === id);
        if (st) st.lentShares = totals.get(id) || 0;
      });

      lendingManagedIds = Array.from(matchedIds);
    }

    function refreshStockNameDatalist() {
      const list = document.getElementById('stockNameDatalist');
      if (!list) return;
      const uniqueNames = Array.from(new Set(stocks.map(s => s.name).filter(Boolean)));
      list.innerHTML = uniqueNames.map(n => `<option value="${esc(n)}"></option>`).join('');
    }

    function renderStockLendingTable(thead, tbody) {
      refreshStockNameDatalist();

      thead.innerHTML = `
        <tr>
          <th style="width: 200px;">股票名稱</th>
          <th style="width: 100px;">現價 ($)</th>
          <th style="width: 110px;">出借張數</th>
          <th style="width: 130px;">市值 ($)</th>
          <th style="width: 120px;">成本 ($)</th>
          <th style="width: 150px;">未實現損益</th>
          <th style="width: 60px;">操作</th>
        </tr>
      `;

      const searchBox = document.getElementById('searchBox');
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
      let rows = stockLending.map((r, idx) => ({ r, idx }));
      if (query) {
        rows = rows.filter(({ r }) => (r.name || '').toLowerCase().includes(query));
      }

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">尚無股票借出紀錄，點擊上方「＋」新增一列</td></tr>`;
        renderSummary();
        return;
      }

      tbody.innerHTML = rows.map(({ r, idx }) => {
        const matched = findStockByName(r.name);
        const isUS = isUsStock(matched);
        const unitSymbol = isUS ? 'US$' : '$';

        const currentPrice = matched ? (Number(matched.currentPrice) || 0) : 0;
        const lentShares = Number(r.lentShares) || 0;
        const marketVal = currentPrice * lentShares;
        const cost = Number(r.cost) || 0;
        const profit = marketVal - cost;
        const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
        const isProfit = profit >= 0;

        return `
          <tr>
            <td class="editable-col">
              <input type="text" class="cell-input font-bold" list="stockNameDatalist" data-row="${idx}" data-col="0" value="${esc(r.name || '')}" placeholder="選擇或輸入股票名稱" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 0)" onchange="updateLendingRow(${idx}, 'name', this.value)" />
            </td>
            <td class="font-mono">${matched ? unitSymbol + formatNum(currentPrice, 2) : '<span style="color:#c9bfa8;">—</span>'}</td>
            <td class="editable-col">
              <input type="number" step="any" class="cell-input" data-row="${idx}" data-col="1" value="${esc(lentShares)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 1)" onchange="updateLendingRow(${idx}, 'lentShares', this.value)" />
            </td>
            <td class="font-mono font-bold">${matched ? unitSymbol + formatNum(marketVal, 0) : '<span style="color:#c9bfa8;">—</span>'}</td>
            <td class="editable-col">
              <input type="number" step="any" class="cell-input" data-row="${idx}" data-col="2" value="${esc(Number(r.cost) || 0)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 2)" onchange="updateLendingRow(${idx}, 'cost', this.value)" />
            </td>
            <td class="font-mono" style="font-weight:700; color:${isProfit ? 'var(--up-red)' : 'var(--down-green)'};">
              ${isProfit ? '+' : ''}${unitSymbol}${formatNum(profit, 0)}
              <div style="font-size:0.72rem; font-weight:600;">${isProfit ? '+' : ''}${profitRate.toFixed(2)}%</div>
            </td>
            <td><button class="btn-del" title="刪除" onclick="deleteLendingRow(${idx})">✕</button></td>
          </tr>
        `;
      }).join('');

      renderSummary();
    }

    function updateLendingRow(index, field, value) {
      recordSnapshot();
      const row = stockLending[index];
      if (!row) return;
      if (field === 'name') {
        row.name = value;
      } else {
        row[field] = parseFloat(value) || 0;
      }
      syncLentSharesToHoldings();
      saveToStorage();
      renderTable();
    }

    function addLendingRow() {
      recordSnapshot();
      stockLending.push({ id: Date.now(), name: '', lentShares: 0, cost: 0 });
      saveToStorage();
      renderTable();
    }

    function deleteLendingRow(index) {
      if (confirm('確定要刪除這筆股票借出紀錄嗎？')) {
        recordSnapshot();
        stockLending.splice(index, 1);
        syncLentSharesToHoldings();
        saveToStorage();
        renderTable();
      }
    }

    /* ====== 股票借出分頁 (STOCK_LENDING_TAB) - 子分頁二：借卷收入 ====== */
    function lendingMonthKeyOf(dateStr) {
      const digits = String(dateStr || '').replace(/[^0-9]/g, '');
      if (digits.length === 7) return digits.slice(0, 5);
      if (digits.length === 6) return digits.slice(0, 4);
      return null;
    }

    function lendingYearKeyOf(dateStr) {
      const digits = String(dateStr || '').replace(/[^0-9]/g, '');
      if (digits.length === 7) return digits.slice(0, 3);
      if (digits.length === 6) return digits.slice(0, 2);
      return null;
    }

    // 115年(含)以後：依「入款日期」的民國年，從明細列自動加總「實際收入」
    // 110~114年：沿用手動記錄的歷史數字 (lendingIncomeManualYearly)
    function getLendingYearlyTotals() {
      const autoMap = new Map();
      lendingIncomeRows.forEach(r => {
        const y = lendingYearKeyOf(r.paymentDate);
        if (!y) return;
        const actual = (Number(r.income) || 0) - (Number(r.serviceFee) || 0);
        autoMap.set(y, (autoMap.get(y) || 0) + actual);
      });

      const years = new Set([...Object.keys(lendingIncomeManualYearly), ...autoMap.keys()]);
      const list = Array.from(years).map(y => ({
        year: y,
        amount: autoMap.has(y) ? autoMap.get(y) : (Number(lendingIncomeManualYearly[y]) || 0),
        isAuto: autoMap.has(y)
      }));
      list.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
      return list;
    }

    function renderLendingYearlyTotalRows(colCount) {
      const yearly = getLendingYearlyTotals();
      if (yearly.length === 0) return '';

      const labelSpan = colCount - 3;
      let html = `<tr style="background:#f4ecd4;"><td colspan="${colCount}" style="font-weight:800; padding:10px 12px; color:#5c5445;">📅 年度借卷收入總計 (實際收入加總，往右滑可看金額)</td></tr>`;
      html += yearly.map(y => `
        <tr>
          <td colspan="${labelSpan}" style="text-align:left; font-weight:700; padding-left:12px; color:#766c5a;">
            ${y.year}年 ${y.isAuto ? '<span style="font-size:0.75rem; color:#9c7c52;">🧮 依明細自動加總</span>' : ''}
          </td>
          <td colspan="2" class="font-mono font-bold" style="font-size:1rem;">
            ${y.isAuto
              ? `$${formatNum(y.amount, 0)}`
              : `<input type="number" step="any" class="cell-input font-bold" value="${esc(y.amount)}" onfocus="this.select()" onchange="updateLendingManualYearly('${y.year}', this.value)" />`
            }
          </td>
          <td></td>
        </tr>
      `).join('');
      return html;
    }

    function renderLendingIncomeTable(thead, tbody) {
      refreshStockNameDatalist();

      thead.innerHTML = `
        <tr>
          <th style="width: 130px;">出借股票</th>
          <th style="width: 90px;">出借日期</th>
          <th style="width: 80px;">出借張數</th>
          <th style="width: 80px;">出借費率</th>
          <th style="width: 90px;">還卷日期</th>
          <th style="width: 90px;">收入 ($)</th>
          <th style="width: 90px;">服務費 ($)</th>
          <th style="width: 100px;">實際收入 ($)</th>
          <th style="width: 90px;">入款日期</th>
          <th style="width: 110px;">每月總收入</th>
          <th style="width: 60px;">操作</th>
        </tr>
      `;

      yfAutoSortByDate(lendingIncomeRows, 'paymentDate');

      const searchBox = document.getElementById('searchBox');
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
      let rows = lendingIncomeRows.map((r, idx) => ({ r, idx }));
      if (query) {
        rows = rows.filter(({ r }) => (r.name || '').toLowerCase().includes(query));
      }

      const COL_COUNT = 11;
      let bodyHtml = '';

      if (rows.length === 0) {
        bodyHtml = `<tr><td colspan="${COL_COUNT}" style="text-align:center; padding:30px; color:#94a3b8;">尚無借卷收入紀錄，點擊上方「＋」新增一列</td></tr>`;
      } else {
        // 每月合計：依「入款日期」所在月份分組，合併儲存格顯示
        const monthCount = {};
        rows.forEach(({ r }) => {
          const key = lendingMonthKeyOf(r.paymentDate);
          if (key) monthCount[key] = (monthCount[key] || 0) + 1;
        });
        const renderedMonths = {};

        bodyHtml = rows.map(({ r, idx }) => {
          const income = Number(r.income) || 0;
          const serviceFee = Number(r.serviceFee) || 0;
          const actualIncome = income - serviceFee;
          const mKey = lendingMonthKeyOf(r.paymentDate);

          let monthTotalHtml = `<td class="font-mono" style="color:#c9bfa8;">—</td>`;
          if (mKey) {
            if (!renderedMonths[mKey]) {
              renderedMonths[mKey] = true;
              const span = monthCount[mKey];
              const monthSum = rows
                .filter(({ r: rr }) => lendingMonthKeyOf(rr.paymentDate) === mKey)
                .reduce((s, { r: rr }) => s + ((Number(rr.income) || 0) - (Number(rr.serviceFee) || 0)), 0);
              monthTotalHtml = `<td class="font-mono font-bold" style="background:#f8f6f0; vertical-align:middle;" ${span > 1 ? `rowspan="${span}"` : ''}>$${formatNum(monthSum, 0)}</td>`;
            } else {
              monthTotalHtml = '';
            }
          }

          return `
            <tr>
              <td class="editable-col"><input type="text" class="cell-input font-bold" list="stockNameDatalist" data-row="${idx}" data-col="0" value="${esc(r.name || '')}" placeholder="選擇或輸入股票名稱" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 0)" onchange="updateLendingIncomeRow(${idx}, 'name', this.value)" /></td>
              <td class="editable-col"><input type="text" class="cell-input font-mono" data-row="${idx}" data-col="1" value="${esc(r.lendDate || '')}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 1)" onchange="updateLendingIncomeRow(${idx}, 'lendDate', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-row="${idx}" data-col="2" value="${esc(Number(r.lentShares) || 0)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 2)" onchange="updateLendingIncomeRow(${idx}, 'lentShares', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-row="${idx}" data-col="3" value="${esc(Number(r.feeRate) || 0)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 3)" onchange="updateLendingIncomeRow(${idx}, 'feeRate', this.value)" /></td>
              <td class="editable-col"><input type="text" class="cell-input font-mono" data-row="${idx}" data-col="4" value="${esc(r.returnDate || '')}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 4)" onchange="updateLendingIncomeRow(${idx}, 'returnDate', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-row="${idx}" data-col="5" value="${esc(income)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 5)" onchange="updateLendingIncomeRow(${idx}, 'income', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-row="${idx}" data-col="6" value="${esc(serviceFee)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 6)" onchange="updateLendingIncomeRow(${idx}, 'serviceFee', this.value)" /></td>
              <td class="font-mono font-bold" style="color:${actualIncome >= 0 ? 'var(--up-red)' : 'var(--down-green)'};">$${formatNum(actualIncome, 0)}</td>
              <td class="editable-col"><input type="text" class="cell-input font-mono" data-row="${idx}" data-col="7" value="${esc(r.paymentDate || '')}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 7)" onchange="updateLendingIncomeRow(${idx}, 'paymentDate', this.value)" /></td>
              ${monthTotalHtml}
              <td><button class="btn-del" title="刪除" onclick="deleteLendingIncomeRow(${idx})">✕</button></td>
            </tr>
          `;
        }).join('');
      }

      tbody.innerHTML = bodyHtml + renderLendingYearlyTotalRows(COL_COUNT);
      renderSummary();
    }

    function updateLendingIncomeRow(index, field, value) {
      recordSnapshot();
      const row = lendingIncomeRows[index];
      if (!row) return;
      if (['name', 'lendDate', 'returnDate', 'paymentDate'].includes(field)) {
        row[field] = value;
      } else {
        row[field] = parseFloat(value) || 0;
      }
      saveToStorage();
      renderTable();
    }

    function addLendingIncomeRow() {
      recordSnapshot();
      lendingIncomeRows.push({ id: Date.now(), name: '', lendDate: '', lentShares: 0, feeRate: 0, returnDate: '', income: 0, serviceFee: 0, paymentDate: '' });
      saveToStorage();
      renderTable();
    }

    function deleteLendingIncomeRow(index) {
      if (confirm('確定要刪除這筆借卷收入紀錄嗎？')) {
        recordSnapshot();
        lendingIncomeRows.splice(index, 1);
        saveToStorage();
        renderTable();
      }
    }

    function updateLendingManualYearly(year, value) {
      recordSnapshot();
      lendingIncomeManualYearly[year] = parseFloat(value) || 0;
      saveToStorage();
      renderTable();
    }
