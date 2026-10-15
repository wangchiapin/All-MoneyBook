/* 股票管理：表格操作（方向鍵移動、拖曳排序、捲動軸同步）
   從 stock.js 拆出來的檔案，功能沒有改變。
   跟其他 script 一樣靠瀏覽器共用的全域變數運作（stocks、saveToStorage、renderTable 等都在 stock.js），
   index.html 要放在 stock.js 後面載入。 */

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
