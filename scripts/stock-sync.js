/* 股票管理：Firebase 雲端同步、JSON 合併匯入、股票資料匯出/匯入
   從 stock.js 拆出來的檔案，功能沒有改變。
   跟其他 script 一樣靠瀏覽器共用的全域變數運作（stocks、saveToStorage、renderTable 等都在 stock.js），
   index.html 要放在 stock.js 後面載入。 */

    /* ====== Firebase 雲端同步 ====== */
    function gatherAllData() {
      return {
        stocks, pastColumns, customAccounts, stockSales, stockBuys, stmtSettings, stmtImported, salesHistory, stockLending,
        lendingIncomeRows, lendingIncomeManualYearly, dcaRows,
        dividendEstimates, exRightsInfo, yfDetail, yfAccount, yfDividendRows, yfOverview,
        snapshots: JSON.parse(localStorage.getItem('ASSET_SNAPSHOTS_V1') || '[]'),
        usdRate: (typeof getUsdRate === 'function') ? getUsdRate() : 29,
        updatedAt: new Date().toISOString()
      };
    }

    function applyAllData(data) {
      if (!data) return;
      if (data.stocks) stocks = data.stocks;
      if (data.pastColumns) pastColumns = data.pastColumns;
      if (data.customAccounts) customAccounts = data.customAccounts;
      if (data.stockSales) stockSales = data.stockSales;
      if (data.stockBuys) stockBuys = data.stockBuys;
      if (data.stmtSettings) stmtSettings = data.stmtSettings;
      if (data.stmtImported) stmtImported = data.stmtImported;
      if (data.salesHistory) salesHistory = data.salesHistory;
      if (data.stockLending) stockLending = data.stockLending;
      if (data.lendingIncomeRows) lendingIncomeRows = data.lendingIncomeRows;
      if (data.lendingIncomeManualYearly) lendingIncomeManualYearly = data.lendingIncomeManualYearly;
      if (data.dcaRows) dcaRows = data.dcaRows;
      if (data.dividendEstimates) dividendEstimates = data.dividendEstimates;
      if (data.exRightsInfo) exRightsInfo = data.exRightsInfo;
      if (data.yfDetail) yfDetail = data.yfDetail;
      if (data.yfAccount) yfAccount = data.yfAccount;
      if (data.yfDividendRows) yfDividendRows = data.yfDividendRows;
      if (data.yfOverview) yfOverview = data.yfOverview;
      if (data.snapshots) localStorage.setItem('ASSET_SNAPSHOTS_V1', JSON.stringify(data.snapshots));
      if (data.usdRate && typeof applyUsdRate === 'function') applyUsdRate(data.usdRate, { silent: true });

      localStorage.setItem(STORAGE_KEY_STOCKS, JSON.stringify(stocks));
      localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastColumns));
      localStorage.setItem(STORAGE_KEY_CUSTOM_ACCOUNTS, JSON.stringify(customAccounts));
      localStorage.setItem(STORAGE_KEY_STOCK_SALES, JSON.stringify(stockSales));
      localStorage.setItem(STORAGE_KEY_STOCK_BUYS, JSON.stringify(stockBuys));
      localStorage.setItem(STORAGE_KEY_STMT_SETTINGS, JSON.stringify(stmtSettings || {}));
      localStorage.setItem(STORAGE_KEY_STMT_IMPORTED, JSON.stringify(stmtImported || []));
      localStorage.setItem(STORAGE_KEY_SALES_HISTORY, JSON.stringify(salesHistory));
      localStorage.setItem(STORAGE_KEY_STOCK_LENDING, JSON.stringify(stockLending));
      localStorage.setItem(STORAGE_KEY_LENDING_INCOME, JSON.stringify(lendingIncomeRows));
      localStorage.setItem(STORAGE_KEY_LENDING_INCOME_YEARLY, JSON.stringify(lendingIncomeManualYearly));
      localStorage.setItem(STORAGE_KEY_DCA, JSON.stringify(dcaRows));
      localStorage.setItem('STOCK_INVESTMENT_DIVIDEND_ESTIMATES_V1', JSON.stringify(dividendEstimates));
      localStorage.setItem('STOCK_INVESTMENT_EXRIGHTS_INFO_V1', JSON.stringify(exRightsInfo));
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
      // 股票買進：每筆有自己的 id；持股那邊已經含這些買進的股數，所以只補紀錄、不再加到持股
      upsertByKey(stockBuys, data.stockBuys, r => String(r.id || ''));
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
      if (data.exRightsInfo) {
        Object.keys(data.exRightsInfo).forEach(k => {
          if (exRightsInfo[k] === undefined) { exRightsInfo[k] = data.exRightsInfo[k]; added++; }
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

    function exportStockData() {
      const exportObj = {
        stocks: stocks,
        pastColumns: pastColumns,
        customAccounts: customAccounts,
        stockSales: stockSales,
        stockBuys: stockBuys,
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
