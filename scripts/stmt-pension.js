/* ====================================================================
   公教／私校退撫儲金對帳單 → 退休試算的專戶餘額、財務總覽的一個項目
   讀對帳單（圖片型，用 OCR）在共用的 stmt-parsers.js；這個檔案只管「確認畫面怎麼顯示、寫到哪裡」。
   接在 stmt-import.js 的確認畫面裡：
     stmtPensionBuildItems(results, imported) ← stmtBuildItems 呼叫
     stmtPensionDescribe(it)                  ← 確認畫面顯示
     stmtPensionSettingsRows(results)         ← 「對應設定」多兩列
     stmtPensionApply(it, bump, problems)     ← stmtApply 寫入
   寫到哪裡由你在「對應設定」選（記住之後不用再選）：
     ‧ 退休試算：把某個專戶的「目前餘額」改成帳戶價值（萬元）；也可以新增一個專戶（名稱就是對帳單的名稱）
     ‧ 財務總覽：把帳戶價值寫進某個項目的目前日期欄
   兩個都可以選、也可以只選一個。累積提存、單位數、淨值、本月提存只顯示、不寫入。
   需要 stmt-import.js；退休試算（retirement.js）有的話才寫專戶餘額，沒有就只寫財務總覽（All-MoneyBook 沒有退休試算）
   ==================================================================== */

const STMT_PEN_NEW = '__new';

function stmtPenKey(res) { return stmtAccKey(res); }
function stmtPenMap(res) {
  const m = stmtSettingsObj().accountMap[stmtPenKey(res)] || {};
  return m;
}
// 沒設定過：試著用名字猜退休試算裡的專戶（含「公教」或「退撫」）
function stmtPenRetAccountId(res) {
  const m = stmtPenMap(res);
  if (m.retAccountId !== undefined) return m.retAccountId;
  if (typeof retirementSettings === 'undefined') return '';
  const accs = retirementSettings.accounts || [];
  // 私校的先找名字有「私校」的，公教的先找「公教」；都沒有再找「退撫」（兩份對帳單不要猜到同一個專戶）
  const first = res.source === 'pension_private' ? /私校/ : /公教/;
  const a = accs.find(x => first.test(x.name || '')) || accs.find(x => /退撫/.test(x.name || '') && !(res.source === 'pension_private' ? /公教/ : /私校/).test(x.name || ''));
  return a ? a.id : '';
}
// 財務總覽的項目：'bank:12' 這種格式
function stmtPenFinanceItems() {
  const out = [];
  if (typeof state === 'undefined') return out;
  [['bank', 'bankItems', '銀行'], ['insurance', 'insuranceItems', '保險'], ['stock', 'stockItems', '股票']].forEach(([t, k, lbl]) => {
    (state[k] || []).filter(x => !x.archived).forEach(it => out.push({ key: `${t}:${it.id}`, id: it.id, isUSD: !!it.isUSD, name: it.name, group: lbl }));
  });
  return out;
}
function stmtPenFinanceItem(res) {
  const m = stmtPenMap(res);
  return m.financeKey ? stmtPenFinanceItems().find(x => x.key === m.financeKey) || null : null;
}

function stmtPensionBuildItems(results, imported) {
  results.filter(r => r.kind === 'pension').forEach(res => {
    const sid = res.statementId;
    const reprocess = imported.has(sid) && stmtReprocess.has(sid);
    if (imported.has(sid) && !reprocess) return;
    const p = res.pension || {};
    if (p.value === null || p.value === undefined) {
      stmtItems.push(stmtItem({ sid, src: res.label, type: 'info', group: 'review', checked: false, title: `${res.label} ${res.period}`, detail: '沒有認到帳戶價值，請手動輸入' }));
      return;
    }
    const it = stmtItem({
      sid, src: res.label, failed: !res.allChecksOk, reprocess, res, type: 'pension', date: p.date || '',
      data: { value: p.value, contributed: p.contributed, pnl: p.pnl, units: p.units, nav: p.nav, date: p.date || '' },
      edit: [['value', '帳戶價值（元）']]
    });
    const hasTarget = !!stmtPenRetAccountId(res) || !!stmtPenFinanceItem(res);
    if (!hasTarget) { it.group = 'review'; it.checked = false; it.note = '請在上面「對應設定」選要寫到退休試算的哪個專戶、或財務總覽的哪個項目'; }
    else if (reprocess) { it.group = 'review'; it.checked = false; it.note = '重新處理：這份之前匯入過，要覆蓋請自己勾'; }
    stmtItems.push(it);
  });
}

