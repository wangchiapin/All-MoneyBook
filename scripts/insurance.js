/* ====================================================================
   保險總覽 (insuranceView) —— 獨立模組，管理完整保單資訊：
   基本資料 / 繳費資訊 / 保障內容(主約+附約) / 目前現值 / 備註，
   支援新增、修改、封存(可還原)、永久刪除，操作邏輯比照財務總覽：
   刪除＝封存（隱藏但保留資料，可在「封存管理」還原或永久刪除）。
   資料獨立存放 (localStorage INSURANCE_POLICIES_V1)，跟「財務總覽 → 二、
   保險資產」互不相通（那邊是逐期現值追蹤，這裡是完整保單管理），
   就像「股票管理」的持股資料跟「財務總覽」的股票項目是分開的一樣。
   跟 stock-lending.js 一樣：沿用其他檔案頂部宣告的全域函式/常數
   (esc / formatNum / showToast / FIN_ARCHIVE_MARK)，靠 <script> 共用
   全域作用域運作，所有呼叫都發生在畫面互動之後，不受載入順序影響。
   ==================================================================== */

let insurancePolicies = [];
try { insurancePolicies = JSON.parse(localStorage.getItem('INSURANCE_POLICIES_V1')) || []; } catch (e) { insurancePolicies = []; }

function saveInsuranceToStorage() {
  try {
    localStorage.setItem('INSURANCE_POLICIES_V1', JSON.stringify(insurancePolicies));
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️ 本機儲存失敗，這次的變更可能沒有存進去', 'error');
  }
}

const INSURANCE_TYPE_OPTIONS = ['壽險', '醫療險', '意外險', '防癌險', '失能扶助險', '重大疾病險', '儲蓄型保險', '投資型保單', '其他'];
const INSURANCE_FREQ_OPTIONS = ['年繳', '半年繳', '季繳', '月繳', '躉繳'];
const INSURANCE_STATUS_OPTIONS = ['有效', '停效', '已到期', '已理賠'];

function emptyInsurancePolicy() {
  return {
    id: 'ins_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: '', insurer: '', type: '', policyNumber: '',
    insuredPerson: '', policyHolder: '',
    effectiveDate: '', paymentPeriod: '',
    premium: 0, paymentFrequency: '年繳', paymentMethod: '', paymentDate: '',
    mainCoverage: 0, riders: [],
    beneficiary: '', status: '有效', currentValue: 0, note: '',
    archived: false
  };
}

function findInsurancePolicy(id) { return insurancePolicies.find(p => p.id === id) || null; }

/* ====== 選單初始化 (險種/繳費方式/狀態 datalist、select) ====== */
function ensureInsuranceOptionLists() {
  const typeList = document.getElementById('insTypeDatalist');
  if (typeList && !typeList.dataset.filled) {
    typeList.innerHTML = INSURANCE_TYPE_OPTIONS.map(t => `<option value="${esc(t)}"></option>`).join('');
    typeList.dataset.filled = '1';
  }
  const freqSel = document.getElementById('insEditPaymentFrequency');
  if (freqSel && !freqSel.dataset.filled) {
    freqSel.innerHTML = INSURANCE_FREQ_OPTIONS.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    freqSel.dataset.filled = '1';
  }
  const statusSel = document.getElementById('insEditStatus');
  if (statusSel && !statusSel.dataset.filled) {
    statusSel.innerHTML = INSURANCE_STATUS_OPTIONS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    statusSel.dataset.filled = '1';
  }
}

/* ====== 主表格 ====== */
function insuranceTotalCoverage(p) {
  return (Number(p.mainCoverage) || 0) + (p.riders || []).reduce((s, r) => s + (Number(r.coverage) || 0), 0);
}

