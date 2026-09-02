
    const defaultData = {
      dates: ["1150401", "1150422", "1150501", "1150601", "1150630", "1150730", "1150822"],
      rates: [31.885, 31.48, 31.575, 31.35, 31.765, 32.415, 31.775],
      bankItems: [
        { id: "b1", name: "郵局" },
        { id: "b2", name: "台新" },
        { id: "b3", name: "台新外匯活存", isForeign: true },
        { id: "b4", name: "RICHART活存" },
        { id: "b5", name: "RICHART外幣活存(美金)", isForeign: true },
        { id: "b6", name: "RICHART外幣活存(日幣)", isForeign: true },
        { id: "b7", name: "RICHART外幣定存", isForeign: true },
        { id: "b8", name: "第一" },
        { id: "b9", name: "ileo網銀" },
        { id: "b10", name: "國泰世華(數位)" },
        { id: "b11", name: "國泰世華KOKO" },
        { id: "b12", name: "國泰世華外幣活存(美金)", isForeign: true },
        { id: "b13", name: "Line Bank" },
        { id: "b14", name: "Line Bank 子帳戶" },
        { id: "b15", name: "富邦銀行" },
        { id: "b16", name: "將來銀行" },
        { id: "b17", name: "永豐銀行" },
        { id: "b18", name: "中國信託" },
        { id: "b19", name: "華南銀行" },
        { id: "b20", name: "玉山銀行" },
        { id: "b21", name: "玉山銀行(美金)" },
        { id: "b22", name: "土地銀行" },
        { id: "b23", name: "台灣銀行" },
        { id: "b25", name: "在姐富邦" },
        { id: "b26", name: "PayPal", isUSD: true, isForeign: true },
        { id: "b27", name: "WISE", isUSD: true, isForeign: true }
      ],
      badDebtItems: [
        { id: "d1", name: "借款(姊)" }
      ],
      insuranceItems: [
        { id: "i1", name: "三商美邦6年外匯壽險", isUSD: true },
        { id: "i2", name: "富邦享安定期壽險" },
        { id: "i3", name: "富邦終身健保" },
        { id: "i4", name: "富邦富利旺終身壽險" },
        { id: "i5", name: "媽媽壽險" }
      ],
      stockItems: [
        { id: "s1", name: "富邦股票" },
        { id: "s2", name: "國泰股票" },
        { id: "s3", name: "永豐股票" },
        { id: "s4", name: "美股(折合台幣)", isUSD: true }
      ],
      values: {
        b1: [4700, 700, 700, 10549, 2513, 1513, 2892],
        b2: [11150, 134, 134, 134, 1712, 21678, 145],
        b3: [0, 0, 0, 0, 0, 0, 0],
        b4: [123, 809, 3136, 6911, 58344, 313, 1073],
        b5: [0, 0, 0, 0, 0, 3219.13365, 0],
        b6: [0, 0, 0, 0, 0, 0, 0],
        b7: [0, 0, 0, 0, 0, 0, 0],
        b8: [279, 279, 279, 279, 279, 279, 279],
        b9: [21699, 312, 3021, 30857, 5822, 2213, 663],
        b10: [13581, 703, 28289, 58413, 26528, 4607, 113969],
        b11: [154, 154, 154, 154, 165, 165, 165],
        b12: [60, 59, 60, 2644, 2690, 2748, 8044],
        b13: [564, 358, 268, 2034, 426, 2135, 1443],
        b14: [0, 0, 0, 0, 0, 0, 0],
        b15: [8154, 11739, 2835, 5572, 35145, 17837, 20887],
        b16: [0, 0, 92008, 2111, 2118, 0, 0],
        b17: [266, 2294, 1318, 3359, 589, 658, 1965],
        b18: [64, 861, 861, 8207, 8212, 9717, 11128],
        b19: [0, 0, 0, 0, 0, 0, 0],
        b20: [16, 350, 6365, 6365, 15588, 15588, 23464],
        b21: [0, 0, 0, 0, 0, 0, 0],
        b22: [0, 0, 0, 0, 0, 0, 0],
        b23: [0, 0, 0, 0, 0, 0, 0],
        b25: [4113, 4113, 4113, 4113, 4113, 4113, 4113],
        b26_usd: [348.14, 173.4, 81.31, 490.63, 31.85, 299.77, 100.5],
        b27_usd: [31.375, 31.375, 31.375, 31.375, 31.375, 31.375, 31.38],
        i2: [0, 0, 0, 0, 0, 0, 0],
        i3: [0, 0, 0, 0, 0, 0, 0],
        i4: [0, 0, 0, 0, 0, 0, 0],
        i5: [149800, 149800, 149800, 149800, 149800, 149800, 149800],
        i1_usd: [3654, 3654, 0, 0, 0, 0, 0],
        s1: [2672928, 2906733, 2923722, 3380986, 3391453, 3394887, 3320746],
        s1_cost: [1680118, 1681875, 1685319, 1689977, 1662176, 1666778, 1691181],
        s2: [427352, 499873, 487725, 639364, 648696, 666450, 680858],
        s2_cost: [383661, 408269, 391851, 401938, 412832, 448188, 460133],
        s3: [63894, 75513, 77376, 103767, 107477, 106907, 108654],
        s3_cost: [66178, 64870, 65846, 67805, 70776, 73708, 75672],
        s4_usdval: [5847, 5483, 5906, 5964, 6274, 6274, 2810.5],
        s4_usdcost: [4012.49, 4012.49, 4012.49, 4012.49, 4012.49, 4012.49, 2006.24],
        s1_profit: [605401, 715850, 699938, 981869, 1045538, 1327441, 1240755],
        s2_profit: [43691, 91604, 95874, 237426, 235864, 218262, 220725],
        d1: [95000, 95000, 95000, 95000, 95000, 95000, 95000]
      },
      colNotes: ["", "", "", "", "", "", ""]
    };

    let state = JSON.parse(localStorage.getItem('finance_data_v6')) || defaultData;

    // 相容/搬遷舊資料：確保新欄位存在，並把還留在「銀行帳戶」裡、
    // 名稱含「借款」的項目自動搬到呆帳區（不管是本機還是雲端讀回來的舊資料都會套用）
    function migrateLegacyData() {
      if (!Array.isArray(state.badDebtItems)) state.badDebtItems = [];
      if (!Array.isArray(state.colNotes)) state.colNotes = state.dates.map(() => '');
      while (state.colNotes.length < state.dates.length) state.colNotes.push('');

      for (let i = state.bankItems.length - 1; i >= 0; i--) {
        if (state.bankItems[i].name && state.bankItems[i].name.includes('借款')) {
          const item = state.bankItems.splice(i, 1)[0];
          state.badDebtItems.push(item);
        }
      }
    }
    migrateLegacyData();

    let gridLayout = [];

    let selection = {
      startR: 0, startC: 0,
      endR: 0, endC: 0,
      activeR: 0, activeC: 0,
      isSelecting: false,
      isEditing: false
    };

    let draggedItemInfo = null;

    // ========================================================================
    // 浮動折線圖：以第四、五部分「總資產(成本)／總資產(現值)」為資料來源
    // ========================================================================
    let latestColCalcs = [];
    let assetChart = null;
    let chartPanelVisible = true;

    function toggleChartPanel(force) {
      const panel = document.getElementById('floatingChartPanel');
      const visible = typeof force === 'boolean' ? force : panel.style.display === 'none';
      panel.style.display = visible ? 'block' : 'none';
      chartPanelVisible = visible;
      if (visible) updateAssetChart();
    }

    function updateAssetChart() {
      if (!chartPanelVisible) return;
      const canvas = document.getElementById('assetTrendChart');
      if (!canvas || typeof Chart === 'undefined' || !latestColCalcs.length) return;
      const labels = state.dates;
      const costData = latestColCalcs.map(c => c.totalCost);
      const valData = latestColCalcs.map(c => c.totalVal);

      if (assetChart) {
        assetChart.data.labels = labels;
        assetChart.data.datasets[0].data = costData;
        assetChart.data.datasets[1].data = valData;
        assetChart.update();
        return;
      }

      assetChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: '總資產(成本)', data: costData, borderColor: '#a8543d', backgroundColor: 'rgba(168,84,61,0.08)', tension: 0.25, pointRadius: 3 },
            { label: '總資產(現值)', data: valData, borderColor: '#4a7c59', backgroundColor: 'rgba(74,124,89,0.08)', tension: 0.25, pointRadius: 3 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { font: { size: 11 }, color: '#3c362e' } },
            tooltip: { callbacks: { label: ctx => ctx.dataset.label + '：' + formatNumber(ctx.parsed.y) } }
          },
          scales: {
            x: { ticks: { font: { size: 10 }, color: '#93897a' }, grid: { color: '#eee6d8' } },
            y: { ticks: { font: { size: 10 }, color: '#93897a', callback: v => formatNumber(v) }, grid: { color: '#eee6d8' } }
          }
        }
      });
    }

    // 面板拖曳（按住標題列可移動；關閉／開啟見工具列按鈕）
    function initChartDrag() {
      const panel = document.getElementById('floatingChartPanel');
      const handle = document.getElementById('chartDragHandle');
      if (!panel || !handle) return;
      let dragging = false, offsetX = 0, offsetY = 0;
      handle.addEventListener('mousedown', (e) => {
        dragging = true;
        const rect = panel.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        panel.style.right = 'auto';
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const maxLeft = window.innerWidth - panel.offsetWidth;
        const maxTop = window.innerHeight - 40;
        panel.style.left = Math.max(0, Math.min(maxLeft, e.clientX - offsetX)) + 'px';
        panel.style.top = Math.max(0, Math.min(maxTop, e.clientY - offsetY)) + 'px';
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    }
    initChartDrag();

    // ========================================================================
    // Firebase 雲端同步（骨架 — 請自行填入 firebaseConfig 並依需求調整）
    // ------------------------------------------------------------------------
    // 1. 到 Firebase Console 複製你的 firebaseConfig 貼到下面。
    //    如果要跟你其他工具(華語課表、moneybook)共用同一個 Firebase 專案
    //    (moneybook-50481)，直接複用該專案的設定即可。
    // 2. 架構比照你既有工具：email/password 登入 + 每個使用者一份 Firestore 文件。
    // 3. 存檔採「整份文件覆蓋」(set，不加 merge:true)，避免你之前遇過的
    //    「merge:true 深層合併導致刪除的欄位又跑回來」那個bug。
    // 4. 這裡先幫你把骨架接好、UI也接好了，實際的 collection/doc 命名、
    //    要不要開放註冊、要不要多裝置即時同步(onSnapshot)等，你可以再自行調整。
    // ========================================================================
    // Firestore 文件路徑：collection('financeAssets') 底下每個使用者一份完整文件
    function fbDocRef() {
      if (!fbDb || !fbUser) return null;
      return fbDb.collection('financeAssets').doc(fbUser.uid);
    }

    if (fbAuth) {
      fbAuth.onAuthStateChanged(async (user) => {
        fbUser = user;
        const statusEl = document.getElementById('syncStatus');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        if (user) {
          loginBtn.style.display = 'none';
          logoutBtn.style.display = '';
          statusEl.textContent = '☁️ 已連線：' + user.email;
          await loadFromCloud();
        } else {
          loginBtn.style.display = '';
          logoutBtn.style.display = 'none';
          statusEl.textContent = '☁️ 未連線（僅本機儲存）';
        }
      });
    }

    async function loadFromCloud() {
      const ref = fbDocRef();
      if (!ref) return;
      try {
        const snap = await ref.get();
        if (snap.exists) {
          state = snap.data().state || state;
          migrateLegacyData();
          localStorage.setItem('finance_data_v6', JSON.stringify(state));
          render();
          saveToCloud(); // 把搬遷/補欄位後的結果同步回雲端，避免下次登入又讀到舊格式
        } else {
          // 雲端還沒有資料：把目前(本機)的狀態第一次推上去
          await ref.set({ state, updatedAt: new Date().toISOString() });
        }
        document.getElementById('syncStatus').textContent = '☁️ 已同步';
      } catch (e) {
        console.error("讀取雲端資料失敗：", e);
        const el = document.getElementById('syncStatus');
        if (el) {
          el.textContent = '☁️ 同步失敗（點我看原因）';
          el.style.cursor = 'pointer';
          el.title = (e.code || '') + ' ' + (e.message || '');
          el.onclick = () => alert('雲端同步失敗：\n\n' + (e.code || '') + '\n' + (e.message || e));
        }
      }
    }

    function saveToCloud() {
      const ref = fbDocRef();
      if (!ref) return;
      // 整份覆蓋（不用 merge:true），避免刪除的項目又被合併回來
      ref.set({ state, updatedAt: new Date().toISOString() }).then(() => {
        const el = document.getElementById('syncStatus');
        if (el) { el.textContent = '☁️ 已同步'; el.title = ''; }
      }).catch(e => {
        console.error("寫入雲端失敗：", e);
        const el = document.getElementById('syncStatus');
        if (el) {
          el.textContent = '☁️ 同步失敗（點我看原因）';
          el.style.cursor = 'pointer';
          el.title = (e.code || '') + ' ' + (e.message || '');
          el.onclick = () => alert('雲端同步失敗：\n\n' + (e.code || '') + '\n' + (e.message || e));
        }
      });
    }

    function saveState() {
      localStorage.setItem('finance_data_v6', JSON.stringify(state));
      // 雲端同步：debounce 800ms，避免每個按鍵/儲存格編輯都寫一次 Firestore
      if (fbUser) {
        clearTimeout(cloudSaveTimer);
        cloudSaveTimer = setTimeout(saveToCloud, 800);
      }
    }

    function formatNumber(num, decimals = 0) {
      if (num === null || num === undefined || isNaN(num)) return "-";
      return Number(num).toLocaleString('zh-TW', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function formatPercent(num) {
      if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return "0.00%";
      return (num * 100).toFixed(2) + "%";
    }

    function colorByValue(num, text) {
      if (num === 0) return '<span style="color:var(--text-main); font-weight:600;">' + text + '</span>';
      const color = num > 0 ? '#b6533c' : '#4a7c59';
      return '<span style="color:' + color + '; font-weight:600;">' + text + '</span>';
    }

    function formatProfit(num, decimals = 0) {
      return colorByValue(num, formatNumber(num, decimals));
    }

    function formatGrowth(num, decimals = 0, isPercent = false) {
      const text = isPercent ? formatPercent(num) : formatNumber(num, decimals);
      if (num === 0) return '<span style="color:var(--text-main); font-weight:600;">' + text + '</span>';
      const color = num > 0 ? '#4a7c59' : '#b6533c';
      return '<span style="color:' + color + '; font-weight:600;">' + text + '</span>';
    }

    function getVal(key, colIndex) {
      if (!state.values[key]) return 0;
      const v = state.values[key][colIndex];
      return (v === undefined || v === null || v === "") ? 0 : Number(v);
    }

    // 通用美元換算：任何銀行/保險/股票項目只要標記 isUSD:true，
    // 都會用當期美金匯率自動換算台幣，不再侷限於單一寫死的帳戶。
    function bankTWD(b, c, rate) { return b.isUSD ? getVal(b.id + '_usd', c) * rate : getVal(b.id, c); }
    function insTWD(ins, c, rate) { return ins.isUSD ? getVal(ins.id + '_usd', c) * rate : getVal(ins.id, c); }
    function stockValTWD(s, c, rate) { return s.isUSD ? getVal(s.id + '_usdval', c) * rate : getVal(s.id, c); }
    function stockCostTWD(s, c, rate) { return s.isUSD ? getVal(s.id + '_usdcost', c) * rate : getVal(s.id + '_cost', c); }

    function setRawVal(key, colIndex, val) {
      if (!state.values[key]) {
        state.values[key] = new Array(state.dates.length).fill(0);
      }
      state.values[key][colIndex] = val === "" ? "" : Number(val);
    }

    function openNoteEditor(e, colIdx) {
      e.stopPropagation();
      closeNoteEditor();
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const pop = document.createElement('div');
      pop.id = 'noteEditorPopover';
      pop.style.cssText = 'position:fixed; top:' + (rect.bottom + 4) + 'px; left:' + Math.max(8, rect.left - 90) + 'px; width:220px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:4px; box-shadow:0 4px 14px rgba(60,54,46,0.18); padding:8px; z-index:2000;';
      const safeVal = (state.colNotes[colIdx] || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      pop.innerHTML =
        '<textarea id="noteEditorTextarea" style="width:100%; height:70px; font-family:inherit; font-size:12px; border:1px solid var(--border-color); border-radius:2px; padding:4px; resize:vertical;">' + safeVal + '</textarea>' +
        '<div style="display:flex; justify-content:flex-end; gap:6px; margin-top:6px;">' +
          '<button class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="closeNoteEditor()">取消</button>' +
          '<button class="btn btn-primary" style="padding:3px 8px; font-size:11px;" onclick="saveNote(' + colIdx + ')">儲存</button>' +
        '</div>';
      document.body.appendChild(pop);
      document.getElementById('noteEditorTextarea').focus();
      setTimeout(() => document.addEventListener('mousedown', outsideNoteClick), 0);
    }

    function outsideNoteClick(e) {
      const pop = document.getElementById('noteEditorPopover');
      if (pop && !pop.contains(e.target) && !e.target.closest('.note-btn')) {
        closeNoteEditor();
      }
    }

    function closeNoteEditor() {
      const pop = document.getElementById('noteEditorPopover');
      if (pop) pop.remove();
      document.removeEventListener('mousedown', outsideNoteClick);
    }

    function saveNote(colIdx) {
      const val = document.getElementById('noteEditorTextarea').value;
      state.colNotes[colIdx] = val;
      saveState();
      closeNoteEditor();
      render();
    }

    function toggleSettingsMenu(e) {
      e.stopPropagation();
      const menu = document.getElementById('settingsMenu');
      const willShow = menu.style.display !== 'block';
      menu.style.display = willShow ? 'block' : 'none';
      if (willShow) setTimeout(() => document.addEventListener('mousedown', outsideSettingsClick), 0);
    }

    function closeSettingsMenu() {
      const menu = document.getElementById('settingsMenu');
      if (menu) menu.style.display = 'none';
      document.removeEventListener('mousedown', outsideSettingsClick);
    }

    function outsideSettingsClick(e) {
      const menu = document.getElementById('settingsMenu');
      const btn = document.getElementById('settingsToggleBtn');
      if (menu && !menu.contains(e.target) && !(btn && btn.contains(e.target))) {
        closeSettingsMenu();
      }
    }

    function updateDate(index, newVal) {
      state.dates[index] = newVal;
      sortColumnsByDate();
      saveState();
      render();
    }

    function sortColumnsByDate() {
      const indices = state.dates.map((d, i) => i);
      indices.sort((a, b) => {
        const da = String(state.dates[a]).replace(/\D/g, '');
        const db = String(state.dates[b]).replace(/\D/g, '');
        return da.localeCompare(db, undefined, { numeric: true });
      });
      const alreadySorted = indices.every((v, i) => v === i);
      if (alreadySorted) return;

      state.dates = indices.map(i => state.dates[i]);
      state.rates = indices.map(i => state.rates[i]);
      state.colNotes = indices.map(i => state.colNotes[i]);
      Object.keys(state.values).forEach(k => {
        state.values[k] = indices.map(i => state.values[k][i]);
      });
    }

    function addColumn() {
      const newDate = prompt("請輸入新增紀錄日期 (例如: 1150401):", "");
      if (!newDate) return;
      state.dates.push(newDate);
      const lastRate = state.rates[state.rates.length - 1] || 31.5;
      state.rates.push(lastRate);
      state.colNotes.push('');

      Object.keys(state.values).forEach(k => {
        state.values[k].push(0);
      });
      sortColumnsByDate();
      saveState();
      render();
    }

    function deleteColumn(index) {
      if (state.dates.length <= 1) {
        alert("至少需保留一期紀錄！");
        return;
      }
      if (confirm("確定要刪除「" + state.dates[index] + "」這期紀錄嗎？")) {
        state.dates.splice(index, 1);
        state.rates.splice(index, 1);
        state.colNotes.splice(index, 1);
        Object.keys(state.values).forEach(k => {
          if (state.values[k]) state.values[k].splice(index, 1);
        });
        saveState();
        render();
      }
    }

    function addItem(type) {
      const name = prompt("請輸入項目名稱：");
      if (!name) return;
      const id = type[0] + '_' + Date.now();
      if (type === 'baddebt') {
        state.badDebtItems.push({ id, name });
        saveState();
        render();
        return;
      }
      const isUSD = confirm("這個項目是否為「美元計價」？\n\n確定＝美元計價，系統會用當期美金匯率自動換算成台幣\n取消＝直接輸入台幣金額");
      if (type === 'bank') state.bankItems.push({ id, name, isUSD, isForeign: isUSD });
      if (type === 'insurance') state.insuranceItems.push({ id, name, isUSD });
      if (type === 'stock') state.stockItems.push({ id, name, isUSD });
      saveState();
      render();
    }

    // 刪除＝封存：項目會從畫面與計算中隱藏，但歷史數值完整保留，
    // 可以在「設定 → 封存管理」還原，或選擇永久刪除。
    function deleteItem(type, id) {
      if (confirm("確定要封存此項目嗎？\n\n封存後不會列入計算與畫面顯示，但歷史數值會保留，之後可以在「設定 → 封存管理」還原。")) {
        const arr = findItemArray(type);
        const item = arr.find(x => x.id === id);
        if (item) item.archived = true;
        saveState();
        render();
      }
    }

    function updateItemName(type, id, newName) {
      const arr = findItemArray(type);
      const item = arr.find(x => x.id === id);
      if (item) item.name = newName;
      saveState();
    }

    function restoreItem(type, id) {
      const arr = findItemArray(type);
      const item = arr.find(x => x.id === id);
      if (item) delete item.archived;
      saveState();
      render();
      openArchiveManager();
    }

    function permanentDeleteItem(type, id) {
      if (!confirm("確定要永久刪除嗎？此動作無法復原，所有歷史數值都會被清除！")) return;
      const arr = findItemArray(type);
      const idx = arr.findIndex(x => x.id === id);
      if (idx !== -1) {
        const item = arr.splice(idx, 1)[0];
        delete state.values[item.id];
        delete state.values[item.id + '_cost'];
        delete state.values[item.id + '_usd'];
        delete state.values[item.id + '_usdval'];
        delete state.values[item.id + '_usdcost'];
        delete state.values[item.id + '_profit'];
      }
      saveState();
      render();
      openArchiveManager();
    }

    function openArchiveManager() {
      closeSettingsMenu();
      closeArchiveManager();
      const archivedList = [];
      ['bank', 'insurance', 'stock', 'baddebt'].forEach(type => {
        findItemArray(type).forEach(item => { if (item.archived) archivedList.push({ type, item }); });
      });

      const rowsHtml = archivedList.length
        ? archivedList.map(({ type, item }) =>
            '<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 4px; border-bottom:1px solid var(--border-color); font-size:13px;">' +
              '<span>【' + typeLabel(type) + '】' + item.name + '</span>' +
              '<span>' +
                '<button class="btn btn-outline" style="padding:3px 8px; font-size:11px; margin-right:6px;" onclick="restoreItem(\'' + type + '\',\'' + item.id + '\')">還原</button>' +
                '<button class="btn btn-danger" style="padding:3px 8px; font-size:11px;" onclick="permanentDeleteItem(\'' + type + '\',\'' + item.id + '\')">永久刪除</button>' +
              '</span>' +
            '</div>'
          ).join('')
        : '<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">目前沒有已封存的項目</div>';

      const modal = document.createElement('div');
      modal.id = 'archiveModal';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(60,54,46,0.35); z-index:3000; display:flex; align-items:center; justify-content:center;';
      modal.innerHTML =
        '<div style="background:var(--card-bg); border-radius:6px; width:440px; max-width:90vw; max-height:70vh; overflow:auto; box-shadow:0 8px 30px rgba(0,0,0,0.25);">' +
          '<div style="background:#4a4438; color:#f4f0e8; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:500; position:sticky; top:0;">' +
            '<span>🗄️ 封存管理</span><span style="cursor:pointer;" onclick="closeArchiveManager()">✖</span>' +
          '</div>' +
          '<div style="padding:8px 16px;">' + rowsHtml + '</div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeArchiveManager(); });
    }

    function closeArchiveManager() {
      const modal = document.getElementById('archiveModal');
      if (modal) modal.remove();
    }

    // --- 拖曳排序 ---
    function handleDragStart(e, type, id) {
      draggedItemInfo = { type, id };
      e.dataTransfer.effectAllowed = 'move';
      const tr = e.target.closest('tr');
      if (tr) tr.classList.add('row-dragging');
    }

    function handleDragOver(e, type, id) {
      if (!draggedItemInfo || draggedItemInfo.type !== type) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const tr = e.currentTarget;
      if (tr) tr.classList.add('drag-over');
    }

    function handleDragLeave(e) {
      const tr = e.currentTarget;
      if (tr) tr.classList.remove('drag-over');
    }

    function findItemArray(type) {
      if (type === 'bank') return state.bankItems;
      if (type === 'insurance') return state.insuranceItems;
      if (type === 'stock') return state.stockItems;
      if (type === 'baddebt') return state.badDebtItems;
      return [];
    }

    function typeLabel(type) {
      return type === 'bank' ? '銀行' : type === 'insurance' ? '保險' : type === 'stock' ? '股票' : '呆帳';
    }

    function handleDrop(e, targetType, targetId) {
      e.preventDefault();
      const tr = e.currentTarget;
      if (tr) tr.classList.remove('drag-over');
      if (!draggedItemInfo || draggedItemInfo.type !== targetType) return;
      if (draggedItemInfo.id === targetId) return;

      const list = findItemArray(targetType);
      const sourceIndex = list.findIndex(x => x.id === draggedItemInfo.id);
      const targetIndex = list.findIndex(x => x.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const movedItem = list.splice(sourceIndex, 1)[0];
      list.splice(targetIndex, 0, movedItem);

      saveState();
      render();
    }

    function handleDragEnd(e) {
      document.querySelectorAll('.row-dragging').forEach(el => el.classList.remove('row-dragging'));
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      draggedItemInfo = null;
    }

    // --- 渲染函數 ---
    function render() {
      const numCols = state.dates.length;
      gridLayout = [];

      // 已封存的項目不列入畫面顯示與任何計算（歷史數值仍保留在 state.values 裡）
      const activeBankItems = state.bankItems.filter(b => !b.archived);
      const activeInsuranceItems = state.insuranceItems.filter(ins => !ins.archived);
      const activeStockItems = state.stockItems.filter(s => !s.archived);
      const activeBadDebtItems = state.badDebtItems.filter(d => !d.archived);

      let theadHtml = '<tr><th class="row-label"><div class="row-label-content"><span class="row-label-text">項目 / 紀錄時間</span></div></th>';
      state.dates.forEach((d, i) => {
        theadHtml += '<th class="col-header">' +
          '<div class="header-content">' +
            '<input type="text" class="date-input" value="' + d + '" onchange="updateDate(' + i + ', this.value)">' +
            '<span class="note-btn" title="備註" onclick="openNoteEditor(event, ' + i + ')">📝' + (state.colNotes[i] ? '<span class="note-dot"></span>' : '') + '</span>' +
            '<span class="del-btn" title="刪除整欄" onclick="deleteColumn(' + i + ')">🗑️</span>' +
          '</div>' +
        '</th>';
      });
      theadHtml += '</tr>';
      document.getElementById('tableHead').innerHTML = theadHtml;

      const colCalcs = [];
      for (let c = 0; c < numCols; c++) {
        const rate = Number(state.rates[c]) || 31.0;

        let cashTotal = 0;
        let cashDisplayTotal = 0;
        activeBankItems.forEach(b => {
          const twd = bankTWD(b, c, rate);
          cashTotal += twd;
          // 現金總額(顯示用)：排除外幣計價帳戶，比照Excel「現金總額」的定義
          // （不影響總資產計算，僅影響「現金總額」這個分類小計的顯示）
          if (!b.isForeign) cashDisplayTotal += twd;
        });

        let insTotal = 0;
        activeInsuranceItems.forEach(ins => { insTotal += insTWD(ins, c, rate); });

        let stockValTotal = 0;
        let stockCostTotal = 0;
        activeStockItems.forEach(s => {
          stockValTotal += stockValTWD(s, c, rate);
          stockCostTotal += stockCostTWD(s, c, rate);
        });

        const totalCost = cashTotal + insTotal + stockCostTotal;
        const totalVal = cashTotal + insTotal + stockValTotal;

        let usdTotalUSD = 0;
        activeBankItems.forEach(b => { if (b.isUSD) usdTotalUSD += getVal(b.id + '_usd', c); });
        activeInsuranceItems.forEach(ins => { if (ins.isUSD) usdTotalUSD += getVal(ins.id + '_usd', c); });
        activeStockItems.forEach(s => { if (s.isUSD) usdTotalUSD += getVal(s.id + '_usdval', c); });

        // 股票損益：若該項目有手動填寫「損益」欄位，優先採用手動數字（比照Excel富邦/國泰做法）；
        // 否則自動用「現值－成本」計算（比照Excel美股做法）。
        let stockProfit = 0;
        activeStockItems.forEach(s => {
          const rawProfit = state.values[s.id + '_profit']?.[c];
          if (rawProfit !== undefined && rawProfit !== null && rawProfit !== '') {
            stockProfit += Number(rawProfit);
          } else {
            stockProfit += stockValTWD(s, c, rate) - stockCostTWD(s, c, rate);
          }
        });
        const stockRoi = stockCostTotal > 0 ? stockProfit / stockCostTotal : 0;

        colCalcs.push({
          rate, cashTotal, cashDisplayTotal, insTotal, stockValTotal, stockCostTotal, totalCost, totalVal,
          usdTotalUSD, stockProfit, stockRoi
        });
      }

      let tbodyHtml = '';
      let curR = 0;

      function createDataRow(labelHtml, rowClass, rowMeta, dropAttrs = "") {
        let rowCols = [];
        let html = '<tr class="' + rowClass + '" ' + dropAttrs + '><td class="row-label">' + labelHtml + '</td>';
        for (let c = 0; c < numCols; c++) {
          const meta = { ...rowMeta, colIdx: c, r: curR, c: c };
          rowCols.push(meta);

          let displayVal = "";
          let rawVal = "";
          if (meta.type === 'editable') {
            rawVal = state.values[meta.key]?.[c] ?? '';
            if (rawVal !== '') {
              displayVal = meta.colorize ? formatProfit(Number(rawVal), meta.decimals || 0) : formatNumber(rawVal, meta.decimals || 0);
            } else if (meta.autoFn) {
              displayVal = meta.autoFn(c);
            } else {
              displayVal = '-';
            }
          } else if (meta.type === 'rate') {
            rawVal = state.rates[c] ?? 31.0;
            displayVal = Number(rawVal).toFixed(3);
          } else if (meta.type === 'calc') {
            displayVal = meta.calcFn(c);
          }

          html += '<td data-r="' + curR + '" data-c="' + c + '" class="grid-cell"><div class="cell-view">' + displayVal + '</div></td>';
        }
        html += '</tr>';
        gridLayout.push(rowCols);
        curR++;
        return html;
      }

      // 1. 銀行
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">一、銀行與現金帳戶</td></tr>';
      activeBankItems.forEach((b) => {
        const dropAttrs = 'ondragover="handleDragOver(event, \'bank\', \'' + b.id + '\')" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, \'bank\', \'' + b.id + '\')"';
        if (b.isUSD) {
          const label = '<div class="row-label-content">' +
            '<div class="row-label-left">' +
              '<span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, \'bank\', \'' + b.id + '\')" ondragend="handleDragEnd(event)" title="按住拖曳以排序">☰</span>' +
              '<span class="del-btn" onclick="deleteItem(\'bank\', \'' + b.id + '\')">✖</span>' +
            '</div>' +
            '<input type="text" class="name-input" value="' + b.name + '" onchange="updateItemName(\'bank\', \'' + b.id + '\', this.value)"><span class="badge-auto">USD自動</span>' +
          '</div>';
          tbodyHtml += createDataRow(label, "bank-row", { type: 'calc', calcFn: c => formatNumber(bankTWD(b, c, colCalcs[c].rate)) }, dropAttrs);
        } else {
          const label = '<div class="row-label-content">' +
            '<div class="row-label-left">' +
              '<span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, \'bank\', \'' + b.id + '\')" ondragend="handleDragEnd(event)" title="按住拖曳以排序">☰</span>' +
              '<span class="del-btn" onclick="deleteItem(\'bank\', \'' + b.id + '\')">✖</span>' +
            '</div>' +
            '<input type="text" class="name-input" value="' + b.name + '" onchange="updateItemName(\'bank\', \'' + b.id + '\', this.value)">' +
          '</div>';
          tbodyHtml += createDataRow(label, "bank-row", { type: 'editable', key: b.id }, dropAttrs);
        }
      });

      // 呆帳區（不列入資產計算，僅供追蹤）
      if (activeBadDebtItems.length > 0) {
        tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">🚫 呆帳區（不列入資產計算）</td></tr>';
        activeBadDebtItems.forEach((d) => {
          const label = '<div class="row-label-content">' +
            '<div class="row-label-left">' +
              '<span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, \'baddebt\', \'' + d.id + '\')" ondragend="handleDragEnd(event)" title="按住拖曳以排序">☰</span>' +
              '<span class="del-btn" onclick="deleteItem(\'baddebt\', \'' + d.id + '\')">✖</span>' +
            '</div>' +
            '<input type="text" class="name-input" value="' + d.name + '" onchange="updateItemName(\'baddebt\', \'' + d.id + '\', this.value)">' +
          '</div>';
          const dropAttrs = 'ondragover="handleDragOver(event, \'baddebt\', \'' + d.id + '\')" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, \'baddebt\', \'' + d.id + '\')"';
          tbodyHtml += createDataRow(label, "baddebt-row", { type: 'editable', key: d.id }, dropAttrs);
        });
      }

      // 2. 保險
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">二、保險資產 (台幣)</td></tr>';
      activeInsuranceItems.forEach((ins) => {
        if (ins.isUSD) {
          const label = '<div class="row-label-content">' +
            '<div class="row-label-left">' +
              '<span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, \'insurance\', \'' + ins.id + '\')" ondragend="handleDragEnd(event)" title="按住拖曳以排序">☰</span>' +
              '<span class="del-btn" onclick="deleteItem(\'insurance\', \'' + ins.id + '\')">✖</span>' +
            '</div>' +
            '<input type="text" class="name-input" value="' + ins.name + '" onchange="updateItemName(\'insurance\', \'' + ins.id + '\', this.value)"><span class="badge-auto">USD自動</span>' +
          '</div>';
          const dropAttrs = 'ondragover="handleDragOver(event, \'insurance\', \'' + ins.id + '\')" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, \'insurance\', \'' + ins.id + '\')"';
          tbodyHtml += createDataRow(label, "ins-row", { type: 'calc', calcFn: c => formatNumber(insTWD(ins, c, colCalcs[c].rate)) }, dropAttrs);
        } else {
          const label = '<div class="row-label-content">' +
            '<div class="row-label-left">' +
              '<span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, \'insurance\', \'' + ins.id + '\')" ondragend="handleDragEnd(event)" title="按住拖曳以排序">☰</span>' +
              '<span class="del-btn" onclick="deleteItem(\'insurance\', \'' + ins.id + '\')">✖</span>' +
            '</div>' +
            '<input type="text" class="name-input" value="' + ins.name + '" onchange="updateItemName(\'insurance\', \'' + ins.id + '\', this.value)">' +
          '</div>';
          const dropAttrs = 'ondragover="handleDragOver(event, \'insurance\', \'' + ins.id + '\')" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, \'insurance\', \'' + ins.id + '\')"';
          tbodyHtml += createDataRow(label, "ins-row", { type: 'editable', key: ins.id }, dropAttrs);
        }
      });

      // 3. 股票
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">三、股票資產 (台幣現值 / 成本)</td></tr>';
      activeStockItems.forEach((s) => {
        if (s.isUSD) {
          const labelVal = '<div class="row-label-content">' +
            '<div class="row-label-left">' +
              '<span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, \'stock\', \'' + s.id + '\')" ondragend="handleDragEnd(event)" title="按住拖曳以排序">☰</span>' +
              '<span class="del-btn" onclick="deleteItem(\'stock\', \'' + s.id + '\')">✖</span>' +
            '</div>' +
            '<input type="text" class="name-input" value="' + s.name + '" onchange="updateItemName(\'stock\', \'' + s.id + '\', this.value)"> [現值]<span class="badge-auto">USD自動</span>' +
          '</div>';
          const dropAttrs = 'ondragover="handleDragOver(event, \'stock\', \'' + s.id + '\')" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, \'stock\', \'' + s.id + '\')"';
          tbodyHtml += createDataRow(labelVal, "stock-row", { type: 'calc', calcFn: c => formatNumber(stockValTWD(s, c, colCalcs[c].rate)) }, dropAttrs);
          tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">' + s.name + ' [成本]<span class="badge-auto">USD自動</span></span></div>', "stock-row", { type: 'calc', calcFn: c => formatNumber(stockCostTWD(s, c, colCalcs[c].rate)) });
        } else {
          const labelVal = '<div class="row-label-content">' +
            '<div class="row-label-left">' +
              '<span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, \'stock\', \'' + s.id + '\')" ondragend="handleDragEnd(event)" title="按住拖曳以排序">☰</span>' +
              '<span class="del-btn" onclick="deleteItem(\'stock\', \'' + s.id + '\')">✖</span>' +
            '</div>' +
            '<input type="text" class="name-input" value="' + s.name + '" onchange="updateItemName(\'stock\', \'' + s.id + '\', this.value)"> [現值]' +
          '</div>';
          const dropAttrs = 'ondragover="handleDragOver(event, \'stock\', \'' + s.id + '\')" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, \'stock\', \'' + s.id + '\')"';
          tbodyHtml += createDataRow(labelVal, "stock-row", { type: 'editable', key: s.id }, dropAttrs);
          tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">' + s.name + ' [成本]</span></div>', "stock-row", { type: 'editable', key: s.id + '_cost' });
        }
      });

      // 4. 總資產 (成本)
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">四、總資產 (成本) 統計</td></tr>';
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">總資產 (成本)</span></div>', "highlight-red", { type: 'calc', calcFn: c => formatNumber(colCalcs[c].totalCost) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">增減 (成本)</span></div>', "highlight-yellow", { type: 'calc', calcFn: c => c === 0 ? '-' : formatGrowth(colCalcs[c].totalCost - colCalcs[c-1].totalCost) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">成長率 (成本)</span></div>', "highlight-yellow", { type: 'calc', calcFn: c => (c === 0 || colCalcs[c-1].totalCost === 0) ? '-' : formatGrowth((colCalcs[c].totalCost - colCalcs[c-1].totalCost)/colCalcs[c-1].totalCost, 0, true) });

      // 5. 總資產 (現值)
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">五、總資產 (現值/帳面) 統計</td></tr>';
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">總資產 (現值)</span></div>', "highlight-red", { type: 'calc', calcFn: c => formatNumber(colCalcs[c].totalVal) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">增減 (現值)</span></div>', "highlight-yellow", { type: 'calc', calcFn: c => c === 0 ? '-' : formatGrowth(colCalcs[c].totalVal - colCalcs[c-1].totalVal) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">成長率 (現值)</span></div>', "highlight-yellow", { type: 'calc', calcFn: c => (c === 0 || colCalcs[c-1].totalVal === 0) ? '-' : formatGrowth((colCalcs[c].totalVal - colCalcs[c-1].totalVal)/colCalcs[c-1].totalVal, 0, true) });

      // 6. 分類總額
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">六、分類資產總額</td></tr>';
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">現金總額</span></div>', "summary-row", { type: 'calc', calcFn: c => formatNumber(colCalcs[c].cashDisplayTotal) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">股票總額 (現值)</span></div>', "summary-row", { type: 'calc', calcFn: c => formatNumber(colCalcs[c].stockValTotal) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">股票總額 (成本)</span></div>', "summary-row", { type: 'calc', calcFn: c => formatNumber(colCalcs[c].stockCostTotal) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">外匯總資產 (美金 USD)</span></div>', "summary-row usdtotal-row", {
        type: 'calc',
        calcFn: c => {
          const usd = colCalcs[c].usdTotalUSD;
          const twd = usd * colCalcs[c].rate;
          return '<span class="usd-line-main">$' + formatNumber(usd, 2) + '</span>' +
                 '<span class="usd-line-sub">(NT$ ' + formatNumber(twd) + ')</span>';
        }
      });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">保險總額</span></div>', "summary-row", { type: 'calc', calcFn: c => formatNumber(colCalcs[c].insTotal) });

      // 7. 美金區
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">七、美金原始金額輸入區 (USD，自動用當期匯率換算台幣)</td></tr>';
      activeBankItems.forEach(b => {
        if (b.isUSD) {
          const label = '<div class="row-label-content"><span class="row-label-text">↳ ' + b.name + ' (USD)</span></div>';
          tbodyHtml += createDataRow(label, "usd-row", { type: 'editable', key: b.id + '_usd', decimals: 2 });
        }
      });
      activeInsuranceItems.forEach(ins => {
        if (ins.isUSD) {
          const label = '<div class="row-label-content"><span class="row-label-text">↳ ' + ins.name + ' (USD)</span></div>';
          tbodyHtml += createDataRow(label, "usd-row", { type: 'editable', key: ins.id + '_usd', decimals: 2 });
        }
      });
      activeStockItems.forEach(s => {
        if (s.isUSD) {
          tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">↳ ' + s.name + ' 現值 (USD)</span></div>', "usd-row", { type: 'editable', key: s.id + '_usdval', decimals: 2 });
          tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">↳ ' + s.name + ' 成本 (USD)</span></div>', "usd-row", { type: 'editable', key: s.id + '_usdcost', decimals: 2 });
        }
      });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">美金匯率 (當期獨立計算) 💱</span></div>', "rate-row", { type: 'rate' });

      // 8. 佔比
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">八、各分類資產佔比 (依現值)</td></tr>';
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">股票佔總比例</span></div>', "ratio-row", { type: 'calc', calcFn: c => formatPercent(colCalcs[c].totalVal > 0 ? colCalcs[c].stockValTotal / colCalcs[c].totalVal : 0) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">保險佔總比例</span></div>', "ratio-row", { type: 'calc', calcFn: c => formatPercent(colCalcs[c].totalVal > 0 ? colCalcs[c].insTotal / colCalcs[c].totalVal : 0) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">外幣佔總比例</span></div>', "ratio-row", { type: 'calc', calcFn: c => formatPercent(colCalcs[c].totalVal > 0 ? (colCalcs[c].usdTotalUSD * colCalcs[c].rate) / colCalcs[c].totalVal : 0) });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">活儲佔總比例</span></div>', "ratio-row", { type: 'calc', calcFn: c => formatPercent(colCalcs[c].totalVal > 0 ? colCalcs[c].cashDisplayTotal / colCalcs[c].totalVal : 0) });

      // 9. 損益
      tbodyHtml += '<tr><td colspan="' + (numCols + 1) + '" class="sec-header">九、股票目前帳面損益（可手動輸入覆蓋，留空則自動以現值－成本計算）</td></tr>';
      activeStockItems.forEach(s => {
        tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">股票投資損益 (' + s.name + ')</span></div>', "stock-row", {
          type: 'editable',
          key: s.id + '_profit',
          colorize: true,
          autoFn: c => {
            const p = stockValTWD(s, c, colCalcs[c].rate) - stockCostTWD(s, c, colCalcs[c].rate);
            return formatProfit(p) + '<span class="badge-auto">自動</span>';
          }
        });
      });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">股票投資總損益</span></div>', "summary-row", {
        type: 'calc',
        calcFn: c => formatProfit(colCalcs[c].stockProfit)
      });
      tbodyHtml += createDataRow('<div class="row-label-content"><span class="row-label-text">股票未實現損益報酬率</span></div>', "summary-row", {
        type: 'calc',
        calcFn: c => colorByValue(colCalcs[c].stockRoi, formatPercent(colCalcs[c].stockRoi))
      });

      document.getElementById('tableBody').innerHTML = tbodyHtml;
      updateSelectionVisuals();

      latestColCalcs = colCalcs;
      updateAssetChart();
    }

    // --- 框選與鍵盤操作 ---
    function updateSelectionVisuals() {
      document.querySelectorAll('.grid-cell').forEach(td => {
        td.classList.remove('cell-selected', 'cell-active');
      });

      const minR = Math.min(selection.startR, selection.endR);
      const maxR = Math.max(selection.startR, selection.endR);
      const minC = Math.min(selection.startC, selection.endC);
      const maxC = Math.max(selection.startC, selection.endC);

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const cell = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
          if (cell) {
            cell.classList.add('cell-selected');
            if (r === selection.activeR && c === selection.activeC) {
              cell.classList.add('cell-active');
            }
          }
        }
      }
    }

    function startEditing(r, c, initialChar = null) {
      if (selection.isEditing) return;
      const meta = gridLayout[r]?.[c];
      if (!meta || (meta.type !== 'editable' && meta.type !== 'rate')) return;

      selection.isEditing = true;
      const cell = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
      if (!cell) return;

      let currentVal = "";
      if (meta.type === 'editable') {
        currentVal = state.values[meta.key]?.[c] ?? '';
      } else if (meta.type === 'rate') {
        currentVal = state.rates[c] ?? 31.0;
      }

      const valToSet = initialChar !== null ? initialChar : currentVal;
      cell.innerHTML = '<input type="number" step="any" class="cell-editor" id="activeEditor">';
      const input = document.getElementById('activeEditor');
      input.value = valToSet;
      input.focus();
      if (initialChar === null) input.select();

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          finishEditing(true);
          moveSelection(1, 0);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          finishEditing(true);
          moveSelection(0, e.shiftKey ? -1 : 1);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finishEditing(false);
        }
      });
    }

    function finishEditing(save = true) {
      if (!selection.isEditing) return;
      const input = document.getElementById('activeEditor');
      if (input && save) {
        const meta = gridLayout[selection.activeR]?.[selection.activeC];
        if (meta) {
          const val = input.value.trim();
          if (meta.type === 'editable') {
            setRawVal(meta.key, meta.colIdx, val);
          } else if (meta.type === 'rate') {
            state.rates[meta.colIdx] = val === '' ? 31.0 : Number(val);
          }
          saveState();
        }
      }
      selection.isEditing = false;
      render();
      document.getElementById('gridContainer').focus();
    }

    function moveSelection(dr, dc) {
      const maxR = gridLayout.length - 1;
      const maxC = state.dates.length - 1;
      let newR = Math.max(0, Math.min(maxR, selection.activeR + dr));
      let newC = Math.max(0, Math.min(maxC, selection.activeC + dc));

      selection.activeR = selection.startR = selection.endR = newR;
      selection.activeC = selection.startC = selection.endC = newC;
      updateSelectionVisuals();
    }

    const container = document.getElementById('gridContainer');

    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.drag-handle') || e.target.closest('.del-btn') || e.target.closest('.date-input') || e.target.closest('.name-input')) {
        return;
      }

      const cell = e.target.closest('.grid-cell');
      if (!cell) return;

      const r = parseInt(cell.getAttribute('data-r'));
      const c = parseInt(cell.getAttribute('data-c'));

      if (selection.isEditing) {
        if (r === selection.activeR && c === selection.activeC) return;
        finishEditing(true);
      }

      selection.isSelecting = true;
      selection.startR = selection.endR = selection.activeR = r;
      selection.startC = selection.endC = selection.activeC = c;
      updateSelectionVisuals();
    });

    window.addEventListener('mousemove', (e) => {
      if (!selection.isSelecting) return;
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;

      const r = parseInt(cell.getAttribute('data-r'));
      const c = parseInt(cell.getAttribute('data-c'));

      if (r !== selection.endR || c !== selection.endC) {
        selection.endR = r;
        selection.endC = c;
        updateSelectionVisuals();
      }
    });

    window.addEventListener('mouseup', () => {
      selection.isSelecting = false;
    });

    container.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      const r = parseInt(cell.getAttribute('data-r'));
      const c = parseInt(cell.getAttribute('data-c'));
      startEditing(r, c);
    });

    container.addEventListener('keydown', (e) => {
      if (selection.isEditing) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1, 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveSelection(0, -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveSelection(0, 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        startEditing(selection.activeR, selection.activeC);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        moveSelection(0, e.shiftKey ? -1 : 1);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const minR = Math.min(selection.startR, selection.endR);
        const maxR = Math.max(selection.startR, selection.endR);
        const minC = Math.min(selection.startC, selection.endC);
        const maxC = Math.max(selection.startC, selection.endC);
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const meta = gridLayout[r]?.[c];
            if (meta && meta.type === 'editable') setRawVal(meta.key, meta.colIdx, "");
          }
        }
        saveState();
        render();
      } else if ((e.key >= '0' && e.key <= '9') || e.key === '-' || e.key === '.') {
        e.preventDefault();
        startEditing(selection.activeR, selection.activeC, e.key);
      }
    });

    // 複製與貼上
    window.addEventListener('copy', (e) => {
      if (selection.isEditing) return;
      const minR = Math.min(selection.startR, selection.endR);
      const maxR = Math.max(selection.startR, selection.endR);
      const minC = Math.min(selection.startC, selection.endC);
      const maxC = Math.max(selection.startC, selection.endC);

      let rows = [];
      for (let r = minR; r <= maxR; r++) {
        let cols = [];
        for (let c = minC; c <= maxC; c++) {
          const meta = gridLayout[r]?.[c];
          let val = "";
          if (meta) {
            if (meta.type === 'editable') val = state.values[meta.key]?.[c] ?? '';
            else if (meta.type === 'rate') val = state.rates[c] ?? 31.0;
            else if (meta.type === 'calc') val = meta.calcFn(c);
          }
          const plainText = String(val).replace(/<[^>]*>?/gm, '');
          cols.push(plainText);
        }
        rows.push(cols.join('\t'));
      }
      e.clipboardData.setData('text/plain', rows.join('\n'));
      e.preventDefault();
    });

    window.addEventListener('paste', (e) => {
      if (selection.isEditing) return;
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;

      const lines = text.trim().split(/\r?\n/).map(line => line.split('\t'));
      const startR = selection.activeR;
      const startC = selection.activeC;

      lines.forEach((line, rOffset) => {
        line.forEach((cellVal, cOffset) => {
          const targetR = startR + rOffset;
          const targetC = startC + cOffset;
          const meta = gridLayout[targetR]?.[targetC];
          if (meta) {
            const cleanVal = cellVal.replace(/[\$,%]/g, '').trim();
            if (meta.type === 'editable' && !isNaN(cleanVal)) {
              setRawVal(meta.key, meta.colIdx, cleanVal);
            } else if (meta.type === 'rate' && !isNaN(cleanVal) && cleanVal !== '') {
              state.rates[meta.colIdx] = Number(cleanVal);
            }
          }
        });
      });

      saveState();
      render();
      e.preventDefault();
    });

    // 匯出/匯入
    function exportData() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", '財務紀錄備份_' + new Date().toISOString().slice(0,10) + '.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    function importData(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.dates && imported.values) {
            state = imported;
            saveState();
            render();
            alert("資料匯入成功！");
          } else {
            alert("檔案格式不正確！");
          }
        } catch (err) {
          alert("解析檔案失敗：" + err.message);
        }
      };
      reader.readAsText(file);
    }

    function resetAll() {
      if (confirm("確定要清空所有資料並恢復預設值嗎？建議先匯出備份！")) {
        localStorage.removeItem('finance_data_v6');
        state = JSON.parse(JSON.stringify(defaultData));
        render();
      }
    }

    render();
