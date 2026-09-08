    /* 股票管理模組共用主殼層 (個人財務資產狀況管理) 已初始化好的 fbAuth / fbDb，
       不在這裡重複 initializeApp，避免 Firebase 重複初始化錯誤。 */
    const CLOUD_COLLECTION = 'stockAssets';
    let stockCloudSyncTimer = null;

    const STORAGE_KEY_STOCKS = 'STOCK_INVESTMENT_EXCEL_PRO_V32_STOCKS';
    const STORAGE_KEY_PAST = 'STOCK_INVESTMENT_EXCEL_PRO_V32_PAST';
    const STORAGE_KEY_CUSTOM_ACCOUNTS = 'STOCK_INVESTMENT_EXCEL_PRO_V32_ACCOUNTS';
    const STORAGE_KEY_STOCK_SALES = 'STOCK_INVESTMENT_EXCEL_PRO_V32_STOCK_SALES';
    const STORAGE_KEY_SALES_HISTORY = 'STOCK_INVESTMENT_EXCEL_PRO_V32_SALES_HISTORY';
    const STORAGE_KEY_STOCK_LENDING = 'STOCK_INVESTMENT_EXCEL_PRO_V32_STOCK_LENDING';
    const STORAGE_KEY_LENDING_INCOME = 'STOCK_INVESTMENT_EXCEL_PRO_V32_LENDING_INCOME';
    const STORAGE_KEY_LENDING_INCOME_YEARLY = 'STOCK_INVESTMENT_EXCEL_PRO_V32_LENDING_INCOME_YEARLY';
    const STORAGE_KEY_DCA = 'STOCK_INVESTMENT_EXCEL_PRO_V32_DCA';

    const INITIAL_DATA = [];

    const INITIAL_REALIZED_EXCEL_COLUMNS = [];

    const INITIAL_STOCK_SALES = [];

    const INITIAL_SALES_HISTORY = [];

    // 媽的永豐 獨立資料變數 (完全安全的 JSON 序列化載入) —— 買賣明細 / 帳戶明細 / 除息資訊 三表 + 總覽
    let yfDetail = JSON.parse(localStorage.getItem('YONG_FENG_DETAIL_V1') || '[]');
    let yfAccount = JSON.parse(localStorage.getItem('YONG_FENG_ACCOUNT_V1') || '[]');
    let yfDividendRows = JSON.parse(localStorage.getItem('YONG_FENG_DIVIDEND_V1') || '[]');
    let yfOverview = JSON.parse(localStorage.getItem('YONG_FENG_OVERVIEW_V2') || JSON.stringify({ stockName: '', currentValue: 0, appCost: 0, goal: 100000 }));

    let stocks = [];
    let pastColumns = [];
    let customAccounts = [];
    let stockSales = [];
    let salesHistory = [];
    let stockLending = [];
    let lendingManagedIds = []; // 本次執行期間，曾被「股票借出」分頁同步過出借張數的持股 id
    let lendingIncomeRows = []; // 借卷收入明細列 (股票借出 > 借卷收入 子分頁)
    // 110~114 手動輸入的歷史年度加總 (依圖片數字記錄)；115年(含)以後改由明細列自動加總
    let lendingIncomeManualYearly = {};
    let dcaRows = []; // 定期定額分頁：{ id, name, dates: number[] (每月扣款日 1~31), amount (每次扣款金額) }
    let dividendEstimates = {};
    let historyStack = [];
    let currentFilter = 'ALL';
    let salesSubTab = 'list';
    let lendingSubTab = 'holdings'; // 'holdings', 'income'
    let dividendsSubTab = 'summary'; // 'summary', 'past', 'estimate'
    let selectedSummaryYear = '115';
    // 記錄「上一次已經捲動過一次最新資料」的分頁/子分頁組合，用來判斷這次 renderTable()
    // 是「剛切換進這個分頁」還是「只是在同一個分頁裡編輯資料觸發的重繪」——
    // 只有前者才要自動捲到最新一筆，後者不應該把使用者正在編輯的位置強制捲走。
    let lastEnteredTabContext = null;
    let selectedSnapshotDate = null;
    let currentEditingStockId = null;
    let currentModalType = 'cash';
    let draggedStockId = null;

    function init() {
      try {
        const savedStocks = localStorage.getItem(STORAGE_KEY_STOCKS);
        stocks = savedStocks ? JSON.parse(savedStocks) : INITIAL_DATA;

        const savedAccounts = localStorage.getItem(STORAGE_KEY_CUSTOM_ACCOUNTS);
        customAccounts = savedAccounts ? JSON.parse(savedAccounts) : [];

        stocks.forEach(s => {
          if (s.stockShares === undefined) {
            const totalShares = (s.dividendHistory || []).reduce((sum, h) => sum + (Number(h.stockShares) || (Number(h.stock) || 0)), 0);
            s.stockShares = totalShares;
          }
          // Task: 市值改為手動輸入、現價 = 市值 / 持有股數 自動計算 —— 既有資料補上市值欄位
          if (s.marketVal === undefined) {
            s.marketVal = (Number(s.currentPrice) || 0) * (Number(s.shares) || 0);
          }
        });

        const savedPast = localStorage.getItem(STORAGE_KEY_PAST);
        pastColumns = savedPast ? JSON.parse(savedPast) : INITIAL_REALIZED_EXCEL_COLUMNS;

        const savedSales = localStorage.getItem(STORAGE_KEY_STOCK_SALES);
        stockSales = savedSales ? JSON.parse(savedSales) : INITIAL_STOCK_SALES;

        const savedHistory = localStorage.getItem(STORAGE_KEY_SALES_HISTORY);
        salesHistory = savedHistory ? JSON.parse(savedHistory) : INITIAL_SALES_HISTORY;

        const savedLending = localStorage.getItem(STORAGE_KEY_STOCK_LENDING);
        stockLending = savedLending ? JSON.parse(savedLending) : [];

        const savedLendingIncome = localStorage.getItem(STORAGE_KEY_LENDING_INCOME);
        lendingIncomeRows = savedLendingIncome ? JSON.parse(savedLendingIncome) : [];

        const savedLendingYearly = localStorage.getItem(STORAGE_KEY_LENDING_INCOME_YEARLY);
        lendingIncomeManualYearly = savedLendingYearly ? JSON.parse(savedLendingYearly) : lendingIncomeManualYearly;

        const savedDca = localStorage.getItem(STORAGE_KEY_DCA);
        dcaRows = savedDca ? JSON.parse(savedDca) : [];

        const savedEst = localStorage.getItem('STOCK_INVESTMENT_DIVIDEND_ESTIMATES_V1');
        dividendEstimates = savedEst ? JSON.parse(savedEst) : {};
      } catch (e) {
        stocks = INITIAL_DATA;
        customAccounts = [];
        pastColumns = INITIAL_REALIZED_EXCEL_COLUMNS;
        stockSales = INITIAL_STOCK_SALES;
        salesHistory = INITIAL_SALES_HISTORY;
        stockLending = [];
        lendingIncomeRows = [];
        lendingIncomeManualYearly = {};
        dcaRows = [];
        dividendEstimates = {};
      }

      syncLentSharesToHoldings();
      setupScrollSync();
      renderTabs();
      renderTable();
      setupGlobalShortcuts();
      setupSettingDropdownClose();
      setupCalculatorDrag();
      restoreNavState();
    }

    function recordSnapshot() {
      try {
        historyStack.push(JSON.stringify({ stocks, pastColumns, customAccounts, stockSales, salesHistory, stockLending, lendingIncomeRows, lendingIncomeManualYearly, dcaRows, dividendEstimates, yfDetail, yfAccount, yfDividendRows, yfOverview }));
        if (historyStack.length > 50) historyStack.shift();
      } catch(e) {}
    }

    function undo() {
      if (historyStack.length > 0) {
        try {
          const prev = JSON.parse(historyStack.pop());
          stocks = prev.stocks;
          pastColumns = prev.pastColumns;
          if (prev.customAccounts) customAccounts = prev.customAccounts;
          if (prev.stockSales) stockSales = prev.stockSales;
          if (prev.salesHistory) salesHistory = prev.salesHistory;
          if (prev.stockLending) stockLending = prev.stockLending;
          if (prev.lendingIncomeRows) lendingIncomeRows = prev.lendingIncomeRows;
          if (prev.lendingIncomeManualYearly) lendingIncomeManualYearly = prev.lendingIncomeManualYearly;
          if (prev.dcaRows) dcaRows = prev.dcaRows;
          if (prev.dividendEstimates) dividendEstimates = prev.dividendEstimates;
          if (prev.yfDetail) yfDetail = prev.yfDetail;
          if (prev.yfAccount) yfAccount = prev.yfAccount;
          if (prev.yfDividendRows) yfDividendRows = prev.yfDividendRows;
          if (prev.yfOverview) yfOverview = prev.yfOverview;
          saveToStorage();
          renderTabs();
          renderTable();
        } catch(e) {}
      }
    }

    function setupGlobalShortcuts() {
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          undo();
        }
      });
    }

    function saveToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY_STOCKS, JSON.stringify(stocks));
        localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastColumns));
        localStorage.setItem(STORAGE_KEY_CUSTOM_ACCOUNTS, JSON.stringify(customAccounts));
        localStorage.setItem(STORAGE_KEY_STOCK_SALES, JSON.stringify(stockSales));
        localStorage.setItem(STORAGE_KEY_SALES_HISTORY, JSON.stringify(salesHistory));
        localStorage.setItem(STORAGE_KEY_STOCK_LENDING, JSON.stringify(stockLending));
        localStorage.setItem(STORAGE_KEY_LENDING_INCOME, JSON.stringify(lendingIncomeRows));
        localStorage.setItem(STORAGE_KEY_LENDING_INCOME_YEARLY, JSON.stringify(lendingIncomeManualYearly));
        localStorage.setItem(STORAGE_KEY_DCA, JSON.stringify(dcaRows));
        localStorage.setItem('STOCK_INVESTMENT_DIVIDEND_ESTIMATES_V1', JSON.stringify(dividendEstimates));
        localStorage.setItem('YONG_FENG_DETAIL_V1', JSON.stringify(yfDetail));
        localStorage.setItem('YONG_FENG_ACCOUNT_V1', JSON.stringify(yfAccount));
        localStorage.setItem('YONG_FENG_DIVIDEND_V1', JSON.stringify(yfDividendRows));
        localStorage.setItem('YONG_FENG_OVERVIEW_V2', JSON.stringify(yfOverview));
      } catch (e) {
        console.error('本機儲存失敗', e);
        const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        if (typeof showToast === 'function') {
          showToast(isQuota ? '⚠️ 儲存空間已滿，這次的變更沒有存進去！請匯出備份後清理舊資料' : '⚠️ 本機儲存失敗，這次的變更可能沒有存進去', 'error');
        } else {
          alert('⚠️ 儲存失敗，這次的變更可能沒有存進去：\n' + (e && e.message ? e.message : e));
        }
      }
      renderSummary();
      scheduleCloudSync();
    }

    /* ====== Firebase 雲端同步 ====== */
    function gatherAllData() {
      return {
        stocks, pastColumns, customAccounts, stockSales, salesHistory, stockLending,
        lendingIncomeRows, lendingIncomeManualYearly, dcaRows,
        dividendEstimates, yfDetail, yfAccount, yfDividendRows, yfOverview,
        snapshots: JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'),
        updatedAt: new Date().toISOString()
      };
    }

    function applyAllData(data) {
      if (!data) return;
      if (data.stocks) stocks = data.stocks;
      if (data.pastColumns) pastColumns = data.pastColumns;
      if (data.customAccounts) customAccounts = data.customAccounts;
      if (data.stockSales) stockSales = data.stockSales;
      if (data.salesHistory) salesHistory = data.salesHistory;
      if (data.stockLending) stockLending = data.stockLending;
      if (data.lendingIncomeRows) lendingIncomeRows = data.lendingIncomeRows;
      if (data.lendingIncomeManualYearly) lendingIncomeManualYearly = data.lendingIncomeManualYearly;
      if (data.dcaRows) dcaRows = data.dcaRows;
      if (data.dividendEstimates) dividendEstimates = data.dividendEstimates;
      if (data.yfDetail) yfDetail = data.yfDetail;
      if (data.yfAccount) yfAccount = data.yfAccount;
      if (data.yfDividendRows) yfDividendRows = data.yfDividendRows;
      if (data.yfOverview) yfOverview = data.yfOverview;
      if (data.snapshots) localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(data.snapshots));

      localStorage.setItem(STORAGE_KEY_STOCKS, JSON.stringify(stocks));
      localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastColumns));
      localStorage.setItem(STORAGE_KEY_CUSTOM_ACCOUNTS, JSON.stringify(customAccounts));
      localStorage.setItem(STORAGE_KEY_STOCK_SALES, JSON.stringify(stockSales));
      localStorage.setItem(STORAGE_KEY_SALES_HISTORY, JSON.stringify(salesHistory));
      localStorage.setItem(STORAGE_KEY_STOCK_LENDING, JSON.stringify(stockLending));
      localStorage.setItem(STORAGE_KEY_LENDING_INCOME, JSON.stringify(lendingIncomeRows));
      localStorage.setItem(STORAGE_KEY_LENDING_INCOME_YEARLY, JSON.stringify(lendingIncomeManualYearly));
      localStorage.setItem(STORAGE_KEY_DCA, JSON.stringify(dcaRows));
      localStorage.setItem('STOCK_INVESTMENT_DIVIDEND_ESTIMATES_V1', JSON.stringify(dividendEstimates));
      localStorage.setItem('YONG_FENG_DETAIL_V1', JSON.stringify(yfDetail));
      localStorage.setItem('YONG_FENG_ACCOUNT_V1', JSON.stringify(yfAccount));
      localStorage.setItem('YONG_FENG_DIVIDEND_V1', JSON.stringify(yfDividendRows));
      localStorage.setItem('YONG_FENG_OVERVIEW_V2', JSON.stringify(yfOverview));

      renderTabs();
      renderTable();
    }

    /* ====== JSON 備份「合併」匯入：保留現有資料，只把匯入檔裡「本地沒有的」項目加進來，
       不會覆蓋或刪除任何既有資料。與 applyAllData()（整份覆蓋，僅供「讀取雲端」時使用）分開。 ====== */
    function mergeApplyAllData(data) {
      if (!data) return { added: 0, skipped: 0 };
      let added = 0, skipped = 0;

      // 1) 有明確唯一鍵的資料：已存在的鍵一律略過（保留舊資料），只新增本地沒有的
      function upsertByKey(existingArr, importedArr, keyFn) {
        if (!Array.isArray(importedArr)) return;
        const existingKeys = new Set(existingArr.map(keyFn));
        importedArr.forEach(item => {
          const k = keyFn(item);
          if (k && existingKeys.has(k)) { skipped++; return; }
          existingArr.push(item);
          if (k) existingKeys.add(k);
          added++;
        });
      }

      upsertByKey(stocks, data.stocks, s => (s.code ? String(s.code).trim() : '') + '|' + (s.name || '').trim() + '|' + (s.account || ''));
      upsertByKey(salesHistory, data.salesHistory, h => String(h.year || ''));
      upsertByKey(stockLending, data.stockLending, l => (l.name || '').trim());
      upsertByKey(dcaRows, data.dcaRows, r => (r.name || '').trim());
      upsertByKey(pastColumns, data.pastColumns, c => String(c.year || ''));
      if (Array.isArray(data.customAccounts)) {
        data.customAccounts.forEach(acc => {
          if (!customAccounts.includes(acc)) { customAccounts.push(acc); added++; }
          else skipped++;
        });
      }

      // 2) 沒有天然唯一鍵的交易明細記錄：直接附加在後面（保留舊資料，不覆蓋，可能重複匯入需自行檢查）
      ['stockSales', 'lendingIncomeRows', 'yfDetail', 'yfAccount', 'yfDividendRows'].forEach(key => {
        if (Array.isArray(data[key]) && data[key].length) {
          const target = { stockSales, lendingIncomeRows, yfDetail, yfAccount, yfDividendRows }[key];
          target.push(...data[key]);
          added += data[key].length;
        }
      });

      // 3) 物件型資料 (以鍵值儲存)：只補本地沒有的鍵，不覆蓋既有的
      if (data.lendingIncomeManualYearly) {
        Object.keys(data.lendingIncomeManualYearly).forEach(y => {
          if (lendingIncomeManualYearly[y] === undefined) { lendingIncomeManualYearly[y] = data.lendingIncomeManualYearly[y]; added++; }
          else skipped++;
        });
      }
      if (data.dividendEstimates) {
        Object.keys(data.dividendEstimates).forEach(k => {
          if (dividendEstimates[k] === undefined) { dividendEstimates[k] = data.dividendEstimates[k]; added++; }
          else skipped++;
        });
      }

      // 4) 媽的永豐總覽：只補目前是空/0 的欄位，已經有值的維持原樣
      if (data.yfOverview) {
        if (!yfOverview.stockName && data.yfOverview.stockName) { yfOverview.stockName = data.yfOverview.stockName; added++; }
        if (!yfOverview.currentValue && data.yfOverview.currentValue) { yfOverview.currentValue = data.yfOverview.currentValue; added++; }
        if (!yfOverview.appCost && data.yfOverview.appCost) { yfOverview.appCost = data.yfOverview.appCost; added++; }
      }

      // 5) 各股紀錄快照：以「快照日期」為鍵，本地沒有的日期才加入
      if (Array.isArray(data.snapshots) && data.snapshots.length) {
        let existingSnaps = [];
        try { existingSnaps = JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'); } catch (e) { existingSnaps = []; }
        const existingDates = new Set(existingSnaps.map(s => s.date));
        data.snapshots.forEach(s => {
          if (s && s.date && !existingDates.has(s.date)) { existingSnaps.push(s); existingDates.add(s.date); added++; }
          else skipped++;
        });
        localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(existingSnaps));
      }

      saveToStorage();
      renderTabs();
      renderTable();
      return { added, skipped };
    }

    function stockDocRef() {
      if (!fbDb || !fbUser) return null;
      return fbDb.collection(CLOUD_COLLECTION).doc(fbUser.uid);
    }

    let lastKnownStockCloudUpdatedAt = null; // 上次成功讀取/寫入雲端時的 updatedAt，用來偵測其他裝置的變更

    async function loadStockFromCloud() {
      const ref = stockDocRef();
      if (!ref) return;
      try {
        const snap = await ref.get();
        if (snap.exists) {
          applyAllData(snap.data());
          lastKnownStockCloudUpdatedAt = (snap.data() && snap.data().updatedAt) || null;
        } else {
          const data = gatherAllData();
          await ref.set(data);
          lastKnownStockCloudUpdatedAt = data.updatedAt;
        }
      } catch (e) {
        console.warn('讀取股票雲端資料失敗', e);
        if (typeof showToast === 'function') showToast('⚠️ 讀取雲端資料失敗，目前顯示的是本機資料', 'error');
      }
    }

    async function pushStockToCloud() {
      const ref = stockDocRef();
      if (!ref) return;
      try {
        // 先偵測衝突：雲端 updatedAt 跟上次讀到的不同，代表其他裝置在這之後也存過檔，
        // 直接整份覆蓋會蓋掉那邊的變更，先跟使用者確認。
        const snap = await ref.get();
        if (snap.exists) {
          const cloudUpdatedAt = (snap.data() && snap.data().updatedAt) || null;
          if (lastKnownStockCloudUpdatedAt && cloudUpdatedAt && cloudUpdatedAt !== lastKnownStockCloudUpdatedAt) {
            const proceed = confirm(
              '⚠️ 偵測到雲端的股票管理資料在你上次同步之後，已經被其他裝置更新過（可能是手機或另一台電腦）。\n\n' +
              '按「確定」會用這台裝置目前的內容覆蓋雲端（另一台裝置的變更會遺失）。\n' +
              '按「取消」不會儲存，建議重新整理頁面，拉取雲端最新版本後再繼續編輯。'
            );
            if (!proceed) {
              if (typeof showToast === 'function') showToast('已暫停同步：雲端有更新的版本，尚未覆蓋', 'error');
              return;
            }
          }
        }
        const data = gatherAllData();
        await ref.set(data);
        lastKnownStockCloudUpdatedAt = data.updatedAt;
      } catch (err) {
        console.warn('股票資料自動同步失敗', err);
        if (typeof showToast === 'function') showToast('⚠️ 股票資料雲端同步失敗（本機已儲存）', 'error');
      }
    }

    function scheduleCloudSync() {
      if (!fbUser) return;
      clearTimeout(stockCloudSyncTimer);
      stockCloudSyncTimer = setTimeout(() => {
        pushStockToCloud();
      }, 2000);
    }

    if (typeof fbAuth !== 'undefined' && fbAuth) {
      fbAuth.onAuthStateChanged((user) => {
        if (user) loadStockFromCloud();
      });
    }

    /* ====== 懸浮計算機邏輯與拖曳 ====== */
    function toggleCalculator() {
      const calc = document.getElementById('floatingCalculator');
      if (calc) {
        const isVisible = calc.style.display === 'block';
        calc.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) calc.focus();
      }
    }

    let calcExpression = '0';
    function calcUpdateScreen() {
      const screen = document.getElementById('calcScreen');
      if (screen) screen.textContent = calcExpression;
    }
    function calcClear() {
      calcExpression = '0';
      calcUpdateScreen();
    }
    function calcAppend(val) {
      if (calcExpression === '0' && val !== '.') {
        calcExpression = val;
      } else {
        calcExpression += val;
      }
      calcUpdateScreen();
    }
    function calcBackspace() {
      if (calcExpression.length > 1) {
        calcExpression = calcExpression.slice(0, -1);
      } else {
        calcExpression = '0';
      }
      calcUpdateScreen();
    }
    function calcEvaluate() {
      try {
        let res = eval(calcExpression.replace(/×/g, '*').replace(/÷/g, '/'));
        calcExpression = String(res);
      } catch (e) {
        calcExpression = '錯誤';
      }
      calcUpdateScreen();
    }

    window.addEventListener('keydown', (e) => {
      const calc = document.getElementById('floatingCalculator');
      const activeEl = document.activeElement;
      const isInTableInput = activeEl && activeEl.classList && activeEl.classList.contains('cell-input');

      if (calc && calc.style.display === 'block' && !isInTableInput) {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
          calcAppend(e.key);
          e.preventDefault();
        } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
          calcAppend(e.key);
          e.preventDefault();
        } else if (e.key === 'Enter' || e.key === '=') {
          calcEvaluate();
          e.preventDefault();
        } else if (e.key === 'Backspace') {
          calcBackspace();
          e.preventDefault();
        } else if (e.key.toLowerCase() === 'c' || e.key === 'Delete') {
          calcClear();
          e.preventDefault();
        }
      }
    });

    function setupCalculatorDrag() {
      const calc = document.getElementById('floatingCalculator');
      const header = document.getElementById('calcDragHandle');
      if (!calc || !header) return;

      let isDragging = false;
      let startX, startY, initialX, initialY;

      header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = calc.offsetLeft;
        initialY = calc.offsetTop;
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let dx = e.clientX - startX;
        let dy = e.clientY - startY;
        calc.style.left = (initialX + dx) + 'px';
        calc.style.top = (initialY + dy) + 'px';
        calc.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    function getAllAccounts() {
      const defaultAccs = ['富邦證券', '國泰證券', '美股複委託'];
      const set = new Set([...defaultAccs, ...customAccounts]);
      stocks.forEach(s => {
        if (s.account && !defaultAccs.includes(s.account) && !s.account.includes('+')) {
          set.add(s.account);
        }
      });
      return Array.from(set);
    }

    function toggleSettingDropdown(e) {
      e.stopPropagation();
      const dropdown = document.getElementById('settingDropdown');
      dropdown.classList.toggle('active');
    }

    function setupSettingDropdownClose() {
      window.addEventListener('click', () => {
        const dropdown = document.getElementById('settingDropdown');
        if (dropdown) dropdown.classList.remove('active');
      });
    }

    function renderTabs() {
      const allAccs = getAllAccounts();
      const tabs = [
        { id: 'ALL', label: '全部持股' },
        ...allAccs.map(acc => ({ id: acc, label: acc, isAccount: true, isCustom: !['富邦證券', '國泰證券', '美股複委託'].includes(acc) })),
        { id: 'ETF', label: 'ETF' },
        { id: '台股', label: '台股個股 (合併)' },
        { id: 'STOCK_SALES', label: '📉 股票賣出', isSales: true },
        { id: 'STOCK_LENDING_TAB', label: '📦 股票借出', isLending: true },
        { id: 'DIVIDENDS_TAB', label: '📊 股利', isDividends: true },
        { id: 'YONG_FENG_TAB', label: '🌸 媽的永豐', isYF: true },
        { id: 'DCA_TAB', label: '📆 定期定額', isDCA: true },
        { id: 'SNAPSHOT_LOGS', label: '📋 各股紀錄', isSnapshot: true }
      ];

      const tabContainer = document.getElementById('tabGroup');
      if (!tabContainer) return;

      tabContainer.innerHTML = tabs.map(t => {
        let countText = '';
        if (t.id === 'DIVIDENDS_TAB' || t.id === 'STOCK_SALES' || t.id === 'STOCK_LENDING_TAB' || t.id === 'SNAPSHOT_LOGS' || t.id === 'YONG_FENG_TAB' || t.id === 'DCA_TAB') {
          countText = '';
        } else {
          countText = ` (${countByFilter(t.id)})`;
        }

        // 安全性修正：帳戶名稱可能是使用者自訂的自由文字，塞進 onclick="..."
        // 字串前一定要先跳脫單引號，否則名稱裡如果剛好有一個單引號，
        // 就能斷開這個屬性、注入任意 JS（stored XSS，資料還會同步進 Firestore）。
        const safeId = esc(t.id).replace(/'/g, "\\'");
        if (t.isCustom) {
          return `
            <div class="tab-pill-group ${currentFilter === t.id ? 'active' : ''}">
              <button class="tab-pill-btn" onclick="setFilter('${safeId}')">${esc(t.label)}${countText}</button>
              <button class="tab-pill-del" title="刪除此證券帳戶" onclick="deleteCustomAccount(event, '${safeId}')">✕</button>
            </div>
          `;
        } else {
          return `
            <button class="tab-btn ${currentFilter === t.id ? 'active' : ''} ${t.isDividends ? 'tab-btn-dividends' : ''} ${t.isYF ? 'tab-btn-yf' : ''} ${t.isSnapshot ? 'tab-btn-snapshot' : ''} ${t.isSales ? 'tab-btn-sales' : ''} ${t.isLending ? 'tab-btn-lending' : ''} ${t.isDCA ? 'tab-btn-dca' : ''}" onclick="setFilter('${safeId}')">
              ${esc(t.label)}${countText}
            </button>
          `;
        }
      }).join('');
    }

    function countByFilter(filterId) {
      if (filterId === 'ALL') return stocks.length;
      if (filterId === '台股') {
        const uniqueSymbols = new Set(stocks.filter(s => s.category === '台股').map(s => s.code || s.name));
        return uniqueSymbols.size;
      }
      return stocks.filter(s => s.account === filterId || s.category === filterId).length;
    }

    function setFilter(filterId) {
      currentFilter = filterId;
      if (filterId === 'STOCK_SALES') {
        salesSubTab = 'list';
      }
      if (filterId === 'STOCK_LENDING_TAB') {
        lendingSubTab = 'holdings';
      }
      if (filterId === 'DIVIDENDS_TAB') {
        dividendsSubTab = 'summary';
      }
      renderTabs();
      renderTable();
      saveNavState();
    }

    function setSalesSubTab(subTab) {
      salesSubTab = subTab;
      document.getElementById('subBtnList').classList.toggle('active', subTab === 'list');
      document.getElementById('subBtnSummary').classList.toggle('active', subTab === 'summary');
      document.getElementById('subBtnHistory').classList.toggle('active', subTab === 'history');
      renderTable();
      saveNavState();
    }

    function setLendingSubTab(subTab) {
      lendingSubTab = subTab;
      document.getElementById('subBtnLendHoldings').classList.toggle('active', subTab === 'holdings');
      document.getElementById('subBtnLendIncome').classList.toggle('active', subTab === 'income');
      renderTable();
      saveNavState();
    }

    function setDividendsSubTab(subTab) {
      dividendsSubTab = subTab;
      document.getElementById('subBtnDivSummary').classList.toggle('active', subTab === 'summary');
      document.getElementById('subBtnDivPast').classList.toggle('active', subTab === 'past');
      document.getElementById('subBtnDivEst').classList.toggle('active', subTab === 'estimate');
      renderTable();
      saveNavState();
    }

    /* ====== Task 3: 記住「重新整理」前所在的頁面 (分頁 + 子分頁)，不要跳回財務總覽 ====== */
    const NAV_STATE_KEY = 'APP_NAV_STATE_V1';

    function saveNavState() {
      try {
        const stockViewEl = document.getElementById('stockView');
        const appView = (stockViewEl && stockViewEl.style.display !== 'none') ? 'stock' : 'finance';
        localStorage.setItem(NAV_STATE_KEY, JSON.stringify({
          appView: appView,
          stockFilter: currentFilter,
          dividendsSubTab: dividendsSubTab,
          salesSubTab: salesSubTab,
          lendingSubTab: lendingSubTab
        }));
      } catch (e) {}
    }

    function restoreNavState() {
      try {
        const saved = JSON.parse(localStorage.getItem(NAV_STATE_KEY) || 'null');
        if (!saved) return;

        if (saved.appView === 'stock') {
          if (typeof switchAppView === 'function') switchAppView('stock');
          if (saved.stockFilter) {
            setFilter(saved.stockFilter);
            if (saved.stockFilter === 'DIVIDENDS_TAB' && saved.dividendsSubTab) {
              setDividendsSubTab(saved.dividendsSubTab);
            }
            if (saved.stockFilter === 'STOCK_SALES' && saved.salesSubTab) {
              setSalesSubTab(saved.salesSubTab);
            }
            if (saved.stockFilter === 'STOCK_LENDING_TAB' && saved.lendingSubTab) {
              setLendingSubTab(saved.lendingSubTab);
            }
          }
        }
        // appView === 'finance' 不需要額外動作，financeView 本來就是預設畫面
      } catch (e) {}
    }

    function changeSummaryYear(yr) {
      selectedSummaryYear = yr;
      renderTable();
    }

    function getMergedTaiwanStocks() {
      const twStocks = stocks.filter(s => s.category === '台股');
      const map = new Map();

      twStocks.forEach(s => {
        const key = s.code ? s.code.trim() : s.name.trim();
        if (!map.has(key)) {
          map.set(key, {
            id: `merged_${key}`,
            name: s.name,
            code: s.code,
            category: '台股',
            account: s.account,
            accounts: [s.account],
            shares: Number(s.shares) || 0,
            totalCost: Number(s.totalCost) || 0,
            currentPrice: Number(s.currentPrice) || 0,
            cashDividends: Number(s.cashDividends) || 0,
            stockShares: Number(s.stockShares) || 0,
            lentShares: Number(s.lentShares) || 0,
            dividendHistory: JSON.parse(JSON.stringify(s.dividendHistory || [])),
            isMerged: false,
            sourceIds: [s.id]
          });
        } else {
          const existing = map.get(key);
          existing.isMerged = true;
          if (!existing.accounts.includes(s.account)) {
            existing.accounts.push(s.account);
          }
          existing.shares += Number(s.shares) || 0;
          existing.totalCost += Number(s.totalCost) || 0;
          existing.cashDividends += Number(s.cashDividends) || 0;
          existing.stockShares += Number(s.stockShares) || 0;
          existing.lentShares += Number(s.lentShares) || 0;
          if (Number(s.currentPrice) > 0) existing.currentPrice = Number(s.currentPrice);
          existing.sourceIds.push(s.id);

          (s.dividendHistory || []).forEach(dh => {
            const matchYear = existing.dividendHistory.find(h => h.year == dh.year);
            if (matchYear) {
              matchYear.cash = (Number(matchYear.cash) || 0) + (Number(dh.cash) || 0);
              matchYear.stockShares = (Number(matchYear.stockShares) || 0) + (Number(dh.stockShares) || (Number(dh.stock) || 0));
              if (!matchYear.cashDate && dh.cashDate) matchYear.cashDate = dh.cashDate;
              if (!matchYear.stockDate && dh.stockDate) matchYear.stockDate = dh.stockDate;
            } else {
              existing.dividendHistory.push({
                year: dh.year,
                cashDate: dh.cashDate || '',
                cash: Number(dh.cash) || 0,
                stockDate: dh.stockDate || '',
                stockShares: Number(dh.stockShares) || (Number(dh.stock) || 0)
              });
            }
          });
        }
      });

      return Array.from(map.values()).map(item => {
        item.account = item.accounts.join(' + ');
        return item;
      });
    }

    function normalizeYearKey(y) {
      if (!y) return '其他';
      let s = String(y).trim();
      if (s.includes('-')) return s;
      let num = parseInt(s);
      if (!isNaN(num)) {
        if (num > 1900) num -= 1911;
        return String(num);
      }
      return s;
    }

    function getFullAssetYearlyDividendSummary() {
      const yearMap = new Map();

      pastColumns.forEach(col => {
        const key = normalizeYearKey(col.year);
        const pastAmt = col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
        yearMap.set(key, {
          displayYear: col.year.includes('-') ? col.year : `${key}(${parseInt(key)+1911})`,
          rawKey: key,
          pastAmount: pastAmt,
          currentAmount: 0,
          totalAmount: pastAmt
        });
      });

      stocks.forEach(st => {
        const p = Number(st.currentPrice) || 0;
        const isUS = isUsStock(st);
        const fxRate = isUS ? 29 : 1;

        (st.dividendHistory || []).forEach(dh => {
          const key = normalizeYearKey(dh.year);
          // 「目前持股股利」全站統一只計算現金股利，不含股票股利折算現值
          const stAmt = (Number(dh.cash) || 0) * fxRate;

          if (!yearMap.has(key)) {
            const num = parseInt(key);
            const disp = !isNaN(num) ? `${key}(${num+1911})` : key;
            yearMap.set(key, {
              displayYear: disp,
              rawKey: key,
              pastAmount: 0,
              currentAmount: stAmt,
              totalAmount: stAmt
            });
          } else {
            const item = yearMap.get(key);
            item.currentAmount += stAmt;
            item.totalAmount += stAmt;
          }
        });
      });

      const sorted = Array.from(yearMap.values()).sort((a, b) => {
        let numA = parseInt(a.rawKey.split('-')[0]) || 0;
        let numB = parseInt(b.rawKey.split('-')[0]) || 0;
        return numA - numB;
      });

      return sorted;
    }

    // 分頁被鎖定時，把整個表格換成「功能尚待開發」提示（thead/tbody 版本，
    // 給股票賣出/借出/股利/定期定額/各股紀錄這幾個用 thead+tbody 渲染的分頁共用）
    function renderPageLockPlaceholder(thead, tbody, pageKey, colspan) {
      if (thead) thead.innerHTML = `<tr><th>提示</th></tr>`;
      if (tbody) tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; padding:60px 16px;">${lockPlaceholderHtml(pageKey, 'page')}</td></tr>`;
      if (typeof renderSummary === 'function') { try { renderSummary(); } catch (e) {} }
    }

    // 計算「相鄰列的某個欄位值相同」該怎麼合併成 rowspan。
    // 只有「值相同且彼此相鄰」才會合併，不相鄰的同值列不會被誤判成同一組
    // （例如：分兩批用同一個價格賣出，中間夾著別的交易，就不會被錯誤地合併在一起）。
    // 回傳陣列，每個 index 對應 list 同一個 index：{ isFirst, span }
    // 空值（''/null/undefined）一律不合併，維持一列一格，避免大片空白格被誤合併。
    function computeAdjacentSpans(list, keyFn) {
      const result = new Array(list.length);
      let i = 0;
      while (i < list.length) {
        const key = keyFn(list[i]);
        let j = i + 1;
        if (key !== '' && key !== null && key !== undefined) {
          while (j < list.length && keyFn(list[j]) === key) j++;
        }
        const span = j - i;
        for (let k = i; k < j; k++) result[k] = { isFirst: k === i, span };
        i = j;
      }
      return result;
    }

    function renderTable() {
      renderYfOverview();

      // 判斷這次 render 是不是「剛切換進這個分頁/子分頁」——只有這種情況才要自動捲到
      // 最新一筆資料；如果分頁/子分頁組合跟上次一樣，代表這次只是編輯資料觸發的重繪，
      // 不該把使用者正在編輯的捲動位置強制捲走。
      const tabContextKey = currentFilter + '|' + salesSubTab + '|' + dividendsSubTab + '|' + lendingSubTab;
      const isFreshTabEntry = tabContextKey !== lastEnteredTabContext;
      lastEnteredTabContext = tabContextKey;

      const thead = document.getElementById('stockGridHead');
      const tbody = document.getElementById('stockTableBody');
      const searchBox = document.getElementById('searchBox');
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';

      const btnDel = document.getElementById('btnDelLastRow');
      const btnAddYear = document.getElementById('btnAddYear');
      const btnAddStock = document.getElementById('btnAddNewStock');
      const pastCalcCard = document.getElementById('pastStockCalcCard');
      const snapshotDateBar = document.getElementById('snapshotDateBar');
      const salesSubBar = document.getElementById('salesSubBar');
      const lendingSubBar = document.getElementById('lendingSubBar');
      const dividendsSubBar = document.getElementById('dividendsSubBar');
      const topScrollWrapper = document.getElementById('topScrollWrapper');
      const mainTableContainer = document.getElementById('mainTableContainer');
      const yfTablesContainer = document.getElementById('yfTablesContainer');
      const tableWithChartLayout = document.getElementById('tableWithChartLayout');
      const dividendChartPanel = document.getElementById('dividendChartPanel');
      const stockGridFoot = document.getElementById('stockGridFoot');

      // 預設：一般表格版面（單欄、無小計列），只有「歷年股利總合」子分頁會切換成雙欄+小計
      const isYearlySummaryView = (currentFilter === 'DIVIDENDS_TAB' && dividendsSubTab === 'summary');
      if (tableWithChartLayout) tableWithChartLayout.classList.toggle('split-mode', isYearlySummaryView);
      if (dividendChartPanel) dividendChartPanel.style.display = isYearlySummaryView ? 'block' : 'none';
      if (!isYearlySummaryView && stockGridFoot) stockGridFoot.innerHTML = '';

      if (currentFilter === 'DIVIDENDS_TAB') {
        if (dividendsSubBar) dividendsSubBar.style.display = 'flex';
      } else {
        if (dividendsSubBar) dividendsSubBar.style.display = 'none';
      }

      if (currentFilter === 'YONG_FENG_TAB') {
        if (yfTablesContainer) yfTablesContainer.style.display = 'flex';
        if (mainTableContainer) mainTableContainer.style.display = 'none';
        if (btnAddStock) btnAddStock.style.display = 'none';
      } else {
        if (yfTablesContainer) yfTablesContainer.style.display = 'none';
        if (mainTableContainer) mainTableContainer.style.display = '';
        if (btnAddStock) btnAddStock.style.display = '';
      }

      if (currentFilter === 'PAST_DIVIDENDS') {
        if (btnAddStock) btnAddStock.textContent = '➕ 新增一列';
        if (btnDel) btnDel.style.display = 'inline-flex';
        if (btnAddYear) btnAddYear.style.display = 'inline-flex';
        if (pastCalcCard) pastCalcCard.style.display = 'flex';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (lendingSubBar) lendingSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'block';
        if (mainTableContainer) mainTableContainer.classList.add('with-top-scroll');
      } else if (currentFilter === 'STOCK_SALES') {
        if (btnAddStock) {
          btnAddStock.textContent = salesSubTab === 'history' ? '➕ 新增歷年紀錄列' : '➕ 新增賣出紀錄列';
        }
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'flex';
        if (lendingSubBar) lendingSubBar.style.display = 'none';

        const yrContainer = document.getElementById('summaryYearSelectorContainer');
        if (yrContainer) yrContainer.style.display = (salesSubTab === 'summary') ? 'flex' : 'none';

        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else if (currentFilter === 'STOCK_LENDING_TAB') {
        if (btnAddStock) {
          btnAddStock.textContent = lendingSubTab === 'income' ? '➕ 新增借卷收入列' : '➕ 新增借出持股列';
        }
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (lendingSubBar) lendingSubBar.style.display = 'flex';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else if (currentFilter === 'YONG_FENG_TAB') {
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (lendingSubBar) lendingSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else if (currentFilter === 'DCA_TAB') {
        if (btnAddStock) btnAddStock.textContent = '➕ 新增定期定額列';
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (lendingSubBar) lendingSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else if (currentFilter === 'DIVIDENDS_TAB') {
        if (btnAddStock) btnAddStock.textContent = dividendsSubTab === 'past' ? '➕ 新增一列' : '➕ 新增股票';
        if (btnDel) btnDel.style.display = dividendsSubTab === 'past' ? 'inline-flex' : 'none';
        if (btnAddYear) btnAddYear.style.display = dividendsSubTab === 'past' ? 'inline-flex' : 'none';
        if (pastCalcCard) pastCalcCard.style.display = dividendsSubTab === 'past' ? 'flex' : 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (lendingSubBar) lendingSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = dividendsSubTab === 'past' ? 'block' : 'none';
        if (mainTableContainer) {
          if (dividendsSubTab === 'past') mainTableContainer.classList.add('with-top-scroll');
          else mainTableContainer.classList.remove('with-top-scroll');
        }
      } else if (currentFilter === 'SNAPSHOT_LOGS') {
        if (btnAddStock) btnAddStock.textContent = '➕ 新增股票';
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'flex';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (lendingSubBar) lendingSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      } else {
        if (btnAddStock) btnAddStock.textContent = '➕ 新增股票';
        if (btnDel) btnDel.style.display = 'none';
        if (btnAddYear) btnAddYear.style.display = 'none';
        if (pastCalcCard) pastCalcCard.style.display = 'none';
        if (snapshotDateBar) snapshotDateBar.style.display = 'none';
        if (salesSubBar) salesSubBar.style.display = 'none';
        if (lendingSubBar) lendingSubBar.style.display = 'none';
        if (topScrollWrapper) topScrollWrapper.style.display = 'none';
        if (mainTableContainer) mainTableContainer.classList.remove('with-top-scroll');
      }

      // 0-1. 媽的永豐分頁 (YONG_FENG_TAB) - 三表並排，無分頁切換
      if (currentFilter === 'YONG_FENG_TAB') {
        if (isPageLocked('yf')) {
          if (yfTablesContainer) yfTablesContainer.innerHTML = `<div style="padding:60px 16px; text-align:center;">${lockPlaceholderHtml('yf', 'page')}</div>`;
          return;
        }
        renderYfTablesAll();
        return;
      }

      // 0-2. 股利分頁 (DIVIDENDS_TAB)
      if (currentFilter === 'DIVIDENDS_TAB') {
        if (isPageLocked('dividends')) {
          renderPageLockPlaceholder(thead, tbody, 'dividends', 6);
          return;
        }
        if (dividendsSubTab === 'summary') {
          renderYearlySummaryTable(thead, tbody);
          return;
        }
        if (dividendsSubTab === 'past') {
          renderPastDividendsTable(thead, tbody, isFreshTabEntry);
          return;
        }
        if (dividendsSubTab === 'estimate') {
          renderEstimatedDividendsTable(thead, tbody);
          return;
        }
      }

      // 1. 股票賣出紀錄分頁 (STOCK_SALES)
      if (currentFilter === 'STOCK_SALES') {
        if (isPageLocked('sales')) {
          renderPageLockPlaceholder(thead, tbody, 'sales', 16);
          return;
        }
        if (salesSubTab === 'summary') {
          renderSalesSummaryTable(thead, tbody);
          return;
        }
        if (salesSubTab === 'history') {
          renderSalesHistoryTable(thead, tbody);
          return;
        }

        thead.innerHTML = `
          <tr>
            <th style="width: 90px;">日期</th>
            <th style="width: 120px;">名稱</th>
            <th style="width: 90px;">股數</th>
            <th style="width: 100px;">買進價格</th>
            <th style="width: 100px;">賣出價格</th>
            <th style="width: 110px;">成本 ($)</th>
            <th style="width: 110px;">賣出 ($)</th>
            <th style="width: 100px;">價差</th>
            <th style="width: 90px;">報酬率</th>
            <th style="width: 90px;">買進手續費</th>
            <th style="width: 90px;">賣出手續費</th>
            <th style="width: 90px;">交易稅</th>
            <th style="width: 100px;">狀態</th>
            <th style="width: 100px;">當日共計</th>
            <th style="width: 50px;">備考</th>
            <th style="width: 60px;">操作</th>
          </tr>
        `;

        yfAutoSortByDate(stockSales, 'date');

        let sales = stockSales;
        if (query) {
          sales = sales.filter(r => (r.name && r.name.toLowerCase().includes(query)) || (r.date && r.date.toLowerCase().includes(query)) || (r.status && r.status.toLowerCase().includes(query)));
        }

        const monthPalette = ['#f5eee0', '#eef0e6', '#e9e4da', '#ece2c4', '#eaeef0', '#f4ecd4'];
        let monthGroupIdx = -1;
        let lastMonthKey = null;
        function salesMonthColor(dateStr) {
          const digits = String(dateStr || '').replace(/[^0-9]/g, '');
          let monthKey = null;
          if (digits.length === 7) monthKey = digits.slice(0, 5);
          else if (digits.length === 6) monthKey = digits.slice(0, 4);
          else if (digits.length === 5) monthKey = digits.slice(0, 3);
          if (!monthKey) return '';
          if (monthKey !== lastMonthKey) {
            lastMonthKey = monthKey;
            monthGroupIdx++;
          }
          return monthPalette[monthGroupIdx % monthPalette.length];
        }

        // 合併儲存格：日期相同的相鄰列合併「日期」欄（也沿用同一組來合併「當日共計」欄，
        // 跟原本邏輯一樣）；賣出價格相同的相鄰列合併「賣出價格／賣出手續費／交易稅／狀態」
        // 這四欄。兩組各自獨立判斷（同一天不代表賣出價格也相同）。
        const dateSpans = computeAdjacentSpans(sales, r => r.date || '');
        // 賣出價格分組：要「同一天、同一檔股票、賣出價格也相同」才會合併，
        // 三個條件缺一不可——不會出現跨日期，只因為賣出價格剛好一樣就被合併的狀況。
        const priceSpans = computeAdjacentSpans(sales, r => {
          const dateKey = r.date || '';
          const nameKey = (r.name || '').trim();
          const priceKey = (r.sellPrice === undefined || r.sellPrice === '') ? '' : String(Number(r.sellPrice) || 0);
          if (!dateKey || !nameKey || priceKey === '') return ''; // 任一條件缺值就不合併，一律各自一列
          return dateKey + '|' + nameKey + '|' + priceKey;
        });

        let rowsHtml = sales.map((r, rIdx) => {
          const retRateStr = r.returnRate !== undefined && !isNaN(r.returnRate) ? (r.returnRate * 100).toFixed(2) + '%' : '0.00%';
          const isPos = (Number(r.spread) || 0) >= 0;
          const dSpan = dateSpans[rIdx];
          const pSpan = priceSpans[rIdx];

          // 日期欄：合併群組的第一列才輸出 <td rowspan>，其餘列完全不輸出這個 <td>
          // （rowspan 會自動佔掉底下幾列的這個欄位位置，不能重複輸出）
          const dateCellHtml = dSpan.isFirst
            ? `<td class="editable-col" ${dSpan.span > 1 ? `rowspan="${dSpan.span}"` : ''} style="vertical-align:middle;"><input type="text" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="0" value="${esc(r.date || '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 0)" onchange="updateSaleRow(${rIdx}, 'date', this.value)" /></td>`
            : '';

          // 當日共計：沿用同一組日期分組
          let dayTotalHtml = '';
          if (dSpan.isFirst) {
            dayTotalHtml = (r.date || '')
              ? `<td class="font-mono" style="background:#f8fafc; font-weight:700; vertical-align:middle;" ${dSpan.span > 1 ? `rowspan="${dSpan.span}"` : ''}>${r.dayTotal !== null && r.dayTotal !== undefined ? '$' + formatNum(r.dayTotal, 0) : '-'}</td>`
              : `<td class="font-mono" style="background:#f8fafc; font-weight:700;">-</td>`;
          }

          // 賣出價格／賣出手續費／交易稅／狀態：合併群組的第一列才輸出，其餘列不輸出
          const sellPriceCellHtml = pSpan.isFirst
            ? `<td class="editable-col" ${pSpan.span > 1 ? `rowspan="${pSpan.span}"` : ''} style="vertical-align:middle;"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="4" value="${esc(r.sellPrice !== undefined && r.sellPrice !== '' ? r.sellPrice : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 4)" onchange="updateSaleRow(${rIdx}, 'sellPrice', this.value)" /></td>`
            : '';
          const sellFeeCellHtml = pSpan.isFirst
            ? `<td class="editable-col" ${pSpan.span > 1 ? `rowspan="${pSpan.span}"` : ''} style="vertical-align:middle;"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="10" value="${esc(r.sellFee !== undefined && r.sellFee !== '' ? r.sellFee : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 10)" onchange="updateSaleRow(${rIdx}, 'sellFee', this.value)" /></td>`
            : '';
          const taxCellHtml = pSpan.isFirst
            ? `<td class="editable-col" ${pSpan.span > 1 ? `rowspan="${pSpan.span}"` : ''} style="vertical-align:middle;"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="11" value="${esc(r.tax !== undefined && r.tax !== '' ? r.tax : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 11)" onchange="updateSaleRow(${rIdx}, 'tax', this.value)" /></td>`
            : '';
          const statusCellHtml = pSpan.isFirst
            ? `<td class="editable-col" ${pSpan.span > 1 ? `rowspan="${pSpan.span}"` : ''} style="vertical-align:middle;">
                <select class="cell-input" style="background:#fff; border:1px solid #cbd5e1; padding:2px;" data-sale-idx="${rIdx}" data-col="12" onchange="updateSaleRow(${rIdx}, 'status', this.value)" onkeydown="handleSaleKey(event, ${rIdx}, 12)">
                  <option value="" ${!r.status ? 'selected' : ''}>-</option>
                  <option value="獲益" ${r.status === '獲益' ? 'selected' : ''}>獲益</option>
                  <option value="認賠" ${r.status === '認賠' ? 'selected' : ''}>認賠</option>
                  <option value="當沖" ${r.status === '當沖' ? 'selected' : ''}>當沖</option>
                </select>
              </td>`
            : '';

          const rowBg = salesMonthColor(r.date);

          return `
            <tr${rowBg ? ` style="background:${rowBg};"` : ''}>
              ${dateCellHtml}
              <td class="editable-col"><input type="text" class="cell-input" style="font-weight:700;" data-sale-idx="${rIdx}" data-col="1" value="${esc(r.name || '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 1)" onchange="updateSaleRow(${rIdx}, 'name', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="2" value="${esc(r.shares !== undefined && r.shares !== '' ? r.shares : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 2)" onchange="updateSaleRow(${rIdx}, 'shares', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="3" value="${esc(r.buyPrice !== undefined && r.buyPrice !== '' ? r.buyPrice : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 3)" onchange="updateSaleRow(${rIdx}, 'buyPrice', this.value)" /></td>
              ${sellPriceCellHtml}

              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="5" value="${esc(r.cost !== undefined && r.cost !== '' ? r.cost : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 5)" onchange="updateSaleRow(${rIdx}, 'cost', this.value)" /></td>
              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="6" value="${esc(r.sellAmt !== undefined && r.sellAmt !== '' ? r.sellAmt : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 6)" onchange="updateSaleRow(${rIdx}, 'sellAmt', this.value)" /></td>

              <td class="font-mono" style="font-weight:700; color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${isPos ? '+' : ''}$${formatNum(r.spread, 0)}</td>
              <td class="font-mono" style="color:${isPos ? 'var(--up-red)' : 'var(--down-green)'};">${esc(retRateStr)}</td>

              <td class="editable-col"><input type="number" step="any" class="cell-input font-mono" data-sale-idx="${rIdx}" data-col="9" value="${esc(r.buyFee !== undefined && r.buyFee !== '' ? r.buyFee : '')}" onfocus="this.select()" onkeydown="handleSaleKey(event, ${rIdx}, 9)" onchange="updateSaleRow(${rIdx}, 'buyFee', this.value)" /></td>
              ${sellFeeCellHtml}
              ${taxCellHtml}
              ${statusCellHtml}

              ${dayTotalHtml}
              <td style="text-align:center;">
                <button class="btn-icon-plain" title="${(r.note || '').trim() ? '查看/編輯備註' : '新增備註'}" onclick="openNoteModal('sale', ${rIdx})" style="font-size:1.05rem; background:none; border:none; cursor:pointer;">${(r.note || '').trim() ? '📝' : '🗒️'}</button>
              </td>
              <td>
                <button class="btn-del" title="刪除" onclick="deleteStockSale(${rIdx})">✕</button>
              </td>
            </tr>
          `;
        }).join('');

        let sumCost = sales.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        let sumSellAmt = sales.reduce((s, r) => s + (Number(r.sellAmt) || 0), 0);
        let sumSpread = sales.reduce((s, r) => s + (Number(r.spread) || 0), 0);
        let sumBuyFee = sales.reduce((s, r) => s + (Number(r.buyFee) || 0), 0);
        let sumSellFee = sales.reduce((s, r) => s + (Number(r.sellFee) || 0), 0);
        let sumTax = sales.reduce((s, r) => s + (Number(r.tax) || 0), 0);
        let avgRetRate = sumCost > 0 ? (sumSpread / sumCost * 100).toFixed(2) + '%' : '0.00%';
        let isPosSum = sumSpread >= 0;

        rowsHtml += `
          <tr style="background:#f1f5f9; font-weight:800; border-top:2px solid #cbd5e1;">
            <td>小計</td>
            <td colspan="4">-</td>
            <td class="font-mono">$${formatNum(sumCost, 0)}</td>
            <td class="font-mono">$${formatNum(sumSellAmt, 0)}</td>
            <td class="font-mono" style="color:${isPosSum ? 'var(--up-red)' : 'var(--down-green)'};">${isPosSum ? '+' : ''}$${formatNum(sumSpread, 0)}</td>
            <td class="font-mono" style="color:${isPosSum ? 'var(--up-red)' : 'var(--down-green)'};">${esc(avgRetRate)}</td>
            <td class="font-mono">${formatNum(sumBuyFee, 0)}</td>
            <td class="font-mono">${formatNum(sumSellFee, 0)}</td>
            <td class="font-mono">${formatNum(sumTax, 0)}</td>
            <td>-</td>
            <td class="font-mono" style="color:${isPosSum ? 'var(--up-red)' : 'var(--down-green)'};">${isPosSum ? '+' : ''}$${formatNum(sumSpread, 0)}</td>
            <td>-</td>
            <td>-</td>
          </tr>
        `;

        tbody.innerHTML = rowsHtml;
        renderSummary();
        if (isFreshTabEntry) {
          setTimeout(() => {
            if (mainTableContainer) mainTableContainer.scrollTop = mainTableContainer.scrollHeight;
          }, 50);
        }
        return;
      }

      // 1.5 股票借出分頁 (STOCK_LENDING_TAB)
      if (currentFilter === 'STOCK_LENDING_TAB') {
        if (isPageLocked('lending')) {
          renderPageLockPlaceholder(thead, tbody, 'lending', 10);
          return;
        }
        if (lendingSubTab === 'income') {
          renderLendingIncomeTable(thead, tbody);
        } else {
          renderStockLendingTable(thead, tbody);
        }
        return;
      }

      // 1.6 定期定額分頁 (DCA_TAB)
      if (currentFilter === 'DCA_TAB') {
        if (isPageLocked('dca')) {
          renderPageLockPlaceholder(thead, tbody, 'dca', 6);
          return;
        }
        renderDcaTable(thead, tbody);
        return;
      }

      // 2. 各股紀錄分頁 (Snapshot Logs)
      if (currentFilter === 'SNAPSHOT_LOGS') {
        if (isPageLocked('snapshot')) {
          renderPageLockPlaceholder(thead, tbody, 'snapshot', 9);
          return;
        }
        let allSnaps = [];
        const storedSnap = localStorage.getItem('ASSET_SNAPSHOTS_V1');
        if (storedSnap) {
          try { allSnaps = JSON.parse(storedSnap); } catch (e) {}
        }

        const pillsContainer = document.getElementById('snapshotDatePillsContainer');
        if (allSnaps.length === 0) {
          if (pillsContainer) pillsContainer.innerHTML = `<span style="font-size:0.8rem; color:#64748b;">尚無快照紀錄，請點擊上方【📸 一鍵紀錄】</span>`;
          thead.innerHTML = `<tr><th>提示</th></tr>`;
          tbody.innerHTML = `<tr><td style="padding:40px; color:#94a3b8;">目前尚無任何快照紀錄</td></tr>`;
          renderSummary();
          return;
        }

        if (!selectedSnapshotDate || !allSnaps.some(s => s.date === selectedSnapshotDate)) {
          selectedSnapshotDate = allSnaps[0].date;
        }

        if (pillsContainer) {
          pillsContainer.innerHTML = allSnaps.map(sp => `
            <div class="snapshot-pill-group ${selectedSnapshotDate === sp.date ? 'active' : ''}">
              <button class="snapshot-date-btn" onclick="selectSnapshotDate('${sp.date}')">
                📅 ${sp.date} (${sp.items.length} 檔)
              </button>
              <button class="snapshot-date-del" title="刪除此日期快照" onclick="deleteEntireSnapshot('${sp.date}')">
                ✕
              </button>
            </div>
          `).join('');
        }

        thead.innerHTML = `
          <tr>
            <th style="width: 150px;">證券帳戶</th>
            <th style="width: 180px;">股票名稱</th>
            <th style="width: 110px;">代號</th>
            <th style="width: 110px;">持有股數</th>
            <th style="width: 140px;">成本 ($)</th>
            <th style="width: 120px;">現價 ($)</th>
            <th style="width: 150px;">市值 ($)</th>
            <th style="width: 150px;">未實現損益</th>
            <th style="width: 60px;">操作</th>
          </tr>
        `;

        const activeSnap = allSnaps.find(sp => sp.date === selectedSnapshotDate) || allSnaps[0];
        let items = activeSnap.items;

        if (query) {
          items = items.filter(r => r.name.toLowerCase().includes(query) || r.code.toLowerCase().includes(query) || r.account.toLowerCase().includes(query));
        }

        tbody.innerHTML = items.map((r, rIdx) => {
          const isP = r.profit >= 0;
          return `
            <tr>
              <td>${esc(r.account)}</td>
              <td style="font-weight:700;">${esc(r.name)}</td>
              <td style="color:#64748b;">${esc(r.code)}</td>
              <td class="font-mono">${formatNum(r.shares, 0)}</td>
              <td class="font-mono">$${formatNum(r.totalCost, 0)}</td>
              <td class="font-mono">$${formatNum(r.currentPrice, 2)}</td>
              <td class="font-mono font-bold">$${formatNum(r.marketVal, 0)}</td>
              <td class="font-mono" style="font-weight:700; color:${isP ? 'var(--up-red)' : 'var(--down-green)'};">
                ${isP ? '+' : ''}$${formatNum(r.profit, 0)}
              </td>
              <td>
                <button class="btn-del" title="刪除此快照筆數" onclick="deleteSnapshotItem('${activeSnap.date}', ${rIdx})">✕</button>
              </td>
            </tr>
          `;
        }).join('');

        renderSummary();
        return;
      }

      // 3. 標準持股表頭 (所有證券帳戶分頁皆支援 ☰ 拖曳排序)
      if (isPageLocked('holdings')) {
        renderPageLockPlaceholder(thead, tbody, 'holdings', 13);
        return;
      }
      const allAccs = getAllAccounts();
      const isAccountTab = allAccs.includes(currentFilter);

      thead.innerHTML = `
        <tr>
          ${isAccountTab ? '<th style="min-width: 50px; width: 50px;">排序</th>' : ''}
          <th style="min-width: 140px; width: 140px;">股票名稱</th>
          <th style="min-width: 90px; width: 90px;">現價 ($) 🧮</th>
          <th class="editable-col" style="min-width: 100px; width: 100px; color: #2563eb;">市值 ✏️</th>
          <th class="editable-col" style="min-width: 100px; width: 100px; color: #2563eb;">成本 ($) ✏️</th>
          <th class="editable-col" style="min-width: 90px; width: 90px; color: #2563eb;">持有股數 ✏️</th>
          <th style="min-width: 110px; width: 110px;">未實現損益</th>
          <th style="min-width: 100px; width: 100px;">平均每股成本</th>
          <th style="min-width: 115px; width: 115px; color: #d97706;">現金股利 ($) 💰</th>
          <th style="min-width: 125px; width: 125px; color: #1d4ed8;">股票股利 ($) 📈</th>
          <th class="highlight-cell" style="min-width: 105px; width: 105px;">含息每股成本</th>
          <th class="editable-col" style="min-width: 90px; width: 90px; color: #2563eb;">出借張數 ✏️</th>
          <th style="min-width: 50px; width: 50px;">操作</th>
        </tr>
      `;

      let displayList = [];
      if (currentFilter === '台股') {
        displayList = getMergedTaiwanStocks();
      } else {
        displayList = stocks.filter(s => (currentFilter === 'ALL') || (s.account === currentFilter) || (s.category === currentFilter));
      }

      if (query) {
        displayList = displayList.filter(s => 
          s.name.toLowerCase().includes(query) || 
          (s.code && s.code.toLowerCase().includes(query)) || 
          s.account.toLowerCase().includes(query)
        );
      }

      if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAccountTab ? 13 : 12}" style="text-align:center; padding:30px; color:#94a3b8;">無相符股票標的</td></tr>`;
        renderSummary();
        return;
      }

      tbody.innerHTML = displayList.map((s, rowIndex) => {
        const isUS = isUsStock(s);
        const fxRate = isUS ? 29 : 1;

        const totalCost = (Number(s.totalCost) || 0) * fxRate;
        const shares = Number(s.shares) || 0;
        const currentPrice = (Number(s.currentPrice) || 0) * fxRate;
        const cashDiv = (Number(s.cashDividends) || 0) * fxRate;
        const stockShares = Number(s.stockShares) || 0;
        const stockDivVal = stockShares * currentPrice;
        const totalDiv = cashDiv + stockDivVal;
        const lentShares = Number(s.lentShares) || 0;

        const avgCostPerShare = shares > 0 ? (totalCost / shares) : 0;
        const isMergedRow = Boolean(s.isMerged);
        // Task: 市值改為手動輸入 (s.marketVal)，現價 = 市值 / 持有股數 自動計算
        // 合併列(isMergedRow)沒有單一市值可編輯，維持用「持有股數 × 現價」計算
        const marketVal = isMergedRow ? (shares * currentPrice) : ((Number(s.marketVal) || 0) * fxRate);
        const profit = marketVal - totalCost;
        const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
        const netCostPerShare = shares > 0 ? ((totalCost - totalDiv) / shares) : 0;
        const isProfit = profit >= 0;

        const enableDrag = isAccountTab && !query && !isMergedRow;
        const unitSymbol = isUS ? 'US$' : '$';

        // 密碼鎖定功能：欄位級鎖定 —— 被鎖定的欄位改顯示「功能尚待開發」佔位內容，
        // 其餘欄位不受影響；欄位本身的 <td> 結構/寬度維持不變。
        const cellCurrentPrice = isFieldLocked('holdings.currentPrice')
          ? lockPlaceholderHtml('holdings.currentPrice', 'field')
          : `${unitSymbol}${formatNum(currentPrice / fxRate, isUS ? 2 : 2)}`;

        const cellMarketVal = isFieldLocked('holdings.marketVal')
          ? lockPlaceholderHtml('holdings.marketVal', 'field')
          : (isMergedRow ? `<span class="font-mono font-bold">${unitSymbol}${formatNum(marketVal / fxRate, isUS ? 2 : 0)}</span>` : `
                <input type="number" step="any" class="cell-input font-bold" data-row="${rowIndex}" data-col="0" data-field="marketVal" value="${esc(Number(s.marketVal) || 0)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 0)" onchange="updateValue(${s.id}, 'marketVal', this.value)" />
              `);

        const cellTotalCost = isFieldLocked('holdings.totalCost')
          ? lockPlaceholderHtml('holdings.totalCost', 'field')
          : (isMergedRow ? `<span class="font-mono font-bold">${unitSymbol}${formatNum(Number(s.totalCost) || 0, isUS ? 2 : 0)}</span>` : `
                <input type="number" step="any" class="cell-input font-bold" data-row="${rowIndex}" data-col="1" data-field="totalCost" value="${esc(Number(s.totalCost) || 0)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 1)" onchange="updateValue(${s.id}, 'totalCost', this.value)" />
              `);

        const cellShares = isFieldLocked('holdings.shares')
          ? lockPlaceholderHtml('holdings.shares', 'field')
          : (isMergedRow ? `<span class="font-mono font-bold">${formatNum(shares, 0)}</span>` : `
                <input type="number" step="any" class="cell-input" data-row="${rowIndex}" data-col="2" data-field="shares" value="${esc(shares)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 2)" onchange="updateValue(${s.id}, 'shares', this.value)" />
              `);

        const cellProfit = isFieldLocked('holdings.profit')
          ? lockPlaceholderHtml('holdings.profit', 'field')
          : `
              <div style="font-weight:700; color:${isProfit ? 'var(--up-red)' : 'var(--down-green)'};">
                ${isProfit ? '+' : ''}${unitSymbol}${formatNum(profit / fxRate, isUS ? 2 : 0)}
              </div>
              <div style="font-size:0.72rem; font-weight:600; color:${isProfit ? 'var(--up-red)' : 'var(--down-green)'};">
                ${isProfit ? '+' : ''}${profitRate.toFixed(2)}%
              </div>
            `;

        const cellAvgCost = isFieldLocked('holdings.avgCost')
          ? lockPlaceholderHtml('holdings.avgCost', 'field')
          : `${unitSymbol}${formatNum(avgCostPerShare / fxRate, 2)}`;

        const cellCashDiv = isFieldLocked('holdings.cashDividends')
          ? lockPlaceholderHtml('holdings.cashDividends', 'field')
          : `
              <button class="btn-cash-pill" onclick="openDividendModal('${s.id}', 'cash')">
                ${unitSymbol}${formatNum((Number(cashDiv) || 0) / fxRate, isUS ? 2 : 0)} 💰
              </button>
            `;

        const cellStockDiv = isFieldLocked('holdings.stockDividends')
          ? lockPlaceholderHtml('holdings.stockDividends', 'field')
          : `
              <button class="btn-stock-pill" onclick="openDividendModal('${s.id}', 'stock')">
                <span>${unitSymbol}${formatNum(stockDivVal / fxRate, isUS ? 2 : 0)} 📈</span>
                <span style="font-size:0.7rem; font-weight:normal; opacity:0.85;">(${formatNum(stockShares, 0)} 股)</span>
              </button>
            `;

        const cellNetCost = isFieldLocked('holdings.netCost')
          ? lockPlaceholderHtml('holdings.netCost', 'field')
          : `${unitSymbol}${formatNum(netCostPerShare / fxRate, 2)}`;

        const cellLentShares = isFieldLocked('holdings.lentShares')
          ? lockPlaceholderHtml('holdings.lentShares', 'field')
          : (isMergedRow ? `<span class="font-mono">${formatNum(lentShares, 0)}</span>` : `
                <input type="number" step="any" class="cell-input" style="color:#64748b;" data-row="${rowIndex}" data-col="3" data-field="lentShares" value="${esc(lentShares)}" onfocus="this.select()" onkeydown="handleCellKey(event, ${rowIndex}, 3)" onchange="updateValue(${s.id}, 'lentShares', this.value)" />
              `);

        return `
          <tr data-id="${s.id}" ${enableDrag ? 'draggable="true" ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, ' + s.id + ')" ondragend="onDragEnd(event)"' : ''}>
            ${isAccountTab ? `
              <td>
                ${enableDrag ? `<span class="drag-handle" title="按住拖曳排序">☰</span>` : `<span style="color:#94a3b8; font-size:0.75rem;">-</span>`}
              </td>
            ` : ''}

            <td>
              <div style="font-weight:700;">${esc(s.name)} <span style="font-size:0.75rem; color:#64748b;">${s.code ? '(' + esc(s.code) + ')' : ''}</span></div>
              <div style="font-size:0.72rem; color:${isMergedRow ? '#766c5a' : '#b3a998'}; font-weight:${isMergedRow ? '700' : 'normal'};">
                ${s.account} ${isMergedRow ? '⚡' : ''} ${isUS ? '(美金)' : ''}
              </div>
            </td>

            <td class="font-mono font-bold">${cellCurrentPrice}</td>

            <td class="editable-col">${cellMarketVal}</td>

            <td class="editable-col">${cellTotalCost}</td>

            <td class="editable-col">${cellShares}</td>

            <td class="font-mono">${cellProfit}</td>

            <td class="font-mono text-slate-500">${cellAvgCost}</td>

            <td>${cellCashDiv}</td>

            <td>${cellStockDiv}</td>

            <td class="font-mono font-bold highlight-cell" style="color:${netCostPerShare < 0 ? '#4a7c59' : 'inherit'};">${cellNetCost}</td>

            <td class="editable-col">${cellLentShares}</td>

            <td>
              ${isMergedRow ? `<span style="font-size:0.75rem; color:#94a3b8;">唯讀</span>` : `
                <button class="btn-del" title="刪除" onclick="deleteStock(${s.id})">✕</button>
              `}
            </td>
          </tr>
        `;
      }).join('');

      renderSummary();
    }


    /* ====== 調整 renderSummary 以支援 4 個卡片與 YONG_FENG_TAB ====== */
    function renderSummary() {
      let totalCost = 0, totalVal = 0, totalDiv = 0, totalLent = 0;
      stocks.forEach(s => {
        const isUS = isUsStock(s);
        const fxRate = isUS ? 29 : 1;

        const p = (Number(s.currentPrice) || 0) * fxRate;
        const cashD = (Number(s.cashDividends) || 0) * fxRate;

        totalCost += (Number(s.totalCost) || 0) * fxRate;
        totalVal += (Number(s.shares) || 0) * p;
        // 「目前持股股利」全站統一只計算現金股利，不含股票股利折算現值
        totalDiv += cashD;
        totalLent += Number(s.lentShares) || 0;
      });

      const realizedGrandTotal = pastColumns.reduce((sum, col) => {
        return sum + col.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      }, 0);

      const combinedAllDividends = totalDiv + realizedGrandTotal;

      const totalProfit = totalVal - totalCost;
      const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
      const isProfit = totalProfit >= 0;

      const elSummaryCost = document.getElementById('summaryCost');
      const elSummaryVal = document.getElementById('summaryValue');
      const elSummaryProf = document.getElementById('summaryProfit');
      const elSummaryProfRate = document.getElementById('summaryProfitRate');
      const elSummaryDivs = document.getElementById('summaryDividends');
      const elSummaryLent = document.getElementById('summaryLent');

      if (elSummaryCost) elSummaryCost.textContent = '$' + formatNum(totalCost, 0);
      if (elSummaryVal) elSummaryVal.textContent = '$' + formatNum(totalVal, 0);
      if (elSummaryProf) {
        elSummaryProf.textContent = (isProfit ? '+' : '') + '$' + formatNum(totalProfit, 0);
        elSummaryProf.style.color = isProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      if (elSummaryProfRate) {
        elSummaryProfRate.textContent = '報酬率：' + (isProfit ? '+' : '') + totalProfitRate.toFixed(2) + '%';
        elSummaryProfRate.style.color = isProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      if (elSummaryDivs) elSummaryDivs.textContent = '$' + formatNum(combinedAllDividends, 0);
      if (elSummaryLent) elSummaryLent.textContent = formatNum(totalLent, 0);

      const subDashContainer = document.getElementById('subDashboardContainer');
      const subCardValContainer = document.getElementById('subCardValContainer');

      const allAccs = getAllAccounts();
      let filterStocks = [];
      let labelName = '全部持股';

      if (currentFilter === 'ALL') {
        filterStocks = stocks;
        labelName = '全體持股';
      } else if (allAccs.includes(currentFilter)) {
        filterStocks = stocks.filter(s => s.account === currentFilter);
        labelName = currentFilter;
      } else if (currentFilter === '台股') {
        filterStocks = stocks.filter(s => s.category === '台股');
        labelName = '台股個股';
      } else if (currentFilter === 'STOCK_SALES') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        const totalSalesCost = stockSales.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        const totalSalesSpread = stockSales.reduce((s, r) => s + (Number(r.spread) || 0), 0);
        const totalSalesFees = stockSales.reduce((s, r) => s + (Number(r.buyFee) || 0) + (Number(r.sellFee) || 0) + (Number(r.tax) || 0), 0);
        
        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (elTitle) elTitle.textContent = `📌 [股票賣出] 總成本`;
        if (elCost) elCost.textContent = '$' + formatNum(totalSalesCost, 0);
        if (elCostDesc) elCostDesc.textContent = `共 ${stockSales.length} 筆賣出紀錄`;
        if (elTitleProf) elTitleProf.textContent = `總價差金額`;
        if (elProf) {
          elProf.textContent = (totalSalesSpread >= 0 ? '+' : '') + '$' + formatNum(totalSalesSpread, 0);
          elProf.style.color = totalSalesSpread >= 0 ? 'var(--up-red)' : 'var(--down-green)';
        }
        if (elProfRate) elProfRate.textContent = `賣出獲利統計`;
        if (elTitleDiv) elTitleDiv.textContent = `手續費總計`;
        if (elDivs) elDivs.textContent = '$' + formatNum(totalSalesFees, 0);
        if (elLent) elLent.textContent = `買手續費+賣手續費+交易稅`;
        return;
      } else if (currentFilter === 'STOCK_LENDING_TAB') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        let totalLendMarketVal = 0, totalLendCost = 0, totalLendProfit = 0;
        stockLending.forEach(r => {
          const matched = findStockByName(r.name);
          const price = matched ? Number(matched.currentPrice) || 0 : 0;
          const mv = price * (Number(r.lentShares) || 0);
          const cost = Number(r.cost) || 0;
          totalLendMarketVal += mv;
          totalLendCost += cost;
          totalLendProfit += (mv - cost);
        });
        const totalIncomeAllYears = getLendingYearlyTotals().reduce((s, y) => s + y.amount, 0);

        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (elTitle) elTitle.textContent = `📌 [股票借出] 出借市值`;
        if (elCost) elCost.textContent = '$' + formatNum(totalLendMarketVal, 0);
        if (elCostDesc) elCostDesc.textContent = `共 ${stockLending.length} 筆出借紀錄`;
        if (elTitleProf) elTitleProf.textContent = `未實現損益`;
        if (elProf) {
          elProf.textContent = (totalLendProfit >= 0 ? '+' : '') + '$' + formatNum(totalLendProfit, 0);
          elProf.style.color = totalLendProfit >= 0 ? 'var(--up-red)' : 'var(--down-green)';
        }
        if (elProfRate) elProfRate.textContent = `出借部位損益統計`;
        if (elTitleDiv) elTitleDiv.textContent = `歷年借卷收入總計`;
        if (elDivs) elDivs.textContent = '$' + formatNum(totalIncomeAllYears, 0);
        if (elLent) elLent.textContent = `110年至今，已入款實際收入加總`;
        return;
      } else if (currentFilter === 'YONG_FENG_TAB') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        const totalYfCost = yfDetail.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        const totalYfBal = yfAccount.length > 0 ? Number(yfAccount[yfAccount.length - 1].balance) || 0 : 0;
        const totalYfDiv = yfDividendRows.length > 0 ? Number(yfDividendRows[yfDividendRows.length - 1].cumulative) || 0 : 0;

        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (elTitle) elTitle.textContent = `📌 [媽的永豐] 定期投資總成本`;
        if (elCost) elCost.textContent = '$' + formatNum(totalYfCost, 0);
        if (elCostDesc) elCostDesc.textContent = `共 ${yfDetail.length} 筆買賣紀錄`;
        if (elTitleProf) elTitleProf.textContent = `帳戶最新餘額`;
        if (elProf) {
          elProf.textContent = '$' + formatNum(totalYfBal, 0);
          elProf.style.color = '#3c362e';
        }
        if (elProfRate) elProfRate.textContent = `獨立計算帳戶`;
        if (elTitleDiv) elTitleDiv.textContent = `累計領取股利`;
        if (elDivs) elDivs.textContent = '$' + formatNum(totalYfDiv, 0);
        if (elLent) elLent.textContent = `專屬領息總額`;
        return;
      } else if (currentFilter === 'DCA_TAB') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'block';

        const uniqueDcaStocks = new Set(dcaRows.map(r => (r.name || '').trim()).filter(Boolean));
        const totalDcaMonthly = dcaRows.reduce((s, r) => s + (Number(r.amount) || 0) * ((r.dates || []).length), 0);

        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elTitleVal = document.getElementById('filterTabValTitle');
        const elVal = document.getElementById('filterValue');
        const elValDesc = document.getElementById('filterValDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (elTitle) elTitle.textContent = `📌 定期定額數量`;
        if (elCost) elCost.textContent = `${uniqueDcaStocks.size} 檔`;
        if (elCostDesc) elCostDesc.textContent = `目前設定中的定期定額股票`;

        if (elTitleVal) elTitleVal.textContent = `💰 定期定額總金額`;
        if (elVal) elVal.textContent = '$' + formatNum(totalDcaMonthly, 0);
        if (elValDesc) elValDesc.textContent = `每月定期定額扣款總金額`;

        // 第三、第四張卡片位置保留，暫不顯示內容
        if (elTitleProf) elTitleProf.textContent = '';
        if (elProf) { elProf.textContent = ''; elProf.style.color = ''; }
        if (elProfRate) elProfRate.textContent = '';
        if (elTitleDiv) elTitleDiv.textContent = '';
        if (elDivs) elDivs.textContent = '';
        if (elLent) elLent.textContent = '';
        return;
      } else if (currentFilter === 'DIVIDENDS_TAB') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        const elTitle = document.getElementById('filterTabCostTitle');
        const elCost = document.getElementById('filterCost');
        const elCostDesc = document.getElementById('filterCostDesc');
        const elProf = document.getElementById('filterProfit');
        const elProfRate = document.getElementById('filterProfitRate');
        const elDivs = document.getElementById('filterDividends');
        const elLent = document.getElementById('filterLent');

        const elTitleProf = document.getElementById('filterTabProfitTitle');
        const elTitleDiv = document.getElementById('filterTabDivTitle');

        if (dividendsSubTab === 'estimate') {
          let totalEstCash = 0;
          let totalEstStockVal = 0;

          const uniqueStocksMap = new Map();
          stocks.forEach(s => {
            const key = s.code ? s.code.trim() : s.name.trim();
            if (!uniqueStocksMap.has(key)) {
              uniqueStocksMap.set(key, {
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

          uniqueStocksMap.forEach((us, key) => {
            const est = dividendEstimates[key] || { expCash: 0, expStock: 0 };
            const isUS = isUsStock(us);
            const fxRate = isUS ? 29 : 1;
            const price = (Number(us.currentPrice) || 0) * fxRate;
            const shares = us.shares;

            const c = Number(est.expCash) || 0;
            const stks = Number(est.expStock) || 0;

            totalEstCash += c * shares;
            totalEstStockVal += (stks * shares) * price;
          });

          if (elTitle) elTitle.textContent = `📌 預估總現金股利`;
          if (elCost) elCost.textContent = '$' + formatNum(totalEstCash, 0);
          if (elCostDesc) elCostDesc.textContent = `庫存標的預估現金`;

          if (elTitleProf) elTitleProf.textContent = `預估總股票股利現值`;
          if (elProf) {
            elProf.textContent = '$' + formatNum(totalEstStockVal, 0);
            elProf.style.color = 'var(--up-red)';
          }
          if (elProfRate) elProfRate.textContent = `依現價折算現值`;

          if (elTitleDiv) elTitleDiv.textContent = `預估總股利合計`;
          if (elDivs) elDivs.textContent = '$' + formatNum(totalEstCash + totalEstStockVal, 0);
          if (elLent) elLent.textContent = `現金 + 股票現值`;
          return;
        } else {
          // 「目前持股股利」全站統一只計算現金股利，不含股票股利折算現值
          let currentHoldingsDivTotal = 0;
          stocks.forEach(st => {
            const isUS = isUsStock(st);
            const fxRate = isUS ? 29 : 1;
            (st.dividendHistory || []).forEach(dh => {
              currentHoldingsDivTotal += (Number(dh.cash) || 0) * fxRate;
            });
          });

          if (elTitle) elTitle.textContent = `📌 非持股股利總和`;
          if (elCost) elCost.textContent = '$' + formatNum(realizedGrandTotal, 0);
          if (elCostDesc) elCostDesc.textContent = `歷史已實現總額`;

          if (elTitleProf) elTitleProf.textContent = `目前持股股利總和`;
          if (elProf) {
            elProf.textContent = '$' + formatNum(currentHoldingsDivTotal, 0);
            elProf.style.color = 'var(--up-red)';
          }
          if (elProfRate) elProfRate.textContent = `在倉持股累計領取`;

          if (elTitleDiv) elTitleDiv.textContent = `年度總股利總和`;
          if (elDivs) elDivs.textContent = '$' + formatNum(combinedAllDividends, 0);
          if (elLent) elLent.textContent = `已實現 + 目前持股`;
          return;
        }
      } else if (currentFilter === 'SNAPSHOT_LOGS') {
        if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        if (subCardValContainer) subCardValContainer.style.display = 'none';

        document.getElementById('filterTabCostTitle').textContent = `📌 [各股紀錄快照] 統計`;
        document.getElementById('filterCost').textContent = '$' + formatNum(totalCost, 0);
        document.getElementById('filterCostDesc').textContent = `歷史快照累積`;
        document.getElementById('filterProfit').textContent = '$' + formatNum(totalProfit, 0);
        document.getElementById('filterProfitRate').textContent = `歷史紀錄檢視`;
        document.getElementById('filterDividends').textContent = '$' + formatNum(combinedAllDividends, 0);
        document.getElementById('filterLent').textContent = '0';
        return;
      } else {
        filterStocks = stocks.filter(s => (currentFilter === 'ALL') || (s.account === currentFilter) || (s.category === currentFilter));
        labelName = currentFilter === 'ALL' ? '全體持股' : currentFilter;
      }

      if (subDashContainer) subDashContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
      if (subCardValContainer) subCardValContainer.style.display = 'block';

      let fCost = 0, fVal = 0, fDiv = 0, fLent = 0;
      filterStocks.forEach(s => {
        const isUS = isUsStock(s);
        const fxRate = isUS ? 29 : 1;

        const p = (Number(s.currentPrice) || 0) * fxRate;
        const cashD = (Number(s.cashDividends) || 0) * fxRate;

        fCost += (Number(s.totalCost) || 0) * fxRate;
        fVal += (Number(s.shares) || 0) * p;
        // 「目前持股股利」全站統一只計算現金股利，不含股票股利折算現值
        fDiv += cashD;
        fLent += Number(s.lentShares) || 0;
      });

      const fProfit = fVal - fCost;
      const fProfitRate = fCost > 0 ? (fProfit / fCost) * 100 : 0;
      const isFProfit = fProfit >= 0;

      const isCurrentUS = currentFilter === '美股複委託';
      const fUnit = isCurrentUS ? 'US$' : '$';
      const fFx = isCurrentUS ? 29 : 1;

      document.getElementById('filterTabCostTitle').textContent = `📌 [${labelName}] 投入成本`;
      document.getElementById('filterCost').textContent = fUnit + formatNum(fCost / fFx, isCurrentUS ? 2 : 0);
      document.getElementById('filterCostDesc').textContent = `佔總資產 ${totalCost > 0 ? ((fCost / totalCost) * 100).toFixed(1) : 0}%`;

      document.getElementById('filterValue').textContent = fUnit + formatNum(fVal / fFx, isCurrentUS ? 2 : 0);
      document.getElementById('filterValDesc').textContent = `該分類現價總值`;
      // 修正：切換分頁時把上一個分頁殘留的卡片標題重設回「股票現值」(例如定期定額分頁會借用這張卡片)
      const elFValTitle = document.getElementById('filterTabValTitle');
      if (elFValTitle) elFValTitle.textContent = '股票現值';

      // 修正：切換分頁時把上一個分頁殘留的卡片標題重設回「未實現損益」
      const elFProfTitle = document.getElementById('filterTabProfitTitle');
      if (elFProfTitle) elFProfTitle.textContent = '未實現損益';
      const elFDivTitle = document.getElementById('filterTabDivTitle');
      if (elFDivTitle) elFDivTitle.textContent = '累計股利';

      const elFProf = document.getElementById('filterProfit');
      if (elFProf) {
        elFProf.textContent = (isFProfit ? '+' : '') + fUnit + formatNum(fProfit / fFx, isCurrentUS ? 2 : 0);
        elFProf.style.color = isFProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      const elFProfRate = document.getElementById('filterProfitRate');
      if (elFProfRate) {
        elFProfRate.textContent = (isFProfit ? '+' : '') + fProfitRate.toFixed(2) + '%';
        elFProfRate.style.color = isFProfit ? 'var(--up-red)' : 'var(--down-green)';
      }
      document.getElementById('filterDividends').textContent = fUnit + formatNum(fDiv / fFx, isCurrentUS ? 2 : 0);
      document.getElementById('filterLent').textContent = `該分頁借出：${formatNum(fLent, 0)} 張 / 股`;
    }

    function updateValue(id, field, value) {
      recordSnapshot();
      const item = stocks.find(s => s.id === id);
      if (item) {
        item[field] = parseFloat(value) || 0;
        // Task: 市值改為手動輸入，現價 = 市值 / 持有股數 自動計算
        if (field === 'marketVal' || field === 'shares') {
          const sh = Number(item.shares) || 0;
          const mv = Number(item.marketVal) || 0;
          item.currentPrice = sh > 0 ? (mv / sh) : 0;
        }
        saveToStorage();
        renderTable();
      }
    }

    let pendingDeleteStock = null; // { id, name, transferItems } — 等待「刪除股票→轉存現金股利」確認視窗回應的暫存資料

    function deleteStock(id) {
      const stock = stocks.find(s => s.id === id);
      if (!stock) return;

      // 只挑出「有金額」的現金股利紀錄；股票股利(stockShares)不在轉存範圍內，刪除後就一併移除
      const isUS = isUsStock(stock);
      const fxRate = isUS ? 29 : 1;
      const transferItems = (stock.dividendHistory || [])
        .filter(h => Number(h.cash) > 0)
        .map(h => ({
          rocYear: String((Number(h.year) || 0) - 1911), // 持有股票那邊記的是西元年，非持股歷史記的是民國年，轉存時換算
          amountTWD: Math.round((Number(h.cash) || 0) * fxRate), // 美股原始金額是美金，統一換算成台幣再存進非持股歷史（那邊沒有幣別欄位）
          cashDate: h.cashDate || ''
        }));

      // 這檔股票沒有任何現金股利紀錄可轉存，維持原本單純的刪除確認
      if (transferItems.length === 0) {
        if (confirm('確定要刪除這筆股票持股嗎？')) {
          recordSnapshot();
          stocks = stocks.filter(s => s.id !== id);
          saveToStorage();
          renderTabs();
          renderTable();
        }
        return;
      }

      pendingDeleteStock = { id, name: stock.name, transferItems };

      const byYear = {};
      transferItems.forEach(it => {
        if (!byYear[it.rocYear]) byYear[it.rocYear] = { amount: 0, count: 0 };
        byYear[it.rocYear].amount += it.amountTWD;
        byYear[it.rocYear].count += 1;
      });
      const years = Object.keys(byYear).sort((a, b) => Number(a) - Number(b));
      const totalAmount = transferItems.reduce((s, it) => s + it.amountTWD, 0);

      const rowsHtml = years.map(y => `
        <tr>
          <td>${esc(y)} 年</td>
          <td class="font-mono">$${formatNum(byYear[y].amount, 0)}</td>
          <td class="font-mono">${byYear[y].count} 筆</td>
        </tr>
      `).join('');

      const body = document.getElementById('deleteStockDividendBody');
      if (body) {
        body.innerHTML = `
          <p style="margin-top:0;">「${esc(stock.name)}」持有期間領過現金股利，要不要把這些紀錄轉存到「股利 → 非持股歷史」？${isUS ? '<br/><span style="font-size:0.8rem; color:#766c5a;">（美股金額已依匯率 29 換算成台幣）</span>' : ''}</p>
          <table class="dividend-table">
            <thead><tr><th>年度</th><th>金額</th><th>筆數</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <p style="text-align:right; font-weight:700; margin:8px 0 0 0;">共 ${transferItems.length} 筆，合計 $${formatNum(totalAmount, 0)}</p>
        `;
      }
      const modal = document.getElementById('deleteStockDividendModal');
      if (modal) modal.classList.add('open');
    }

    function closeDeleteStockDividendModal() {
      pendingDeleteStock = null;
      const modal = document.getElementById('deleteStockDividendModal');
      if (modal) modal.classList.remove('open');
    }

    function confirmDeleteStockWithTransfer(shouldTransfer) {
      if (!pendingDeleteStock) return;
      const { id, name, transferItems } = pendingDeleteStock;

      recordSnapshot(); // 刪除+轉存算同一個操作，只記一次快照，Ctrl+Z 才會一次全部復原

      if (shouldTransfer) {
        transferItems.forEach(it => {
          // 同一年度同一檔股票如果非持股歷史裡已經有資料了，不合併、直接新增一列（依使用者要求）
          let col = pastColumns.find(c => String(c.year) === it.rocYear);
          if (!col) {
            col = { year: it.rocYear, items: [] };
            pastColumns.push(col); // 沿用「新增新年度」既有的慣例：新年度加在最後面，不重新排序
          }
          col.items.push({ stock: name, amount: it.amountTWD, cashDate: it.cashDate });
        });
      }

      stocks = stocks.filter(s => s.id !== id);
      saveToStorage();
      renderTabs();
      renderTable();
      closeDeleteStockDividendModal();
    }

    /* ====== 全部股票表格：方向鍵/Enter 在格子間移動 ====== */
    function handleCellKey(event, row, col) {
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
      const selector = `#stockGrid [data-row="${targetRow}"][data-col="${targetCol}"]`;
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

    function deleteStockSale(index) {
      if (confirm('確定要刪除這筆股票賣出紀錄嗎？')) {
        recordSnapshot();
        stockSales.splice(index, 1);
        saveToStorage();
        renderTabs();
        renderTable();
      }
    }

    /* ====== HTML5 拖曳排序事件處理 ====== */
    function onDragStart(e) {
      const tr = e.target.closest('tr');
      draggedStockId = Number(tr.getAttribute('data-id'));
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }

    function onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const tr = e.target.closest('tr');
      if (tr && !tr.classList.contains('dragging')) {
        tr.classList.add('drag-over');
      }
    }

    function onDragLeave(e) {
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('drag-over');
    }

    function onDrop(e, targetStockId) {
      e.preventDefault();
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('drag-over');

      if (!draggedStockId || draggedStockId === Number(targetStockId)) return;

      const fromIdx = stocks.findIndex(s => s.id === draggedStockId);
      const toIdx = stocks.findIndex(s => s.id === Number(targetStockId));

      if (fromIdx !== -1 && toIdx !== -1) {
        recordSnapshot();
        const [movedItem] = stocks.splice(fromIdx, 1);
        stocks.splice(toIdx, 0, movedItem);
        saveToStorage();
        renderTabs();
        renderTable();
      }
    }

    function onDragEnd(e) {
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('dragging');
      document.querySelectorAll('tr').forEach(row => row.classList.remove('drag-over'));
      draggedStockId = null;
    }

    /* ====== 快照日期標籤切換與整筆刪除 ====== */
    function selectSnapshotDate(dateStr) {
      selectedSnapshotDate = dateStr;
      renderTable();
    }

    function deleteEntireSnapshot(dateStr) {
      if (confirm(`確定要刪除整個【${dateStr}】的資產快照紀錄嗎？`)) {
        let allSnaps = JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]');
        allSnaps = allSnaps.filter(sp => sp.date !== dateStr);
        localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(allSnaps));
        
        if (allSnaps.length > 0) {
          selectedSnapshotDate = allSnaps[0].date;
        } else {
          selectedSnapshotDate = null;
        }
        renderTabs();
        renderTable();
      }
    }

    function deleteSnapshotItem(dateStr, itemIdx) {
      if (confirm('確定要刪除這筆快照紀錄嗎？')) {
        let allSnaps = JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]');
        const snap = allSnaps.find(sp => sp.date === dateStr);
        if (snap) {
          snap.items.splice(itemIdx, 1);
          allSnaps = allSnaps.filter(sp => sp.items.length > 0);
          localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(allSnaps));
          renderTabs();
          renderTable();
        }
      }
    }

    /* ====== 一鍵紀錄資產快照 ====== */
    function takeAssetSnapshot() {
      if (isPageLocked('snapshot')) { showToast('此分頁已鎖定，請先解鎖', 'error'); return; }
      const today = new Date().toISOString().slice(0, 10);
      const targetAccounts = getAllAccounts();
      const snapshotItems = stocks.filter(s => targetAccounts.includes(s.account));

      if (snapshotItems.length === 0) {
        alert('沒有找到任何持股可供記錄！');
        return;
      }

      let savedSnapshots = [];
      const storedSnap = localStorage.getItem('ASSET_SNAPSHOTS_V1');
      if (storedSnap) {
        try { savedSnapshots = JSON.parse(storedSnap); } catch (e) {}
      }

      let existingSnap = savedSnapshots.find(sp => sp.date === today);
      const newItems = snapshotItems.map(s => ({
        account: s.account,
        name: s.name,
        code: s.code || '-',
        shares: Number(s.shares) || 0,
        totalCost: Number(s.totalCost) || 0,
        currentPrice: Number(s.currentPrice) || 0,
        marketVal: (Number(s.shares) || 0) * (Number(s.currentPrice) || 0),
        profit: ((Number(s.shares) || 0) * (Number(s.currentPrice) || 0)) - (Number(s.totalCost) || 0)
      }));

      if (existingSnap) {
        existingSnap.items = newItems;
      } else {
        savedSnapshots.unshift({
          date: today,
          items: newItems
        });
      }

      localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(savedSnapshots));
      selectedSnapshotDate = today;
      alert(`📸 成功記錄 ${today} 的資產快照！已自動切換至【各股紀錄】分頁。`);
      
      setFilter('SNAPSHOT_LOGS');
    }

    /* ====== 捲動軸同步 ====== */
    function setupScrollSync() {
      const topWrapper = document.getElementById('topScrollWrapper');
      const tableWrapper = document.getElementById('mainTableContainer');
      if (!topWrapper || !tableWrapper) return;

      let isSyncingTop = false;
      let isSyncingTable = false;

      topWrapper.addEventListener('scroll', () => {
        if (!isSyncingTop) {
          isSyncingTable = true;
          tableWrapper.scrollLeft = topWrapper.scrollLeft;
        }
        isSyncingTop = false;
      });

      tableWrapper.addEventListener('scroll', () => {
        if (!isSyncingTable) {
          isSyncingTop = true;
          topWrapper.scrollLeft = tableWrapper.scrollLeft;
        }
        isSyncingTable = false;
      });
    }

    function syncScrollWidth() {
      const grid = document.getElementById('stockGrid');
      const dummy = document.getElementById('topScrollDummy');
      if (grid && dummy) {
        dummy.style.width = grid.scrollWidth + 'px';
      }
    }

    function scrollToLatestYear() {
      const topWrapper = document.getElementById('topScrollWrapper');
      const tableWrapper = document.getElementById('mainTableContainer');
      if (tableWrapper) {
        tableWrapper.scrollLeft = tableWrapper.scrollWidth;
      }
      if (topWrapper) {
        topWrapper.scrollLeft = topWrapper.scrollWidth;
      }
    }

    /* ====== 新增股票與證券帳戶管理 ====== */
    function openAddAccountModal() {
      document.getElementById('newAccountName').value = '';
      document.getElementById('addAccountModal').classList.add('open');
    }

    function closeAddAccountModal() {
      document.getElementById('addAccountModal').classList.remove('open');
    }

    function submitAddAccount() {
      const name = document.getElementById('newAccountName').value.trim();
      if (!name) {
        alert('請輸入證券帳戶名稱！');
        return;
      }
      const allAccs = getAllAccounts();
      if (allAccs.includes(name)) {
        alert('此證券帳戶已存在！');
        return;
      }

      recordSnapshot();
      customAccounts.push(name);
      saveToStorage();
      renderTabs();
      setFilter(name);
      closeAddAccountModal();
      alert(`已成功新增證券帳戶【${name}】！`);
    }

    function deleteCustomAccount(event, accName) {
      event.stopPropagation();
      const hasStocks = stocks.some(s => s.account === accName);
      if (hasStocks) {
        alert(`無法刪除【${accName}】！該帳戶內還有股票標的，請先將標的刪除或移動至其他帳戶。`);
        return;
      }

      if (confirm(`確定要刪除證券帳戶【${accName}】分頁嗎？`)) {
        recordSnapshot();
        customAccounts = customAccounts.filter(a => a !== accName);
        if (currentFilter === accName) {
          currentFilter = 'ALL';
        }
        saveToStorage();
        renderTabs();
        renderTable();
      }
    }

    // 依目前 currentFilter（含各子分頁）對應到密碼鎖定功能的分頁 key
    function getCurrentPageLockKey() {
      if (currentFilter === 'YONG_FENG_TAB') return 'yf';
      if (currentFilter === 'DIVIDENDS_TAB') return 'dividends';
      if (currentFilter === 'STOCK_SALES') return 'sales';
      if (currentFilter === 'STOCK_LENDING_TAB') return 'lending';
      if (currentFilter === 'DCA_TAB') return 'dca';
      if (currentFilter === 'SNAPSHOT_LOGS') return 'snapshot';
      return 'holdings'; // ALL / 各券商帳戶 / ETF / 台股個股，都是同一份「全部持股」資料
    }

    function openAddStockModal() {
      // 分頁被鎖定時，不管子分頁的「新增」按鈕實際會呼叫哪個 add 函式，
      // 一律先擋下來 —— 所有分頁的新增動作最終都會經過這個函式。
      if (isPageLocked(getCurrentPageLockKey())) {
        showToast('此分頁已鎖定，請先解鎖', 'error');
        return;
      }
      if (currentFilter === 'DIVIDENDS_TAB' && dividendsSubTab === 'past') {
        handleAddNew();
        return;
      }
      if (currentFilter === 'STOCK_SALES') {
        if (salesSubTab === 'history') {
          addSaleHistoryRow();
        } else {
          addStockSaleRow();
        }
        return;
      }
      if (currentFilter === 'STOCK_LENDING_TAB') {
        if (lendingSubTab === 'income') {
          addLendingIncomeRow();
        } else {
          addLendingRow();
        }
        return;
      }
      if (currentFilter === 'DCA_TAB') {
        addDcaRow();
        return;
      }
      document.getElementById('addModalTitle').textContent = '➕ 新增股票標的';
      document.getElementById('newStockName').value = '';
      document.getElementById('newStockCode').value = '';
      document.getElementById('newStockShares').value = '';
      document.getElementById('newStockTotalCost').value = '';
      
      const accSelect = document.getElementById('newStockAccount');
      const allAccs = getAllAccounts();
      accSelect.innerHTML = allAccs.map(acc => `<option value="${esc(acc)}">${esc(acc)}</option>`).join('');

      if (allAccs.includes(currentFilter)) {
        accSelect.value = currentFilter;
      } else {
        accSelect.value = allAccs[0] || '富邦證券';
      }
      handleAutoDetectCategory();

      document.getElementById('addStockModal').classList.add('open');
    }

    function closeAddStockModal() {
      const modal = document.getElementById('addStockModal');
      if (modal) modal.classList.remove('open');
    }

    function handleAutoDetectCategory() {
      const acc = document.getElementById('newStockAccount').value;
      const code = document.getElementById('newStockCode').value.trim();
      const catSelect = document.getElementById('newStockCategory');
      if (!catSelect) return;

      if (acc === '美股複委託') {
        catSelect.value = '美股';
      } else if (code.startsWith('00')) {
        catSelect.value = 'ETF';
      } else {
        catSelect.value = '台股';
      }
    }

    function submitAddNewStock() {
      const name = document.getElementById('newStockName').value.trim();
      if (!name) {
        alert('請輸入股票/ETF名稱！');
        return;
      }

      const code = document.getElementById('newStockCode').value.trim();
      const account = document.getElementById('newStockAccount').value;
      const category = document.getElementById('newStockCategory').value;
      const shares = parseFloat(document.getElementById('newStockShares').value) || 0;
      const totalCost = parseFloat(document.getElementById('newStockTotalCost').value) || 0;

      recordSnapshot();
      const newItem = {
        id: Date.now(),
        name: name,
        code: code,
        category: category,
        account: account,
        shares: shares,
        totalCost: totalCost,
        currentPrice: 0,
        marketVal: 0,
        cashDividends: 0,
        stockShares: 0,
        dividendHistory: [],
        lentShares: 0
      };

      stocks.unshift(newItem);
      saveToStorage();
      renderTabs();
      renderTable();
      closeAddStockModal();
    }

    /* ====== 分離式股利彈窗 ====== */
    /* ====== Task 5: 歷年股利總合 - 單一年度所有持股現金股利明細彈窗 ====== */
    function openYearlyDivDetailModal(rawKey, displayYear) {
      const rows = [];
      let total = 0;

      stocks.forEach(st => {
        const isUS = isUsStock(st);
        const fxRate = isUS ? 29 : 1;
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
      const fxRate = isUS ? 29 : 1;
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

    function exportStockData() {
      const exportObj = {
        stocks: stocks,
        pastColumns: pastColumns,
        customAccounts: customAccounts,
        stockSales: stockSales,
        salesHistory: salesHistory,
        stockLending: stockLending,
        lendingIncomeRows: lendingIncomeRows,
        lendingIncomeManualYearly: lendingIncomeManualYearly,
        dcaRows: dcaRows,
        snapshots: JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'),
        yfDetail: yfDetail,
        yfAccount: yfAccount,
        yfDividendRows: yfDividendRows,
        yfOverview: yfOverview,
        version: "V56",
        exportDate: new Date().toISOString()
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
      const dl = document.createElement('a');
      dl.setAttribute("href", dataStr);
      dl.setAttribute("download", `股票資產備份_${new Date().toISOString().slice(0,10)}.json`);
      dl.click();
    }

    function importStockData(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          recordSnapshot();
          let result;
          if (Array.isArray(imported)) {
            result = mergeApplyAllData({ stocks: imported });
          } else if (imported && imported.stocks) {
            result = mergeApplyAllData(imported);
          } else {
            alert('匯入失敗：檔案格式不正確');
            return;
          }
          alert(`匯入完成！\n新增：${result.added} 筆\n略過（本地已有，未覆蓋）：${result.skipped} 筆`);
        } catch (err) {
          alert('匯入失敗：檔案格式不正確');
        }
      };
      reader.readAsText(file);
    }

    function formatNum(num, decimals = 0) {
      if (num === null || num === undefined || isNaN(num)) return '0';
      return Number(num).toLocaleString('zh-TW', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    window.onload = init;
