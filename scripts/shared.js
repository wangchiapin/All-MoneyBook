    const firebaseConfig = {
  apiKey: "AIzaSyDB6zYAHvi0oTkObv-qDnP6nn0UUnscby0",
  authDomain: "moneybook-50481.firebaseapp.com",
  projectId: "moneybook-50481",
  storageBucket: "moneybook-50481.firebasestorage.app",
  messagingSenderId: "549256761796",
  appId: "1:549256761796:web:254332f109e7b8ad871491",
  measurementId: "G-XTDYYS4HK6"
    };

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

    /* ====== 共用小工具：輕量 Toast 提示（用來取代部分 alert，尤其是「儲存失敗」這種
       不該被使用者忽略、但也不用整個擋住畫面的通知） ====== */
    function showToast(msg, type) {
      let box = document.getElementById('globalToastBox');
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
      const tabFinance = document.getElementById('tabBtnFinance');
      const tabStock = document.getElementById('tabBtnStock');
      if (view === 'stock') {
        financeView.style.display = 'none';
        stockView.style.display = 'block';
        tabFinance.classList.remove('active');
        tabStock.classList.add('active');
        if (typeof renderTable === 'function') renderTable();
      } else {
        stockView.style.display = 'none';
        financeView.style.display = 'block';
        tabStock.classList.remove('active');
        tabFinance.classList.add('active');
        if (typeof render === 'function') render();
        // 每次「進入」財務總覽，都重新捲動到最新日期那一欄
        if (typeof scrollFinanceToLatestDate === 'function') {
          setTimeout(scrollFinanceToLatestDate, 0);
        }
      }
      if (typeof saveNavState === 'function') saveNavState();
    }