function renderInsuranceTable() {
  const tbody = document.getElementById('insuranceTableBody');
  if (!tbody) return;

  const searchBox = document.getElementById('insuranceSearchBox');
  const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
  let list = insurancePolicies.filter(p => !p.archived);
  if (query) {
    list = list.filter(p => [p.name, p.insurer, p.type, p.insuredPerson].some(v => (v || '').toLowerCase().includes(query)));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">尚無保單資料，點擊上方「➕ 新增保單」開始建立</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
      <tr>
        <td class="ins-name-cell" onclick="openInsuranceDetailModal('${p.id}')" title="點擊查看保單詳情">${esc(p.name || '（未命名保單）')}</td>
        <td>${esc(p.insuredPerson || '—')}</td>
        <td>${esc(p.type || '—')}</td>
        <td class="font-mono">${p.premium ? '$' + formatNum(p.premium, 0) : '—'}</td>
        <td>${esc(p.paymentFrequency || '—')}</td>
        <td>${esc(p.paymentMethod || '—')}</td>
        <td>${esc(p.paymentDate || '—')}</td>
        <td class="font-mono">${p.currentValue ? '$' + formatNum(p.currentValue, 0) : '—'}</td>
        <td><span class="ins-status-badge">${esc(p.status || '—')}</span></td>
        <td class="ins-ops-cell">
          <button class="btn-icon-plain" title="編輯" onclick="openInsuranceEditModal('${p.id}')">✏️</button>
          <button class="btn-icon-plain" title="封存" onclick="archiveInsurancePolicy('${p.id}')">🗄️</button>
        </td>
      </tr>
    `).join('');
}

/* ====== 新增/編輯彈窗 ====== */
let insEditingId = null;
let insEditingRiders = [];

function addInsurancePolicy() { openInsuranceEditModal(null); }

function openInsuranceEditModal(id) {
  ensureInsuranceOptionLists();
  const p = id ? findInsurancePolicy(id) : emptyInsurancePolicy();
  if (!p) return;
  insEditingId = id ? p.id : null;
  insEditingRiders = (p.riders || []).map(r => Object.assign({}, r));

  const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
  document.getElementById('insEditModalTitle').textContent = id ? '✏️ 編輯保單' : '➕ 新增保單';
  setVal('insEditName', p.name);
  setVal('insEditInsurer', p.insurer);
  setVal('insEditType', p.type);
  setVal('insEditPolicyNumber', p.policyNumber);
  setVal('insEditInsuredPerson', p.insuredPerson);
  setVal('insEditPolicyHolder', p.policyHolder);
  setVal('insEditEffectiveDate', p.effectiveDate);
  setVal('insEditPaymentPeriod', p.paymentPeriod);
  setVal('insEditPremium', p.premium || 0);
  setVal('insEditPaymentFrequency', p.paymentFrequency || '年繳');
  setVal('insEditPaymentMethod', p.paymentMethod);
  setVal('insEditPaymentDate', p.paymentDate);
  setVal('insEditMainCoverage', p.mainCoverage || 0);
  setVal('insEditBeneficiary', p.beneficiary);
  setVal('insEditStatus', p.status || '有效');
  setVal('insEditCurrentValue', p.currentValue || 0);
  setVal('insEditNote', p.note);

  renderInsuranceRidersEditor();

  const modal = document.getElementById('insuranceEditModal');
  if (modal) modal.classList.add('open');
}

function closeInsuranceEditModal() {
  const modal = document.getElementById('insuranceEditModal');
  if (modal) modal.classList.remove('open');
  insEditingId = null;
  insEditingRiders = [];
}

function renderInsuranceRidersEditor() {
  const box = document.getElementById('insRidersEditList');
  if (!box) return;
  if (insEditingRiders.length === 0) {
    box.innerHTML = `<div style="color:var(--text-muted); font-size:12px; padding:6px 2px;">尚未加入附約，點下方「➕ 新增附約」加入</div>`;
    return;
  }
  box.innerHTML = insEditingRiders.map((r, idx) => `
    <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
      <input type="text" class="cell-input" placeholder="附約名稱" style="flex:1;" value="${esc(r.name || '')}" onchange="updateInsuranceRiderField(${idx}, 'name', this.value)" />
      <input type="number" step="any" class="cell-input" placeholder="保額" style="width:120px;" value="${esc(Number(r.coverage) || 0)}" onchange="updateInsuranceRiderField(${idx}, 'coverage', this.value)" />
      <button class="btn-icon-plain" title="刪除此附約" onclick="deleteInsuranceRiderRow(${idx})">✕</button>
    </div>
  `).join('');
}

function addInsuranceRiderRow() {
  insEditingRiders.push({ id: 'r_' + Date.now(), name: '', coverage: 0 });
  renderInsuranceRidersEditor();
}

function updateInsuranceRiderField(idx, field, value) {
  const r = insEditingRiders[idx];
  if (!r) return;
  r[field] = field === 'coverage' ? (parseFloat(value) || 0) : value;
}

function deleteInsuranceRiderRow(idx) {
  insEditingRiders.splice(idx, 1);
  renderInsuranceRidersEditor();
}

function saveInsuranceEditModal() {
  const getVal = elId => { const el = document.getElementById(elId); return el ? el.value : ''; };
  const name = getVal('insEditName').trim();
  if (!name) { alert('請輸入保險名稱'); return; }

  const p = insEditingId ? findInsurancePolicy(insEditingId) : emptyInsurancePolicy();
  if (!p) return;

  p.name = name;
  p.insurer = getVal('insEditInsurer').trim();
  p.type = getVal('insEditType').trim();
  p.policyNumber = getVal('insEditPolicyNumber').trim();
  p.insuredPerson = getVal('insEditInsuredPerson').trim();
  p.policyHolder = getVal('insEditPolicyHolder').trim();
  p.effectiveDate = getVal('insEditEffectiveDate').trim();
  p.paymentPeriod = getVal('insEditPaymentPeriod').trim();
  p.premium = parseFloat(getVal('insEditPremium')) || 0;
  p.paymentFrequency = getVal('insEditPaymentFrequency');
  p.paymentMethod = getVal('insEditPaymentMethod').trim();
  p.paymentDate = getVal('insEditPaymentDate').trim();
  p.mainCoverage = parseFloat(getVal('insEditMainCoverage')) || 0;
  p.beneficiary = getVal('insEditBeneficiary').trim();
  p.status = getVal('insEditStatus');
  p.currentValue = parseFloat(getVal('insEditCurrentValue')) || 0;
  p.note = getVal('insEditNote').trim();
  p.riders = insEditingRiders.filter(r => (r.name || '').trim() || (Number(r.coverage) || 0)).map(r => ({ id: r.id || ('r_' + Date.now()), name: (r.name || '').trim(), coverage: Number(r.coverage) || 0 }));

  if (!insEditingId) insurancePolicies.push(p);

  saveInsuranceToStorage();
  closeInsuranceEditModal();
  renderInsuranceTable();
}

/* ====== 詳情彈窗（唯讀，點保單名稱開啟） ====== */
let insDetailOpenId = null;

function openInsuranceDetailModal(id) {
  const p = findInsurancePolicy(id);
  if (!p) return;
  insDetailOpenId = id;
  const body = document.getElementById('insuranceDetailBody');
  if (!body) return;

  const row = (label, value) => `<div class="ins-detail-row"><span class="ins-detail-label">${esc(label)}</span><span class="ins-detail-value">${value === '' || value === null || value === undefined ? '—' : esc(value)}</span></div>`;
  const totalCoverage = insuranceTotalCoverage(p);
  const ridersHtml = (p.riders || []).length
    ? p.riders.map(r => `<div class="ins-detail-row"><span class="ins-detail-label">↳ ${esc(r.name || '未命名附約')}</span><span class="ins-detail-value">$${formatNum(Number(r.coverage) || 0, 0)}</span></div>`).join('')
    : `<div style="color:var(--text-muted); font-size:12px; padding:4px 0;">無附約</div>`;

  document.getElementById('insuranceDetailTitle').textContent = p.name || '（未命名保單）';
  body.innerHTML = `
    <div class="ins-detail-section-title">基本資料</div>
    ${row('保險公司', p.insurer)}
    ${row('險種', p.type)}
    ${row('保單號碼', p.policyNumber)}
    ${row('被保險人', p.insuredPerson)}
    ${row('要保人', p.policyHolder)}
    ${row('生效日期', p.effectiveDate)}
    ${row('狀態', p.status)}

    <div class="ins-detail-section-title">繳費資訊</div>
    ${row('繳費年期', p.paymentPeriod)}
    ${row('保費', p.premium ? '$' + formatNum(p.premium, 0) : '')}
    ${row('繳費方式', p.paymentFrequency)}
    ${row('扣款方式', p.paymentMethod)}
    ${row('扣款日期', p.paymentDate)}

    <div class="ins-detail-section-title">保障內容</div>
    ${row('主約保額', p.mainCoverage ? '$' + formatNum(p.mainCoverage, 0) : '')}
    ${ridersHtml}
    ${row('保障總額', '$' + formatNum(totalCoverage, 0))}
    ${row('受益人', p.beneficiary)}

    <div class="ins-detail-section-title">財務追蹤</div>
    ${row('目前現值', p.currentValue ? '$' + formatNum(p.currentValue, 0) : '')}

    ${p.note ? `<div class="ins-detail-section-title">備註</div><div class="ins-detail-note">${esc(p.note)}</div>` : ''}
  `;

  const modal = document.getElementById('insuranceDetailModal');
  if (modal) modal.classList.add('open');
}

function closeInsuranceDetailModal() {
  const modal = document.getElementById('insuranceDetailModal');
  if (modal) modal.classList.remove('open');
  insDetailOpenId = null;
}

function editInsuranceFromDetail() {
  const id = insDetailOpenId;
  closeInsuranceDetailModal();
  if (id) openInsuranceEditModal(id);
}

/* ====== 封存／還原／永久刪除（邏輯比照財務總覽） ====== */
function archiveInsurancePolicy(id) {
  const p = findInsurancePolicy(id);
  if (!p) return;
  if (confirm('確定要封存此保單嗎？\n\n封存後不會列在保險總覽列表，但資料會保留，之後可以在「封存管理」還原。')) {
    p.archived = true;
    saveInsuranceToStorage();
    renderInsuranceTable();
    closeInsuranceDetailModal();
  }
}

function restoreInsurancePolicy(id) {
  const p = findInsurancePolicy(id);
  if (!p) return;
  delete p.archived;
  saveInsuranceToStorage();
  renderInsuranceTable();
  openInsuranceArchiveManager();
}

function permanentDeleteInsurancePolicy(id) {
  if (!confirm('確定要永久刪除嗎？此動作無法復原！')) return;
  const idx = insurancePolicies.findIndex(p => p.id === id);
  if (idx !== -1) insurancePolicies.splice(idx, 1);
  saveInsuranceToStorage();
  renderInsuranceTable();
  openInsuranceArchiveManager();
}

function openInsuranceArchiveManager() {
  closeInsuranceArchiveManager();
  const archivedList = insurancePolicies.filter(p => p.archived);

  const rowsHtml = archivedList.length
    ? archivedList.map(p =>
        '<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 4px; border-bottom:1px solid var(--border-color); font-size:13px;">' +
          '<span>' + esc(p.name || '（未命名保單）') + '</span>' +
          '<span>' +
            '<button class="btn btn-outline" style="padding:3px 8px; font-size:11px; margin-right:6px;" onclick="restoreInsurancePolicy(\'' + p.id + '\')">還原</button>' +
            '<button class="btn btn-danger" style="padding:3px 8px; font-size:11px;" onclick="permanentDeleteInsurancePolicy(\'' + p.id + '\')">永久刪除</button>' +
          '</span>' +
        '</div>'
      ).join('')
    : '<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">目前沒有已封存的保單</div>';

  const modal = document.createElement('div');
  modal.id = 'insuranceArchiveModal';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(60,54,46,0.35); z-index:3000; display:flex; align-items:center; justify-content:center;';
  modal.innerHTML =
    '<div style="background:var(--card-bg); border-radius:6px; width:440px; max-width:90vw; max-height:70vh; overflow:auto; box-shadow:0 8px 30px rgba(0,0,0,0.25);">' +
      '<div style="background:#4a4438; color:#f4f0e8; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:500; position:sticky; top:0;">' +
        '<span>🗄️ 保險封存管理</span><span style="cursor:pointer;" onclick="closeInsuranceArchiveManager()">✖</span>' +
      '</div>' +
      '<div style="padding:8px 16px;">' + rowsHtml + '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

function closeInsuranceArchiveManager() {
  const modal = document.getElementById('insuranceArchiveModal');
  if (modal) modal.remove();
}

/* ====== JSON「全部資料備份」合併匯入用：比照 Excel 匯入的邏輯，用「保險名稱」比對，
   本地已有同名保單就略過，找不到的（含已封存的）就整筆加進來 ====== */
function mergeInsuranceData(importedList) {
  if (!Array.isArray(importedList)) return { added: 0, skipped: 0 };
  const existingNames = new Set(insurancePolicies.map(p => p.name));
  let added = 0, skipped = 0;
  importedList.forEach(p => {
    if (!p || !p.name) return;
    if (existingNames.has(p.name)) { skipped++; return; }
    insurancePolicies.push(Object.assign({}, p, { id: p.id || ('ins_' + Date.now() + '_' + added) }));
    existingNames.add(p.name);
    added++;
  });
  if (added) saveInsuranceToStorage();
  return { added, skipped };
}
