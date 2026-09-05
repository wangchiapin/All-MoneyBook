    const firebaseConfig = {
  apiKey: "AIzaSyDB6zYAHvi0oTkObv-qDnP6nn0UUnscby0",
  authDomain: "moneybook-50481.firebaseapp.com",
  projectId: "moneybook-50481",
  storageBucket: "moneybook-50481.firebasestorage.app",
  messagingSenderId: "549256761796",
  appId: "1:549256761796:web:254332f109e7b8ad871491",
  measurementId: "G-XTDYYS4HK6"
    };

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
            return fbAuth.createUserWithEmailAndPassword(email, password);
          }
          throw err;
        })
        .catch(err => alert("登入失敗：" + err.message));
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
