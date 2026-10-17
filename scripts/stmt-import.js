/* ====================================================================
   對帳單匯入（第 3 步）：總入口 ＋ 確認畫面 ＋ 寫入
   - 標題列「📥 匯入對帳單」（手機在 ⋯ 選單裡）打開全螢幕視窗
   - 選檔 → 密碼（可記在這台裝置）→ 在自己的裝置上用 PDF.js 讀（stmt-parsers.js）
   - 確認畫面：新增／更新／需要你看／略過，每筆可勾選、可修改
   - 寫入：股票買進、股票賣出（先買先賣）、當沖、配股、現金股利、借卷收入、出借張數、
           庫存核對、財務總覽銀行餘額；寫完可「復原這次匯入」
   需要 stock.js、stock-buys.js、stock-sales.js、stock-lending.js、finance.js、stmt-parsers.js
   ==================================================================== */

    const STMT_PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
    const STMT_PW_KEY = 'STMT_IMPORT_PASSWORDS_V1';   // 只存在這台裝置，不同步
    const STMT_BACKUP_KEY = 'STMT_IMPORT_LAST_BACKUP_V1';

    // stmtSettings / stmtImported 宣告在 stock.js（跟著股票資料一起存、同步）
    let stmtFiles = [];      // { id, file, name, status, password, result, error }
    let stmtItems = [];      // 確認畫面的每一筆
    let stmtStep = 'pick';   // 'pick' | 'review' | 'done'
    let stmtDoneInfo = null;
    let stmtPdfjsPromise = null;

    /* ---------------- 小工具 ---------------- */
    function stmtEsc(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s); }
    function stmtFmt(n, d = 0) { return typeof formatNum === 'function' ? formatNum(n, d) : String(n); }
    function stmtNorm(s) { return String(s || '').replace(/\s+/g, '').replace(/臺/g, '台').replace(/\*+$/, ''); }
    function stmtRoc(iso) {
      const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? String(Number(m[1]) - 1911) + m[2] + m[3] : '';
    }
    function stmtIsoFromRoc(roc) {
      const s = String(roc || '').replace(/[^0-9]/g, '');
      if (s.length < 5) return '';
      const d = s.slice(-2), m = s.slice(-4, -2), y = Number(s.slice(0, -4)) + 1911;
      return `${y}-${m}-${d}`;
    }
    // 某天之後的第一個工作日（只跳過六日，國定假日不知道）
    function stmtNextWorkday(iso) {
      const t = Date.parse(iso + 'T00:00:00Z');
      if (isNaN(t)) return '';
      const d = new Date(t);
      do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
      return d.toISOString().slice(0, 10);
    }
    // 借券費的入款日、還券日：月底結算 → 下個月第一個工作日；這個月裡提早還券 → 還券後第一個工作日
    function stmtLendDates(res, l) {
      const pm = String(res.period || '').match(/^(\d{4})-(\d{2})$/);
      if (!pm) return { pay: l.dueDate || l.lendDate, ret: '' };
      const y = Number(pm[1]), m = Number(pm[2]);
      const start = `${pm[1]}-${pm[2]}-01`;
      const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      if (l.dueDate && l.dueDate >= start && l.dueDate <= end) return { pay: stmtNextWorkday(l.dueDate), ret: l.dueDate };
      return { pay: stmtNextWorkday(end), ret: '' };
    }
    function stmtDaysApart(a, b) {
      const ta = Date.parse(a), tb = Date.parse(b);
      if (isNaN(ta) || isNaN(tb)) return 9999;
      return Math.abs(ta - tb) / 86400000;
    }
    function stmtR(n) { return Math.round((Number(n) || 0) * 100) / 100; }
    function stmtGetPasswords() { try { return JSON.parse(localStorage.getItem(STMT_PW_KEY) || '[]'); } catch (e) { return []; } }
    function stmtRememberPassword(pw) {
      if (!pw) return;
      const list = stmtGetPasswords().filter(p => p !== pw);
      list.unshift(pw);
      try { localStorage.setItem(STMT_PW_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) { /* 略過 */ }
    }
    function stmtSettingsObj() {
      if (!stmtSettings || typeof stmtSettings !== 'object') stmtSettings = {};
      stmtSettings.accountMap = stmtSettings.accountMap || {};
      stmtSettings.nameMap = stmtSettings.nameMap || {};
      return stmtSettings;
    }

    /* ---------------- PDF.js ---------------- */
    function stmtLoadPdfjs() {
      if (!stmtPdfjsPromise) {
        stmtPdfjsPromise = import(STMT_PDFJS_BASE + 'pdf.min.mjs').then(m => {
          m.GlobalWorkerOptions.workerSrc = STMT_PDFJS_BASE + 'pdf.worker.min.mjs';
          return m;
        }).catch(e => { stmtPdfjsPromise = null; throw e; });
      }
      return stmtPdfjsPromise;
    }

    /* ---------------- 視窗 ---------------- */
    function openStmtImport() {
      if (typeof mbCloseSheet === 'function') mbCloseSheet();
      document.querySelector('.app-header')?.classList.remove('mb-menu-open');
      stmtFiles = [];
      stmtItems = [];
      stmtStep = 'pick';
      stmtDoneInfo = null;
      if (typeof stmtPendingActive !== 'undefined') stmtPendingActive = [];
      let ov = document.getElementById('stmtOverlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'stmtOverlay';
        ov.className = 'stmt-overlay';
        ov.innerHTML = `
          <div class="stmt-panel" role="dialog">
            <div class="stmt-head">
              <div class="stmt-title">📥 匯入對帳單</div>
              <button type="button" class="stmt-close" onclick="closeStmtImport()" aria-label="關閉">✕</button>
            </div>
            <div class="stmt-body" id="stmtBody"></div>
            <div class="stmt-foot" id="stmtFoot"></div>
          </div>`;
        document.body.appendChild(ov);
      }
      const titleEl = ov.querySelector('.stmt-title');
      if (titleEl) titleEl.textContent = '📥 匯入對帳單';
      ov.classList.add('open');
      document.body.classList.add('stmt-open');
      stmtRender();
    }

    function closeStmtImport() {
      if (stmtStep === 'review' && stmtItems.some(it => it.checked) && !confirm('還沒寫入，確定要關掉嗎？（讀到的資料不會保留）')) return;
      document.getElementById('stmtOverlay')?.classList.remove('open');
      document.body.classList.remove('stmt-open');
      stmtFiles = [];
      stmtItems = [];
      if (typeof stmtPendingActive !== 'undefined') stmtPendingActive = [];
    }

    function stmtRender() {
      const body = document.getElementById('stmtBody');
      const foot = document.getElementById('stmtFoot');
      if (!body || !foot) return;
      if (stmtStep === 'pick') { body.innerHTML = stmtPickHtml(); foot.innerHTML = stmtPickFoot(); }
      else if (stmtStep === 'pending') { body.innerHTML = stmtPendingHtml(); foot.innerHTML = stmtPendingFoot(); }
      else if (stmtStep === 'review') { body.innerHTML = stmtReviewHtml(); foot.innerHTML = stmtReviewFoot(); }
      else { body.innerHTML = stmtDoneHtml(); foot.innerHTML = `<button class="btn btn-primary" onclick="closeStmtImport()">完成</button>`; }
    }

    /* ================= 1. 選檔＋密碼 ================= */
    function stmtPickHtml() {
      const rows = stmtFiles.map(f => {
        let status = '';
        if (f.status === 'pending') status = '<span class="stmt-tag">等待讀取</span>';
        else if (f.status === 'reading') status = '<span class="stmt-tag">讀取中…</span>';
        else if (f.status === 'needpw') status = `
            <div class="stmt-pw">
              <input type="password" id="stmtPw_${f.id}" placeholder="${f.wrong ? '密碼不正確，請再輸入一次' : '這份需要密碼'}" autocomplete="off" value="" onkeydown="if(event.key==='Enter'){event.preventDefault();stmtReadAll();}" />
            </div>`;
        else if (f.status === 'ok') {
          const r = f.result;
          const ok = r.allChecksOk;
          status = `<span class="stmt-tag ${ok ? 'ok' : 'bad'}">${stmtEsc(r.label)}・${stmtEsc(r.period || '')}・${ok ? '自我檢查通過' : '自我檢查沒通過'}</span>`;
        } else if (f.status === 'unsupported') status = `<span class="stmt-tag warn">${stmtEsc(f.result.label)}</span>`;
        else if (f.status === 'error') status = `<span class="stmt-tag bad">讀取失敗：${stmtEsc(f.error)}</span>`;
        return `
          <div class="stmt-file">
            <div class="stmt-file-name">📄 ${stmtEsc(f.name)}</div>
            <div class="stmt-file-status">${status}</div>
            <button class="stmt-x" title="拿掉" onclick="stmtRemoveFile(${f.id})">✕</button>
          </div>`;
      }).join('');
      const needPw = stmtFiles.some(f => f.status === 'needpw');
      return `
        <div class="stmt-step-hint">選對帳單 PDF（可以一次選好幾份）。檔案只在這台裝置上打開讀取，不會上傳。<br>網頁版的對帳單請先用「列印 → 另存成 PDF」。</div>
        <label class="stmt-pick-btn">
          ＋ 選擇對帳單
          <input type="file" accept="application/pdf,.pdf" multiple onchange="stmtAddFiles(this.files); this.value='';" style="display:none;" />
        </label>
        <div class="stmt-files">${rows || '<div class="stmt-empty">還沒選檔案</div>'}</div>
        ${needPw ? `<label class="stmt-remember"><input type="checkbox" id="stmtRememberPw" checked /> 這台裝置記住密碼（只存在這台，不會同步到雲端）</label>` : ''}
      `;
    }

    function stmtPickFoot() {
      const hasPending = stmtFiles.some(f => f.status === 'pending' || f.status === 'needpw');
      const hasOk = stmtFiles.some(f => f.status === 'ok');
      return `
        <button class="btn" onclick="closeStmtImport()">取消</button>
        ${hasPending ? `<button class="btn btn-primary" onclick="stmtReadAll()">讀取</button>` : ''}
        ${hasOk && !hasPending ? `<button class="btn btn-primary" onclick="stmtGoReview()">下一步：確認內容 →</button>` : ''}
      `;
    }

    let stmtFileSeq = 1;
    function stmtAddFiles(fileList) {
      Array.from(fileList || []).forEach(file => {
        if (stmtFiles.some(f => f.name === file.name && f.file.size === file.size)) return;
        stmtFiles.push({ id: stmtFileSeq++, file, name: file.name, status: 'pending' });
      });
      stmtRender();
      stmtReadAll();
    }

    function stmtRemoveFile(id) {
      stmtFiles = stmtFiles.filter(f => f.id !== id);
      stmtRender();
    }

    // 讀一份：先不用密碼，再試記住的密碼，最後才請使用者輸入
    async function stmtReadOne(f, pdfjs) {
      const buf = await f.file.arrayBuffer();
      const typed = f.status === 'needpw' ? (document.getElementById('stmtPw_' + f.id)?.value || '') : '';
      const tries = typed ? [typed] : ['', ...stmtGetPasswords()];
      f.status = 'reading';
      for (const pw of tries) {
        try {
          const res = await StmtParsers.parsePdf(pdfjs, new Uint8Array(buf.slice(0)), pw);
          if (pw && typed) {
            const rem = document.getElementById('stmtRememberPw');
            if (!rem || rem.checked) stmtRememberPassword(pw);
          }
          f.result = res;
          f.status = res.unsupported ? 'unsupported' : 'ok';
          return;
        } catch (e) {
          if (e && e.needPassword) { f.wrong = !!typed; continue; }
          f.status = 'error';
          f.error = (e && e.message) || String(e);
          return;
        }
      }
      f.status = 'needpw';
    }

    async function stmtReadAll() {
      const todo = stmtFiles.filter(f => f.status === 'pending' || f.status === 'needpw');
      if (!todo.length) return;
      let pdfjs;
      try {
        pdfjs = await stmtLoadPdfjs();
      } catch (e) {
        showToast('讀 PDF 的工具載入失敗，請確認網路連線後再試一次', 'error');
        return;
      }
      for (const f of todo) {
        if (f.status === 'needpw' && !(document.getElementById('stmtPw_' + f.id)?.value)) continue;
        await stmtReadOne(f, pdfjs);
        stmtRender();
      }
      stmtRender();
      // 全部讀好、沒有要輸入密碼的，直接進確認畫面
      if (stmtFiles.length && stmtFiles.every(f => ['ok', 'unsupported', 'error'].includes(f.status)) && stmtFiles.some(f => f.status === 'ok')) {
        stmtGoReview();
      }
    }

    function stmtGoReview() {
      stmtStep = 'review';
      stmtBuildItems();
      stmtRender();
      const body = document.getElementById('stmtBody');
      if (body) body.scrollTop = 0;
    }

    /* 測試用：直接給讀好的結果（不經過 PDF） */
    function stmtLoadResultsForTest(results) {
      openStmtImport();
      stmtFiles = results.map((r, i) => ({ id: stmtFileSeq++, name: r.label + '_' + i + '.pdf', status: r.unsupported ? 'unsupported' : 'ok', result: r, file: { size: i } }));
      stmtGoReview();
    }

    /* ================= 2. 對應（帳戶、名稱） ================= */
    function stmtResults() { return stmtFiles.filter(f => f.status === 'ok').map(f => f.result); }

    function stmtAccKey(res, accNo, currency) {
      return res.kind === 'bank' ? `${res.source}|${accNo}|${currency || 'TWD'}` : `${res.source}|${res.account || ''}`;
    }

    // 證券對帳單 → App 的證券帳戶（沒設定過就用券商名稱猜）
    function stmtStockAccount(res) {
      const map = stmtSettingsObj().accountMap;
      const key = stmtAccKey(res);
      if (map[key] && map[key].stockAccount) return map[key].stockAccount;
      const accs = getAllAccounts();
      return accs.includes(res.label) ? res.label : '';
    }

    function stmtBankTarget(res, acc) {
      const m = stmtSettingsObj().accountMap[stmtAccKey(res, acc.accountNo, acc.currency)];
      return m ? m : null; // { financeItemId } 或 { skip:true }
    }

    // 名稱 → App 持股（account 給空字串就在所有帳戶找）
    function stmtSubseq(a, b) { // a 的字依序出現在 b 裡
      let i = 0;
      for (const ch of b) if (ch === a[i]) i++;
      return i === a.length;
    }
    function stmtMatchHolding(name, code, account, pool) {
      const list = (pool || stocks).filter(s => !account || s.account === account);
      const n = stmtNorm(name), c = String(code || '').trim();
      const mapped = stmtSettingsObj().nameMap[n];
      if (mapped) stmtUsedNames.set(n, name);
      if (mapped === STMT_GONE) return { h: null, how: 'gone' };
      if (c) { const h = list.find(s => String(s.code || '').trim() === c); if (h) return { h, how: 'code' }; }
      if (mapped) { const h = list.find(s => stmtNorm(s.name) === stmtNorm(mapped)); if (h) return { h, how: 'map' }; }
      let h = list.find(s => stmtNorm(s.name) === n);
      if (h) return { h, how: 'exact' };
      const guess = list.filter(s => { const sn = stmtNorm(s.name); return sn && n && (stmtSubseq(sn, n) || stmtSubseq(n, sn)); });
      if (guess.length === 1) return { h: guess[0], how: 'guess' };
      return { h: null, how: guess.length > 1 ? 'many' : 'none' };
    }
    // 用對應後的名稱（新增持股、寫紀錄時用）
    function stmtAppName(name, code, account) {
      const m = stmtMatchHolding(name, code, account);
      if (m.h) return m.h.name;
      const mapped = stmtSettingsObj().nameMap[stmtNorm(name)];
      return mapped && mapped !== STMT_GONE ? mapped : name;
    }

    /* ================= 3. 建立確認清單 ================= */
    let stmtItemSeq = 1;
    function stmtItem(o) {
      return Object.assign({ id: stmtItemSeq++, checked: true, group: 'add', edit: [], data: {}, note: '' }, o);
    }

    const STMT_GONE = '__gone';
    const stmtUsedNames = new Map(); // 這次匯入有用到的名稱對應（設定區要留著讓你改）
    function stmtIsGone(name) { return stmtSettingsObj().nameMap[stmtNorm(name)] === STMT_GONE; }
    function stmtBuildItems() {
      stmtItems = [];
      stmtUsedNames.clear();
      const results = stmtResults();
      const imported = new Set((stmtImported || []).map(x => x.statementId));
      const sim = JSON.parse(JSON.stringify(stocks)); // 模擬：照順序套用買賣，算先買先賣成本和月底股數
      const simFind = (account, name, code) => stmtMatchHolding(name, code, account, sim).h;
      const tradeQueue = [];

      // 這次一起匯入的證券對帳單有哪些期間（核對銀行那邊的借券費、權益息用）
      const secPeriods = new Set(results.filter(r => r.kind === 'securities').map(r => r.period));
      const allSecMoney = [];
      results.forEach(r => {
        (r.lendings || []).forEach(l => allSecMoney.push({ date: stmtLendDates(r, l).pay, amount: l.net, kind: 'lendingFee' }));
        (r.compensations || []).forEach(c => allSecMoney.push({ date: c.payDate, amount: c.amount, kind: 'compensation' }));
      });

      // 已匯入過的整份略過
      stmtFiles.filter(f => f.status === 'unsupported').forEach(f => {
        stmtItems.push(stmtItem({ type: 'info', group: 'skip', checked: false, title: f.name, detail: f.result.label }));
      });

      results.forEach(res => {
        const sid = res.statementId;
        const failed = !res.allChecksOk;
        if (imported.has(sid)) {
          stmtItems.push(stmtItem({ type: 'info', group: 'skip', checked: false, title: `${res.label} ${res.period}`, detail: '這份對帳單之前已經匯入過，整份略過' }));
          return;
        }
        const base = { sid, src: res.label, failed };

        if (res.kind === 'securities') {
          const account = stmtStockAccount(res);
          // 買賣
          const day = {};
          (res.trades || []).forEach(t => {
            if (t.mode === 'daytrade') {
              const k = t.date + '|' + stmtNorm(t.name);
              (day[k] = day[k] || { buys: [], sells: [] })[t.side === 'buy' ? 'buys' : 'sells'].push(t);
            } else tradeQueue.push({ res, t, account, base });
          });
          // 當沖：按比例把買進拆給每一筆賣出
          Object.values(day).forEach(g => {
            const bS = g.buys.reduce((s, t) => s + t.shares, 0);
            const sS = g.sells.reduce((s, t) => s + t.shares, 0);
            const bAmt = g.buys.reduce((s, t) => s + t.amount, 0);
            const bFee = g.buys.reduce((s, t) => s + t.fee, 0);
            const avg = bS > 0 ? bAmt / bS : 0;
            const ref = (g.sells[0] || g.buys[0]);
            if (!g.sells.length || !g.buys.length || bS !== sS) {
              stmtItems.push(stmtItem(Object.assign({}, base, {
                type: 'info', group: 'review', checked: false,
                title: `當沖對不起來：${ref.name} ${stmtRoc(ref.date)}`,
                detail: `沖買 ${stmtFmt(bS)} 股、沖賣 ${stmtFmt(sS)} 股，股數不一樣，請自己到「股票賣出」輸入`
              })));
              return;
            }
            let feeLeft = bFee;
            g.sells.forEach((s, si) => {
              const part = s.shares / bS;
              // 買進手續費按比例拆，最後一筆拿剩下的，加起來才會剛好等於對帳單
              const buyFee = si === g.sells.length - 1 ? feeLeft : Math.round(bFee * part);
              feeLeft -= buyFee;
              const name = stmtAppName(s.name, s.code, account);
              const cost = stmtR(s.shares * avg + buyFee);
              const sellAmt = stmtR(s.amount - s.fee - s.tax);
              stmtItems.push(stmtItem(Object.assign({}, base, {
                type: 'daytrade', date: s.date,
                data: { date: stmtRoc(s.date), name, shares: s.shares, buyPrice: stmtR(avg), sellPrice: s.price, buyFee, sellFee: s.fee, tax: s.tax, cost, sellAmt },
                edit: [['name', '名稱', 'text'], ['shares', '股數'], ['buyPrice', '買進價格'], ['sellPrice', '賣出價格'], ['buyFee', '買進手續費'], ['sellFee', '賣出手續費'], ['tax', '交易稅']]
              })));
            });
          });

          // 配股
          (res.stockDividends || []).forEach(d => tradeQueue.push({ res, t: Object.assign({ side: 'stockdiv' }, d), account, base }));

          // 出借合約 → 借卷收入
          const lentByName = {};
          (res.lendings || []).forEach(l => {
            const name = stmtAppName(l.name, '', account);
            const ld = stmtLendDates(res, l);
            lentByName[name] = (lentByName[name] || 0) + (ld.ret ? 0 : l.shares); // 這個月已還券的不算
            const data = {
              name, lendDate: stmtRoc(l.lendDate), lentShares: l.shares, feeRate: l.rate, returnDate: stmtRoc(ld.ret),
              income: l.fee, serviceFee: stmtR((l.serviceFee || 0) + (l.tax || 0)), paymentDate: stmtRoc(ld.pay),
              contractNo: l.contractNo || '', stmtMonth: res.period || ''
            };
            // 重複：同一份合約＋同一個月；舊的手動紀錄沒有合約編號 → 名稱＋出借日＋金額＋入款日差 10 天內
            const same = lendingIncomeRows.find(r => {
              if (r.contractNo && data.contractNo) return String(r.contractNo) === String(data.contractNo) && (r.stmtMonth || String(stmtIsoFromRoc(r.paymentDate)).slice(0, 7)) === (data.stmtMonth || ld.pay.slice(0, 7)) && stmtNorm(r.name) === stmtNorm(name);
              return stmtNorm(r.name) === stmtNorm(name) && String(r.lendDate).replace(/[^0-9]/g, '') === data.lendDate && Math.abs((Number(r.income) || 0) - data.income) < 1 && stmtDaysApart(stmtIsoFromRoc(r.paymentDate), ld.pay) <= 10;
            });
            const dup = !!same;
            stmtItems.push(stmtItem(Object.assign({}, base, {
              type: 'lendIncome', date: l.lendDate, data, dup,
              dupWith: same ? `出借 ${same.lendDate} ${same.name} ${stmtFmt(same.lentShares)}　收入 $${stmtFmt(same.income)}　入款 ${same.paymentDate || '（空白）'}` : '',
              edit: [['name', '出借股票', 'text'], ['lendDate', '出借日期', 'text'], ['returnDate', '還卷日期', 'text'], ['paymentDate', '入款日期', 'text'], ['income', '收入'], ['serviceFee', '服務費']]
            })));
          });
          // 出借張數
          Object.keys(lentByName).forEach(name => {
            const row = stockLending.find(r => stmtNorm(r.name) === stmtNorm(name));
            if (!row && !lentByName[name]) return; // 全部還券、App 也沒這列 → 不用新增
            stmtItems.push(stmtItem(Object.assign({}, base, {
              type: 'lentShares', group: 'update', data: { name, shares: lentByName[name] }, old: row ? Number(row.lentShares) || 0 : null
            })));
          });

          // 權益補償 → 現金股利
          (res.compensations || []).forEach(c => {
            stmtItems.push(stmtItem(Object.assign({}, base, {
              type: 'cashDiv', date: c.payDate, account,
              data: { name: c.name, date: c.payDate, amount: c.amount, how: '權益補償' },
              edit: [['amount', '金額'], ['date', '日期 (YYYY-MM-DD)', 'text']]
            })));
          });

          // 庫存（月底再核對，要等買賣都模擬完）
          if ((res.holdings || []).length) stmtItems.push(stmtItem(Object.assign({}, base, { type: '_holdings', res, account })));
        }

        if (res.kind === 'bank') {
          (res.bankAccounts || []).forEach(a => {
            stmtItems.push(stmtItem(Object.assign({}, base, { type: 'balance', group: 'update', res, acc: a, data: { value: a.balance } , edit: [['value', '餘額']] })));
          });
          (res.cashDividends || []).forEach(d => {
            stmtItems.push(stmtItem(Object.assign({}, base, {
              type: 'cashDiv', date: d.date, account: '',
              data: { name: d.name, date: d.date, amount: d.amount, how: '銀行入帳' },
              edit: [['amount', '金額'], ['date', '日期 (YYYY-MM-DD)', 'text']]
            })));
          });
          (res.refs || []).forEach(rf => {
            const label = rf.type === 'compensation' ? '權益息' : '借券費';
            const match = allSecMoney.find(m => m.kind === rf.type && Math.abs(m.amount - rf.amount) < 1 && stmtDaysApart(m.date, rf.date) <= 10);
            const periodHasSec = secPeriods.has(res.period);
            stmtItems.push(stmtItem(Object.assign({}, base, {
              type: 'info', group: match || !periodHasSec ? 'skip' : 'review', checked: false,
              title: `銀行入帳的${label} $${stmtFmt(rf.amount)}（${stmtRoc(rf.date)}）`,
              detail: match ? '跟證券對帳單核對過，金額相同（證券那邊記帳，這裡不再記）'
                : (periodHasSec ? '證券對帳單裡找不到一樣金額的，請你看一下（可能被扣補充保費）' : '只核對、不記帳（這次沒有一起匯入同月份的證券對帳單）')
            })));
          });
        }
      });

      // 買賣、配股照日期模擬（同一天：買進、配股先，賣出後）
      const order = { buy: 0, stockdiv: 1, sell: 2 };
      tradeQueue.sort((a, b) => (a.t.date || '').localeCompare(b.t.date || '') || order[a.t.side] - order[b.t.side]);
      tradeQueue.forEach(({ t, account, base }) => {
        const name = stmtAppName(t.name, t.code, account);
        if (t.side === 'buy') {
          const cost = stmtR(t.amount + t.fee);
          let h = simFind(account, t.name, t.code);
          if (!h) { h = { id: 'sim' + Math.random(), name, code: t.code || '', account, shares: 0, totalCost: 0, lots: [] }; sim.push(h); }
          sbEnsureLots(h);
          h.lots.push({ id: 'simb', kind: 'buy', date: stmtRoc(t.date), origShares: t.shares, origCost: cost, shares: t.shares, cost });
          sbAdjustHolding(h, t.shares, cost, t.price);
          const exists = !!stmtMatchHolding(t.name, t.code, account).h;
          stmtItems.push(stmtItem(Object.assign({}, base, {
            type: 'buy', date: t.date, account,
            data: { date: stmtRoc(t.date), name, code: t.code || '', shares: t.shares, price: t.price, fee: t.fee, cost, kind: t.mode === 'dca' ? '定期定額' : '一般' },
            newHolding: !exists,
            edit: [['name', '名稱', 'text'], ['shares', '股數'], ['price', '成交價'], ['fee', '手續費'], ['cost', '成本']]
          })));
        } else if (t.side === 'sell') {
          const h = simFind(account, t.name, t.code);
          let est = null;
          if (h) est = fifoSell(h, t.shares, t.price);
          const sellAmt = stmtR(t.amount - t.fee - t.tax);
          stmtItems.push(stmtItem(Object.assign({}, base, {
            type: 'sell', date: t.date, account,
            data: { date: stmtRoc(t.date), name, code: t.code || '', shares: t.shares, sellPrice: t.price, sellFee: t.fee, tax: t.tax, sellAmt, cost: est ? Math.round(est.cost) : '', costEdited: false },
            est, noHolding: !h,
            edit: [['name', '名稱', 'text'], ['shares', '股數'], ['sellPrice', '賣出價格'], ['sellFee', '賣出手續費'], ['tax', '交易稅'], ['cost', '成本']]
          })));
        } else if (t.side === 'stockdiv') {
          const h = simFind(account, t.name, '');
          if (h) addStockDividendLot(h, stmtRoc(t.date), t.shares);
          const real = stmtMatchHolding(t.name, '', account).h;
          const sameDh = real && (real.dividendHistory || []).find(dh => dh.stockDate === t.date && Number(dh.stockShares) === Number(t.shares));
          const dup = !!sameDh;
          stmtItems.push(stmtItem(Object.assign({}, base, {
            type: 'stockDiv', date: t.date, account, dup, noHolding: !real,
            dupWith: sameDh ? `${real.name} 股利紀錄：${stmtRoc(sameDh.stockDate)} 股票股利 ${stmtFmt(sameDh.stockShares)} 股` : '',
            data: { name, date: t.date, shares: t.shares },
            edit: [['shares', '配發股數']]
          })));
        }
      });

      // 庫存核對（用模擬完的股數比）
      const lendUnit = stmtSettingsObj().lendUnit === 'lot' ? 1000 : 1;
      stmtItems.filter(it => it.type === '_holdings').forEach(it => {
        const seen = new Set();
        it.res.holdings.forEach(hd => {
          const h = simFind(it.account, hd.name, hd.code);
          const real = stmtMatchHolding(hd.name, hd.code, it.account).h;
          if (h) seen.add(String(h.id));
          const lent = real ? (Number(real.lentShares) || 0) * lendUnit : 0;
          const want = hd.shares + lent;
          const app = h ? Number(h.shares) || 0 : 0;
          const name = real ? real.name : hd.name;
          if (h && Math.abs(app - want) < 0.001) {
            stmtItems.push(stmtItem(Object.assign({}, { sid: it.sid, src: it.src }, { type: 'info', group: 'skip', checked: false, title: `庫存 ${name} ${stmtFmt(want)} 股`, detail: '跟 App 股數一樣' })));
          } else {
            stmtItems.push(stmtItem(Object.assign({}, { sid: it.sid, src: it.src, failed: it.failed }, {
              type: 'holdingFix', group: 'review', account: it.account, choice: 'statement',
              data: { name, code: hd.code, shares: want, appShares: app, lent, stmtShares: hd.shares }, noHolding: !real
            })));
          }
        });
      });
      stmtItems = stmtItems.filter(it => it.type !== '_holdings');

      // 跟手動輸入過的比對（同一天一樣的交易用筆數比）
      const keyOf = (d, n, s, p) => [d, stmtNorm(n), Number(s) || 0, stmtR(p)].join('|');
      const appRows = {};
      const addRow = (k, txt) => { (appRows[k] = appRows[k] || []).push(txt); };
      stockBuys.forEach(r => addRow('b|' + keyOf(r.date, r.name, r.shares, r.price), `股票買進 ${r.date} ${r.name} ${stmtFmt(r.shares)} 股 @ ${r.price}`));
      stockSales.forEach(r => addRow('s|' + keyOf(r.date, r.name, r.shares, r.sellPrice), `股票賣出 ${r.date} ${r.name} ${stmtFmt(r.shares)} 股 @ ${r.sellPrice}`));
      stmtItems.forEach(it => {
        let k = null;
        if (it.type === 'buy') k = 'b|' + keyOf(it.data.date, it.data.name, it.data.shares, it.data.price);
        if (it.type === 'sell' || it.type === 'daytrade') k = 's|' + keyOf(it.data.date, it.data.name, it.data.shares, it.data.sellPrice);
        if (k && appRows[k] && appRows[k].length) { it.dup = true; it.dupWith = appRows[k].shift(); }
      });

      // 現金股利：找持股、比對手動輸入過的
      stmtItems.filter(it => it.type === 'cashDiv').forEach(it => {
        const m = stmtMatchHolding(it.data.name, '', it.account);
        it.holdingId = m.h ? m.h.id : null;
        it.many = m.how === 'many';
        if (m.h) {
          it.data.name = m.h.name;
          const sameDh = (m.h.dividendHistory || []).find(dh => Math.abs((Number(dh.cash) || 0) - it.data.amount) < 1 && stmtDaysApart(dh.cashDate, it.data.date) <= 7);
          it.dup = !!sameDh;
          it.dupWith = sameDh ? `${m.h.name} 股利紀錄：${sameDh.cashDate} 現金股利 $${stmtFmt(sameDh.cash)}` : '';
        }
      });

      // 分組：可能已輸入 → 略過；有問題 → 需要你看
      stmtItems.forEach(it => {
        if (it.type === 'info') return;
        if (['sell', 'stockDiv', 'cashDiv', 'holdingFix', 'lentShares'].includes(it.type) && stmtIsGone(it.data.name)) {
          it.group = 'skip'; it.checked = false; it.note = '設定成「已經沒有這檔，不用問」'; return;
        }
        if (it.dup) { it.group = 'skip'; it.checked = false; it.note = '可能已經輸入過了'; return; }
        if (it.failed) { it.group = 'review'; it.checked = false; it.note = '這份對帳單自我檢查沒通過，請先確認'; return; }
        if ((it.type === 'sell') && it.noHolding) { it.group = 'review'; it.note = '持股裡找不到這檔，只會記賣出、不會扣持股（成本要自己填）'; }
        if (it.type === 'sell' && it.est && it.est.short > 0) { it.group = 'review'; it.note = `持股不夠，少 ${stmtFmt(it.est.short)} 股`; }
        if (it.type === 'stockDiv' && it.noHolding) { it.group = 'review'; it.checked = false; it.note = '持股裡找不到這檔'; }
        if (it.type === 'cashDiv' && !it.holdingId) { it.group = 'review'; it.checked = false; it.note = it.many ? '好幾個帳戶都有這檔，請在上面設定名稱對應' : '持股裡找不到這檔，請在上面設定名稱對應'; }
        if (it.type === 'holdingFix' && it.noHolding) { it.checked = false; it.note = 'App 持股裡沒有這檔'; }
        if (it.type === 'balance') {
          const t = stmtBankTarget(it.res, it.acc);
          if (!t) { it.group = 'review'; it.checked = false; it.note = '請在上面設定要寫到財務總覽的哪一個項目'; }
          else if (t.skip) { it.group = 'skip'; it.checked = false; it.note = '設定成不匯入'; }
        }
        if (it.type === 'lentShares') {
          if (it.old !== null && Math.abs(it.old - stmtLentDisplay(it.data.shares)) < 0.001) { it.group = 'skip'; it.checked = false; it.note = '出借張數一樣'; }
        }
      });
    }

    // 這筆銀行餘額要寫到財務總覽的哪一格（沒設定或略過就是 null）
    function stmtBalanceKey(it) {
      const t = stmtBankTarget(it.res, it.acc);
      if (!t || t.skip) return null;
      const item = (state.bankItems || []).find(b => String(b.id) === String(t.financeItemId));
      return item ? (item.isUSD ? item.id + '_usd' : item.id) : null;
    }

    function stmtLentDisplay(shares) {
      return stmtSettingsObj().lendUnit === 'lot' ? stmtR(shares / 1000) : shares;
    }

    /* ================= 4. 確認畫面 ================= */
    function stmtNeededSettings() {
      const results = stmtResults();
      const imported = new Set((stmtImported || []).map(x => x.statementId));
      const out = { sec: [], bank: [], names: [], lendUnit: false, financeCol: false };
      const seenNames = new Set();
      results.filter(r => !imported.has(r.statementId)).forEach(r => {
        if (r.kind === 'securities') {
          out.sec.push(r);
          if ((r.lendings || []).length) out.lendUnit = true;
        }
        if (r.kind === 'bank') (r.bankAccounts || []).forEach(a => { out.bank.push({ res: r, acc: a }); out.financeCol = true; });
      });
      stmtItems.forEach(it => {
        if ((it.type === 'cashDiv' && !it.holdingId) || ((it.type === 'sell' || it.type === 'stockDiv' || it.type === 'holdingFix') && it.noHolding)) {
          const n = it.data.name;
          if (stmtIsGone(n)) return;
          if (!seenNames.has(stmtNorm(n))) { seenNames.add(stmtNorm(n)); out.names.push({ name: n, account: it.account || '' }); }
        }
      });
      // 這次有用到、之前設過的名稱對應：也列出來，方便改
      stmtUsedNames.forEach((name, n) => {
        if (!seenNames.has(n)) { seenNames.add(n); out.names.push({ name, account: '', saved: true }); }
      });
      return out;
    }

    function stmtSettingsHtml() {
      const need = stmtNeededSettings();
      const s = stmtSettingsObj();
      const accs = getAllAccounts();
      const rows = [];
      need.sec.forEach(r => {
        const cur = stmtStockAccount(r);
        rows.push(`<div class="stmt-set-row"><span>${stmtEsc(r.label)}（帳號 ${stmtEsc(r.account || '—')}）→ 證券帳戶</span>
          <select onchange="stmtSetSec('${stmtEsc(stmtAccKey(r))}', this.value)">
            ${cur ? '' : '<option value="">請選擇</option>'}
            ${accs.map(a => `<option value="${stmtEsc(a)}" ${a === cur ? 'selected' : ''}>${stmtEsc(a)}</option>`).join('')}
          </select></div>`);
      });
      const items = (typeof state !== 'undefined' && state.bankItems) ? state.bankItems : [];
      need.bank.forEach(({ res, acc }) => {
        const t = stmtBankTarget(res, acc);
        const val = t ? (t.skip ? '__skip' : t.financeItemId) : '';
        rows.push(`<div class="stmt-set-row ${t ? '' : 'need'}"><span>${stmtEsc(res.label)} ${stmtEsc(acc.type || '')} ${stmtEsc(acc.accountNo)}（${stmtEsc(acc.currency)}）→ 財務總覽</span>
          <select onchange="stmtSetBank('${stmtEsc(stmtAccKey(res, acc.accountNo, acc.currency))}', this.value)">
            ${val ? '' : '<option value="">請選擇</option>'}
            ${items.map(b => `<option value="${stmtEsc(b.id)}" ${String(b.id) === String(val) ? 'selected' : ''}>${stmtEsc(b.name)}${b.isUSD ? '（美元）' : ''}</option>`).join('')}
            <option value="__skip" ${val === '__skip' ? 'selected' : ''}>不匯入這個帳戶</option>
          </select></div>`);
      });
      if (need.financeCol) {
        const dates = (typeof state !== 'undefined' && state.dates) ? state.dates : [];
        if (s.financeCol == null || s.financeCol >= dates.length) s.financeCol = dates.length - 1;
        const periods = stmtResults().filter(r => r.kind === 'bank').map(r => r.period).sort();
        rows.push(`<div class="stmt-set-row"><span>銀行餘額寫進財務總覽的日期欄</span>
          <select onchange="stmtSetCol(this.value)">
            ${dates.map((d, i) => `<option value="${i}" ${i === s.financeCol ? 'selected' : ''}>${stmtEsc(d)}</option>`).reverse().join('')}
          </select></div>
          <div class="stmt-set-tip">對帳單月份：${stmtEsc(periods.join('、'))}。如果要寫到新的日期，請先到財務總覽「➕ 新增紀錄時間」。</div>`);
      }
      if (need.lendUnit) {
        rows.push(`<div class="stmt-set-row ${s.lendUnit ? '' : 'need'}"><span>「出借張數」你平常填的是</span>
          <select onchange="stmtSetLendUnit(this.value)">
            ${s.lendUnit ? '' : '<option value="">請選擇</option>'}
            <option value="lot" ${s.lendUnit === 'lot' ? 'selected' : ''}>張（2,000 股填 2）</option>
            <option value="share" ${s.lendUnit === 'share' ? 'selected' : ''}>股（2,000 股填 2000）</option>
          </select></div>`);
      }
      need.names.forEach(({ name, account, saved }) => {
        const cur = s.nameMap[stmtNorm(name)] || '';
        rows.push(`<div class="stmt-set-row ${cur ? '' : 'need'}"><span>對帳單上的「${stmtEsc(name)}」是持股的</span>
          ${stmtNameSelect(stmtNorm(name), cur, account)}</div>`);
      });
      const manage = stmtManageHtml();
      if (!rows.length && !manage) return '';
      return `<div class="stmt-settings"><div class="stmt-sec-title">⚙️ 對應設定（設一次之後會記住）</div>${rows.join('')}${manage}</div>`;
    }
    function stmtNameSelect(n, cur, account) {
      const pool = stocks.filter(st => !account || st.account === account);
      const names = [];
      pool.forEach(st => { if (!names.some(x => x.name === st.name)) names.push(st); });
      const known = !cur || cur === STMT_GONE || names.some(st => st.name === cur);
      return `<select onchange="stmtSetName('${stmtEsc(n)}', this.value)">
            <option value="" ${cur ? '' : 'selected'}>${cur ? '（清除這個設定）' : '請選擇'}</option>
            ${known ? '' : `<option value="${stmtEsc(cur)}" selected>${stmtEsc(cur)}（持股裡找不到）</option>`}
            ${names.map(st => `<option value="${stmtEsc(st.name)}" ${st.name === cur ? 'selected' : ''}>${stmtEsc(st.name)}${account ? '' : '（' + stmtEsc(st.account) + '）'}</option>`).join('')}
            <option value="${STMT_GONE}" ${cur === STMT_GONE ? 'selected' : ''}>已經沒有這檔，不用問</option>
          </select>`;
    }

    // 管理所有記住的設定（這次沒用到的也能改、能刪）
    let stmtManageOpen = false;
    function stmtKeyLabel(key, v) {
      if (v && v.label) return v.label;
      const now = stmtLabelFor(key);
      if (now) return now;
      return String(key).replace(/\|/g, ' ');
    }
    function stmtManageHtml() {
      const s = stmtSettingsObj();
      const accs = getAllAccounts();
      const items = (typeof state !== 'undefined' && state.bankItems) ? state.bankItems : [];
      const secRows = [], bankRows = [], nameRows = [];
      Object.keys(s.accountMap).forEach(key => {
        const v = s.accountMap[key] || {};
        const del = `<button type="button" class="stmt-del-btn" onclick="stmtDelSetting('acc', '${stmtEsc(key)}')">刪除</button>`;
        if (v.stockAccount !== undefined) {
          secRows.push(`<div class="stmt-set-row"><span>${stmtEsc(stmtKeyLabel(key, v))} → 證券帳戶</span><span class="stmt-set-ctl">
            <select onchange="stmtSetSec('${stmtEsc(key)}', this.value)">
              ${accs.includes(v.stockAccount) ? '' : `<option value="${stmtEsc(v.stockAccount)}" selected>${stmtEsc(v.stockAccount)}</option>`}
              ${accs.map(a => `<option value="${stmtEsc(a)}" ${a === v.stockAccount ? 'selected' : ''}>${stmtEsc(a)}</option>`).join('')}
            </select>${del}</span></div>`);
        } else {
          const val = v.skip ? '__skip' : String(v.financeItemId || '');
          bankRows.push(`<div class="stmt-set-row"><span>${stmtEsc(stmtKeyLabel(key, v))} → 財務總覽</span><span class="stmt-set-ctl">
            <select onchange="stmtSetBank('${stmtEsc(key)}', this.value)">
              ${items.map(b => `<option value="${stmtEsc(b.id)}" ${String(b.id) === val ? 'selected' : ''}>${stmtEsc(b.name)}${b.isUSD ? '（美元）' : ''}</option>`).join('')}
              <option value="__skip" ${val === '__skip' ? 'selected' : ''}>不匯入這個帳戶</option>
            </select>${del}</span></div>`);
        }
      });
      Object.keys(s.nameMap).forEach(n => {
        nameRows.push(`<div class="stmt-set-row"><span>「${stmtEsc(n)}」是持股的</span><span class="stmt-set-ctl">
          ${stmtNameSelect(n, s.nameMap[n], '')}
          <button type="button" class="stmt-del-btn" onclick="stmtDelSetting('name', '${stmtEsc(n)}')">刪除</button></span></div>`);
      });
      if (!secRows.length && !bankRows.length && !nameRows.length) return '';
      const sec = (t, r) => r.length ? `<div class="stmt-manage-sub">${t}</div>${r.join('')}` : '';
      return `<details class="stmt-manage" ${stmtManageOpen ? 'open' : ''} ontoggle="stmtManageOpen = this.open">
        <summary>🗂️ 管理所有記住的設定（${secRows.length + bankRows.length + nameRows.length}）</summary>
        <div class="stmt-set-tip">這裡會列出以前設過的全部對應，這次沒用到的也可以改或刪掉。</div>
        ${sec('證券帳戶', secRows)}${sec('銀行帳戶', bankRows)}${sec('股票名稱', nameRows)}
      </details>`;
    }
    function stmtDelSetting(kind, key) {
      const s = stmtSettingsObj();
      if (!confirm('確定要刪掉這個設定嗎？下次匯入會再問你一次。')) return;
      if (kind === 'acc') delete s.accountMap[key]; else delete s.nameMap[key];
      stmtAfterSetting();
    }
    // 存設定時順便記下看得懂的名稱（管理清單用）
    function stmtLabelFor(key) {
      for (const r of stmtResults()) {
        if (r.kind === 'securities' && stmtAccKey(r) === key) return `${r.label}（帳號 ${r.account || '—'}）`;
        if (r.kind === 'bank') for (const a of (r.bankAccounts || [])) {
          if (stmtAccKey(r, a.accountNo, a.currency) === key) return `${r.label} ${a.type || ''} ${a.accountNo}（${a.currency}）`;
        }
      }
      const old = stmtSettingsObj().accountMap[key];
      return old && old.label ? old.label : '';
    }

    function stmtAfterSetting() {
      if (typeof saveToStorage === 'function') saveToStorage();
      stmtBuildItems();
      stmtRender();
    }
    function stmtSetSec(key, acc) { const label = stmtLabelFor(key); stmtSettingsObj().accountMap[key] = Object.assign({ stockAccount: acc }, label ? { label } : {}); stmtAfterSetting(); }
    function stmtSetBank(key, v) { const label = stmtLabelFor(key); stmtSettingsObj().accountMap[key] = Object.assign(v === '__skip' ? { skip: true } : { financeItemId: v }, label ? { label } : {}); stmtAfterSetting(); }
    function stmtSetCol(v) { stmtSettingsObj().financeCol = Number(v); stmtAfterSetting(); }
    function stmtSetLendUnit(v) { stmtSettingsObj().lendUnit = v || undefined; stmtAfterSetting(); }
    function stmtSetName(n, v) { if (v) stmtSettingsObj().nameMap[n] = v; else delete stmtSettingsObj().nameMap[n]; stmtAfterSetting(); }

    // 每一筆顯示的文字
    function stmtDescribe(it) {
      const d = it.data;
      const roc = v => stmtEsc(v || '');
      switch (it.type) {
        case 'buy': return {
          tag: d.kind === '定期定額' ? '定期定額' : '買進', title: `${roc(d.date)} ${stmtEsc(d.name)} ${stmtFmt(d.shares)} 股 @ ${d.price}`,
          detail: `${stmtEsc(it.account)}・成本 $${stmtFmt(d.cost)}（含手續費 ${stmtFmt(d.fee)}）${it.newHolding ? '・持股沒有這檔，會新增一檔' : ''}`, amount: d.cost
        };
        case 'sell': {
          const cost = d.cost === '' || d.cost == null ? null : Number(d.cost);
          const spread = cost != null ? d.sellAmt - cost : null;
          return {
            tag: '賣出', title: `${roc(d.date)} ${stmtEsc(d.name)} ${stmtFmt(d.shares)} 股 @ ${d.sellPrice}`,
            detail: `${stmtEsc(it.account)}・賣出 $${stmtFmt(d.sellAmt)}` + (cost != null ? `・${d.costEdited ? '成本（你改的）' : '先買先賣成本約'} $${stmtFmt(cost)}・損益 ${spread >= 0 ? '+' : ''}${stmtFmt(spread)}・${spread >= 0 ? '獲益' : '認賠'}` : ''),
            amount: d.sellAmt
          };
        }
        case 'daytrade': return {
          tag: '當沖', title: `${roc(d.date)} ${stmtEsc(d.name)} ${stmtFmt(d.shares)} 股 買 ${d.buyPrice} 賣 ${d.sellPrice}`,
          detail: `損益 ${(d.sellAmt - d.cost) >= 0 ? '+' : ''}${stmtFmt(d.sellAmt - d.cost)}（成本 $${stmtFmt(d.cost)}、賣出 $${stmtFmt(d.sellAmt)}）`, amount: d.sellAmt - d.cost
        };
        case 'stockDiv': return { tag: '配股', title: `${stmtEsc(stmtRoc(d.date))} ${stmtEsc(d.name)} 配 ${stmtFmt(d.shares)} 股`, detail: `${stmtEsc(it.account)}・持股股數增加，成本不變` };
        case 'cashDiv': return { tag: '現金股利', title: `${stmtEsc(stmtRoc(d.date))} ${stmtEsc(d.name)} $${stmtFmt(d.amount)}`, detail: `${stmtEsc(d.how)}・記到持股的現金股利`, amount: d.amount };
        case 'lendIncome': return { tag: '借卷收入', title: `${roc(d.lendDate)} ${stmtEsc(d.name)} ${stmtFmt(d.lentShares)} 股`, detail: `收入 $${stmtFmt(d.income)} − 服務費 $${stmtFmt(d.serviceFee)} ＝ 實際 $${stmtFmt(d.income - d.serviceFee)}・入款 ${roc(d.paymentDate)}` + (d.returnDate ? `・這個月還券 ${roc(d.returnDate)}` : '') + (d.contractNo ? `・合約 ${stmtEsc(d.contractNo)}` : ''), amount: d.income - d.serviceFee };
        case 'lentShares': {
          const unit = stmtSettingsObj().lendUnit;
          const nv = stmtLentDisplay(d.shares);
          return { tag: '出借張數', title: `${stmtEsc(d.name)}：${it.old === null ? '（新增一列）' : stmtFmt(it.old, 2)} → ${unit ? stmtFmt(nv, 2) : '?'}`, detail: unit ? `對帳單這個月的出借合約共 ${stmtFmt(d.shares)} 股` : '請先在上面選「張」或「股」' };
        }
        case 'balance': {
          const t = stmtBankTarget(it.res, it.acc);
          const item = t && !t.skip ? (state.bankItems || []).find(b => String(b.id) === String(t.financeItemId)) : null;
          const col = stmtSettingsObj().financeCol;
          const key = item ? (item.isUSD ? item.id + '_usd' : item.id) : null;
          const old = key && state.values[key] ? state.values[key][col] : '';
          // 好幾個銀行帳戶對到財務總覽同一個項目：有勾的加在一起寫進去
          const same = key ? stmtItems.filter(x => x.type === 'balance' && x.checked && stmtBalanceKey(x) === key) : [];
          const sum = same.length > 1 && it.checked ? stmtR(same.reduce((s, x) => s + (Number(x.data.value) || 0), 0)) : null;
          return {
            tag: '餘額', title: `${stmtEsc(it.res.label)} ${stmtEsc(it.acc.accountNo)} ${it.acc.currency === 'USD' ? 'US$' : '$'}${stmtFmt(d.value, it.acc.currency === 'USD' ? 2 : 0)}`,
            detail: item ? `財務總覽「${stmtEsc(item.name)}」${stmtEsc(state.dates[col] || '')}：${old === '' || old == null ? '空白' : stmtFmt(Number(old) || 0, 2)} → ${stmtFmt(sum != null ? sum : d.value, 2)}`
              + (sum != null ? `（${same.length} 個帳戶加總：${same.map(x => stmtEsc(String(x.acc.accountNo).slice(-4)) + ' $' + stmtFmt(x.data.value, 0)).join(' ＋ ')}）` : '') : '還沒設定對應'
          };
        }
        case 'holdingFix': return {
          tag: '庫存核對', title: `${stmtEsc(d.name)}：對帳單 ${stmtFmt(d.shares)} 股${d.lent ? `（庫存 ${stmtFmt(d.stmtShares)}＋出借 ${stmtFmt(d.lent)}）` : ''}，App ${stmtFmt(d.appShares)} 股`,
          detail: `${stmtEsc(it.account)}・App 的股數已經算進這次匯入的買賣`
        };
        default: return { tag: '', title: stmtEsc(it.title || ''), detail: stmtEsc(it.detail || '') };
      }
    }

    function stmtItemHtml(it) {
      const ds = stmtDescribe(it);
      const canCheck = it.type !== 'info';
      const editHtml = it.editing ? `<div class="stmt-edit">${it.edit.map(([k, label, type]) => `
          <label><span>${label}</span><input type="${type === 'text' ? 'text' : 'number'}" step="any" value="${stmtEsc(it.data[k])}" onchange="stmtEditField(${it.id}, '${k}', this.value, '${type || 'num'}')" /></label>`).join('')}</div>` : '';
      const fixHtml = it.type === 'holdingFix' && !it.noHolding ? `
        <div class="stmt-choice">
          <label><input type="radio" name="hf${it.id}" ${it.choice === 'statement' ? 'checked' : ''} onchange="stmtSetChoice(${it.id}, 'statement')" /> 以對帳單為準（改成 ${stmtFmt(it.data.shares)} 股）</label>
          <label><input type="radio" name="hf${it.id}" ${it.choice === 'keep' ? 'checked' : ''} onchange="stmtSetChoice(${it.id}, 'keep')" /> 保留目前數字</label>
        </div>` : '';
      return `
        <div class="stmt-item ${it.checked ? 'on' : ''} ${it.flag ? 'flag' : ''}">
          ${canCheck ? `<input type="checkbox" class="stmt-cb" ${it.checked ? 'checked' : ''} onchange="stmtToggle(${it.id}, this.checked)" />` : '<span class="stmt-cb-space"></span>'}
          <div class="stmt-item-main">
            <div class="stmt-item-title">${ds.tag ? `<span class="stmt-badge t-${it.type}">${ds.tag}</span>` : ''}${ds.title}</div>
            <div class="stmt-item-detail">${ds.detail || ''}</div>
            ${it.note ? `<div class="stmt-item-note">${stmtEsc(it.note)}</div>` : ''}
            ${it.dupWith ? `<div class="stmt-item-dupwith">App 裡已有：${stmtEsc(it.dupWith)}</div>` : ''}
            ${fixHtml}
            ${editHtml}
            ${it.flag ? `<div class="stmt-flag-row">⚠️ 待修改，原因（可不填）：<input type="text" value="${stmtEsc(it.flagNote || '')}" placeholder="例如：成本不對" onchange="stmtSetFlagNote(${it.id}, this.value)" /></div>` : ''}
          </div>
          <div class="stmt-item-btns">
            ${STMT_FLAG_TYPES.includes(it.type) ? `<button class="stmt-flag-btn ${it.flag ? 'on' : ''}" title="${it.flag ? '取消待修改' : '標記待修改（匯入後在分頁提醒你）'}" onclick="stmtToggleFlag(${it.id})">⚠️</button>` : ''}
            ${it.edit.length ? `<button class="stmt-edit-btn" onclick="stmtToggleEdit(${it.id})">${it.editing ? '收起' : '✏️'}</button>` : ''}
          </div>
        </div>`;
    }

    // 每一區裡面照種類排：買進 → 賣出 → 當沖 → 配股 → 現金股利 → 借卷收入 → 出借張數 → 庫存 → 銀行
    const STMT_KINDS = ['buy', 'sell', 'daytrade', 'stockDiv', 'cashDiv', 'lendIncome', 'lentShares', 'holding', 'balance', 'bankref', 'other'];
    const STMT_KIND_LABEL = { buy: '買進', sell: '賣出', daytrade: '當沖', stockDiv: '配股', cashDiv: '現金股利', lendIncome: '借卷收入', lentShares: '出借張數', holding: '庫存', balance: '銀行餘額', bankref: '銀行入帳核對', other: '其他' };
    function stmtKindOf(it) {
      if (it.type === 'holdingFix') return 'holding';
      if (it.type !== 'info') return STMT_KINDS.includes(it.type) ? it.type : 'other';
      const t = String(it.title || '');
      if (t.startsWith('庫存')) return 'holding';
      if (t.startsWith('銀行入帳')) return 'bankref';
      if (t.startsWith('當沖')) return 'daytrade';
      return 'other';
    }
    function stmtReviewHtml() {
      const cards = stmtFiles.map(f => {
        if (f.status === 'ok') {
          const r = f.result;
          const okCnt = r.checks.filter(c => c.ok).length;
          return `<div class="stmt-card ${r.allChecksOk ? '' : 'bad'}"><b>${stmtEsc(r.label)}</b> ${stmtEsc(r.period)}<span>${r.allChecksOk ? `✅ 自我檢查 ${okCnt} 項全部通過` : `⚠️ 自我檢查 ${okCnt}/${r.checks.length} 通過${r.warnings.length ? '，有 ' + r.warnings.length + ' 個提醒' : ''}`}</span></div>`;
        }
        return `<div class="stmt-card muted"><b>${stmtEsc(f.name)}</b><span>${stmtEsc(f.status === 'error' ? '讀取失敗' : (f.result ? f.result.label : ''))}</span></div>`;
      }).join('');
      const groups = [
        ['add', '➕ 新增', '會寫進 App 的新紀錄'],
        ['update', '🔄 更新', '會改掉 App 裡現在的數字'],
        ['review', '👀 需要你看', '有地方對不上，或需要你決定'],
        ['skip', '⏭️ 略過', '已經有了、只核對，或不需要寫入。這區預設不寫入，勾了就會寫入']
      ];
      const gHtml = groups.map(([g, title, tip]) => {
        const list = stmtItems.filter(it => it.group === g);
        if (!list.length) return '';
        const sorted = list.slice().sort((a, b) => STMT_KINDS.indexOf(stmtKindOf(a)) - STMT_KINDS.indexOf(stmtKindOf(b)) || String(a.date || '').localeCompare(String(b.date || '')));
        const open = g !== 'skip' || list.length <= 6;
        let lastKind = null;
        const body = sorted.map(it => {
          const k = stmtKindOf(it);
          let head = '';
          if (k !== lastKind) { lastKind = k; head = `<div class="stmt-subhead">${STMT_KIND_LABEL[k]}（${sorted.filter(x => stmtKindOf(x) === k).length}）</div>`; }
          return head + stmtItemHtml(it);
        }).join('');
        const canCnt = list.filter(it => it.type !== 'info').length;
        const btns = canCnt ? `<span class="stmt-group-btns"><button type="button" onclick="event.preventDefault(); event.stopPropagation(); stmtGroupCheck('${g}', true)">全選</button><button type="button" onclick="event.preventDefault(); event.stopPropagation(); stmtGroupCheck('${g}', false)">全不選</button></span>` : '';
        return `<details class="stmt-group g-${g}" ${open ? 'open' : ''}><summary><span class="stmt-sec-title">${title}（${list.length}）</span><span class="stmt-group-tip">${tip}</span>${btns}</summary>${body}</details>`;
      }).join('');
      return `<div class="stmt-cards">${cards}</div>${stmtSettingsHtml()}${gHtml || '<div class="stmt-empty">沒有要匯入的內容</div>'}`;
    }

    function stmtReviewFoot() {
      const n = stmtItems.filter(it => it.checked).length;
      return `
        <button class="btn" onclick="stmtStep = (typeof stmtPendingActive !== 'undefined' && stmtPendingActive.length) ? 'pending' : 'pick'; stmtRender();">← 回上一步</button>
        <button class="btn btn-primary" ${n ? '' : 'disabled'} onclick="stmtApply()">確認寫入（${n} 筆）</button>`;
    }

    function stmtFind(id) { return stmtItems.find(it => it.id === id); }
    const STMT_FLAG_TYPES = ['buy', 'sell', 'daytrade', 'lendIncome'];
    function stmtToggleFlag(id) { const it = stmtFind(id); if (!it) return; it.flag = !it.flag; if (it.flag && !it.checked) it.checked = true; stmtRefreshKeepScroll(); }
    function stmtSetFlagNote(id, v) { const it = stmtFind(id); if (it) it.flagNote = v; }
    function stmtGroupCheck(g, v) { stmtItems.forEach(it => { if (it.group === g && it.type !== 'info') it.checked = v; }); stmtRefreshKeepScroll(); }
    function stmtToggle(id, v) { const it = stmtFind(id); if (it) it.checked = v; stmtRefreshKeepScroll(); }
    function stmtToggleEdit(id) { const it = stmtFind(id); if (it) it.editing = !it.editing; stmtRefreshKeepScroll(); }
    function stmtSetChoice(id, v) { const it = stmtFind(id); if (it) it.choice = v; }
    function stmtEditField(id, k, v, type) {
      const it = stmtFind(id);
      if (!it) return;
      it.data[k] = type === 'text' ? String(v).trim() : (parseFloat(v) || 0);
      const d = it.data;
      if (it.type === 'buy' && k !== 'cost' && k !== 'name') d.cost = stmtR(d.shares * d.price + d.fee);
      if (it.type === 'sell' && k === 'cost') d.costEdited = true;
      else if (it.type === 'sell' && k !== 'name') {
        d.sellAmt = stmtR(d.shares * d.sellPrice - d.sellFee - d.tax);
        if (k === 'shares') {
          const h = stmtMatchHolding(d.name, d.code, it.account).h;
          it.est = h ? fifoPreview(h, d.shares) : null;
          if (!d.costEdited) d.cost = it.est ? Math.round(it.est.cost) : '';
        }
      }
      if (it.type === 'daytrade') { d.cost = stmtR(d.shares * d.buyPrice + d.buyFee); d.sellAmt = stmtR(d.shares * d.sellPrice - d.sellFee - d.tax); }
      stmtRefreshKeepScroll();
    }
    function stmtRefreshKeepScroll() {
      const body = document.getElementById('stmtBody');
      const top = body ? body.scrollTop : 0;
      stmtRender();
      if (body) body.scrollTop = top;
    }

    /* ================= 5. 寫入 ================= */
    function stmtApply() {
      const chosen = stmtItems.filter(it => it.checked);
      if (!chosen.length) return;
      if (chosen.some(it => it.type === 'lentShares') && !stmtSettingsObj().lendUnit) { showToast('請先在上面選「出借張數」是張還是股', 'error'); return; }
      if (chosen.some(it => it.type === 'balance' && !stmtBankTarget(it.res, it.acc))) { showToast('有銀行帳戶還沒設定對應', 'error'); return; }
      if (chosen.some(it => it.type === 'balance')) {
        const col = stmtSettingsObj().financeCol;
        if (!(state.dates || []).length || col == null || col < 0 || col >= state.dates.length) { showToast('財務總覽還沒有日期欄，請先到財務總覽按「➕ 新增紀錄時間」，再回來匯入', 'error'); return; }
      }

      // 備份（復原用）：股票資料＋財務總覽
      const backup = { at: new Date().toISOString(), stock: JSON.parse(JSON.stringify(gatherAllData())), finance: JSON.parse(JSON.stringify(state)) };
      try { localStorage.setItem(STMT_BACKUP_KEY, JSON.stringify(backup)); } catch (e) { /* 太大就只留在記憶體 */ }
      window.__stmtLastBackup = backup;
      recordSnapshot();

      const counts = {};
      const bump = k => { counts[k] = (counts[k] || 0) + 1; };
      const problems = [];
      // 寫入順序：餘額 → 依日期的買賣／股利／借券（同一天買進、配股先，賣出後）→ 出借張數 → 庫存修正
      const bucket = { balance: 0, lentShares: 2, holdingFix: 3 };
      const order = { buy: 1, stockDiv: 2, sell: 3, daytrade: 4, cashDiv: 5, lendIncome: 6 };
      const list = chosen.slice().sort((a, b) => ((bucket[a.type] ?? 1) - (bucket[b.type] ?? 1))
        || String(a.date || '').localeCompare(String(b.date || '')) || ((order[a.type] || 0) - (order[b.type] || 0)));
      let financeChanged = false;
      const balanceSum = {}; // 同一個項目有好幾個帳戶 → 加總

      list.forEach(it => {
        const d = it.data;
        const todo = it.flag ? (String(it.flagNote || '').trim() || '待修改') : '';
        try {
          if (it.type === 'buy') {
            const br = addStockBuy({ date: d.date, account: it.account, name: d.name, code: d.code, shares: d.shares, price: d.price, fee: d.fee, cost: d.cost, type: d.kind, note: '', source: it.sid });
            if (todo) br.todo = todo;
            bump('買進');
          } else if (it.type === 'sell') {
            const h = stmtMatchHolding(d.name, d.code, it.account).h;
            const r = h ? fifoSell(h, d.shares, d.sellPrice) : null;
            const userCost = d.costEdited && d.cost !== '' && d.cost != null ? Number(d.cost) || 0 : null;
            const cost = userCost != null ? userCost : (r ? Math.round(r.cost) : '');
            const row = { date: d.date, name: d.name, shares: d.shares, buyPrice: '', sellPrice: d.sellPrice, cost, sellAmt: d.sellAmt, spread: 0, returnRate: 0, buyFee: '', sellFee: d.sellFee, tax: d.tax, status: '', dayTotal: null, note: '', note2: '', source: it.sid };
            if (r) {
              row.fifo = { holdingId: h.id, account: h.account, shares: r.shares, cost: r.cost };
              // 你改了成本 → 持股也改成扣你填的成本（差額算在剩下最早的那一批）
              if (userCost != null && Math.abs(userCost - r.cost) > 0.001) {
                if ((Number(h.shares) || 0) > 0) {
                  h.totalCost = Math.max(0, stmtR((Number(h.totalCost) || 0) - (userCost - r.cost)));
                  sbEnsureLots(h);
                }
                row.fifo.cost = userCost;
              }
            }
            if (Number(row.cost) > 0) { row.spread = row.sellAmt - row.cost; row.returnRate = row.spread / row.cost; row.status = row.spread >= 0 ? '獲益' : '認賠'; }
            if (r && r.short > 0) problems.push(`${d.name} 持股不夠，少 ${stmtFmt(r.short)} 股`);
            if (todo) row.todo = todo;
            stockSales.push(row);
            bump('賣出');
          } else if (it.type === 'daytrade') {
            const row = { date: d.date, name: d.name, shares: d.shares, buyPrice: d.buyPrice, sellPrice: d.sellPrice, cost: d.cost, sellAmt: d.sellAmt, spread: stmtR(d.sellAmt - d.cost), returnRate: d.cost > 0 ? (d.sellAmt - d.cost) / d.cost : 0, buyFee: d.buyFee, sellFee: d.sellFee, tax: d.tax, status: '當沖', dayTotal: null, note: '', note2: '', source: it.sid };
            if (todo) row.todo = todo;
            stockSales.push(row);
            bump('當沖');
          } else if (it.type === 'stockDiv') {
            const h = stmtMatchHolding(d.name, '', it.account).h;
            if (!h) { problems.push(`配股 ${d.name} 找不到持股`); return; }
            addStockDividendLot(h, stmtRoc(d.date), d.shares, '配股');
            h.dividendHistory = h.dividendHistory || [];
            h.dividendHistory.push({ year: Number(String(d.date).slice(0, 4)), cashDate: '', cash: 0, stockDate: d.date, stockShares: d.shares, source: it.sid });
            stmtRecalcDividends(h);
            bump('配股');
          } else if (it.type === 'cashDiv') {
            const h = stocks.find(s => String(s.id) === String(it.holdingId)) || stmtMatchHolding(d.name, '', it.account).h;
            if (!h) { problems.push(`現金股利 ${d.name} 找不到持股`); return; }
            h.dividendHistory = h.dividendHistory || [];
            h.dividendHistory.push({ year: Number(String(d.date).slice(0, 4)), cashDate: d.date, cash: d.amount, stockDate: '', stockShares: 0, source: it.sid });
            stmtRecalcDividends(h);
            bump('現金股利');
          } else if (it.type === 'lendIncome') {
            lendingIncomeRows.push({ todo: todo || undefined, id: Date.now() + Math.floor(Math.random() * 100000), name: d.name, lendDate: d.lendDate, lentShares: stmtLentDisplay(d.lentShares), feeRate: d.feeRate, returnDate: d.returnDate, income: d.income, serviceFee: d.serviceFee, paymentDate: d.paymentDate, contractNo: d.contractNo || '', stmtMonth: d.stmtMonth || '', source: it.sid });
            bump('借卷收入');
          } else if (it.type === 'lentShares') {
            const v = stmtLentDisplay(d.shares);
            const row = stockLending.find(r => stmtNorm(r.name) === stmtNorm(d.name));
            if (row) row.lentShares = v; else stockLending.push({ id: Date.now() + Math.floor(Math.random() * 100000), name: d.name, lentShares: v, cost: 0 });
            bump('出借張數');
          } else if (it.type === 'holdingFix') {
            if (it.choice !== 'statement') return;
            const h = stmtMatchHolding(d.name, d.code, it.account).h;
            if (!h) return;
            sbAdjustHolding(h, d.shares - (Number(h.shares) || 0), 0);
            bump('庫存修正');
          } else if (it.type === 'balance') {
            const t = stmtBankTarget(it.res, it.acc);
            const item = (state.bankItems || []).find(b => String(b.id) === String(t.financeItemId));
            if (!item) { problems.push(`財務總覽找不到帳戶 ${it.acc.accountNo} 對應的項目`); return; }
            const bKey = item.isUSD ? item.id + '_usd' : item.id;
            balanceSum[bKey] = stmtR((balanceSum[bKey] || 0) + (Number(d.value) || 0));
            setRawVal(bKey, stmtSettingsObj().financeCol, balanceSum[bKey]);
            financeChanged = true;
            bump('銀行餘額');
          }
        } catch (e) {
          console.error(e);
          problems.push(`${stmtDescribe(it).title.replace(/<[^>]+>/g, '')}：${e.message}`);
        }
      });

      if (typeof syncLentSharesToHoldings === 'function') syncLentSharesToHoldings();
      yfAutoSortByDate(stockSales, 'date');
      recalcSalesDayTotals();

      // 記下匯入過的對帳單（同一份不會再匯一次）
      const sids = new Set(list.map(it => it.sid).filter(Boolean));
      stmtResults().forEach(r => {
        if (!sids.has(r.statementId)) return;
        stmtImported.push({ statementId: r.statementId, label: r.label, period: r.period, importedAt: new Date().toISOString() });
      });

      saveToStorage();
      if (financeChanged) { saveState(); if (typeof render === 'function') render(); }
      renderTabs();
      renderTable();

      stmtDoneInfo = { counts, problems, flagged: list.filter(it => it.flag && STMT_FLAG_TYPES.includes(it.type)).length };
      stmtStep = 'done';
      stmtItems = [];
      stmtRender();
      // 從「📬 待確認」來的：寫好了就從待確認拿掉
      if (typeof stmtPendingAfterApply === 'function') stmtPendingAfterApply();
    }

    function stmtRecalcDividends(h) {
      h.cashDividends = (h.dividendHistory || []).reduce((s, x) => s + (Number(x.cash) || 0), 0);
      h.stockShares = (h.dividendHistory || []).reduce((s, x) => s + (Number(x.stockShares) || 0), 0);
    }

    function stmtDoneHtml() {
      const c = stmtDoneInfo ? stmtDoneInfo.counts : {};
      const p = stmtDoneInfo ? stmtDoneInfo.problems : [];
      const lines = Object.keys(c).map(k => `<li>${stmtEsc(k)}：${c[k]} 筆</li>`).join('');
      return `
        <div class="stmt-done">
          <div class="stmt-done-big">✅ 匯入完成</div>
          <ul>${lines || '<li>沒有寫入任何資料</li>'}</ul>
          ${stmtDoneInfo && stmtDoneInfo.flagged ? `<div class="stmt-item-note">⚠️ 有 ${stmtDoneInfo.flagged} 筆標了「待修改」，在各分頁會整列標紅，改好後點那一列的 ⚠️ 取消</div>` : ''}
          ${p.length ? `<div class="stmt-item-note">有 ${p.length} 個地方沒寫進去：<br>${p.map(stmtEsc).join('<br>')}</div>` : ''}
          <button class="btn" style="margin-top:14px;" onclick="stmtUndoLast()">↩️ 復原這次匯入</button>
          <div class="stmt-set-tip">按下去會把股票管理和財務總覽，整個回到這次匯入前的樣子。</div>
        </div>`;
    }

    function stmtUndoLast() {
      let backup = window.__stmtLastBackup;
      if (!backup) { try { backup = JSON.parse(localStorage.getItem(STMT_BACKUP_KEY) || 'null'); } catch (e) { backup = null; } }
      if (!backup) { showToast('找不到上一次匯入前的備份', 'error'); return; }
      if (!confirm('確定要復原嗎？股票管理和財務總覽會回到這次匯入前的樣子（匯入之後你自己改的也會一起不見）。')) return;
      applyAllData(backup.stock);
      saveToStorage();
      if (backup.finance) { state = backup.finance; saveState(); if (typeof render === 'function') render(); }
      window.__stmtLastBackup = null;
      try { localStorage.removeItem(STMT_BACKUP_KEY); } catch (e) { /* 略過 */ }
      showToast('已復原這次匯入');
      if (typeof stmtPendingAfterUndo === 'function') stmtPendingAfterUndo();
      closeStmtImport();
    }


/* ====================================================================
   「⚠️ 待修改」標記：匯入時標的那幾筆，在股票買進／股票賣出／借卷收入分頁整列標紅
   ==================================================================== */
    function todoList(name) {
      return name === 'buys' ? stockBuys : name === 'sales' ? stockSales : name === 'lending' ? lendingIncomeRows : [];
    }
    function todoRowAttr(r, bg) {
      if (r && r.todo) return ` class="row-todo" style="background:#fbe1d8;"`;
      return bg ? ` style="background:${bg};"` : '';
    }
    function todoFlagBtn(name, r) {
      if (!r || !r.todo) return '';
      const i = todoList(name).indexOf(r);
      return `<button class="todo-flag" title="待修改：${stmtEsc(r.todo)}（改好後點這裡取消標記）" onclick="todoClear('${name}', ${i})">⚠️</button>`;
    }
    function todoBannerRow(name, thead) {
      const list = todoList(name).filter(r => r && r.todo);
      if (!list.length) return '';
      let cols = 1;
      const hr = thead && thead.rows && thead.rows[thead.rows.length - 1];
      if (hr) cols = Array.from(hr.cells).reduce((s, c) => s + (c.colSpan || 1), 0);
      const items = list.slice(0, 5).map(r => `${stmtEsc(r.date || r.lendDate || '')} ${stmtEsc(r.name || '')}：${stmtEsc(r.todo)}`).join('、');
      return `<tr class="todo-banner"><td colspan="${cols}">⚠️ 有 <b>${list.length}</b> 筆待修改（${items}${list.length > 5 ? '…' : ''}）。改好後點那一列的 ⚠️ 取消標記。
        <button type="button" onclick="todoJump()">跳到第一筆</button></td></tr>`;
    }
    function todoClear(name, i) {
      const r = todoList(name)[i];
      if (!r || !r.todo) return;
      if (!confirm(`這筆改好了嗎？\n（${r.todo}）\n\n按確定會取消「待修改」標記。`)) return;
      if (typeof recordSnapshot === 'function') recordSnapshot();
      delete r.todo;
      if (typeof saveToStorage === 'function') saveToStorage();
      if (typeof renderTable === 'function') renderTable();
    }
    function todoJump() {
      const el = document.querySelector('tr.row-todo');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
