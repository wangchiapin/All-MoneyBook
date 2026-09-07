    /* ====== 定期定額分頁 (DCA)｜dcaRows 相關的渲染與編輯函式 ======
       此檔案從 stock.js 拆分出來（架構重構 Phase 3），沿用 stock.js 頂部宣告的
       全域狀態變數（stocks / customAccounts / dcaRows / yfDetail ... 等），
       靠瀏覽器對 classic <script> 標籤的共用全域作用域運作，
       不需要 import/export，index.html 只要確保這個檔案在 stock.js 之前或之後載入皆可
       （所有呼叫都發生在 window.onload 之後，屆時所有 <script> 都已執行完畢）。 ====== */


    /* ====== 定期定額分頁 (DCA_TAB) ======
       dcaRows: { id, name, dates: number[] (每月扣款日，1~31), amount (每次扣款金額) }
       每月扣款總金額 (單一股票) = amount × dates.length */
    function migrateDcaRowLegacyDate(row) {
      // 舊資料格式為單一 date 字串 (例如 "2024-01-15")，搬遷成 dates: [15]
      if (!Array.isArray(row.dates)) {
        const legacyDay = row.date ? parseInt(String(row.date).match(/\d+/g)?.slice(-1)[0], 10) : NaN;
        row.dates = (!isNaN(legacyDay) && legacyDay >= 1 && legacyDay <= 31) ? [legacyDay] : [];
        delete row.date;
      }
      row.dates = (row.dates || []).filter(d => Number.isInteger(d) && d >= 1 && d <= 31).sort((a, b) => a - b);
      return row;
    }

    function renderDcaTable(thead, tbody) {
      refreshStockNameDatalist();
      dcaRows.forEach(migrateDcaRowLegacyDate);

      thead.innerHTML = `
        <tr>
          <th style="width: 180px;">股票名稱</th>
          <th style="width: 150px;">日期 (扣款日)</th>
          <th style="width: 120px;">扣款金額 ($)</th>
          <th style="width: 140px;">每月扣款總金額 ($)</th>
          <th style="width: 60px;">操作</th>
        </tr>
      `;

      // 依股票名稱分組排序，讓同一檔股票相鄰，方便瀏覽
      sortDcaRowsByName();

      const searchBox = document.getElementById('searchBox');
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
      let rows = dcaRows.map((r, idx) => ({ r, idx }));
      if (query) {
        rows = rows.filter(({ r }) => (r.name || '').toLowerCase().includes(query));
      }

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">尚無定期定額紀錄，點擊上方「＋」新增一列</td></tr>`;
        renderSummary();
        return;
      }

      let grandTotal = 0;

      const bodyHtml = rows.map(({ r, idx }) => {
        const amount = Number(r.amount) || 0;
        const dates = r.dates || [];
        const rowTotal = amount * dates.length;
        grandTotal += rowTotal;
        const dateDisplay = dates.length ? dates.map(d => `${d}日`).join('、') : '尚未設定';

        return `
          <tr>
            <td class="editable-col"><input type="text" class="cell-input font-bold" list="stockNameDatalist" data-row="${idx}" data-col="0" value="${esc(r.name || '')}" placeholder="選擇或輸入股票名稱" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 0)" onchange="updateDcaRow(${idx}, 'name', this.value)" /></td>
            <td class="editable-col">
              <button type="button" class="dca-date-picker-btn" data-row="${idx}" data-col="1" onkeydown="handleCellKey(event, ${idx}, 1)" onclick="openDcaDatePicker(${idx})" title="點擊選擇每月扣款日">
                📅 ${dateDisplay}
              </button>
            </td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-row="${idx}" data-col="2" value="${esc(amount)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${idx}, 2)" onchange="updateDcaRow(${idx}, 'amount', this.value)" /></td>
            <td class="font-mono font-bold" style="background:#f0f7f8;">$${formatNum(rowTotal, 0)}</td>
            <td><button class="btn-del" title="刪除" onclick="deleteDcaRow(${idx})">✕</button></td>
          </tr>
        `;
      }).join('');

      const footerHtml = `
        <tr style="background:#f1f5f9; font-weight:800; border-top:2px solid #cbd5e1;">
          <td colspan="3" style="text-align:right; padding-right:12px;">小計</td>
          <td class="font-mono" style="font-size:1rem;">$${formatNum(grandTotal, 0)}</td>
          <td>-</td>
        </tr>
      `;

      tbody.innerHTML = bodyHtml + footerHtml;
      renderSummary();
    }

    function sortDcaRowsByName() {
      const withName = [];
      const withoutName = [];
      dcaRows.forEach(r => {
        if ((r.name || '').trim() !== '') withName.push(r);
        else withoutName.push(r);
      });
      withName.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      const newArr = withName.concat(withoutName);
      dcaRows.length = 0;
      newArr.forEach(r => dcaRows.push(r));
    }

    function updateDcaRow(index, field, value) {
      recordSnapshot();
      const row = dcaRows[index];
      if (!row) return;
      if (field === 'name') {
        row[field] = value;
      } else if (field === 'dates') {
        row.dates = Array.isArray(value) ? value.slice().sort((a, b) => a - b) : [];
      } else {
        row[field] = parseFloat(value) || 0;
      }
      saveToStorage();
      renderTable();
    }

    function addDcaRow() {
      recordSnapshot();
      dcaRows.push({ id: Date.now(), name: '', dates: [], amount: 0 });
      saveToStorage();
      renderTable();
    }

    function deleteDcaRow(index) {
      if (confirm('確定要刪除這筆定期定額紀錄嗎？')) {
        recordSnapshot();
        dcaRows.splice(index, 1);
        saveToStorage();
        renderTable();
      }
    }

    /* ====== 定期定額：扣款日曆選擇器 (只選「每月的哪幾天」，不分月份) ====== */
    let dcaDatePickerTargetIdx = null;
    let dcaDatePickerSelection = [];

    function openDcaDatePicker(idx) {
      const row = dcaRows[idx];
      if (!row) return;
      dcaDatePickerTargetIdx = idx;
      dcaDatePickerSelection = (row.dates || []).slice();
      renderDcaDatePickerGrid();
      const modal = document.getElementById('dcaDatePickerModal');
      if (modal) modal.classList.add('open');
    }

    function closeDcaDatePicker() {
      const modal = document.getElementById('dcaDatePickerModal');
      if (modal) modal.classList.remove('open');
      dcaDatePickerTargetIdx = null;
    }

    function renderDcaDatePickerGrid() {
      const grid = document.getElementById('dcaDatePickerGrid');
      if (!grid) return;
      let html = '';
      for (let d = 1; d <= 31; d++) {
        const isSelected = dcaDatePickerSelection.includes(d);
        html += `<button type="button" class="dca-day-cell${isSelected ? ' selected' : ''}" onclick="toggleDcaDatePickerDay(${d})">${esc(d)}</button>`;
      }
      grid.innerHTML = html;
      const summary = document.getElementById('dcaDatePickerSummary');
      if (summary) {
        const sorted = dcaDatePickerSelection.slice().sort((a, b) => a - b);
        summary.textContent = sorted.length ? `已選擇：每月 ${sorted.map(d => d + '日').join('、')} 扣款` : '尚未選擇任何日期';
      }
    }

    function toggleDcaDatePickerDay(d) {
      const pos = dcaDatePickerSelection.indexOf(d);
      if (pos >= 0) dcaDatePickerSelection.splice(pos, 1);
      else dcaDatePickerSelection.push(d);
      renderDcaDatePickerGrid();
    }

    function confirmDcaDatePicker() {
      if (dcaDatePickerTargetIdx === null) return;
      updateDcaRow(dcaDatePickerTargetIdx, 'dates', dcaDatePickerSelection);
      closeDcaDatePicker();
    }