function stmtPensionDescribe(it) {
  const d = it.data, p = (it.res && it.res.pension) || {};
  const rate = d.contributed ? ((d.pnl / d.contributed) * 100).toFixed(2) + '%' : '';
  const bits = [`累積提存 $${stmtFmt(d.contributed)}`, `損益 ${d.pnl >= 0 ? '+' : ''}${stmtFmt(d.pnl)}${rate ? `（${rate}）` : ''}`];
  if (d.units) bits.push(`單位數 ${stmtFmt(d.units, 4)}、淨值 ${d.nav}`);
  (p.portfolios || []).forEach(x => bits.push(`${stmtEsc(x.name)} 現值 $${stmtFmt(x.value)}（${stmtFmt(x.units, 4)} 單位 × ${x.nav}）`));
  if (p.month) bits.push(`本月提存${p.month.date ? ' ' + stmtEsc(stmtRoc(p.month.date)) : ''}：個人 ${stmtFmt(p.month.own)}＋政府 ${stmtFmt(p.month.gov)}${p.month.other ? '＋其他 ' + stmtFmt(p.month.other) : ''}＝${stmtFmt(p.month.total)}`);
  const lines = [];
  const accId = stmtPenRetAccountId(it.res);
  if (accId === STMT_PEN_NEW) lines.push(`退休試算：新增專戶「${stmtEsc(it.res.label)}」，餘額 ${stmtFmt(d.value / 10000, 4)} 萬`);
  else if (accId) {
    const a = (retirementSettings.accounts || []).find(x => x.id === accId);
    if (a) lines.push(`退休試算「${stmtEsc(a.name || '（未命名）')}」餘額：${stmtFmt(Number(a.balance) || 0, 4)} → ${stmtFmt(d.value / 10000, 4)} 萬`);
  }
  const fi = stmtPenFinanceItem(it.res);
  if (fi) {
    const col = stmtSettingsObj().financeCol;
    const key = fi.isUSD ? fi.id + '_usd' : fi.id;
    const old = state.values[key] ? state.values[key][col] : '';
    lines.push(`財務總覽「${stmtEsc(fi.name)}」${stmtEsc((state.dates || [])[col] || '')}：${old === '' || old == null ? '空白' : stmtFmt(Number(old) || 0, 0)} → ${stmtFmt(d.value, 0)}`);
  }
  return {
    tag: '退撫儲金', title: `${stmtEsc(it.res.label)} ${stmtEsc(it.res.period)}　帳戶價值 $${stmtFmt(d.value)}`,
    detail: bits.join('・') + (lines.length ? '<br>' + lines.join('<br>') : ''), amount: d.value
  };
}

