/* 股票管理：新增股票與證券帳戶管理
   從 stock.js 拆出來的檔案，功能沒有改變。
   跟其他 script 一樣靠瀏覽器共用的全域變數運作（stocks、saveToStorage、renderTable 等都在 stock.js），
   index.html 要放在 stock.js 後面載入。 */

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
