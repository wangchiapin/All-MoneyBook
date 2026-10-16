/* ====================================================================
   對帳單「📬 待確認」（第 6 步，App 這邊）
   - 自動程式（GitHub 私人倉庫，每週一凌晨 3 點）從 Gmail 拿對帳單 PDF、讀好，
     放進 Firestore：stmtPending/{使用者}/items/{一份一筆}
   - 這裡負責：標題列按鈕（有待確認才出現、顯示數字）、待確認清單、
     選好的幾份一起送進原本的確認畫面；寫入後從待確認拿掉，「復原這次匯入」會放回去
   - 自動程式只會「放進待確認」，一定要在這裡按寫入才會改到帳

   每一筆的資料：
     { createdAt, mailDate, mailSubject, mailFrom, fileName,
       status: 'ok' | 'needpw' | 'error' | 'unsupported',
       label, period, allChecksOk, resultJson（讀取結果，JSON 文字）, error }
   需要 shared.js（fbDb、fbUser）、stmt-import.js
   ==================================================================== */

    const STMT_PENDING_COLLECTION = 'stmtPending';
    let stmtPendingList = [];      // 從雲端讀來的待確認 [{ id, ...資料 }]
    let stmtPendingPicked = {};    // 清單上勾了哪幾份 { id: true }
    let stmtPendingActive = [];    // 這次送進確認畫面的那幾份（寫入後要刪掉、復原時放回去）
    let stmtPendingRemoved = [];   // 上一次寫入時拿掉的（復原用）
    let stmtPendingLoading = false;

    function stmtPendingCol() {
      if (typeof fbDb === 'undefined' || !fbDb || typeof fbUser === 'undefined' || !fbUser) return null;
      return fbDb.collection(STMT_PENDING_COLLECTION).doc(fbUser.uid).collection('items');
    }

    function stmtPendingResult(p) {
      if (p._result !== undefined) return p._result;
      try { p._result = p.resultJson ? JSON.parse(p.resultJson) : null; } catch (e) { p._result = null; }
      return p._result;
    }

    function stmtPendingIsImported(p) {
      const r = stmtPendingResult(p);
      return !!(r && (stmtImported || []).some(x => x.statementId === r.statementId));
    }

    /* ---------------- 讀雲端、更新按鈕 ---------------- */
    async function stmtPendingRefresh() {
      const col = stmtPendingCol();
      if (!col) { stmtPendingList = []; stmtPendingUpdateBtn(); return; }
      stmtPendingLoading = true;
      try {
        const snap = await col.get();
        const list = [];
        snap.forEach(doc => list.push(Object.assign({ id: doc.id }, doc.data())));
        list.sort((a, b) => String(b.mailDate || b.createdAt || '').localeCompare(String(a.mailDate || a.createdAt || '')));
        stmtPendingList = list;
      } catch (e) {
        console.warn('讀取待確認失敗', e);
      } finally {
        stmtPendingLoading = false;
      }
      stmtPendingUpdateBtn();
      if (stmtStep === 'pending' && document.getElementById('stmtOverlay')?.classList.contains('open')) stmtRender();
    }

    function stmtPendingUpdateBtn() {
      const btn = document.getElementById('stmtPendingBtn');
      if (!btn) return;
      // 「不是對帳單、已略過」的不算數字，也不會單獨讓按鈕出現
      const n = stmtPendingList.filter(p => p.status !== 'unsupported').length;
      btn.style.display = n ? '' : 'none';
      btn.innerHTML = `📬 待確認 <span class="stmt-pending-num">${n}</span>`;
      // 手機的 ⋯ 按鈕上也點一個紅點，提醒裡面有待確認
      document.getElementById('mbHeaderMore')?.classList.toggle('has-pending', n > 0);
    }

    async function stmtPendingDelete(id) {
      const col = stmtPendingCol();
      if (!col) throw new Error('沒有登入雲端');
      await col.doc(id).delete();
      stmtPendingList = stmtPendingList.filter(p => p.id !== id);
    }

    function stmtPendingClean(p) {
      const o = Object.assign({}, p);
      delete o.id; delete o._result;
      return o;
    }

    /* ---------------- 清單畫面 ---------------- */
    function openStmtPending() {
      if (!stmtPendingCol()) { showToast('要先登入雲端同步，才看得到待確認的對帳單', 'error'); return; }
      openStmtImport();
      stmtStep = 'pending';
      stmtPendingPicked = {};
      stmtPendingList.forEach(p => { if (p.status === 'ok' && !stmtPendingIsImported(p)) stmtPendingPicked[p.id] = true; });
      const t = document.querySelector('#stmtOverlay .stmt-title');
      if (t) t.textContent = '📬 待確認的對帳單';
      stmtRender();
      stmtPendingRefresh().then(() => {
        // 重新讀到的新項目，可以讀的也預設勾起來
        stmtPendingList.forEach(p => { if (!(p.id in stmtPendingPicked) && p.status === 'ok' && !stmtPendingIsImported(p)) stmtPendingPicked[p.id] = true; });
        if (stmtStep === 'pending') stmtRender();
      });
    }

    function stmtPendingDateText(s) {
      if (!s) return '';
      const d = new Date(s);
      if (isNaN(d)) return String(s);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    function stmtPendingRowHtml(p) {
      const r = stmtPendingResult(p);
      const done = stmtPendingIsImported(p);
      const mail = [p.mailDate ? `${stmtPendingDateText(p.mailDate)} 收到` : '', p.fileName || ''].filter(Boolean).map(stmtEsc).join('・');
      let tag = '', cb = '<span class="stmt-cb-space"></span>';
      if (p.status === 'ok' && r) {
        tag = done
          ? '<span class="stmt-tag">之前已經匯入過</span>'
          : `<span class="stmt-tag ${p.allChecksOk ? 'ok' : 'bad'}">${p.allChecksOk ? '自我檢查通過' : '自我檢查沒通過，要仔細看'}</span>`;
        cb = `<input type="checkbox" class="stmt-cb" ${stmtPendingPicked[p.id] ? 'checked' : ''} onchange="stmtPendingPick('${p.id}', this.checked)">`;
      } else if (p.status === 'needpw') {
        tag = '<span class="stmt-tag bad">打不開：存好的密碼都不對</span>';
      } else {
        tag = `<span class="stmt-tag bad">讀取失敗：${stmtEsc(p.error || '不明原因')}</span>`;
      }
      const title = r && p.status === 'ok' ? `${stmtEsc(r.label || p.label)} ${stmtEsc(r.period || p.period || '')}` : stmtEsc(p.label || p.fileName || '對帳單');
      const hint = p.status === 'needpw' || p.status === 'error'
        ? '<div class="stmt-set-tip">可以到 Gmail 下載這份 PDF，用「📥 匯入對帳單」自己匯入，再按「丟掉」。</div>' : '';
      return `
        <div class="stmt-item ${p.status === 'ok' && stmtPendingPicked[p.id] ? 'on' : ''}">
          ${cb}
          <div class="stmt-item-main">
            <div class="stmt-item-title">${title}</div>
            <div class="stmt-item-detail">${mail}</div>
            <div style="margin-top:4px;">${tag}</div>
            ${hint}
          </div>
          <button class="stmt-edit-btn" onclick="stmtPendingDiscard('${p.id}')">丟掉</button>
        </div>`;
    }

    function stmtPendingHtml() {
      const main = stmtPendingList.filter(p => p.status !== 'unsupported');
      const skipped = stmtPendingList.filter(p => p.status === 'unsupported');
      const loading = stmtPendingLoading && !stmtPendingList.length ? '<div class="stmt-empty">讀取中…</div>' : '';
      const mainHtml = main.length
        ? `<div class="stmt-group g-add"><div class="stmt-pending-head"><span class="stmt-sec-title">收到的對帳單（${main.length}）</span><span class="stmt-group-tip">勾起來的會一起進確認畫面</span></div>${main.map(stmtPendingRowHtml).join('')}</div>`
        : (loading || '<div class="stmt-empty">沒有待確認的對帳單 🎉</div>');
      const skipHtml = skipped.length ? `
        <div class="stmt-pending-skip">
          <div>信裡另外有 ${skipped.length} 個不是對帳單的 PDF，已經略過：</div>
          <div class="stmt-set-tip">${skipped.map(p => `${stmtEsc(p.fileName || '')}${p.mailSubject ? `（${stmtEsc(p.mailSubject)}）` : ''}`).join('<br>')}</div>
          <button class="stmt-edit-btn" style="margin-top:6px;" onclick="stmtPendingClearSkipped()">清掉這幾行</button>
        </div>` : '';
      return `
        <div class="stmt-step-hint">每週一凌晨 3 點，會自動從 Gmail 有「對帳單」標籤的信拿 PDF 來讀，放在這裡等你確認。<br>還沒按「確認寫入」之前，你的帳都不會被改。</div>
        ${mainHtml}${skipHtml}`;
    }

    function stmtPendingFoot() {
      const n = stmtPendingList.filter(p => stmtPendingPicked[p.id] && p.status === 'ok').length;
      return `
        <button class="btn" onclick="closeStmtImport()">關閉</button>
        <button class="btn btn-primary" ${n ? '' : 'disabled'} onclick="stmtPendingGoReview()">確認內容（${n} 份）→</button>`;
    }

    function stmtPendingPick(id, v) { stmtPendingPicked[id] = v; stmtRender(); }

    async function stmtPendingDiscard(id) {
      const p = stmtPendingList.find(x => x.id === id);
      if (!p) return;
      const name = stmtPendingResult(p) ? `${stmtPendingResult(p).label} ${stmtPendingResult(p).period || ''}` : (p.fileName || '這份');
      if (!confirm(`確定丟掉「${name}」嗎？\n只會從待確認拿掉，Gmail 的信不會動，你的帳也不會改。`)) return;
      try { await stmtPendingDelete(id); } catch (e) { showToast('丟掉失敗：' + e.message, 'error'); return; }
      delete stmtPendingPicked[id];
      stmtPendingUpdateBtn();
      stmtRender();
    }

    async function stmtPendingClearSkipped() {
      const ids = stmtPendingList.filter(p => p.status === 'unsupported').map(p => p.id);
      try { for (const id of ids) await stmtPendingDelete(id); } catch (e) { showToast('清除失敗：' + e.message, 'error'); }
      stmtPendingUpdateBtn();
      stmtRender();
    }

    /* ---------------- 送進原本的確認畫面 ---------------- */
    function stmtPendingGoReview() {
      const chosen = stmtPendingList.filter(p => stmtPendingPicked[p.id] && p.status === 'ok' && stmtPendingResult(p));
      if (!chosen.length) return;
      stmtFiles = chosen.map(p => {
        const r = stmtPendingResult(p);
        return { id: stmtFileSeq++, name: p.fileName || (r.label + '.pdf'), status: r.unsupported ? 'unsupported' : 'ok', result: r, file: { size: 0 }, pendingId: p.id };
      });
      stmtPendingActive = chosen;
      stmtGoReview();
    }

    // stmtApply 寫完後呼叫：把這次用掉的從待確認拿掉
    async function stmtPendingAfterApply() {
      if (!stmtPendingActive.length) { stmtPendingRemoved = []; return; }
      const used = stmtPendingActive;
      stmtPendingActive = [];
      stmtPendingRemoved = [];
      for (const p of used) {
        try { await stmtPendingDelete(p.id); stmtPendingRemoved.push(p); }
        catch (e) { console.warn('從待確認拿掉失敗', e); }
      }
      stmtPendingUpdateBtn();
    }

    // 「復原這次匯入」後呼叫：剛剛拿掉的放回待確認
    async function stmtPendingAfterUndo() {
      const back = stmtPendingRemoved;
      stmtPendingRemoved = [];
      if (!back.length) return;
      const col = stmtPendingCol();
      if (!col) return;
      for (const p of back) {
        try { await col.doc(p.id).set(stmtPendingClean(p)); } catch (e) { console.warn('放回待確認失敗', e); }
      }
      await stmtPendingRefresh();
    }

    /* ---------------- 什麼時候去雲端看一下 ---------------- */
    if (typeof fbAuth !== 'undefined' && fbAuth) {
      fbAuth.onAuthStateChanged(user => {
        if (user) stmtPendingRefresh();
        else { stmtPendingList = []; stmtPendingUpdateBtn(); }
      });
    }
    // 切回這個分頁（例如手機從別的 App 回來）時再看一次
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && stmtPendingCol()) stmtPendingRefresh();
    });
