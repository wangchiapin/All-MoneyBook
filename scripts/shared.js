    const firebaseConfig = {
  apiKey: "AIzaSyDB6zYAHvi0oTkObv-qDnP6nn0UUnscby0",
  authDomain: "moneybook-50481.firebaseapp.com",
  projectId: "moneybook-50481",
  storageBucket: "moneybook-50481.firebasestorage.app",
  messagingSenderId: "549256761796",
  appId: "1:549256761796:web:254332f109e7b8ad871491",
  measurementId: "G-XTDYYS4HK6"
    };

    /* ====== 共用小工具：財務總覽 Excel 匯出/匯入用的「已封存」標記字首，
       讓封存項目也能完整匯出、之後合併匯入時自動以封存狀態還原 ====== */
    const FIN_ARCHIVE_MARK = '🗄️[已封存] ';

    /* ====== 共用小工具：HTML 屬性/內容跳脫，避免名稱、備註打到雙引號等特殊字元時把畫面弄壞 ====== */
    function esc(v) {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /* ====== 共用小工具：判斷一筆持股是否為美股複委託帳戶（原本在 stock.js 多處重複判斷，
       抽成共用函式方便統一維護；接受股票物件，或只有 account/category 兩個欄位的資料） ====== */
    function isUsStock(stock) {
      if (!stock) return false;
      return stock.account === '美股複委託' || stock.category === '美股';
    }

    /* ====== 共用小工具：手機數字鍵盤 (inputmode="decimal")
       整個 App 有很多地方各自用模板字串產生 <input type="number">（股票管理、財務總覽、
       股利、定期定額、借券...等好幾個檔案），逐一手動加屬性容易漏掉。
       改用 MutationObserver 監看整個頁面，任何新出現的數字輸入框都自動補上
       inputmode="decimal"，手機上會穩定跳出含小數點的數字鍵盤，且未來新增的
       輸入框也會自動套用，不用每個 render() 函式各自記得呼叫。 ====== */
    function applyDecimalInputMode(root) {
      (root || document).querySelectorAll('input[type="number"]:not([inputmode])').forEach(el => {
        el.setAttribute('inputmode', 'decimal');
      });
    }
    (function initDecimalInputModeObserver() {
      applyDecimalInputMode(document);
      const observer = new MutationObserver(() => applyDecimalInputMode(document));
      const start = () => observer.observe(document.body, { childList: true, subtree: true });
      if (document.body) start();
      else document.addEventListener('DOMContentLoaded', start);
    })();

    /* ====== 共用小工具：手機版三個懸浮元件（計算機／資產趨勢圖／小提醒卡片）互斥收合
       手機螢幕小，這三個 position:fixed 的面板同時開很容易互相重疊。
       規則只在手機寬度 (<=640px) 生效：桌機完全不受影響，維持原本各自獨立的行為。
       開啟任何一個時呼叫這個函式，把其他兩個收起來即可；各自原本的開啟入口
       （工具列上的 🧮／📈 按鈕、小提醒卡片右上角的展開）不需要改動。 ====== */
    function closeOtherFloatingWidgetsOnMobile(exceptName) {
      if (window.innerWidth > 640) return;
      if (exceptName !== 'calc') {
        const calc = document.getElementById('floatingCalculator');
        if (calc) calc.style.display = 'none';
      }
      if (exceptName !== 'chart') {
        const chart = document.getElementById('floatingChartPanel');
        if (chart) chart.style.display = 'none';
        if (typeof chartPanelVisible !== 'undefined') chartPanelVisible = false;
      }
      if (exceptName !== 'tips') {
        const tips = document.getElementById('tipsWidget');
        const bubble = document.getElementById('tipsWidgetBubble');
        if (tips && tips.style.display !== 'none') {
          tips.style.display = 'none';
          if (bubble) bubble.style.display = 'flex';
          if (typeof tipsWidgetPause === 'function') tipsWidgetPause();
        }
      }
    }

    /* ====== 共用小工具：輕量 Toast 提示（用來取代部分 alert，尤其是「儲存失敗」這種
       不該被使用者忽略、但也不用整個擋住畫面的通知） ====== */
    function showToast(msg, type) {      let box = document.getElementById('globalToastBox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'globalToastBox';
        box.style.cssText = 'position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:99999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none;';
        document.body.appendChild(box);
      }
      const toast = document.createElement('div');
      const isError = type === 'error';
      toast.textContent = msg;
      toast.style.cssText = `pointer-events:auto; max-width:90vw; padding:10px 18px; border-radius:8px; font-size:0.85rem; font-weight:600; color:#fff; box-shadow:0 6px 18px rgba(0,0,0,0.2); background:${isError ? '#a8543d' : '#4a7c59'};`;
      box.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = 'opacity 0.4s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
      }, isError ? 6000 : 3000);
    }

    /* ====== 密碼鎖定功能：核心邏輯 ======
       - lockConfig：哪些「分頁」「欄位」被設定要鎖定，以及解鎖密碼；只存在 localStorage（本機），
         不隨 Firebase 雲端同步 —— 每台裝置的鎖定設定各自獨立。
       - unlockedThisBrowse：本次瀏覽階段已經用密碼解鎖過的項目，存在記憶體變數（重新整理網頁
         就會清空），符合「解鎖後整個瀏覽階段有效，重新整理才會再鎖回去」的需求。
       - 被鎖定的地方一律顯示「功能尚待開發」+ 施工中圖示，不會出現「已鎖定」「🔒」等字樣，
         避免讓人一眼看出「這裡本來有東西、輸入密碼就能看到」。 ====== */
    const LOCK_CONFIG_KEY = 'FIELD_LOCK_CONFIG_V1';

    let lockConfig = (function () {
      try {
        const saved = JSON.parse(localStorage.getItem(LOCK_CONFIG_KEY) || 'null');
        if (saved && typeof saved === 'object') {
          return {
            password: saved.password || '0000',
            pages: saved.pages || {},
            fields: saved.fields || {}
          };
        }
      } catch (e) {}
      return { password: '0000', pages: {}, fields: {} };
    })();

    let unlockedThisBrowse = new Set();

    // 可鎖定的「整頁」清單（財務總覽的四大分類 + 股票管理的各分頁）
    const LOCKABLE_PAGES = [
      { key: 'finance_bank', label: '📋 財務總覽 → 一、銀行與現金帳戶' },
      { key: 'finance_insurance', label: '📋 財務總覽 → 二、保險資產' },
      { key: 'finance_stock', label: '📋 財務總覽 → 三、股票資產' },
      { key: 'finance_baddebt', label: '📋 財務總覽 → 呆帳區' },
      { key: 'holdings', label: '📈 股票管理 → 全部持股（含各券商帳戶 / ETF / 台股個股）' },
      { key: 'sales', label: '📈 股票管理 → 股票賣出（整頁，含以下三個子分頁）' },
      { key: 'sales_detail', label: '　└ 股票管理 → 股票賣出 → 賣出明細' },
      { key: 'sales_summary', label: '　└ 股票管理 → 股票賣出 → 每日買賣紀錄小計' },
      { key: 'sales_history', label: '　└ 股票管理 → 股票賣出 → 歷年紀錄' },
      { key: 'lending', label: '📈 股票管理 → 股票借出（整頁，含以下兩個子分頁）' },
      { key: 'lending_holdings', label: '　└ 股票管理 → 股票借出 → 出借持股列表' },
      { key: 'lending_income', label: '　└ 股票管理 → 股票借出 → 借卷收入' },
      { key: 'dividends', label: '📈 股票管理 → 股利（整頁，含以下三個子分頁）' },
      { key: 'dividends_summary', label: '　└ 股票管理 → 股利 → 歷年股利總合' },
      { key: 'dividends_past', label: '　└ 股票管理 → 股利 → 非持股股利' },
      { key: 'dividends_estimate', label: '　└ 股票管理 → 股利 → 年度預估股利' },
      { key: 'yf', label: '📈 股票管理 → 媽的永豐（整頁，含以下三張表）' },
      { key: 'yf_detail', label: '　└ 股票管理 → 媽的永豐 → 買賣明細' },
      { key: 'yf_account', label: '　└ 股票管理 → 媽的永豐 → 永豐帳戶明細' },
      { key: 'yf_dividend', label: '　└ 股票管理 → 媽的永豐 → 除息資訊' },
      { key: 'dca', label: '📈 股票管理 → 定期定額' },
      { key: 'snapshot', label: '📈 股票管理 → 各股紀錄' }
    ];

    // 可鎖定的「單一欄位」清單（目前支援「全部持股」表格內的欄位；
    // 財務總覽本身是逐日期的表格，欄位鎖定的意義不大，所以先只做整頁鎖定）
    const LOCKABLE_FIELDS = [
      { key: 'holdings.currentPrice', label: '全部持股 → 現價' },
      { key: 'holdings.marketVal', label: '全部持股 → 市值' },
      { key: 'holdings.totalCost', label: '全部持股 → 成本' },
      { key: 'holdings.shares', label: '全部持股 → 持有股數' },
      { key: 'holdings.profit', label: '全部持股 → 未實現損益' },
      { key: 'holdings.avgCost', label: '全部持股 → 平均每股成本' },
      { key: 'holdings.cashDividends', label: '全部持股 → 現金股利' },
      { key: 'holdings.stockDividends', label: '全部持股 → 股票股利' },
      { key: 'holdings.netCost', label: '全部持股 → 含息每股成本' },
      { key: 'holdings.lentShares', label: '全部持股 → 出借張數' }
    ];

    function saveLockConfig() {
      try {
        localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(lockConfig));
      } catch (e) {
        console.warn('儲存密碼鎖定設定失敗：', e);
      }
    }

    function isPageLocked(pageKey) {
      return !!lockConfig.pages[pageKey] && !unlockedThisBrowse.has('page:' + pageKey);
    }
    function isFieldLocked(fieldKey) {
      return !!lockConfig.fields[fieldKey] && !unlockedThisBrowse.has('field:' + fieldKey);
    }

    // 施工中圖示需要連續點擊兩次（3 秒內）才會跳出密碼輸入框，
    // 單純點一下不會有任何反應，避免不小心點到就暴露「這裡其實是鎖住的」。
    let lockIconClickTracker = {};
    function handleLockIconClick(event, key, type) {
      if (event) event.stopPropagation();
      const trackKey = type + ':' + key;
      const st = lockIconClickTracker[trackKey] || { count: 0, timer: null };
      st.count++;
      if (st.timer) clearTimeout(st.timer);
      if (st.count >= 2) {
        st.count = 0;
        promptUnlockField(key, type);
      } else {
        st.timer = setTimeout(() => { st.count = 0; }, 3000);
      }
      lockIconClickTracker[trackKey] = st;
    }

    function promptUnlockField(key, type) {
      const pw = prompt('請輸入密碼：');
      if (pw === null) return;
      if (pw === lockConfig.password) {
        unlockedThisBrowse.add(type + ':' + key);
        showToast('已解鎖', 'success');
        refreshAllViews();
      } else {
        showToast('密碼錯誤', 'error');
      }
    }

    // 鎖定狀態變更後，重新渲染目前畫面上看得到的表格（兩個 render 函式互相用
    // typeof 保護，不管目前在哪個分頁、哪支檔案先載入都不會噴錯）
    function refreshAllViews() {
      if (typeof render === 'function') { try { render(); } catch (e) {} }
      if (typeof renderTable === 'function') { try { renderTable(); } catch (e) {} }
    }

    function lockPlaceholderHtml(key, type) {
      const safeKey = esc(key);
      return `<span class="lock-placeholder"><span class="lock-placeholder-text">功能尚待開發</span><span class="lock-construction-icon" onclick="handleLockIconClick(event, '${safeKey}', '${type}')">🚧</span></span>`;
    }

    /* ====== 密碼鎖定功能：設定面板 ====== */
    function openLockSettingsModal() {
      const pwInput = document.getElementById('lockPasswordInput');
      if (pwInput) pwInput.value = '';
      renderLockSettingsLists();
      const modal = document.getElementById('lockSettingsModal');
      if (modal) modal.classList.add('open');
    }
    function closeLockSettingsModal() {
      const modal = document.getElementById('lockSettingsModal');
      if (modal) modal.classList.remove('open');
    }
    function renderLockSettingsLists() {
      const pagesEl = document.getElementById('lockPagesList');
      const fieldsEl = document.getElementById('lockFieldsList');
      if (pagesEl) {
        pagesEl.innerHTML = LOCKABLE_PAGES.map(p => `
          <label class="lock-settings-item">
            <input type="checkbox" ${lockConfig.pages[p.key] ? 'checked' : ''} onchange="toggleLockPage('${p.key}', this.checked)">
            <span>${esc(p.label)}</span>
          </label>
        `).join('');
      }
      if (fieldsEl) {
        fieldsEl.innerHTML = LOCKABLE_FIELDS.map(f => `
          <label class="lock-settings-item">
            <input type="checkbox" ${lockConfig.fields[f.key] ? 'checked' : ''} onchange="toggleLockField('${f.key}', this.checked)">
            <span>${esc(f.label)}</span>
          </label>
        `).join('');
      }
    }
    function toggleLockPage(key, checked) {
      lockConfig.pages[key] = checked;
      saveLockConfig();
      refreshAllViews();
    }
    function toggleLockField(key, checked) {
      lockConfig.fields[key] = checked;
      saveLockConfig();
      refreshAllViews();
    }
    function saveLockPassword() {
      const input = document.getElementById('lockPasswordInput');
      const pw = input ? input.value.trim() : '';
      if (!pw) { showToast('請輸入新密碼', 'error'); return; }
      lockConfig.password = pw;
      saveLockConfig();
      if (input) input.value = '';
      showToast('密碼已更新', 'success');
    }

    let fbAuth = null, fbDb = null, fbUser = null, cloudSaveTimer = null;

    try {
      firebase.initializeApp(firebaseConfig);
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
    } catch (e) {
      console.warn("Firebase 尚未設定（請填入上面的 firebaseConfig）：", e);
    }

    function handleLoginClick() {
      if (!fbAuth) { alert("尚未設定 Firebase，請先在程式碼中填入 firebaseConfig。"); return; }
      const email = prompt("Email：");
      if (!email) return;
      const password = prompt("密碼：");
      if (!password) return;
      fbAuth.signInWithEmailAndPassword(email, password)
        .catch(err => {
          if (err.code === 'auth/user-not-found') {
            // 修正：找不到帳號時不要默默自動註冊，先跟使用者確認，
            // 避免 Email 打錯字時誤建立一個全新空白帳號、以為資料不見了。
            const doRegister = confirm(
              `找不到帳號 ${email}。\n\n按「確定」會建立一個全新帳號（資料會是空白的）。\n按「取消」不會建立，請確認 Email 有沒有打錯字。`
            );
            if (doRegister) return fbAuth.createUserWithEmailAndPassword(email, password);
            return;
          }
          throw err;
        })
        .catch(err => { if (err) alert("登入失敗：" + err.message); });
    }

    function firebaseSignOut() {
      if (fbAuth) fbAuth.signOut();
    }


    /* ====== 分頁切換：個人財務資產狀況管理 <-> 股票管理 ====== */
    function switchAppView(view) {
      const financeView = document.getElementById('financeView');
      const stockView = document.getElementById('stockView');
      const insuranceView = document.getElementById('insuranceView');
      const tabFinance = document.getElementById('tabBtnFinance');
      const tabStock = document.getElementById('tabBtnStock');
      const tabInsurance = document.getElementById('tabBtnInsurance');

      financeView.style.display = 'none';
      stockView.style.display = 'none';
      if (insuranceView) insuranceView.style.display = 'none';
      tabFinance.classList.remove('active');
      tabStock.classList.remove('active');
      if (tabInsurance) tabInsurance.classList.remove('active');

      if (view === 'stock') {
        stockView.style.display = 'block';
        tabStock.classList.add('active');
        // 每次「進入」股票管理（含從其他分頁切回來），都視為重新進入分頁，
        // 讓對應的分頁/子分頁重新捲動到最新一筆資料
        if (typeof lastEnteredTabContext !== 'undefined') lastEnteredTabContext = null;
        if (typeof renderTable === 'function') renderTable();
      } else if (view === 'insurance') {
        if (insuranceView) insuranceView.style.display = 'block';
        if (tabInsurance) tabInsurance.classList.add('active');
        if (typeof renderInsuranceTable === 'function') renderInsuranceTable();
      } else {
        financeView.style.display = 'block';
        tabFinance.classList.add('active');
        if (typeof render === 'function') render();
        // 每次「進入」財務總覽，都重新捲動到最新日期那一欄
        if (typeof scrollFinanceToLatestDate === 'function') {
          setTimeout(scrollFinanceToLatestDate, 0);
        }
      }
      if (typeof saveNavState === 'function') saveNavState();
    }
