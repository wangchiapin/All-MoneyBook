    /* ====== 股票賣出分頁｜stockSales / salesHistory 相關函式 ======
       此檔案從 stock.js 拆分出來（架構重構 Phase 3），沿用 stock.js 頂部宣告的
       全域狀態變數（stocks / customAccounts / dcaRows / yfDetail ... 等），
       靠瀏覽器對 classic <script> 標籤的共用全域作用域運作，
       不需要 import/export，index.html 只要確保這個檔案在 stock.js 之前或之後載入皆可
       （所有呼叫都發生在 window.onload 之後，屆時所有 <script> 都已執行完畢）。 ====== */


    /* ====== 渲染每日買賣紀錄小計表 (自動偵測多年份與月份格式，不顯示年份) ====== */
    function renderSalesSummaryTable(thead, tbody) {
      const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

      const yearSet = new Set(['115']);
      stockSales.forEach(r => {
        let dStr = String(r.date || '').trim();
        if (dStr.length >= 5) {
          let yrPart = dStr.length === 7 ? dStr.slice(0, 3) : (dStr.length === 6 ? dStr.slice(0, 2) : dStr.slice(0, 2));
          if (yrPart) yearSet.add(yrPart);
        }
      });
      salesHistory.forEach(h => {
        if (h.year) yearSet.add(String(h.year));
      });

      const sortedYears = Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
      if (!sortedYears.includes(selectedSummaryYear)) {
        selectedSummaryYear = sortedYears[0] || '115';
      }

      const yrSel = document.getElementById('summaryYearSelect');
      if (yrSel) {
        yrSel.innerHTML = sortedYears.map(yr => `<option value="${esc(yr)}" ${yr === selectedSummaryYear ? 'selected' : ''}>${yr}年</option>`).join('');
      }

      const monthData = Array.from({length: 12}, () => new Map());

      stockSales.forEach(r => {
        let dStr = String(r.date || '').trim();
        if (dStr.length >= 5) {
          let yrPart = '';
          let mPart = '';
          let dayPart = '';

          if (dStr.length === 7) {
            yrPart = dStr.slice(0, 3);
            mPart = dStr.slice(3, 5);
            dayPart = dStr.slice(5, 7);
          } else if (dStr.length === 6) {
            yrPart = dStr.slice(0, 2);
            mPart = dStr.slice(2, 4);
            dayPart = dStr.slice(4, 6);
          } else if (dStr.length === 5) {
            yrPart = dStr.slice(0, 2);
            mPart = '0' + dStr.slice(2, 3);
            dayPart = dStr.slice(3, 5);
          }

          if (yrPart === selectedSummaryYear) {
            let mNum = parseInt(mPart);
            if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
              let dayKey = `${mNum}/${parseInt(dayPart)}`;
              let amt = Number(r.spread) || 0;
              if (monthData[mNum - 1].has(dayKey)) {
                monthData[mNum - 1].set(dayKey, monthData[mNum - 1].get(dayKey) + amt);
              } else {
                monthData[mNum - 1].set(dayKey, amt);
              }
            }
          }
        }
      });

      const monthArrays = monthData.map(map => {
        let arr = [];
        for (let [dayStr, amount] of map.entries()) {
          arr.push({ dayStr, amount });
        }
        return arr;
      });

      let maxRows = Math.max(...monthArrays.map(arr => arr.length), 1);

      let headHtml = `<tr>`;
      monthNames.forEach((m, idx) => {
        const bgHead = idx % 2 === 0 ? 'background:#eef0e6; color:#5c5445;' : 'background:#f4ecd4; color:#6e5439;';
        headHtml += `<th colspan="2" style="${bgHead} font-size:0.95rem; text-align:center;">${selectedSummaryYear}年 ${m}</th>`;
      });
      headHtml += `</tr><tr>`;
      monthNames.forEach((m, idx) => {
        const bgSub = idx % 2 === 0 ? 'background:#fdfbf7; color:#5c5445;' : 'background:#f4ecd4; color:#6e5439;';
        headHtml += `<th style="${bgSub} width:75px;">日期</th><th style="${bgSub} width:85px;">金額</th>`;
      });
      headHtml += `</tr>`;
      thead.innerHTML = headHtml;

      let rowsHtml = '';
      for (let r = 0; r < maxRows; r++) {
        rowsHtml += `<tr>`;
        monthArrays.forEach((arr, mIdx) => {
          const item = arr[r] || { dayStr: '', amount: '' };
          const cellBg = mIdx % 2 === 0 ? 'background:#fdfbf7;' : 'background:#ffffff;';
          const amtVal = item.amount !== '' && item.amount !== undefined ? item.amount : '';
          const isPos = Number(amtVal) >= 0;
          const amtColor = amtVal !== '' ? (isPos ? 'color:var(--up-red); font-weight:700;' : 'color:var(--down-green); font-weight:700;') : '';

          rowsHtml += `
            <td style="${cellBg} font-family:monospace;">${esc(item.dayStr)}</td>
            <td style="${cellBg} font-family:monospace; ${amtColor}">${amtVal !== '' ? (isPos ? '+' : '') + formatNum(amtVal, 0) : ''}</td>
          `;
        });
        rowsHtml += `</tr>`;
      }

      // 小計 row
      rowsHtml += `<tr style="background:#ece7dc; font-weight:700;">`;
      const monthSums = monthArrays.map(arr => arr.reduce((s, it) => s + (Number(it.amount) || 0), 0));
      monthNames.forEach((m, idx) => {
        const sVal = monthSums[idx];
        const isPos = sVal >= 0;
        rowsHtml += `
          <td style="border-top:2px solid #ddd5c4;">小計</td>
          <td class="font-mono" style="border-top:2px solid #ddd5c4; color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(sVal, 0)}</td>
        `;
      });
      rowsHtml += `</tr>`;

      // 總計 row
      const grandTotal = monthSums.reduce((s, v) => s + v, 0);
      rowsHtml += `<tr style="background:#ece6d9; font-weight:800; font-size:0.95rem;">`;
      rowsHtml += `<td colspan="2">總計</td>`;
      rowsHtml += `<td colspan="22" class="font-mono" style="text-align:left; padding-left:16px; color:${grandTotal >= 0 ? 'var(--up-red)' : 'var(--down-green)'};">${grandTotal >= 0 ? '+' : ''}$${formatNum(grandTotal, 0)}</td>`;
      rowsHtml += `</tr>`;

      // 當沖損益 row
      const dayTradeSums = monthData.map((map, mIdx) => {
        let sum = 0;
        stockSales.forEach(r => {
          let dStr = String(r.date || '').trim();
          if (r.status === '當沖' && dStr.startsWith(selectedSummaryYear)) {
            let mPart = dStr.length === 7 ? dStr.slice(3, 5) : (dStr.length === 6 ? dStr.slice(2, 4) : '0' + dStr.slice(2, 3));
            if (parseInt(mPart) === (mIdx + 1)) {
              sum += Number(r.spread) || 0;
            }
          }
        });
        return sum;
      });

      rowsHtml += `<tr style="background:#f4ecd4; font-weight:700;">`;
      monthNames.forEach((m, idx) => {
        const dtVal = dayTradeSums[idx];
        const isPos = dtVal >= 0;
        rowsHtml += `
          <td>當沖損益</td>
          <td class="font-mono" style="color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(dtVal, 0)}</td>
        `;
      });
      rowsHtml += `</tr>`;

      tbody.innerHTML = rowsHtml;
      renderSummary();
    }

    /* ====== 渲染歷年紀錄表格 (自動帶入統計 + 保持可手動修改) ====== */
    function renderSalesHistoryTable(thead, tbody) {
      thead.innerHTML = `
        <tr>
          <th style="width: 100px;">年份</th>
          <th style="width: 200px;">總成本 ($)</th>
          <th style="width: 200px;">總賣出 ($)</th>
          <th style="width: 180px;">價差 ($)</th>
          <th style="width: 120px;">報酬率</th>
          <th style="width: 80px;">操作</th>
        </tr>
      `;

      let yearMap = new Map();

      // 1. 先放入既有紀錄：114年(含)以前一律視為手動固定；115年(含)以後只有使用者明確編輯過 (isManual===true) 才鎖定
      salesHistory.forEach(h => {
        const yr = String(h.year);
        const forceManual = parseInt(yr) <= 114;
        const manual = forceManual || h.isManual === true;
        yearMap.set(yr, {
          year: yr,
          totalCost: Number(h.totalCost) || 0,
          totalSell: Number(h.totalSell) || 0,
          spread: Number(h.spread) || 0,
          returnRate: Number(h.returnRate) || 0,
          isManual: manual
        });
      });

      // 2. 115年(含)以後，尚未被手動鎖定的年份，一律從「股票賣出明細」自動加總 (每次重新計算)
      let autoTotals = new Map();
      stockSales.forEach(r => {
        let dStr = String(r.date || '').trim();
        if (dStr.length < 5) return;
        let yrPart = dStr.length === 7 ? dStr.slice(0, 3) : (dStr.length === 6 ? dStr.slice(0, 2) : dStr.slice(0, 2));
        if (parseInt(yrPart) < 115) return;
        if (!autoTotals.has(yrPart)) {
          autoTotals.set(yrPart, { totalCost: 0, totalSell: 0, spread: 0 });
        }
        const t = autoTotals.get(yrPart);
        t.totalCost += Number(r.cost) || 0;
        t.totalSell += Number(r.sellAmt) || 0;
        t.spread += Number(r.spread) || 0;
      });

      autoTotals.forEach((t, yr) => {
        const existing = yearMap.get(yr);
        if (existing && existing.isManual) return;
        yearMap.set(yr, {
          year: yr,
          totalCost: t.totalCost,
          totalSell: t.totalSell,
          spread: t.spread,
          returnRate: t.totalCost > 0 ? t.spread / t.totalCost : 0,
          isManual: false
        });
      });

      salesHistory = Array.from(yearMap.values()).sort((a, b) => parseInt(b.year) - parseInt(a.year));

      let rowsHtml = salesHistory.map((h, hIdx) => {
        const isPos = (Number(h.spread) || 0) >= 0;
        const retStr = h.returnRate !== undefined && !isNaN(h.returnRate) ? (h.returnRate * 100).toFixed(2) + '%' : '0.00%';
        const canToggleLock = parseInt(h.year) >= 115; // 114年以前一律手動固定，不可切換
        const lockBtn = canToggleLock
          ? `<button class="btn-del" title="${h.isManual ? '目前手動鎖定，點擊恢復自動加總' : '目前自動加總中，點擊改為手動鎖定'}" onclick="toggleHistoryLock(${hIdx})" style="margin-right:4px;">${h.isManual ? '🔒' : '🔓'}</button>`
          : `<span title="114年以前一律手動固定" style="margin-right:4px; opacity:0.5;">🔒</span>`;
        return `
          <tr>
            <td class="editable-col"><input type="text" class="cell-input font-bold" data-hist-idx="${hIdx}" data-col="0" value="${esc(h.year || '')}" onfocus="this.select()" onkeydown="handleHistoryKey(event, ${hIdx}, 0)" onchange="updateHistoryRow(${hIdx}, 'year', this.value)" /></td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-hist-idx="${hIdx}" data-col="1" value="${esc(h.totalCost !== undefined ? h.totalCost : '')}" onfocus="this.select()" onkeydown="handleHistoryKey(event, ${hIdx}, 1)" onchange="updateHistoryRow(${hIdx}, 'totalCost', this.value)" /></td>
            <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-hist-idx="${hIdx}" data-col="2" value="${esc(h.totalSell !== undefined ? h.totalSell : '')}" onfocus="this.select()" onkeydown="handleHistoryKey(event, ${hIdx}, 2)" onchange="updateHistoryRow(${hIdx}, 'totalSell', this.value)" /></td>
            <td class="font-mono" style="font-weight:700; color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(h.spread, 0)}</td>
            <td class="font-mono" style="color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${esc(retStr)}</td>
            <td style="white-space:nowrap;">
              ${lockBtn}<button class="btn-del" title="刪除" onclick="deleteHistoryRow(${hIdx})">✕</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rowsHtml;
      renderSummary();
    }

    // 115年(含)以後的列，總成本/總賣出欄位不再因為「編輯過」就被隱性鎖定 — 只有透過這個
    // 明確的鎖頭按鈕，使用者才會把某一年切成手動固定，否則永遠跟著「股票賣出明細」自動加總。
    function toggleHistoryLock(index) {
      recordSnapshot();
      if (!salesHistory[index]) return;
      if (parseInt(salesHistory[index].year) < 115) return; // 114年以前不可切換
      salesHistory[index].isManual = !salesHistory[index].isManual;
      saveToStorage();
      renderTable();
    }

    function updateHistoryRow(index, field, value) {
      recordSnapshot();
      if (!salesHistory[index]) return;
      if (field === 'year') {
        salesHistory[index].year = value;
      } else {
        // 手動輸入總成本/總賣出時，只有 115年(含)以後才需要使用者用鎖頭按鈕明確鎖定；
        // 這裡不再自動幫使用者上鎖，避免「不小心點進去改一下」就永久脫離自動加總。
        salesHistory[index][field] = parseFloat(value) || 0;
        salesHistory[index].spread = Number(salesHistory[index].totalSell) - Number(salesHistory[index].totalCost);
        if (Number(salesHistory[index].totalCost) > 0) {
          salesHistory[index].returnRate = salesHistory[index].spread / Number(salesHistory[index].totalCost);
        } else {
          salesHistory[index].returnRate = 0;
        }
      }
      saveToStorage();
      renderTable();
    }

    function handleHistoryKey(e, rowIndex, colIndex) {
      if (e.isComposing || e.keyCode === 229) return; // 輸入法組字中不攔截方向鍵
      const cols = [0, 1, 2];
      const currentIdxInCols = cols.indexOf(colIndex);
      const el = e.target;
      const isTextField = el.type === 'text';
      const jumpTo = (r, c) => {
        const selector = `[data-hist-idx="${r}"][data-col="${c}"]`;
        const targetEl = document.querySelector(selector);
        if (targetEl) {
          targetEl.focus();
          requestAnimationFrame(() => {
            if (document.activeElement !== targetEl) {
              setTimeout(() => {
                const stillThere = document.querySelector(selector);
                if (stillThere) stillThere.focus();
              }, 60);
            }
          });
        }
      };
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (currentIdxInCols < cols.length - 1) {
          jumpTo(rowIndex, cols[currentIdxInCols + 1]);
        } else if (rowIndex < salesHistory.length - 1) {
          jumpTo(rowIndex + 1, cols[0]);
        }
      } else if (e.key === 'ArrowRight') {
        if (isTextField && el.selectionStart !== null && el.selectionEnd !== el.value.length) return;
        if (currentIdxInCols < cols.length - 1) { e.preventDefault(); jumpTo(rowIndex, cols[currentIdxInCols + 1]); }
      } else if (e.key === 'ArrowLeft') {
        if (isTextField && el.selectionStart !== null && el.selectionStart !== 0) return;
        if (currentIdxInCols > 0) { e.preventDefault(); jumpTo(rowIndex, cols[currentIdxInCols - 1]); }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (rowIndex < salesHistory.length - 1) jumpTo(rowIndex + 1, cols[currentIdxInCols]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIndex > 0) jumpTo(rowIndex - 1, cols[currentIdxInCols]);
      }
    }

    function deleteHistoryRow(index) {
      if (confirm('確定要刪除這筆歷年紀錄嗎？')) {
        recordSnapshot();
        salesHistory.splice(index, 1);
        saveToStorage();
        renderTable();
      }
    }

    function addSaleHistoryRow() {
      recordSnapshot();
      salesHistory.push({
        year: String(new Date().getFullYear() - 1911),
        totalCost: 0,
        totalSell: 0,
        spread: 0,
        returnRate: 0,
        isManual: true
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 股票賣出明細即時計算與強健鍵盤導航 (支援 Enter、Tab、方向鍵移動) ====== */
    function updateSaleRow(index, field, value) {
      recordSnapshot();
      const r = stockSales[index];
      if (!r) return;

      if (field === 'date' || field === 'name' || field === 'status') {
        r[field] = value;
      } else {
        r[field] = value === '' ? '' : (parseFloat(value) || 0);
      }

      // 成本 = 股數*買進價格+買進手續費；賣出 = 股數*賣出價格+賣出手續費+交易稅 (自動計算，直接改成本/賣出金額則尊重手動輸入)
      if (field === 'shares' || field === 'buyPrice' || field === 'buyFee') {
        const shares = Number(r.shares) || 0;
        const buyPrice = Number(r.buyPrice) || 0;
        const buyFee = Number(r.buyFee) || 0;
        r.cost = shares * buyPrice + buyFee;
      }
      if (field === 'shares' || field === 'sellPrice' || field === 'sellFee' || field === 'tax') {
        const shares = Number(r.shares) || 0;
        const sellPrice = Number(r.sellPrice) || 0;
        const sellFee = Number(r.sellFee) || 0;
        const tax = Number(r.tax) || 0;
        r.sellAmt = shares * sellPrice - sellFee - tax;
      }

      if (Number(r.cost) > 0 && Number(r.sellAmt) > 0) {
        r.spread = Number(r.sellAmt) - Number(r.cost);
        r.returnRate = r.spread / Number(r.cost);
      }

      if (field === 'date') {
        yfAutoSortByDate(stockSales, 'date');
      }

      recalcSalesDayTotals();

      saveToStorage();
      renderTable();
    }

    /* ====== 依日期重新計算「當日共計」(所有相同日期的列一起加總) ====== */
    function recalcSalesDayTotals() {
      const groups = {};
      stockSales.forEach(r => {
        if (!r.date) return;
        if (!groups[r.date]) groups[r.date] = [];
        groups[r.date].push(r);
      });
      Object.values(groups).forEach(group => {
        const daySum = group.reduce((s, it) => s + (Number(it.spread) || 0), 0);
        group.forEach(it => it.dayTotal = daySum);
      });
    }

    function handleSaleKey(e, rowIndex, colIndex) {
      // 中文/注音等輸入法組字中，方向鍵是用來選字，不能被攔截去跳格，否則會導致焦點行為錯亂
      if (e.isComposing || e.keyCode === 229) return;

      const cols = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12]; // 可編輯欄位索引 (含狀態下拉選單 12)
      let currentIdxInCols = cols.indexOf(colIndex);
      const el = e.target;
      const isTextField = el.type === 'text';

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (currentIdxInCols < cols.length - 1) {
          focusCellSafely(`[data-sale-idx="${rowIndex}"][data-col="${cols[currentIdxInCols + 1]}"]`);
        } else {
          if (rowIndex === stockSales.length - 1) {
            addStockSaleRow();
          } else {
            focusCellSafely(`[data-sale-idx="${rowIndex + 1}"][data-col="${cols[0]}"]`);
          }
        }
      } else if (e.key === 'ArrowRight') {
        // 文字欄位游標不在最尾端時，讓瀏覽器正常移動游標，不要跳格
        if (isTextField && el.selectionStart !== null && el.selectionEnd !== el.value.length) return;
        if (currentIdxInCols < cols.length - 1) {
          e.preventDefault();
          focusCellSafely(`[data-sale-idx="${rowIndex}"][data-col="${cols[currentIdxInCols + 1]}"]`);
        }
      } else if (e.key === 'ArrowLeft') {
        // 文字欄位游標不在最前端時，讓瀏覽器正常移動游標，不要跳格
        if (isTextField && el.selectionStart !== null && el.selectionStart !== 0) return;
        if (currentIdxInCols > 0) {
          e.preventDefault();
          focusCellSafely(`[data-sale-idx="${rowIndex}"][data-col="${cols[currentIdxInCols - 1]}"]`);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusNextExistingSaleCell(rowIndex, cols[currentIdxInCols], 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIndex > 0) {
          focusNextExistingSaleCell(rowIndex, cols[currentIdxInCols], -1);
        }
      }
    }

    // 日期／賣出價格／賣出手續費／交易稅／狀態這幾欄在合併儲存格時，被合併吃掉的列
    // 不會有對應的 input，往上/下移動時直接找下一個「真的存在」的格子，跳過中間被合併的列，
    // 而不是卡住不動。
    function focusNextExistingSaleCell(rowIndex, colIndex, direction) {
      const cells = document.querySelectorAll(`[data-col="${colIndex}"][data-sale-idx]`);
      const indices = Array.from(cells)
        .map(el => Number(el.getAttribute('data-sale-idx')))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
      const target = direction > 0
        ? indices.find(i => i > rowIndex)
        : indices.slice().reverse().find(i => i < rowIndex);
      if (target !== undefined) {
        focusCellSafely(`[data-sale-idx="${target}"][data-col="${colIndex}"]`);
      }
    }

    // 保險用的安全跳格函式：立即嘗試 focus；若因瀏覽器內部狀態（例如輸入法組字剛結束）
    // 導致這次 focus 沒有生效，會在短暫延遲後再嘗試一次，避免焦點整個掉到頁面外、卡住不動。
    function focusCellSafely(selector) {
      const el = document.querySelector(selector);
      if (!el) return;
      el.focus();
      requestAnimationFrame(() => {
        if (document.activeElement !== el) {
          setTimeout(() => {
            const stillThere = document.querySelector(selector);
            if (stillThere) stillThere.focus();
          }, 60);
        }
      });
    }

    function addStockSaleRow() {
      recordSnapshot();
      stockSales.push({
        date: '',
        name: '',
        shares: '',
        buyPrice: '',
        sellPrice: '',
        cost: '',
        sellAmt: '',
        spread: 0,
        returnRate: 0,
        buyFee: '',
        sellFee: '',
        tax: '',
        status: '',
        dayTotal: null,
        note: '',
        note2: ''
      });
      saveToStorage();
      renderTable();
    }
