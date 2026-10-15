/* 股票管理：懸浮計算機（含鍵盤輸入與拖曳）
   從 stock.js 拆出來的檔案，功能沒有改變。
   跟其他 script 一樣靠瀏覽器共用的全域變數運作（stocks、saveToStorage、renderTable 等都在 stock.js），
   index.html 要放在 stock.js 後面載入。 */

    /* ====== 懸浮計算機邏輯與拖曳 ====== */
    function toggleCalculator() {
      const calc = document.getElementById('floatingCalculator');
      if (calc) {
        const isVisible = calc.style.display === 'block';
        calc.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
          calc.focus();
          if (typeof closeOtherFloatingWidgetsOnMobile === 'function') closeOtherFloatingWidgetsOnMobile('calc');
        }
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
      // 修正：原本只認 .cell-input 這個 class，但「財務總覽」的儲存格編輯器用的是
      // .cell-editor（不同 class），導致計算機開著時財務總覽表格打字全被計算機吃掉。
      // 改成只要目前 focus 在任何輸入框(input/textarea/select)或 contenteditable 上，
      // 一律視為「在表格輸入」，不管是哪個分頁、哪個 class，鍵盤都優先給該輸入框。
      const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      const isInTableInput = !!activeEl && (
        inputTags.includes(activeEl.tagName) || activeEl.isContentEditable
      );

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
