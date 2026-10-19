/* 雲端覆蓋保護：記錄「這台裝置有沒有還沒上傳的修改」。
   以前登入時，雲端的資料會直接蓋掉本機；如果你在沒登入／斷線時改過東西，那些修改就消失了。
   現在每份資料（finance 財務總覽、stock 股票管理、insurance 保險）各記一筆：
     dirty     ＝ 本機有還沒成功上傳的修改
     lastKnown ＝ 上次成功同步時，雲端文件的 updatedAt
   讀雲端時：
     1. 本機沒有未上傳的修改          → 直接用雲端的（跟以前一樣）
     2. 有修改，但雲端自從上次同步後沒人動過 → 保留本機，並上傳
     3. 有修改，雲端也被別台裝置改過      → 問使用者；選用雲端之前會先自動下載一份本機備份
   紀錄只存在這個瀏覽器的 localStorage（CLOUD_SYNC_META_V1）。 */

const CLOUD_META_KEY = 'CLOUD_SYNC_META_V1';
let cloudGuardBackedUp = false; // 同一次開啟網頁只自動下載一次備份

function cloudMetaAll() {
  try { return JSON.parse(localStorage.getItem(CLOUD_META_KEY)) || {}; } catch (e) { return {}; }
}
function cloudMetaSave(all) {
  try { localStorage.setItem(CLOUD_META_KEY, JSON.stringify(all)); } catch (e) { /* 存不下就算了，不影響主要功能 */ }
}

// 本機資料有變動時呼叫
function cloudMarkDirty(name) {
  const all = cloudMetaAll();
  const m = all[name] || {};
  m.dirty = true;
  m.dirtyAt = Date.now();
  all[name] = m;
  cloudMetaSave(all);
  try { if (Object.keys(cloudStatusMap).length) cloudStatusRender(); } catch (e) { /* 略過 */ }
}

// 成功上傳／成功讀取雲端後呼叫。startedAt＝這次上傳開始的時間：
// 如果上傳途中使用者又改了東西（dirtyAt 比較晚），就不能清掉「有修改」的記號。
function cloudMarkSynced(name, updatedAt, startedAt) {
  const all = cloudMetaAll();
  const m = all[name] || {};
  m.lastKnown = updatedAt || m.lastKnown || null;
  if (!m.dirty || !startedAt || (m.dirtyAt || 0) <= startedAt) m.dirty = false;
  all[name] = m;
  cloudMetaSave(all);
}

function cloudMetaOf(name) {
  return cloudMetaAll()[name] || {};
}

function cloudMetaClearAll() {
  try { localStorage.removeItem(CLOUD_META_KEY); } catch (e) { /* 略過 */ }
}

/* 讀雲端時決定要用誰的。回傳 'cloud'（用雲端）或 'local'（保留本機並上傳）。
   label＝給人看的名稱（例如「財務總覽」）。 */
function cloudDecideOnLoad(name, label, cloudUpdatedAt) {
  const m = cloudMetaOf(name);
  if (!m.dirty) return 'cloud';
  if (m.lastKnown && cloudUpdatedAt && cloudUpdatedAt === m.lastKnown) return 'local';
  const useCloud = confirm(
    '⚠️ 「' + label + '」在這台裝置上有還沒上傳到雲端的修改，而雲端上的版本跟你上次同步時不一樣了（可能是別台裝置改過）。\n\n' +
    '按「確定」＝改用雲端的版本。這台裝置未上傳的修改會被蓋掉，但我會先自動下載一份備份檔給你。\n' +
    '按「取消」＝保留這台裝置的內容，並用它覆蓋雲端（別台裝置的修改會遺失）。'
  );
  if (!useCloud) return 'local';
  if (!cloudGuardBackedUp) {
    cloudGuardBackedUp = true;
    try { if (typeof exportData === 'function') exportData(); } catch (e) { console.warn('自動備份失敗', e); }
  }
  return 'cloud';
}

/* ====== 標題列的雲端狀態：把財務總覽、股票、保險（huimoney 還有記帳）合成一個說法 ======
   以前每一塊各說各話：財務總覽顯示「已同步」時，記帳或股票可能其實失敗了，只有一個一閃而過的提示。
   現在每一塊回報自己的狀態，標題列只要有一塊失敗／暫停就會明講是哪一塊，點下去看原因。 */
const cloudStatusMap = {}; // name -> { label, state: 'ok' | 'fail' | 'paused', detail }

function cloudStatusSet(name, label, state, detail) {
  cloudStatusMap[name] = { label, state, detail: detail || '' };
  cloudStatusRender();
}
function cloudStatusReset() {
  Object.keys(cloudStatusMap).forEach(k => delete cloudStatusMap[k]);
}
function cloudStatusErrText(e) {
  if (!e) return '';
  const hint = e.code === 'permission-denied' ? '（Firebase 規則沒有開放這份資料）' : '';
  return (e.code || '') + ' ' + (e.message || e) + hint;
}
function cloudAnyDirty() {
  const all = cloudMetaAll();
  if (Object.keys(all).some(k => all[k] && all[k].dirty)) return true;
  try {
    if (typeof lgLoadMeta === 'function' && lgLoadMeta().dirty) return true;
  } catch (e) { /* 略過 */ }
  return false;
}
function cloudStatusRender() {
  const el = document.getElementById('syncStatus');
  if (!el || typeof fbUser === 'undefined' || !fbUser) return;
  const list = Object.values(cloudStatusMap);
  const fails = list.filter(x => x.state === 'fail');
  const paused = list.filter(x => x.state === 'paused');
  el.style.cursor = '';
  el.onclick = null;
  if (fails.length) {
    el.textContent = '☁️ 同步失敗：' + fails.map(x => x.label).join('、') + '（點我看原因）';
    el.title = fails.map(x => x.label + '：' + x.detail).join('\n');
    el.style.cursor = 'pointer';
    el.onclick = () => alert('雲端同步失敗，資料目前只存在這個瀏覽器：\n\n' + fails.map(x => '・' + x.label + '\n  ' + x.detail).join('\n\n'));
  } else if (paused.length) {
    el.textContent = '☁️ 已暫停同步：' + paused.map(x => x.label).join('、') + '（雲端有更新的版本）';
    el.title = '雲端上的版本比這台新，你選了不覆蓋。重新整理頁面可以拉取雲端最新版本。';
  } else if (cloudAnyDirty()) {
    el.textContent = '☁️ 有變更還沒上傳（' + fbUser.email + '）';
    el.title = '稍後會自動上傳；如果一直停在這個狀態，請檢查網路。';
  } else {
    el.textContent = '☁️ 已同步（' + fbUser.email + '）';
    el.title = '';
  }
}
