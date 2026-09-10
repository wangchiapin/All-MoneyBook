    /* ====== 股利分頁（歷年總合 / 預估 / 非持股歷史）｜dividendEstimates 與過去股利紀錄相關函式 ======
       此檔案從 stock.js 拆分出來（架構重構 Phase 3），沿用 stock.js 頂部宣告的
       全域狀態變數（stocks / customAccounts / dcaRows / yfDetail ... 等），
       靠瀏覽器對 classic <script> 標籤的共用全域作用域運作，
       不需要 import/export，index.html 只要確保這個檔案在 stock.js 之前或之後載入皆可
       （所有呼叫都發生在 window.onload 之後，屆時所有 <script> 都已執行完畢）。 ====== */

    /* ====== 媽的永豐：三表 + 總覽 一次全部渲染 (無分頁切換，並排顯示) ====== */
    /* ====== 渲染「歷年股利總合」子分頁 (股利分頁) ====== */
    function renderYearlySummaryTable(thead, tbody) {
      thead.innerHTML = `
        <tr>
          <th style="width: 13%;">發放年度</th>
          <th style="width: 20%; color:#5c5445;">非持股股利總和 ($)</th>
          <th style="width: 20%; color:#766c5a;">目前持股股利 (現金股利) ($)</th>
          <th style="width: 22%; color:#9c7c52; font-size:0.9rem;">年度全體總額 ($) 🌟</th>
          <th style="width: 17%;">全體歷年佔比</th>
          <th style="width: 8%;">明細</th>
        </tr>
      `;

      // fullSummaryList 由 getFullAssetYearlyDividendSummary() 回傳，已經是「舊到新」排序
      const fullSummaryList = getFullAssetYearlyDividendSummary();
      const grandYearlyTotal = fullSummaryList.reduce((sum, y) => sum + y.totalAmount, 0);

      // 表格顯示：最新年度在最上面 (由新到舊)
      const displayList = [...fullSummaryList].reverse();

      tbody.innerHTML = displayList.map(item => {
        const ratio = grandYearlyTotal > 0 ? ((item.totalAmount / grandYearlyTotal) * 100).toFixed(1) : 0;
        return `
          <tr>
            <td style="font-weight:700; font-size:0.92rem;">${esc(item.displayYear)}</td>
            <td class="font-mono" style="color:#5c5445;">$${formatNum(item.pastAmount, 0)}</td>
            <td class="font-mono font-bold" style="color:#766c5a;">$${formatNum(item.currentAmount, 0)}</td>
            <td class="font-mono font-bold" style="font-size:1.05rem; color:#9c7c52; background:#f4ecd4;">
              $${formatNum(item.totalAmount, 0)}
            </td>
            <td>
              <span class="font-mono font-bold" style="font-size:0.85rem; color:#93897a;">${ratio}%</span>
            </td>
            <td>
              <button class="btn" style="padding:3px 8px; font-size:0.78rem;" onclick="openYearlyDivDetailModal('${item.rawKey}', '${item.displayYear}')">🔍 明細</button>
            </td>
          </tr>
        `;
      }).join('');

      // 小計列 (加總各年度數字)
      const subtotalPast = fullSummaryList.reduce((s, y) => s + y.pastAmount, 0);
      const subtotalCurrent = fullSummaryList.reduce((s, y) => s + y.currentAmount, 0);
      const stockGridFoot = document.getElementById('stockGridFoot');
      if (stockGridFoot) {
        stockGridFoot.innerHTML = `
          <td style="font-weight:800;">小計</td>
          <td class="font-mono">$${formatNum(subtotalPast, 0)}</td>
          <td class="font-mono">$${formatNum(subtotalCurrent, 0)}</td>
          <td class="font-mono" style="font-size:1.05rem;">$${formatNum(grandYearlyTotal, 0)}</td>
          <td>100%</td>
          <td>—</td>
        `;
      }

      renderYearlySummaryChart(fullSummaryList);
      renderSummary();
    }

    /* ====== 歷年股利總合：右側折線圖 (時間軸固定舊到新，不受表格排序影響) ====== */
    let yearlySummaryChart = null;
    function renderYearlySummaryChart(fullSummaryList) {
      const canvas = document.getElementById('dividendSummaryChartCanvas');
      if (!canvas || typeof Chart === 'undefined') return;

      const labels = fullSummaryList.map(y => y.displayYear);
      const pastData = fullSummaryList.map(y => y.pastAmount);
      const currentData = fullSummaryList.map(y => y.currentAmount);
      const totalData = fullSummaryList.map(y => y.totalAmount);

      if (yearlySummaryChart) {
        yearlySummaryChart.data.labels = labels;
        yearlySummaryChart.data.datasets[0].data = pastData;
        yearlySummaryChart.data.datasets[1].data = currentData;
        yearlySummaryChart.data.datasets[2].data = totalData;
        yearlySummaryChart.update();
        return;
      }

      yearlySummaryChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: '非持股股利總和', data: pastData, borderColor: '#5c5445', backgroundColor: 'rgba(92,84,69,0.08)', tension: 0.25, pointRadius: 3 },
            { label: '目前持股股利', data: currentData, borderColor: '#766c5a', backgroundColor: 'rgba(118,108,90,0.08)', tension: 0.25, pointRadius: 3 },
            { label: '年度全體總額', data: totalData, borderColor: '#9c7c52', backgroundColor: 'rgba(156,124,82,0.1)', tension: 0.25, pointRadius: 3, borderWidth: 2.5 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { font: { size: 11 }, color: '#3c362e' } },
            tooltip: { callbacks: { label: ctx => ctx.dataset.label + '：$' + formatNum(ctx.parsed.y, 0) } }
          },
          scales: {
            x: { ticks: { font: { size: 10 }, color: '#93897a' }, grid: { color: '#eee6d8' } },
            y: { ticks: { font: { size: 10 }, color: '#93897a', callback: v => formatNum(v, 0) }, grid: { color: '#eee6d8' } }
          }
        }
      });
    }

    /* ====== 「年度預估股利」子分頁共用：去重後的持股清單 (render 與 除權息自動抓取都會用到) ====== */
    function getUniqueEstimateStocks() {
      const uniqueStocksMap = new Map();
      stocks.forEach(s => {
        const key = s.code ? s.code.trim() : s.name.trim();
        if (!uniqueStocksMap.has(key)) {
          uniqueStocksMap.set(key, {
            name: s.name,
            code: s.code || '',
            shares: Number(s.shares) || 0,
            currentPrice: Number(s.currentPrice) || 0,
            account: s.account,
            category: s.category
          });
        } else {
          const ex = uniqueStocksMap.get(key);
          ex.shares += Number(s.shares) || 0;
          if (Number(s.currentPrice) > 0) ex.currentPrice = Number(s.currentPrice);
        }
      });
      return Array.from(uniqueStocksMap.values());
    }

    /* ====== 渲染「年度預估股利」子分頁 (股利分頁) ====== */
    function renderEstimatedDividendsTable(thead, tbody) {
      const uniqueStocks = getUniqueEstimateStocks();

      thead.innerHTML = `
        <tr>
          <th style="width: 140px; background:#ece6d9;">項目 / 股票</th>
          ${uniqueStocks.map(us => `<th style="width: 120px;">${esc(us.name)} <span style="font-size:0.75rem; color:#93897a;">${us.code ? '(' + esc(us.code) + ')' : ''}</span></th>`).join('')}
        </tr>
      `;

      let estRows = [
        { label: '除息時間', type: 'ex_cash_date' },
        { label: '除權時間', type: 'ex_stock_date' },
        { label: '發放時間 (參考)', type: 'pay_date_ref' },
        { label: '預估除息', field: 'expCash', type: 'input' },
        { label: '預估除權', field: 'expStock', type: 'input' },
        { label: '現金殖利率', field: 'yieldRate', type: 'calc_yield' },
        { label: '預估現金股利', field: 'totCash', type: 'calc_tot_cash' },
        { label: '預估股票股利', field: 'totStock', type: 'calc_tot_stock' },
        { label: '除權息參考價', field: 'refPrice', type: 'calc_ref_price' },
        { label: '除權後股數', field: 'afterShares', type: 'calc_after_shares' },
        { label: '持有股數 (目前)', field: 'shares', type: 'display_shares' }
      ];

      tbody.innerHTML = estRows.map(row => {
        let cellsHtml = uniqueStocks.map((us) => {
          const key = us.code ? us.code : us.name;
          if (!dividendEstimates[key]) {
            dividendEstimates[key] = { expCash: 0, expStock: 0 };
          }
          const est = dividendEstimates[key];
          const price = us.currentPrice;
          const shares = us.shares;

          if (row.type === 'input') {
            const val = est[row.field] !== undefined ? est[row.field] : 0;
            return `
              <td class="editable-col">
                <input type="number" step="any" class="cell-input font-mono font-bold" value="${esc(val)}" onchange="updateEstDividend('${key}', '${row.field}', this.value)" />
              </td>
            `;
          } else if (row.type === 'ex_cash_date' || row.type === 'ex_stock_date' || row.type === 'pay_date_ref') {
            const info = exRightsInfo[key];
            let text = '';
            let title = '';
            if (row.type === 'ex_cash_date') {
              if (info && info.exDate && info.exType && info.exType.indexOf('息') !== -1) {
                text = info.exDate;
                title = '資料來源：' + (info.source || '') + '（僅供參考，實際依公司公告為準）';
              }
            } else if (row.type === 'ex_stock_date') {
              if (info && info.exDate && info.exType && info.exType.indexOf('權') !== -1) {
                text = info.exDate;
                title = '資料來源：' + (info.source || '') + '（僅供參考，實際依公司公告為準）';
              }
            } else if (row.type === 'pay_date_ref') {
              if (info && info.payDateRef) {
                text = info.payDateRef;
                title = '參考自「董事會（擬議）股利分派日／股東會日期」，非保證實際入帳日期';
              }
            }
            if (text) {
              return `<td class="font-mono" style="font-size:0.85rem;" title="${esc(title)}">${esc(text)}</td>`;
            }
            return `<td class="font-mono" style="font-size:0.85rem; color:#b8ac96;">尚無資料</td>`;
          } else if (row.type === 'display_shares') {
            return `<td class="font-mono">${formatNum(shares, 0)}</td>`;
          } else if (row.type === 'calc_yield') {
            const c = Number(est.expCash) || 0;
            const y = price > 0 ? (c / price) * 100 : 0;
            return `<td class="font-mono font-bold" style="color:#766c5a;">${y.toFixed(2)}%</td>`;
          } else if (row.type === 'calc_tot_cash') {
            const c = Number(est.expCash) || 0;
            const totC = Math.round(c * shares);
            return `<td class="font-mono font-bold" style="color:#9c7c52;">$${formatNum(totC, 0)}</td>`;
          } else if (row.type === 'calc_tot_stock') {
            const s = Number(est.expStock) || 0;
            const totS = Math.round(s * shares);
            return `<td class="font-mono font-bold" style="color:#5c5445;">${formatNum(totS, 0)} 股</td>`;
          } else if (row.type === 'calc_ref_price') {
            const c = Number(est.expCash) || 0;
            const s = Number(est.expStock) || 0;
            const refP = price > 0 ? (price - c) / (1 + (s / 10)) : price;
            return `<td class="font-mono font-bold">${formatNum(refP, 2)}</td>`;
          } else if (row.type === 'calc_after_shares') {
            const s = Number(est.expStock) || 0;
            const afterSh = Math.round(shares * (1 + (s / 10)));
            return `<td class="font-mono font-bold">${formatNum(afterSh, 0)}</td>`;
          }
          return `<td>-</td>`;
        }).join('');

        return `
          <tr>
            <td style="font-weight:700; background:#fdfbf7; text-align:left; padding-left:12px;">${esc(row.label)}</td>
            ${cellsHtml}
          </tr>
        `;
      }).join('');

      renderSummary();
    }

    function updateEstDividend(key, field, value) {
      recordSnapshot();
      if (!dividendEstimates[key]) {
        dividendEstimates[key] = { expCash: 0, expStock: 0 };
      }
      dividendEstimates[key][field] = parseFloat(value) || 0;
      saveToStorage();
      renderTable();
    }

    /* ====== 「年度預估股利」：抓取除權除息公開資料 (免費、無金鑰) ======
       - 上市 (TWSE)：除權除息預告表 TWT48U (除息/除權日期、現金股利) +
                      股利分派情形 t187ap45_L (董事會/股東會日期 → 發放時間參考)
       - 上櫃 (TPEx)：除權除息預告表 (best-effort，欄位若異動需再調整)
       所有請求都直接從瀏覽器發出，不經過任何伺服器/第三方 API，完全免費。
       規則：只補目前是 0 的「預估除息/預估除權」欄位，使用者已手動改過的不覆蓋。 */
    async function fetchExRightsInfo() {
      if (isPageLocked('dividends') || isPageLocked('dividends_estimate')) {
        showToast('此分頁已鎖定，請先解鎖', 'error');
        return;
      }
      const btn = document.getElementById('btnUpdateExRights');
      const statusEl = document.getElementById('divEstLastUpdated');
      if (btn) { btn.disabled = true; btn.textContent = '🔄 更新中...'; }

      const uniqueStocks = getUniqueEstimateStocks();
      if (uniqueStocks.length === 0) {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 更新除權息資訊'; }
        return;
      }

      let twseForecast = null;   // { fields, data }
      let twseFilings = null;    // Array<Object> (t187ap45_L)
      let tpexForecast = null;   // { aaData }
      let anyOk = false;

      try {
        const res = await fetch('https://www.twse.com.tw/exchangeReport/TWT48U?response=json');
        const json = await res.json();
        if (json && Array.isArray(json.data) && Array.isArray(json.fields)) {
          twseForecast = json;
          anyOk = true;
        }
      } catch (e) {
        console.warn('TWSE 除權除息預告表抓取失敗', e);
      }

      try {
        const res2 = await fetch('https://openapi.twse.com.tw/v1/opendata/t187ap45_L');
        const json2 = await res2.json();
        if (Array.isArray(json2)) {
          twseFilings = json2;
          anyOk = true;
        }
      } catch (e) {
        console.warn('TWSE 股利分派情形抓取失敗', e);
      }

      try {
        const res3 = await fetch('https://www.tpex.org.tw/web/stock/exright/preAnnounce/prepost.php?l=zh-tw&o=json');
        const json3 = await res3.json();
        if (json3 && Array.isArray(json3.aaData)) {
          tpexForecast = json3;
          anyOk = true;
        }
      } catch (e) {
        // 上櫃來源網址/格式較不穩定，抓不到就跳過，不影響上市資料
        console.warn('TPEx 除權除息預告表抓取失敗（可能是網址或格式已變動）', e);
      }

      if (!anyOk) {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 更新除權息資訊'; }
        showToast('⚠️ 抓取失敗，連不上網站', 'error');
        return;
      }

      recordSnapshot();
      const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });

      // TWSE 除權除息預告表欄位索引
      let idxDate = -1, idxCode = -1, idxType = -1, idxCash = -1, idxStockRate = -1;
      if (twseForecast) {
        idxDate = twseForecast.fields.indexOf('除權除息日期');
        idxCode = twseForecast.fields.indexOf('股票代號');
        idxType = twseForecast.fields.indexOf('除權息');
        idxCash = twseForecast.fields.indexOf('現金股利');
        idxStockRate = twseForecast.fields.indexOf('無償配股率');
      }

      let matchedCount = 0;

      uniqueStocks.forEach(us => {
        const code = (us.code || '').trim();
        const key = code || us.name;
        if (!exRightsInfo[key]) exRightsInfo[key] = {};
        const info = exRightsInfo[key];
        let matchedThis = false;

        // 1) 上市：除權除息預告表
        if (twseForecast && code && idxCode !== -1) {
          const row = twseForecast.data.find(r => String(r[idxCode]).trim() === code);
          if (row) {
            info.source = 'TWSE';
            info.exDate = row[idxDate] || '';
            info.exType = row[idxType] || '';
            const cashRaw = String(row[idxCash] || '');
            info.cashDividend = cashRaw.indexOf('待公告') === -1 ? (parseFloat(cashRaw.replace(/,/g, '')) || 0) : null;
            const stockRateRaw = String(row[idxStockRate] || '0');
            const stockRate = parseFloat(stockRateRaw.replace(/,/g, '')) || 0;
            // 無償配股率 → 每股股票股利(元)：配股率 × 面額(10元)
            info.stockDividend = stockRate > 0 ? Math.round(stockRate * 10 * 10000) / 10000 : 0;
            matchedThis = true;
          }
        }

        // 2) 上櫃：除權除息預告表 (best-effort，欄位順序需視實際回應調整；找不到不影響上市資料)
        if (!matchedThis && tpexForecast && code) {
          const row = (tpexForecast.aaData || []).find(r => Array.isArray(r) && String(r[1]).trim() === code);
          if (row) {
            info.source = 'TPEx';
            info.exDate = row[0] || '';
            info.exType = row[3] || '';
            const cashRaw = String(row[7] || '');
            info.cashDividend = cashRaw.indexOf('待公告') === -1 ? (parseFloat(cashRaw.replace(/,/g, '')) || 0) : null;
            const stockRateRaw = String(row[4] || '0');
            const stockRate = parseFloat(stockRateRaw.replace(/,/g, '')) || 0;
            info.stockDividend = stockRate > 0 ? Math.round(stockRate * 10 * 10000) / 10000 : 0;
            matchedThis = true;
          }
        }

        // 3) 上市：股利分派情形 → 發放時間參考（只有上市有這份資料）
        if (twseFilings && code) {
          const rows = twseFilings.filter(r => String(r['公司代號'] || '').trim() === code);
          if (rows.length > 0) {
            rows.sort((a, b) => String(b['股利年度'] || '').localeCompare(String(a['股利年度'] || '')));
            const best = rows[0];
            info.payDateRef = best['董事會(擬議)股利分派日'] || best['股東會日期'] || '';
          }
        }

        if (matchedThis) matchedCount++;
        info.fetchedAt = nowStr;

        // 只在使用者還沒手動填過（目前是 0）的欄位補上自動抓到的數字，已改過的不覆蓋
        if (!dividendEstimates[key]) dividendEstimates[key] = { expCash: 0, expStock: 0 };
        const est = dividendEstimates[key];
        if ((!est.expCash || est.expCash === 0) && info.cashDividend !== null && info.cashDividend !== undefined) {
          est.expCash = info.cashDividend;
        }
        if ((!est.expStock || est.expStock === 0) && info.stockDividend) {
          est.expStock = info.stockDividend;
        }
      });

      saveToStorage();
      renderTable();
      if (btn) { btn.disabled = false; btn.textContent = '🔄 更新除權息資訊'; }
      if (statusEl) statusEl.textContent = `最後更新：${nowStr}（比對到 ${matchedCount}/${uniqueStocks.length} 檔）`;
      if (matchedCount > 0) {
        showToast('✅ 除權除息資訊已更新', 'success');
      } else {
        showToast('已連上資料來源，但目前沒有比對到你持股的除權息資料', 'info');
      }
    }

    /* ====== 渲染「非持有/已實現股利」子分頁 (股利分頁) ====== */
    function renderPastDividendsTable(thead, tbody, isFreshTabEntry) {
      const query = document.getElementById('searchBox') ? document.getElementById('searchBox').value.trim().toLowerCase() : '';
      const maxRows = Math.max(...pastColumns.map(c => c.items.length), 1);

      let headHtml = `<tr>`;
      pastColumns.forEach((c, idx) => {
        const themeClass = idx % 2 === 0 ? 'year-theme-a-head' : 'year-theme-b-head';
        headHtml += `<th colspan="2" class="${themeClass}">${c.year} 年度</th>`;
      });
      headHtml += `</tr><tr>`;
      pastColumns.forEach((c, idx) => {
        const subTheme = idx % 2 === 0 ? 'year-theme-a-sub' : 'year-theme-b-sub';
        headHtml += `<th class="${subTheme}">股票</th><th class="${subTheme}">現金股利 ($)</th>`;
      });
      headHtml += `</tr>`;
      thead.innerHTML = headHtml;

      let rowsHtml = '';
      for (let r = 0; r < maxRows; r++) {
        rowsHtml += `<tr>`;
        pastColumns.forEach((col, colIdx) => {
          const item = col.items[r] || { stock: '', amount: '', cashDate: '' };
          const isStockHit = query && item.stock && item.stock.toLowerCase().includes(query);
          const cellTheme = colIdx % 2 === 0 ? 'year-theme-a-cell' : 'year-theme-b-cell';

          const stockColIdx = colIdx * 2;
          const amtColIdx = colIdx * 2 + 1;
          const hasDate = Boolean(item.cashDate);

          rowsHtml += `
            <td class="${cellTheme}">
              <div class="stock-cell-wrap">
                <div class="stock-cell-box">
                  <input type="text" class="cell-input ${isStockHit ? 'highlight-cell' : ''}" style="font-weight:700;"
                    data-past-row="${r}" data-past-col="${stockColIdx}" data-year-idx="${colIdx}" data-field="stock"
                    value="${esc(item.stock || '')}" placeholder="-"
                    onfocus="this.select()" onkeydown="handlePastCellKey(event, ${r}, ${stockColIdx})"
                    onchange="updatePastCellValue(${colIdx}, ${r}, 'stock', this.value)" />
                  <button class="btn-cal-icon" title="${hasDate ? '入帳日: ' + item.cashDate : '點擊記錄入帳日'}" onclick="openPastSingleDivModal(${colIdx}, ${r})">
                    ${hasDate ? '📅' : '🗓️'}
                  </button>
                </div>
                ${hasDate ? `<div class="stock-cell-date">${esc(item.cashDate)}</div>` : ''}
              </div>
            </td>
            <td class="${cellTheme}">
              <input type="number" step="any" class="cell-input font-mono ${isStockHit ? 'highlight-cell' : ''}"
                data-past-row="${r}" data-past-col="${amtColIdx}" data-year-idx="${colIdx}" data-field="amount"
                value="${esc(item.amount !== '' && item.amount !== undefined ? item.amount : '')}" placeholder="-"
                onfocus="this.select()" onkeydown="handlePastCellKey(event, ${r}, ${amtColIdx})"
                onchange="updatePastCellValue(${colIdx}, ${r}, 'amount', this.value)" />
            </td>
          `;
        });
        rowsHtml += `</tr>`;
      }

      rowsHtml += `<tr>`;
      pastColumns.forEach((col, idx) => {
        const totTheme = idx % 2 === 0 ? 'year-theme-a-tot' : 'year-theme-b-tot';
        const colSum = col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
        rowsHtml += `
          <td class="${totTheme}">合計</td>
          <td class="font-mono ${totTheme}" style="font-size:0.95rem;">${formatNum(colSum, 0)}</td>
        `;
      });
      rowsHtml += `</tr>`;

      tbody.innerHTML = rowsHtml;
      renderSummary();

      setTimeout(() => {
        syncScrollWidth();
        if (isFreshTabEntry) scrollToLatestYear();
      }, 50);
    }

    /* ====== 非持有/已實現股利：儲存單一格資料 ====== */
    function updatePastCellValue(colIdx, row, field, value) {
      recordSnapshot();
      if (!pastColumns[colIdx]) return;
      while (pastColumns[colIdx].items.length <= row) {
        pastColumns[colIdx].items.push({ stock: '', amount: '', cashDate: '' });
      }
      if (field === 'amount') {
        pastColumns[colIdx].items[row][field] = value === '' ? '' : (parseFloat(value) || 0);
      } else {
        pastColumns[colIdx].items[row][field] = value;
      }
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：方向鍵在格子間移動 ====== */
    function handlePastCellKey(event, row, colIdx) {
      let targetRow = row;
      let targetCol = colIdx;
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        targetRow = row + 1;
      } else if (event.key === 'ArrowUp') {
        targetRow = row - 1;
      } else if (event.key === 'ArrowRight') {
        targetCol = colIdx + 1;
      } else if (event.key === 'ArrowLeft') {
        targetCol = colIdx - 1;
      } else {
        return;
      }
      const targetEl = document.querySelector(`[data-past-row="${targetRow}"][data-past-col="${targetCol}"]`);
      if (targetEl) {
        event.preventDefault();
        targetEl.focus();
      }
    }

    /* ====== 非持有/已實現股利：記錄單筆入帳日期彈窗 ====== */
    let pastDivModalTarget = { colIdx: null, row: null };
    function openPastSingleDivModal(colIdx, row) {
      pastDivModalTarget = { colIdx, row };
      const item = (pastColumns[colIdx] && pastColumns[colIdx].items[row]) || { cashDate: '' };
      const input = document.getElementById('pastDivDateInput');
      if (input) input.value = item.cashDate || '';
      const modal = document.getElementById('pastDivDateModal');
      if (modal) modal.classList.add('open');
    }

    function closePastSingleDivModal() {
      const modal = document.getElementById('pastDivDateModal');
      if (modal) modal.classList.remove('open');
    }

    function savePastSingleDivDate() {
      const { colIdx, row } = pastDivModalTarget;
      if (colIdx === null || row === null || !pastColumns[colIdx]) return;
      recordSnapshot();
      const input = document.getElementById('pastDivDateInput');
      const val = input ? input.value.trim() : '';
      while (pastColumns[colIdx].items.length <= row) {
        pastColumns[colIdx].items.push({ stock: '', amount: '', cashDate: '' });
      }
      pastColumns[colIdx].items[row].cashDate = val;
      saveToStorage();
      closePastSingleDivModal();
      renderTable();
    }

    /* ====== 非持有/已實現股利：新增一列 (在最後一個年度欄位加空白列) ====== */
    function handleAddNew() {
      recordSnapshot();
      if (pastColumns.length === 0) {
        pastColumns.push({ year: String(new Date().getFullYear() - 1911), items: [] });
      }
      pastColumns.forEach(col => {
        col.items.push({ stock: '', amount: '', cashDate: '' });
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：刪除最後一列空白列 (若最後一列全部欄位皆為空才刪) ====== */
    function handleDeleteLastPastRow() {
      if (isPageLocked('dividends')) { showToast('此分頁已鎖定，請先解鎖', 'error'); return; }
      if (pastColumns.length === 0) return;
      const maxRows = Math.max(...pastColumns.map(c => c.items.length), 0);
      if (maxRows === 0) return;
      const lastRowIdx = maxRows - 1;
      const isLastRowEmpty = pastColumns.every(col => {
        const item = col.items[lastRowIdx];
        if (!item) return true;
        return (!item.stock || item.stock.trim() === '') && (item.amount === '' || item.amount === undefined || Number(item.amount) === 0);
      });
      if (!isLastRowEmpty) {
        alert('最後一列還有資料，無法刪除。請先清空該列內容再試一次。');
        return;
      }
      recordSnapshot();
      pastColumns.forEach(col => {
        if (col.items.length > lastRowIdx) col.items.splice(lastRowIdx, 1);
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：新增新年度欄位 ====== */
    function handleAddYear() {
      if (isPageLocked('dividends')) { showToast('此分頁已鎖定，請先解鎖', 'error'); return; }
      const lastYear = pastColumns.length > 0 ? parseInt(pastColumns[pastColumns.length - 1].year) || (new Date().getFullYear() - 1911) : (new Date().getFullYear() - 1911);
      const newYear = prompt('請輸入新年度 (民國年，例如 116)：', String(lastYear + 1));
      if (!newYear) return;
      recordSnapshot();
      const maxRows = Math.max(...pastColumns.map(c => c.items.length), 5);
      pastColumns.push({
        year: newYear.trim(),
        items: Array.from({ length: maxRows }, () => ({ stock: '', amount: '', cashDate: '' }))
      });
      saveToStorage();
      renderTable();
    }

    /* ====== 非持有/已實現股利：單一標的歷年現金股利速查 ====== */
    function calculateSingleStockPastDividends() {
      const input = document.getElementById('calcTargetInput');
      const detailEl = document.getElementById('calcDetailText');
      const totalEl = document.getElementById('calcTotalText');
      if (!input || !detailEl || !totalEl) return;
      const query = input.value.trim().toLowerCase();
      if (!query) {
        detailEl.textContent = '請輸入名稱進行速查';
        totalEl.textContent = '$0';
        return;
      }
      let total = 0;
      let count = 0;
      pastColumns.forEach(col => {
        col.items.forEach(item => {
          if (item.stock && item.stock.toLowerCase().includes(query)) {
            total += Number(item.amount) || 0;
            count++;
          }
        });
      });
      detailEl.textContent = `共找到 ${count} 筆紀錄`;
      totalEl.textContent = '$' + formatNum(total, 0);
    }