function stmtPensionSettingsRows(results) {
  const rows = [];
  results.filter(r => r.kind === 'pension').forEach(res => {
    const key = stmtPenKey(res);
    const accId = stmtPenRetAccountId(res);
    const accs = (typeof retirementSettings !== 'undefined' ? retirementSettings.accounts : []) || [];
    const fk = stmtPenMap(res).financeKey || '';
    const fitems = stmtPenFinanceItems();
    if (typeof retirementSettings !== 'undefined') {   // 這個網站沒有退休試算分頁就不顯示
      rows.push(`<div class="stmt-set-row"><span>${stmtEsc(res.label)} → 退休試算的專戶</span>
        <select onchange="stmtPenSet('${stmtEsc(key)}', 'retAccountId', this.value)">
          <option value="" ${accId ? '' : 'selected'}>不寫入退休試算</option>
          ${accs.map(a => `<option value="${stmtEsc(a.id)}" ${a.id === accId ? 'selected' : ''}>${stmtEsc(a.name || '（未命名）')}</option>`).join('')}
          <option value="${STMT_PEN_NEW}" ${accId === STMT_PEN_NEW ? 'selected' : ''}>＋新增一個「${stmtEsc(res.label)}」專戶</option>
        </select></div>`);
    }
    rows.push(`<div class="stmt-set-row"><span>${stmtEsc(res.label)} → 財務總覽的項目</span>
      <select onchange="stmtPenSet('${stmtEsc(key)}', 'financeKey', this.value)">
        <option value="" ${fk ? '' : 'selected'}>不寫入財務總覽</option>
        ${fitems.map(x => `<option value="${stmtEsc(x.key)}" ${x.key === fk ? 'selected' : ''}>${stmtEsc(x.name)}（${x.group}）</option>`).join('')}
      </select></div>`);
  });
  return rows;
}
function stmtPenSet(key, field, value) {
  const s = stmtSettingsObj();
  const old = s.accountMap[key] || {};
  const cur = { retAccountId: old.retAccountId, financeKey: old.financeKey };
  // 第一次改其中一個時，另一個先固定成現在畫面上看到的（不然「自動猜的」會跟著變）
  if (cur.retAccountId === undefined) { const r = stmtResults().find(x => stmtPenKey(x) === key); cur.retAccountId = r ? stmtPenRetAccountId(r) : ''; }
  cur[field] = value;
  const r0 = stmtResults().find(x => stmtPenKey(x) === key);
  s.accountMap[key] = Object.assign({}, cur, { label: r0 ? r0.label : '退撫儲金' });
  stmtAfterSetting();
}

function stmtPensionApply(it, bump, problems) {
  const d = it.data;
  const value = Number(d.value) || 0;
  let wrote = 0;
  // 退休試算：專戶餘額（萬）
  let accId = stmtPenRetAccountId(it.res);
  if (accId && typeof retirementSettings !== 'undefined') {
    let acc = accId === STMT_PEN_NEW ? null : (retirementSettings.accounts || []).find(x => x.id === accId);
    if (accId === STMT_PEN_NEW || !acc) {
      acc = retNewAccount({ name: it.res.label || '退撫儲金', balance: 0, rate: 4 });
      retirementSettings.accounts.push(acc);
      const s = stmtSettingsObj();
      s.accountMap[stmtPenKey(it.res)] = Object.assign({}, s.accountMap[stmtPenKey(it.res)] || {}, { retAccountId: acc.id, label: it.res.label || '退撫儲金' });
    }
    acc.balance = Math.round(value / 10000 * 10000) / 10000;
    retirementSettings.touched = true;
    saveRetirementSettings();
    if (typeof renderRetirementIfVisible === 'function') renderRetirementIfVisible();
    bump('退撫儲金：退休試算專戶餘額');
    wrote++;
  }
  // 財務總覽：目前日期欄
  const fi = stmtPenFinanceItem(it.res);
  if (fi) {
    const col = stmtSettingsObj().financeCol;
    if (!(state.dates || []).length || col == null || col < 0 || col >= state.dates.length) problems.push('退撫儲金：財務總覽還沒有日期欄，沒有寫進財務總覽');
    else {
      setRawVal(fi.isUSD ? fi.id + '_usd' : fi.id, col, value);
      saveState();
      if (typeof render === 'function') render();
      bump('退撫儲金：財務總覽');
      wrote++;
    }
  }
  if (!wrote) problems.push('退撫儲金：沒有選要寫到哪裡');
}
