/* 股票管理：資產快照（切換日期、刪除、一鍵記錄）
   從 stock.js 拆出來的檔案，功能沒有改變。
   跟其他 script 一樣靠瀏覽器共用的全域變數運作（stocks、saveToStorage、renderTable 等都在 stock.js），
   index.html 要放在 stock.js 後面載入。 */

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

      if (!confirm(`確定要記錄 ${today} 的資產快照嗎？（共 ${snapshotItems.length} 筆持股）`)) {
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
