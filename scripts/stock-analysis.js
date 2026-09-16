    /* ====== 股票分析圖（新分頁按鈕）======
       此檔案沿用 stock.js 頂部宣告的全域狀態變數（stocks / pastColumns / currentFilter ...）
       跟 dividends.js 的 getFullAssetYearlyDividendSummary()，不需要 import/export，
       靠瀏覽器對 classic <script> 標籤的共用全域作用域運作。

       ➕ 新增股票 跟 🧮 計算機 中間的「📊 股票分析圖」按鈕，點開後依目前所在的分頁顯示：
       - 持股分頁（全部持股/ETF/台股/各券商帳戶）：長條圖（每支股票成本 vs 現值兩根並排柱子，
         依現值高到低排序）+ 圓餅圖（各股票持股比例）；只看「目前分頁篩選後」的股票。
       - 股利分頁：長條圖（各股票現金股利，持股中/已售出用不同顏色）+ 圓餅圖（股利領取比例，
         一樣持股中/已售出用不同顏色），股利範圍預設累計所有年份，也可以切換成單一年度。
       - 其他分頁（股票賣出/股票借出/媽的永豐/定期定額/各股紀錄）：顯示「此分頁無分析圖表」提示。

       密碼鎖定功能：如果「全部持股」頁面或成本/市值欄位被鎖定，持股分析圖不顯示；
       如果「股利」頁面（含歷年股利總合/非持股股利子分頁）被鎖定，股利分析圖不顯示。 ====== */

    let stockAnalysisBarChart = null;
    let stockAnalysisPieChart = null;

    const STOCK_ANALYSIS_NA_FILTERS = ['STOCK_SALES', 'STOCK_LENDING_TAB', 'YONG_FENG_TAB', 'DCA_TAB', 'SNAPSHOT_LOGS'];

    function isStockAnalysisApplicable() {
      return currentFilter === 'DIVIDENDS_TAB' || !STOCK_ANALYSIS_NA_FILTERS.includes(currentFilter);
    }

    function isStockAnalysisLocked() {
      if (currentFilter === 'DIVIDENDS_TAB') {
        return isPageLocked('dividends') || isPageLocked('dividends_summary') || isPageLocked('dividends_past');
      }
      return isPageLocked('holdings') || isFieldLocked('holdings.totalCost') || isFieldLocked('holdings.marketVal');
    }

    function openStockAnalysisModal() {
      const modal = document.getElementById('stockAnalysisModal');
      if (!modal) return;
      modal.classList.add('open');
      renderStockAnalysisModalContent();
    }

    function closeStockAnalysisModal() {
      const modal = document.getElementById('stockAnalysisModal');
      if (modal) modal.classList.remove('open');
    }

    function renderStockAnalysisModalContent() {
      const emptyMsg = document.getElementById('stockAnalysisEmptyMsg');
      const lockedMsg = document.getElementById('stockAnalysisLockedMsg');
      const yearWrap = document.getElementById('stockAnalysisYearFilterWrap');
      const chartsWrap = document.getElementById('stockAnalysisChartsWrap');
      const legendWrap = document.getElementById('stockAnalysisColorLegend');
      if (!emptyMsg || !lockedMsg || !yearWrap || !chartsWrap) return;

      if (!isStockAnalysisApplicable()) {
        emptyMsg.style.display = 'block';
        lockedMsg.style.display = 'none';
        yearWrap.style.display = 'none';
        chartsWrap.style.display = 'none';
        if (legendWrap) legendWrap.style.display = 'none';
        return;
      }

      if (isStockAnalysisLocked()) {
        emptyMsg.style.display = 'none';
        lockedMsg.style.display = 'block';
        lockedMsg.innerHTML = lockPlaceholderHtml(currentFilter === 'DIVIDENDS_TAB' ? 'dividends' : 'holdings', 'page');
        yearWrap.style.display = 'none';
        chartsWrap.style.display = 'none';
        if (legendWrap) legendWrap.style.display = 'none';
        return;
      }

      emptyMsg.style.display = 'none';
      lockedMsg.style.display = 'none';
      chartsWrap.style.display = 'block';

      const isDividendsMode = currentFilter === 'DIVIDENDS_TAB';
      yearWrap.style.display = isDividendsMode ? 'block' : 'none';
      if (legendWrap) legendWrap.style.display = isDividendsMode ? 'flex' : 'none';

      const barTitle = document.getElementById('stockAnalysisBarTitle');
      const pieTitle = document.getElementById('stockAnalysisPieTitle');
      if (isDividendsMode) {
        if (barTitle) barTitle.textContent = '各股票現金股利（持股中／已售出）';
        if (pieTitle) pieTitle.textContent = '股利領取比例';
        populateStockAnalysisYearSelect();
      } else {
        if (barTitle) barTitle.textContent = '成本 vs 現值';
        if (pieTitle) pieTitle.textContent = '持股比例';
      }

      renderStockAnalysisCharts();
    }

    function populateStockAnalysisYearSelect() {
      const sel = document.getElementById('stockAnalysisYearSelect');
      if (!sel || typeof getFullAssetYearlyDividendSummary !== 'function') return;
      const years = getFullAssetYearlyDividendSummary(); // 舊到新排序，含 rawKey/displayYear
      const prevVal = sel.value;
      sel.innerHTML = '<option value="">累計所有年份</option>' +
        years.slice().reverse().map(y => '<option value="' + esc(y.rawKey) + '">' + esc(y.displayYear) + '</option>').join('');
      if (years.some(y => y.rawKey === prevVal)) sel.value = prevVal;
    }

    // 產生一組跟現有配色系(暖棕/卡其色系)協調的圓餅圖顏色，數量不夠時循環使用
    function generateStockAnalysisColors(count) {
      const palette = ['#766c5a', '#9c7c52', '#a8543d', '#5c5445', '#c9a86a', '#8a9a7a', '#b98d6f', '#6f8a96', '#a68a5b', '#7a6f8a'];
      const out = [];
      for (let i = 0; i < count; i++) out.push(palette[i % palette.length]);
      return out;
    }

    function renderStockAnalysisCharts() {
      // 防呆：不適用或鎖定的情況下不畫圖（正常流程下 renderStockAnalysisModalContent 已經擋掉，
      // 但年度下拉選單的 onchange 會直接呼叫這裡，所以還是要重複檢查一次）
      if (!isStockAnalysisApplicable() || isStockAnalysisLocked()) return;
      if (currentFilter === 'DIVIDENDS_TAB') {
        renderDividendAnalysisCharts();
      } else {
        renderHoldingsAnalysisCharts();
      }
    }

    /* ====== 持股分頁：成本 vs 現值長條圖 + 持股比例圓餅圖 ====== */
    function getStockAnalysisHoldingsData() {
      let displayList;
      if (currentFilter === '台股') {
        displayList = getMergedTaiwanStocks();
      } else {
        displayList = stocks.filter(s => (currentFilter === 'ALL') || (s.account === currentFilter) || (s.category === currentFilter));
      }
      return displayList.map(s => {
        const isUS = isUsStock(s);
        const fxRate = isUS ? 29 : 1;
        const totalCost = (Number(s.totalCost) || 0) * fxRate;
        const shares = Number(s.shares) || 0;
        const currentPrice = (Number(s.currentPrice) || 0) * fxRate;
        const isMergedRow = Boolean(s.isMerged);
        const marketVal = isMergedRow ? (shares * currentPrice) : ((Number(s.marketVal) || 0) * fxRate);
        return { name: s.name, cost: totalCost, value: marketVal };
      }).filter(d => d.cost !== 0 || d.value !== 0)
        .sort((a, b) => b.value - a.value);
    }

    // 長條圖類別（股票）數量可能有幾十檔，橫向排不下、Chart.js 會自動省略部分刻度標籤，
    // 導致「某支股票明明有資料，但看不到自己的名字」。改成縱向逐列排列（一支股票一列，
    // 由上往下），並依股票數量動態撐高容器，搭配外層 modal-body 捲動，就不會再有標籤被省略。
    function resizeStockAnalysisBarWrap(count) {
      const wrap = document.getElementById('stockAnalysisBarCanvasWrap');
      if (wrap) wrap.style.height = Math.max(220, count * 32) + 'px';
    }

    function renderHoldingsAnalysisCharts() {
      const data = getStockAnalysisHoldingsData();
      const labels = data.map(d => d.name);
      const costData = data.map(d => d.cost);
      const valueData = data.map(d => d.value);

      resizeStockAnalysisBarWrap(labels.length);
      const barCanvas = document.getElementById('stockAnalysisBarCanvas');
      if (barCanvas && typeof Chart !== 'undefined') {
        if (stockAnalysisBarChart) { stockAnalysisBarChart.destroy(); stockAnalysisBarChart = null; }
        stockAnalysisBarChart = new Chart(barCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: '成本', data: costData, backgroundColor: 'rgba(92,84,69,0.55)' },
              { label: '現值', data: valueData, backgroundColor: 'rgba(156,124,82,0.85)' }
            ]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { font: { size: 11 }, color: '#3c362e' } },
              tooltip: { callbacks: { label: ctx => ctx.dataset.label + '：$' + formatNum(ctx.parsed.x, 0) } }
            },
            scales: {
              x: { ticks: { font: { size: 10 }, color: '#93897a', callback: v => formatNum(v, 0) }, grid: { color: '#eee6d8' } },
              y: { ticks: { font: { size: 11 }, color: '#3c362e' }, grid: { display: false } }
            }
          }
        });
      }

      const pieCanvas = document.getElementById('stockAnalysisPieCanvas');
      if (pieCanvas && typeof Chart !== 'undefined') {
        if (stockAnalysisPieChart) { stockAnalysisPieChart.destroy(); stockAnalysisPieChart = null; }
        const colors = generateStockAnalysisColors(labels.length);
        const total = valueData.reduce((s, v) => s + v, 0);
        stockAnalysisPieChart = new Chart(pieCanvas.getContext('2d'), {
          type: 'pie',
          data: { labels, datasets: [{ data: valueData, backgroundColor: colors }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { font: { size: 10 }, color: '#3c362e', boxWidth: 10 } },
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                    return ctx.label + '：$' + formatNum(ctx.parsed, 0) + '（' + pct + '%）';
                  }
                }
              }
            }
          }
        });
      }
    }

    /* ====== 股利分頁：現金股利長條圖 + 領取比例圓餅圖（持股中／已售出用不同顏色）====== */
    const STOCK_ANALYSIS_HELD_COLOR = 'rgba(118,108,90,0.85)';
    const STOCK_ANALYSIS_PAST_COLOR = 'rgba(168,84,61,0.6)';

    function getStockAnalysisDividendData() {
      const yearSel = document.getElementById('stockAnalysisYearSelect');
      const yearFilter = yearSel ? yearSel.value : '';

      // 目前持股的現金股利（來源：stocks[].dividendHistory，跟歷年股利總合的「目前持股股利」同一套邏輯）
      const currentEntries = [];
      stocks.forEach(st => {
        const isUS = isUsStock(st);
        const fxRate = isUS ? 29 : 1;
        let amt = 0;
        (st.dividendHistory || []).forEach(dh => {
          const key = normalizeYearKey(dh.year);
          if (yearFilter && key !== yearFilter) return;
          amt += (Number(dh.cash) || 0) * fxRate;
        });
        if (amt !== 0) currentEntries.push({ name: st.name, amount: amt });
      });

      // 已售出/非持股的現金股利（來源：pastColumns，跟歷年股利總合的「非持股股利」同一套邏輯）
      const pastMap = new Map();
      pastColumns.forEach(col => {
        const key = normalizeYearKey(col.year);
        if (yearFilter && key !== yearFilter) return;
        (col.items || []).forEach(it => {
          const amt = Number(it.amount) || 0;
          if (!amt) return;
          const name = it.stock || '未命名';
          pastMap.set(name, (pastMap.get(name) || 0) + amt);
        });
      });
      const pastEntries = Array.from(pastMap.entries()).map(([name, amount]) => ({ name, amount }));

      const all = [
        ...currentEntries.map(e => ({ name: e.name, amount: e.amount, held: true })),
        ...pastEntries.map(e => ({ name: e.name, amount: e.amount, held: false }))
      ].filter(e => e.amount > 0);
      all.sort((a, b) => b.amount - a.amount);
      return all;
    }

    function renderDividendAnalysisCharts() {
      const data = getStockAnalysisDividendData();
      const labels = data.map(d => d.held ? d.name : (d.name + '（已售出）'));
      const amounts = data.map(d => d.amount);
      const colors = data.map(d => d.held ? STOCK_ANALYSIS_HELD_COLOR : STOCK_ANALYSIS_PAST_COLOR);

      resizeStockAnalysisBarWrap(labels.length);
      const barCanvas = document.getElementById('stockAnalysisBarCanvas');
      if (barCanvas && typeof Chart !== 'undefined') {
        if (stockAnalysisBarChart) { stockAnalysisBarChart.destroy(); stockAnalysisBarChart = null; }
        stockAnalysisBarChart = new Chart(barCanvas.getContext('2d'), {
          type: 'bar',
          data: { labels, datasets: [{ label: '現金股利', data: amounts, backgroundColor: colors }] },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: ctx => '$' + formatNum(ctx.parsed.x, 0) } }
            },
            scales: {
              x: { ticks: { font: { size: 10 }, color: '#93897a', callback: v => formatNum(v, 0) }, grid: { color: '#eee6d8' } },
              y: { ticks: { font: { size: 11 }, color: '#3c362e' }, grid: { display: false } }
            }
          }
        });
      }

      const pieCanvas = document.getElementById('stockAnalysisPieCanvas');
      if (pieCanvas && typeof Chart !== 'undefined') {
        if (stockAnalysisPieChart) { stockAnalysisPieChart.destroy(); stockAnalysisPieChart = null; }
        const total = amounts.reduce((s, v) => s + v, 0);
        stockAnalysisPieChart = new Chart(pieCanvas.getContext('2d'), {
          type: 'pie',
          data: { labels, datasets: [{ data: amounts, backgroundColor: colors }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { font: { size: 10 }, color: '#3c362e', boxWidth: 10 } },
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                    return ctx.label + '：$' + formatNum(ctx.parsed, 0) + '（' + pct + '%）';
                  }
                }
              }
            }
          }
        });
      }
    }
