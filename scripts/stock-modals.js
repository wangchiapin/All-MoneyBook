/* 股票管理：股利彈窗、歷年股利明細彈窗、備註彈窗
   從 stock.js 拆出來的檔案，功能沒有改變。
   跟其他 script 一樣靠瀏覽器共用的全域變數運作（stocks、saveToStorage、renderTable 等都在 stock.js），
   index.html 要放在 stock.js 後面載入。 */

    /* ====== 分離式股利彈窗 ====== */
    /* ====== Task 5: 歷年股利總合 - 單一年度所有持股現金股利明細彈窗 ====== */
    function openYearlyDivDetailModal(rawKey, displayYear) {
      const rows = [];
      let total = 0;

      stocks.forEach(st => {
        const isUS = isUsStock(st);
        const fxRate = isUS ? getUsdRate() : 1;
        (st.dividendHistory || []).forEach(dh => {
          if (normalizeYearKey(dh.year) !== rawKey) return;
          const cash = (Number(dh.cash) || 0) * fxRate;
          if (cash <= 0) return;
          rows.push({ name: st.name, date: dh.cashDate || '—', cash });
          total += cash;
        });
      });

      rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

      const titleEl = document.getElementById('yearlyDivDetailTitle');
      if (titleEl) titleEl.textContent = `📅 ${displayYear} 年度現金股利明細`;

      const bodyEl = document.getElementById('yearlyDivDetailBody');
      if (bodyEl) {
        bodyEl.innerHTML = rows.length ? rows.map(r => `
          <tr>
            <td>${esc(r.name)}</td>
            <td class="font-mono">${esc(r.date)}</td>
            <td class="font-mono">$${formatNum(r.cash, 0)}</td>
          </tr>
        `).join('') : `<tr><td colspan="3" style="color:#93897a;">該年度沒有現金股利紀錄</td></tr>`;
      }

      const totalEl = document.getElementById('yearlyDivDetailTotal');
      if (totalEl) totalEl.textContent = '$' + formatNum(total, 0);

      const modal = document.getElementById('yearlyDivDetailModal');
      if (modal) modal.classList.add('open');
    }

    function closeYearlyDivDetailModal() {
      const modal = document.getElementById('yearlyDivDetailModal');
      if (modal) modal.classList.remove('open');
    }

    /* ====== 通用備註彈窗：目前用於「股票賣出明細」的備考欄位 ====== */
    let noteModalContext = null; // { type: 'sale', index }

    function openNoteModal(type, index) {
      noteModalContext = { type, index };
      let currentNote = '';
      if (type === 'sale' && stockSales[index]) {
        currentNote = stockSales[index].note || '';
      }
      const titleEl = document.getElementById('noteModalTitle');
      if (titleEl) titleEl.textContent = '📝 備註';
      const textarea = document.getElementById('noteModalTextarea');
      if (textarea) textarea.value = currentNote;
      const modal = document.getElementById('noteModal');
      if (modal) modal.classList.add('open');
    }

    function closeNoteModal() {
      const modal = document.getElementById('noteModal');
      if (modal) modal.classList.remove('open');
      noteModalContext = null;
    }

    function saveNoteModal() {
      if (!noteModalContext) return;
      const textarea = document.getElementById('noteModalTextarea');
      const value = textarea ? textarea.value : '';
      recordSnapshot();
      if (noteModalContext.type === 'sale' && stockSales[noteModalContext.index]) {
        stockSales[noteModalContext.index].note = value;
      }
      saveToStorage();
      closeNoteModal();
      renderTable();
    }

    function openDividendModal(stockId, type = 'cash') {
      currentModalType = type;
      let target = null;
      let isMerged = false;

      if (typeof stockId === 'string' && stockId.startsWith('merged_')) {
        isMerged = true;
        const mergedList = getMergedTaiwanStocks();
        target = mergedList.find(m => m.id === stockId);
      } else {
        target = stocks.find(s => s.id === Number(stockId));
      }

      if (!target) return;
      currentEditingStockId = stockId;

      const isUS = isUsStock(target);
      const fxRate = isUS ? getUsdRate() : 1;
      const unitSymbol = isUS ? 'US$' : '$';

      const curPrice = (Number(target.currentPrice) || 0) * fxRate;
      const modalHead = document.getElementById('dividendModalHead');

      if (type === 'cash') {
        document.getElementById('modalTitle').textContent = `💰 ${target.name} (${target.code || '-'}) - 歷年現金股利明細 ${isMerged ? '(跨帳戶合計)' : ''} ${isUS ? '[美金]' : ''}`;
        document.getElementById('modalSubTitle').textContent = `記錄每年現金股利金額與入帳時間`;
        document.getElementById('modalFooterLabel').textContent = '現金股利總計：';
        modalHead.innerHTML = `
          <tr style="background:#f1f5f9; color:#475569;">
            <th style="width: 100px;">發放年度</th>
            <th style="width: 180px;">現金股利匯入時間</th>
            <th style="width: 180px; color:#d97706;">現金股利金額 (${unitSymbol})</th>
            <th style="width: 60px;">刪除</th>
          </tr>
        `;
      } else {
        document.getElementById('modalTitle').textContent = `📈 ${target.name} (${target.code || '-'}) - 歷年股票股利明細 ${isMerged ? '(跨帳戶合計)' : ''}`;
        document.getElementById('modalSubTitle').textContent = `最新現價：${unitSymbol}${formatNum(curPrice / fxRate, isUS ? 2 : 2)}（依現價折算扣抵市值）`;
        document.getElementById('modalFooterLabel').textContent = '股票股利折算總市值：';
        modalHead.innerHTML = `
          <tr style="background:#f1f5f9; color:#475569;">
            <th style="width: 90px;">發放年度</th>
            <th style="width: 160px;">股票股利匯入時間</th>
            <th style="width: 130px; color:#1d4ed8;">配股股數 (股)</th>
            <th style="width: 150px;">現價折算市值 (${unitSymbol})</th>
            <th style="width: 50px;">刪除</th>
          </tr>
        `;
      }
      
      const history = (target.dividendHistory || []).map(h => ({
        year: h.year || 2024,
        cashDate: h.cashDate || '',
        cash: Number(h.cash !== undefined ? h.cash : 0),
        stockDate: h.stockDate || '',
        stockShares: Number(h.stockShares !== undefined ? h.stockShares : (h.stock || 0))
      }));

      renderDividendModalRows(history, curPrice / fxRate, isReadOnly = isMerged, unitSymbol);
      
      const btnAdd = document.getElementById('btnAddDivRow');
      const btnSave = document.getElementById('btnSaveDivModal');
      if (isMerged) {
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnSave) btnSave.style.display = 'none';
      } else {
        if (btnAdd) btnAdd.style.display = 'block';
        if (btnSave) btnSave.style.display = 'block';
      }

      document.getElementById('dividendModal').classList.add('open');
    }

    function closeDividendModal() {
      document.getElementById('dividendModal').classList.remove('open');
      currentEditingStockId = null;
    }

    function renderDividendModalRows(history, currentPrice, isReadOnly = false, unitSymbol = '$') {
      const tbody = document.getElementById('dividendTableBody');
      let totalAmount = 0;

      if (currentModalType === 'cash') {
        tbody.innerHTML = history.map((item, idx) => {
          const cash = Number(item.cash) || 0;
          totalAmount += cash;

          return `
            <tr>
              <td>
                ${isReadOnly ? `<span class="font-bold">${esc(item.year)}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-weight:700;" value="${esc(item.year || 2024)}" onchange="updateDividendRow(${idx}, 'year', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span>${esc(item.cashDate || '-')}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-size:0.85rem;" placeholder="YYYY-MM-DD" value="${esc(item.cashDate || '')}" onchange="updateDividendRow(${idx}, 'cashDate', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span class="font-mono font-bold" style="color:#d97706;">${unitSymbol}${formatNum(cash, 0)}</span>` : `
                  <input type="number" step="any" class="cell-input font-mono" style="border:1px solid #cbd5e1; color:#d97706; font-weight:700;" value="${esc(cash)}" onchange="updateDividendRow(${idx}, 'cash', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span style="color:#94a3b8;">-</span>` : `
                  <button class="btn-del" title="刪除此年度" onclick="removeDividendRow(${idx})">✕</button>
                `}
              </td>
            </tr>
          `;
        }).join('');

        document.getElementById('modalTotalDiv').style.color = '#9c7c52';
        document.getElementById('modalTotalDiv').textContent = unitSymbol + formatNum(totalAmount, 0);

      } else {
        tbody.innerHTML = history.map((item, idx) => {
          const sShares = Number(item.stockShares) || 0;
          const stockVal = sShares * currentPrice;
          totalAmount += stockVal;

          return `
            <tr>
              <td>
                ${isReadOnly ? `<span class="font-bold">${esc(item.year)}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-weight:700;" value="${esc(item.year || 2024)}" onchange="updateDividendRow(${idx}, 'year', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span>${esc(item.stockDate || '-')}</span>` : `
                  <input type="text" class="cell-input" style="border:1px solid #cbd5e1; font-size:0.85rem;" placeholder="YYYY-MM-DD" value="${esc(item.stockDate || '')}" onchange="updateDividendRow(${idx}, 'stockDate', this.value)" />
                `}
              </td>
              <td>
                ${isReadOnly ? `<span class="font-mono font-bold" style="color:#1d4ed8;">${formatNum(sShares, 0)}</span>` : `
                  <input type="number" step="any" class="cell-input font-mono" style="border:1px solid #cbd5e1; color:#1d4ed8; font-weight:700;" value="${esc(sShares)}" onchange="updateDividendRow(${idx}, 'stockShares', this.value)" />
                `}
              </td>
              <td class="font-mono font-bold" style="background:#f8fafc; color:#1d4ed8;">
                ${unitSymbol}${formatNum(stockVal, 0)}
              </td>
              <td>
                ${isReadOnly ? `<span style="color:#94a3b8;">-</span>` : `
                  <button class="btn-del" title="刪除此年度" onclick="removeDividendRow(${idx})">✕</button>
                `}
              </td>
            </tr>
          `;
        }).join('');

        document.getElementById('modalTotalDiv').style.color = '#5c5445';
        document.getElementById('modalTotalDiv').textContent = unitSymbol + formatNum(totalAmount, 0);
      }
    }

    function addDividendYear() {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (!stock) return;
      if (!stock.dividendHistory) stock.dividendHistory = [];
      const lastYear = stock.dividendHistory.length > 0 ? Math.max(...stock.dividendHistory.map(h => Number(h.year) || 2024)) + 1 : new Date().getFullYear();
      stock.dividendHistory.push({ year: lastYear, cashDate: '', cash: 0, stockDate: '', stockShares: 0 });
      const isUS = isUsStock(stock);
      renderDividendModalRows(stock.dividendHistory, Number(stock.currentPrice) || 0, false, isUS ? 'US$' : '$');
    }

    function updateDividendRow(index, field, value) {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (!stock || !stock.dividendHistory[index]) return;
      stock.dividendHistory[index][field] = (field === 'cash' || field === 'stockShares') ? (parseFloat(value) || 0) : value;
      const isUS = isUsStock(stock);
      renderDividendModalRows(stock.dividendHistory, Number(stock.currentPrice) || 0, false, isUS ? 'US$' : '$');
    }

    function removeDividendRow(index) {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (!stock || !stock.dividendHistory) return;
      stock.dividendHistory.splice(index, 1);
      const isUS = isUsStock(stock);
      renderDividendModalRows(stock.dividendHistory, Number(stock.currentPrice) || 0, false, isUS ? 'US$' : '$');
    }

    function saveDividendModal() {
      const stock = stocks.find(s => s.id === Number(currentEditingStockId));
      if (stock) {
        recordSnapshot();
        const cashSum = (stock.dividendHistory || []).reduce((sum, h) => sum + (Number(h.cash) || 0), 0);
        const stockSharesSum = (stock.dividendHistory || []).reduce((sum, h) => sum + (Number(h.stockShares) || 0), 0);
        stock.cashDividends = cashSum;
        stock.stockShares = stockSharesSum;
        saveToStorage();
        renderTable();
      }
      closeDividendModal();
    }
