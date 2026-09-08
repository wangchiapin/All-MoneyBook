    /* ====== 媽的永豐 三表 + 總覽｜yfDetail / yfAccount / yfDividendRows / yfOverview 相關函式 ======
       此檔案從 stock.js 拆分出來（架構重構 Phase 3），沿用 stock.js 頂部宣告的
       全域狀態變數（stocks / customAccounts / dcaRows / yfDetail ... 等），
       靠瀏覽器對 classic <script> 標籤的共用全域作用域運作，
       不需要 import/export，index.html 只要確保這個檔案在 stock.js 之前或之後載入皆可
       （所有呼叫都發生在 window.onload 之後，屆時所有 <script> 都已執行完畢）。 ====== */

    /* ====== 媽的永豐 四個獨立子部分渲染函數 ====== */
    /* ====== 媽的永豐：共用工具函式 (日期解析/民國轉換/格式化) ====== */
    function yfParseDateInt(val) {
      if (!val) return 99999999;
      let str = String(val).trim();
      let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return parseInt(match[1] + match[2] + match[3], 10);
      let numStr = str.replace(/[^0-9]/g, '');
      if (numStr.length >= 8 && numStr.startsWith('20')) {
        return parseInt(numStr.substring(0, 8), 10);
      } else if (numStr.length === 7 || numStr.length === 6) {
        let cutIndex = numStr.length - 4;
        let rocYear = parseInt(numStr.substring(0, cutIndex), 10);
        let westernYear = rocYear + 1911;
        return parseInt(westernYear + numStr.substring(cutIndex), 10);
      }
      return 99999999;
    }

    function yfToROCString(val) {
      if (!val) return val;
      let str = String(val).trim();
      let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        let rocYear = parseInt(match[1], 10) - 1911;
        return String(rocYear) + match[2] + match[3];
      }
      return str;
    }

    function yfParseNum(str) {
      if (str === null || str === undefined || str === '') return 0;
      return parseFloat(String(str).replace(/,/g, '')) || 0;
    }

    function yfAutoSortByDate(arr, dateField) {
      const withDate = [];
      const withoutDate = [];
      arr.forEach(r => {
        const v = r[dateField];
        if (v && String(v).trim() !== '' && yfParseDateInt(v) !== 99999999) {
          withDate.push(r);
        } else {
          withoutDate.push(r);
        }
      });
      withDate.sort((a, b) => yfParseDateInt(a[dateField]) - yfParseDateInt(b[dateField]));
      const newArr = withDate.concat(withoutDate);
      arr.length = 0;
      newArr.forEach(r => arr.push(r));
    }

    /* ====== 媽的永豐：除息股利自動分配 (依買進日期 < 除息日 加總持有股數) ====== */
    function computeYfDividendDistribution() {
      const exRows = yfDividendRows
        .map((r, idx) => ({ idx, val: yfParseDateInt(r.exDate) }))
        .filter(r => r.val !== 99999999)
        .sort((a, b) => a.val - b.val);

      let cumulative = 0;
      exRows.forEach(({ idx, val: exDate }) => {
        const row = yfDividendRows[idx];
        let sumShares = 0;
        yfDetail.forEach(d => {
          if (yfParseDateInt(d.date) < exDate) sumShares += Number(d.shares) || 0;
        });
        const cashPerShare = Number(row.cashPerShare) || 0;
        const divAmt = Math.round(cashPerShare * sumShares);
        cumulative += divAmt;
        row.heldShares = sumShares;
        row.divAmount = divAmt;
        row.cumulative = cumulative;
      });

      // 沒有有效除息日的列，歸零顯示
      yfDividendRows.forEach(r => {
        if (yfParseDateInt(r.exDate) === 99999999) {
          r.heldShares = 0;
          r.divAmount = 0;
          r.cumulative = 0;
        }
      });

      return cumulative;
    }

    /* ====== 媽的永豐：帳戶餘額累計 ====== */
    function computeYfAccountBalance() {
      let running = 0;
      yfAccount.forEach(r => {
        if (r.amount !== '' && r.amount !== null && r.amount !== undefined) {
          running += Number(r.amount) || 0;
          r.balance = running;
        } else if (r.date) {
          r.balance = running;
        } else {
          r.balance = 0;
        }
      });
    }

    /* ====== 媽的永豐：買賣明細列的除息區間底色 (淡綠/淡藍 交替區分區間) ====== */
    function yfDetailRowColor(tradeDateStr, exDivDates) {
      if (!tradeDateStr || String(tradeDateStr).trim() === '') return '';
      const tradeDate = yfParseDateInt(tradeDateStr);
      const palette = ['#e3edf7', '#fbe4e4']; // 淡藍色 / 淡紅色 交替
      let colorIndex = exDivDates.length;
      for (let i = 0; i < exDivDates.length; i++) {
        if (tradeDate < exDivDates[i]) { colorIndex = i; break; }
      }
      return palette[colorIndex % palette.length];
    }

    /* ====== 媽的永豐：買賣明細表 ====== */
    function renderYfDetailTable() {
      const thead = document.getElementById('yfDetailHead');
      const tbody = document.getElementById('yfDetailBody');
      const foot = document.getElementById('yfDetailFoot');
      if (!thead || !tbody) return;

      if (isPageLocked('yf_detail')) {
        thead.innerHTML = `<tr><th>提示</th></tr>`;
        tbody.innerHTML = `<tr><td style="text-align:center; padding:40px 16px;">${lockPlaceholderHtml('yf_detail', 'page')}</td></tr>`;
        if (foot) foot.innerHTML = '';
        return;
      }

      thead.innerHTML = `
        <tr>
          <th style="width:24%;">日期</th>
          <th style="width:18%;">股數</th>
          <th style="width:20%;">成交價</th>
          <th style="width:26%;">投資成本</th>
          <th style="width:12%;">操作</th>
        </tr>
      `;

      const exDivDates = yfDividendRows
        .map(r => yfParseDateInt(r.exDate))
        .filter(v => v !== 99999999)
        .sort((a, b) => a - b);

      let totalShares = 0, totalCost = 0;
      tbody.innerHTML = yfDetail.map((r, idx) => {
        totalShares += Number(r.shares) || 0;
        totalCost += Number(r.cost) || 0;
        const bg = yfDetailRowColor(r.date, exDivDates);
        const bgStyle = bg ? ` style="background:${bg};"` : '';
        return `
        <tr${bgStyle}>
          <td class="editable-col"${bgStyle}><input type="text" class="cell-input font-mono" data-yf-table="detail" data-row="${idx}" data-col="0" value="${esc(r.date || '')}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 0)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'date', this.value), 0)" onchange="updateYfDetail(${idx}, 'date', this.value)" /></td>
          <td class="editable-col"${bgStyle}><input type="number" step="any" class="cell-input font-mono" data-yf-table="detail" data-row="${idx}" data-col="1" value="${esc(r.shares || 0)}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 1)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'shares', this.value), 0)" onchange="updateYfDetail(${idx}, 'shares', this.value)" /></td>
          <td class="editable-col"${bgStyle}><input type="number" step="any" class="cell-input font-mono" data-yf-table="detail" data-row="${idx}" data-col="2" value="${esc(r.price || 0)}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 2)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'price', this.value), 0)" onchange="updateYfDetail(${idx}, 'price', this.value)" /></td>
          <td class="editable-col"${bgStyle}><input type="number" step="any" class="cell-input font-mono font-bold" data-yf-table="detail" data-row="${idx}" data-col="3" value="${esc(r.cost || 0)}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'detail', ${idx}, 3)" onpaste="setTimeout(() => updateYfDetail(${idx}, 'cost', this.value), 0)" onchange="updateYfDetail(${idx}, 'cost', this.value)" /></td>
          <td${bgStyle}><button class="btn-del" onclick="deleteYfDetailRow(${idx})">✕</button></td>
        </tr>
      `;
      }).join('');

      const footRow = document.getElementById('yfDetailFoot');
      if (footRow) {
        footRow.innerHTML = `<td class="font-bold">小計</td><td class="font-mono font-bold">${formatNum(totalShares, 0)}</td><td></td><td class="font-mono font-bold">${formatNum(totalCost, 0)}</td><td></td>`;
      }
    }

    function updateYfDetail(idx, field, val) {
      recordSnapshot();
      if (!yfDetail[idx]) return;
      if (field === 'date') {
        yfDetail[idx].date = yfToROCString(val);
        yfAutoSortByDate(yfDetail, 'date');
      } else {
        yfDetail[idx][field] = parseFloat(val) || 0;
      }
      computeYfDividendDistribution();
      yfOverview.totalDividend = yfDividendRows.length ? yfDividendRows[yfDividendRows.length - 1].cumulative || 0 : 0;
      saveToStorage();
      renderTable();
    }

    function deleteYfDetailRow(idx) {
      if (confirm('確定刪除此筆買賣明細？')) {
        recordSnapshot();
        yfDetail.splice(idx, 1);
        computeYfDividendDistribution();
        saveToStorage();
        renderTable();
      }
    }

    function addYfDetailRow() {
      recordSnapshot();
      yfDetail.push({ date: '', shares: 0, price: 0, cost: 0 });
      saveToStorage();
      renderTable();
    }

    /* ====== 媽的永豐：永豐帳戶明細表 ====== */
    function renderYfAccountTable() {
      const thead = document.getElementById('yfAccountHead');
      const tbody = document.getElementById('yfAccountBody');
      if (!thead || !tbody) return;

      if (isPageLocked('yf_account')) {
        thead.innerHTML = `<tr><th>提示</th></tr>`;
        tbody.innerHTML = `<tr><td style="text-align:center; padding:40px 16px;">${lockPlaceholderHtml('yf_account', 'page')}</td></tr>`;
        return;
      }

      thead.innerHTML = `
        <tr>
          <th style="width:15%;">日期</th>
          <th style="width:11%;">款項</th>
          <th style="width:22%;">明細</th>
          <th style="width:14%;">金額</th>
          <th style="width:14%;">餘額</th>
          <th style="width:16%;">備考</th>
          <th style="width:8%;">操作</th>
        </tr>
      `;

      tbody.innerHTML = yfAccount.map((r, idx) => `
        <tr>
          <td class="editable-col"><input type="text" class="cell-input font-mono" data-yf-table="account" data-row="${idx}" data-col="0" value="${esc(r.date || '')}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 0)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'date', this.value), 0)" onchange="updateYfAccount(${idx}, 'date', this.value)" /></td>
          <td class="editable-col">
            <select class="cell-input" data-yf-table="account" data-row="${idx}" data-col="1" onkeydown="handleYfTableKey(event, 'account', ${idx}, 1)" onchange="updateYfAccount(${idx}, 'type', this.value)">
              <option value="入帳" ${r.type === '入帳' ? 'selected' : ''}>入帳</option>
              <option value="出帳" ${r.type === '出帳' ? 'selected' : ''}>出帳</option>
            </select>
          </td>
          <td class="editable-col"><input type="text" class="cell-input" data-yf-table="account" data-row="${idx}" data-col="2" value="${esc(r.detail || '')}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 2)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'detail', this.value), 0)" onchange="updateYfAccount(${idx}, 'detail', this.value)" /></td>
          <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-yf-table="account" data-row="${idx}" data-col="3" value="${esc(r.amount || 0)}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 3)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'amount', this.value), 0)" onchange="updateYfAccount(${idx}, 'amount', this.value)" /></td>
          <td class="font-mono" style="text-align:right; padding-right:8px; color:var(--text-muted);">${formatNum(r.balance || 0, 0)}</td>
          <td class="editable-col"><input type="text" class="cell-input" data-yf-table="account" data-row="${idx}" data-col="4" value="${esc(r.note || '')}" title="${esc(r.note || '')}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'account', ${idx}, 4)" onpaste="setTimeout(() => updateYfAccount(${idx}, 'note', this.value), 0)" onchange="updateYfAccount(${idx}, 'note', this.value)" /></td>
          <td><button class="btn-del" onclick="deleteYfAccountRow(${idx})">✕</button></td>
        </tr>
      `).join('');
    }

    function updateYfAccount(idx, field, val) {
      recordSnapshot();
      if (!yfAccount[idx]) return;
      if (field === 'date') {
        yfAccount[idx].date = yfToROCString(val);
        yfAutoSortByDate(yfAccount, 'date');
      } else if (field === 'amount') {
        yfAccount[idx][field] = parseFloat(val) || 0;
      } else {
        yfAccount[idx][field] = val;
      }
      computeYfAccountBalance();
      saveToStorage();
      renderTable();
    }

    function deleteYfAccountRow(idx) {
      if (confirm('確定刪除此筆帳戶明細？')) {
        recordSnapshot();
        yfAccount.splice(idx, 1);
        computeYfAccountBalance();
        saveToStorage();
        renderTable();
      }
    }

    function addYfAccountRow() {
      recordSnapshot();
      yfAccount.push({ date: '', type: '入帳', detail: '', amount: 0, balance: 0, note: '' });
      saveToStorage();
      renderTable();
    }

    /* ====== 媽的永豐：除息資訊表 ====== */
    function renderYfDividendTable() {
      const thead = document.getElementById('yfDividendHead');
      const tbody = document.getElementById('yfDividendBody');
      if (!thead || !tbody) return;

      if (isPageLocked('yf_dividend')) {
        thead.innerHTML = `<tr><th>提示</th></tr>`;
        tbody.innerHTML = `<tr><td style="text-align:center; padding:40px 16px;">${lockPlaceholderHtml('yf_dividend', 'page')}</td></tr>`;
        return;
      }

      thead.innerHTML = `
        <tr>
          <th style="width:16%;">除息日</th>
          <th style="width:13%;">現金股利</th>
          <th style="width:16%;">發放日</th>
          <th style="width:14%;">持有股數</th>
          <th style="width:12%;">股利</th>
          <th style="width:16%;">累計領取</th>
          <th style="width:13%;">操作</th>
        </tr>
      `;

      tbody.innerHTML = yfDividendRows.map((r, idx) => `
        <tr>
          <td class="editable-col"><input type="text" class="cell-input font-mono" data-yf-table="dividend" data-row="${idx}" data-col="0" value="${esc(r.exDate || '')}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'dividend', ${idx}, 0)" onpaste="setTimeout(() => updateYfDividend(${idx}, 'exDate', this.value), 0)" onchange="updateYfDividend(${idx}, 'exDate', this.value)" /></td>
          <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-yf-table="dividend" data-row="${idx}" data-col="1" value="${esc(r.cashPerShare || 0)}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'dividend', ${idx}, 1)" onpaste="setTimeout(() => updateYfDividend(${idx}, 'cashPerShare', this.value), 0)" onchange="updateYfDividend(${idx}, 'cashPerShare', this.value)" /></td>
          <td class="editable-col"><input type="text" class="cell-input font-mono" data-yf-table="dividend" data-row="${idx}" data-col="2" value="${esc(r.payDate || '')}" onfocus="this.select()" onkeydown="handleYfTableKey(event, 'dividend', ${idx}, 2)" onpaste="setTimeout(() => updateYfDividend(${idx}, 'payDate', this.value), 0)" onchange="updateYfDividend(${idx}, 'payDate', this.value)" /></td>
          <td class="font-mono" style="text-align:right; padding-right:8px; color:var(--text-muted);">${formatNum(r.heldShares || 0, 0)}</td>
          <td class="font-mono" style="text-align:right; padding-right:8px; color:var(--text-muted);">${formatNum(r.divAmount || 0, 0)}</td>
          <td class="font-mono font-bold" style="text-align:right; padding-right:8px;">${formatNum(r.cumulative || 0, 0)}</td>
          <td><button class="btn-del" onclick="deleteYfDividendRow(${idx})">✕</button></td>
        </tr>
      `).join('');
    }

    function updateYfDividend(idx, field, val) {
      recordSnapshot();
      if (!yfDividendRows[idx]) return;
      if (field === 'exDate' || field === 'payDate') {
        yfDividendRows[idx][field] = yfToROCString(val);
        if (field === 'exDate') yfAutoSortByDate(yfDividendRows, 'exDate');
      } else {
        yfDividendRows[idx][field] = parseFloat(val) || 0;
      }
      computeYfDividendDistribution();
      saveToStorage();
      renderTable();
    }

    function deleteYfDividendRow(idx) {
      if (confirm('確定刪除此筆除息記錄？')) {
        recordSnapshot();
        yfDividendRows.splice(idx, 1);
        computeYfDividendDistribution();
        saveToStorage();
        renderTable();
      }
    }

    function addYfDividendRow() {
      recordSnapshot();
      yfDividendRows.push({ exDate: '', cashPerShare: 0, payDate: '', heldShares: 0, divAmount: 0, cumulative: 0 });
      saveToStorage();
      renderTable();
    }

    /* ====== 媽的永豐：股票投資概況總覽卡片 (成本/股數/總股利自動加總，現值/目標本金手動輸入) ====== */
    function renderYfOverview() {
      const panel = document.getElementById('yfOverviewPanel');
      if (!panel) return;
      if (currentFilter !== 'YONG_FENG_TAB') { panel.style.display = 'none'; return; }
      panel.style.display = 'block';

      const nameEl = document.getElementById('yfOvName');
      const currentEl = document.getElementById('yfOvCurrent');
      const appCostEl = document.getElementById('yfOvActualCost');
      if (nameEl && document.activeElement !== nameEl) nameEl.value = yfOverview.stockName || '';
      if (currentEl && document.activeElement !== currentEl) currentEl.value = yfOverview.currentValue || 0;
      if (appCostEl && document.activeElement !== appCostEl) appCostEl.value = yfOverview.appCost || 0;

      const totalShares = yfDetail.reduce((s, r) => s + (Number(r.shares) || 0), 0);
      const totalCost = yfDetail.reduce((s, r) => s + (Number(r.cost) || 0), 0); // 實際扣款成本：買賣明細加總，僅供參考
      const appCost = Number(yfOverview.appCost) || 0; // APP顯示成本：手動輸入，作為其他卡片的計算基礎
      const currentVal = Number(yfOverview.currentValue) || 0;
      const goal = 100000; // 固定目標本金，不提供編輯欄位
      const dividend = computeYfDividendDistribution();
      yfOverview.totalDividend = dividend;

      const avgPrice = totalShares > 0 ? appCost / totalShares : 0;
      const unrealizedPL = currentVal - appCost;
      const roi = appCost > 0 ? (unrealizedPL / appCost) * 100 : 0;

      const costWithDiv = appCost - dividend;
      const plWithDiv = currentVal - costWithDiv;
      const avgPriceWithDiv = totalShares > 0 ? costWithDiv / totalShares : 0;
      const roiWithDiv = costWithDiv > 0 ? (plWithDiv / costWithDiv) * 100 : 0;
      const debt = goal - appCost;

      document.getElementById('yfOvCost').textContent = '$' + formatNum(totalCost, 0);
      const elCostDiff = document.getElementById('yfOvCostDiff');
      if (elCostDiff) {
        const diff = appCost - totalCost;
        if (Math.abs(diff) < 1) {
          elCostDiff.textContent = '與App顯示成本相符';
          elCostDiff.style.color = '';
        } else {
          elCostDiff.textContent = `${diff > 0 ? '比App顯示成本少記 $' : '比App顯示成本多記 $'}${formatNum(Math.abs(diff), 0)}`;
          elCostDiff.style.color = 'var(--up-red)';
        }
      }
      document.getElementById('yfOvShares').textContent = formatNum(totalShares, 0);
      document.getElementById('yfOvAvgPrice').textContent = formatNum(avgPrice, 2);

      const elProfit = document.getElementById('yfOvProfit');
      elProfit.textContent = '$' + formatNum(unrealizedPL, 0);
      elProfit.style.color = unrealizedPL >= 0 ? 'var(--up-red)' : 'var(--down-green)';
      const elROI = document.getElementById('yfOvROI');
      elROI.textContent = roi.toFixed(2) + '%';
      elROI.style.color = roi >= 0 ? 'var(--up-red)' : 'var(--down-green)';

      document.getElementById('yfOvTotalDiv').textContent = '$' + formatNum(dividend, 0);
      document.getElementById('yfOvCostWithDiv').textContent = '$' + formatNum(costWithDiv, 0);
      const elProfitDiv = document.getElementById('yfOvProfitWithDiv');
      elProfitDiv.textContent = '$' + formatNum(plWithDiv, 0);
      elProfitDiv.style.color = plWithDiv >= 0 ? 'var(--up-red)' : 'var(--down-green)';
      document.getElementById('yfOvAvgPriceWithDiv').textContent = formatNum(avgPriceWithDiv, 2);
      const elROIWithDiv = document.getElementById('yfOvROIWithDiv');
      elROIWithDiv.textContent = roiWithDiv.toFixed(2) + '%';
      elROIWithDiv.style.color = roiWithDiv >= 0 ? 'var(--up-red)' : 'var(--down-green)';

      document.getElementById('yfOvRemain').textContent = '$' + formatNum(debt, 0);
    }

    function updateYfOverview(field, val) {
      recordSnapshot();
      yfOverview[field] = (field === 'stockName') ? val : (parseFloat(val) || 0);
      saveToStorage();
      renderYfOverview();
    }



    /* ====== 媽的永豐三表：方向鍵/Enter 在格子間移動 (Ctrl+C/V 由瀏覽器原生處理，貼上後靠 onpaste 同步資料) ====== */
    function handleYfTableKey(event, tableName, row, col) {
      if (event.isComposing || event.keyCode === 229) return; // 輸入法組字中不攔截方向鍵
      const key = event.key;
      const el = event.target;
      const isTextField = el.type === 'text';
      let targetRow = row;
      let targetCol = col;
      if (key === 'ArrowDown' || key === 'Enter') {
        targetRow = row + 1;
      } else if (key === 'ArrowUp') {
        targetRow = row - 1;
      } else if (key === 'ArrowRight') {
        if (isTextField && el.selectionStart !== null && el.selectionEnd !== el.value.length) return;
        targetCol = col + 1;
      } else if (key === 'ArrowLeft') {
        if (isTextField && el.selectionStart !== null && el.selectionStart !== 0) return;
        targetCol = col - 1;
      } else {
        return;
      }
      const selector = `[data-yf-table="${tableName}"][data-row="${targetRow}"][data-col="${targetCol}"]`;
      const targetEl = document.querySelector(selector);
      if (targetEl) {
        event.preventDefault();
        targetEl.focus();
        if (targetEl.select) targetEl.select();
        requestAnimationFrame(() => {
          if (document.activeElement !== targetEl) {
            setTimeout(() => {
              const stillThere = document.querySelector(selector);
              if (stillThere) { stillThere.focus(); if (stillThere.select) stillThere.select(); }
            }, 60);
          }
        });
      }
    }


    function renderYfTablesAll(isFreshTabEntry) {
      computeYfAccountBalance();
      computeYfDividendDistribution();
      renderYfOverview();
      renderYfDetailTable();
      renderYfAccountTable();
      renderYfDividendTable();

      // 剛切換進「媽的永豐」分頁時，三張表（買賣明細 / 永豐帳戶明細 / 除息資訊）
      // 各自都是獨立捲動區塊，資料由舊到新排序，所以要各自捲到底部才看得到最新一筆；
      // 之後同分頁內編輯資料觸發的重繪，則不強制捲動，避免打斷使用者正在操作的位置。
      if (isFreshTabEntry) {
        setTimeout(() => {
          ['yfDetailCard', 'yfAccountCard', 'yfDividendCard'].forEach(cardId => {
            const card = document.getElementById(cardId);
            const scrollEl = card ? card.querySelector('.yf-table-scroll') : null;
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
          });
        }, 50);
      }
    }
