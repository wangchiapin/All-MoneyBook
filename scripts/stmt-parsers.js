/* ====================================================================
   對帳單讀取程式（第 1 步）
   - 把 PDF 對帳單轉成「一行一行、一格一格」的文字，再依各家的格式讀出資料
   - 不用 AI、不連網：PDF 在使用者自己的裝置上打開（之後自動流程則在 GitHub 私人倉庫的臨時電腦上跑）
   - 同一份程式可以在瀏覽器（網頁的「📥 匯入對帳單」）和 Node（自動流程、測試）使用

   目前支援：國泰證券、富邦證券、台北富邦銀行、國泰世華銀行
   （富邦信用卡認得出來，但先不處理）

   每份對帳單讀完會得到同一種格式的結果（見 emptyResult），
   並附上 checks：用對帳單自己印的總計／餘額來核對，全部 ok 才代表讀對了。
   這一步只負責「讀」，不會改動任何資料；寫進 All-MoneyBook 是之後確認畫面的事。
   ==================================================================== */
(function (root) {
  'use strict';

  /* ---------------- 小工具 ---------------- */
  const NUM_RE = /^[+-]?\d{1,3}(,\d{3})*(\.\d+)?$|^[+-]?\d+(\.\d+)?$/;
  function isNum(s) { return NUM_RE.test(String(s || '').trim()); }
  function num(s) {
    const t = String(s == null ? '' : s).replace(/,/g, '').replace(/^\+/, '').trim();
    if (t === '' || t === '-' || t === '­') return 0;
    const n = Number(t);
    return isNaN(n) ? 0 : n;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  // 民國 115/09/16 或 西元 2026/09/16 → 2026-09-16
  function isoDate(s) {
    const m = String(s || '').match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return '';
    let y = Number(m[1]);
    if (y < 1911) y += 1911;
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  function isDate(s) { return /^\d{2,4}\/\d{1,2}\/\d{1,2}$/.test(String(s || '')); }
  function cleanName(s) { return String(s || '').replace(/\*+$/, '').trim(); }
  function emptyResult(source, label) {
    return {
      source, label,              // 例如 'cathay_sec'、'國泰證券'
      kind: '',                   // 'securities' 或 'bank'
      period: '',                 // 對帳單月份 '2026-09'
      account: '',                // 對帳單上的帳號（遮罩過的）
      statementId: '',            // 這份對帳單的編號（券商＋帳號＋月份），用來避免重複匯入
      trades: [],                 // 買賣：{date, name, code, side:'buy'|'sell', mode:'normal'|'daytrade'|'dca', shares, price, amount, fee, tax, net, orderNo}
      holdings: [],               // 庫存：{code, name, shares, closePrice, marketValue}
      lendings: [],               // 出借合約的借券費：{name, lendDate, contractNo, shares, rate, dueDate, fee, tax, serviceFee, net}
      compensations: [],          // 權益補償（出借期間的股息）：{name, contractNo, shares, payDate, kind, amount}
      stockDividends: [],         // 配股（集保劃撥配發）：{date, name, shares}
      cashDividends: [],          // 銀行入帳的現金股息：{date, name, amount, desc}
      bankAccounts: [],           // 銀行帳戶月底餘額：{accountNo, type, currency, balance}
      bankTx: [],                 // 銀行交易明細：{accountNo, date, desc, amount(存入為正、提出為負), balance, category}
      refs: [],                   // 只用來核對、不會記帳的資料：{type:'compensation'|'lendingFee', date, amount, desc}
      checks: [],                 // 自我檢查：{label, expected, actual, ok}
      warnings: []
    };
  }
  function check(res, label, expected, actual) {
    const ok = Math.abs(round2(expected) - round2(actual)) < 0.005;
    res.checks.push({ label, expected: round2(expected), actual: round2(actual), ok });
    return ok;
  }

  /* ---------------- PDF → 一行一行的格子 ----------------
     pdfjsLib：PDF.js（瀏覽器用 CDN 載入、Node 用 pdfjs-dist）
     password：對帳單密碼（沒有就留空）
     回傳 pages: [[ {y, cells:[{x0, x1, t}] } ]]，同一頁由上往下 */
  async function extractPages(pdfjsLib, data, password) {
    const task = pdfjsLib.getDocument({ data, password: password || undefined, isEvalSupported: false, useSystemFonts: true });
    let doc;
    try {
      doc = await task.promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        const err = new Error(e.code === 2 ? '密碼不正確' : '這份對帳單需要密碼');
        err.needPassword = true;
        err.wrongPassword = e.code === 2;
        throw err;
      }
      throw e;
    }
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4], y = it.transform[5], h = it.height || 8;
        let row = rows.find(r => Math.abs(r.y - y) < Math.max(2, h * 0.35));
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, w: it.width || 0, s: it.str });
      });
      rows.sort((a, b) => b.y - a.y);
      pages.push(rows.map(r => {
        r.items.sort((a, b) => a.x - b.x);
        const cells = [];
        r.items.forEach(it => {
          const last = cells[cells.length - 1];
          if (last && it.x - last.x1 <= 2.5) { last.t += it.s; last.x1 = it.x + it.w; }
          else cells.push({ x0: it.x, x1: it.x + it.w, t: it.s });
        });
        cells.forEach(c => { c.t = c.t.replace(/\s+/g, ''); });
        return { y: r.y, cells: cells.filter(c => c.t) };
      }));
    }
    try { doc.destroy(); } catch (e) { /* 略過 */ }
    return pages;
  }

  function flatLines(pages) {
    const out = [];
    pages.forEach((lines, pi) => lines.forEach(l => out.push(Object.assign({ page: pi + 1 }, l))));
    return out;
  }
  function lineText(l) { return l.cells.map(c => c.t).join(' '); }
  function allText(pages) { return flatLines(pages).map(lineText).join('\n'); }

  /* ---------------- 認出是哪一家 ---------------- */
  function detect(pages) {
    const t = allText(pages).replace(/\s+/g, '');
    if (t.includes('國泰世華銀行綜合月對帳單')) return 'cathay_bank';
    if (t.includes('有價證券買賣對帳單') && t.includes('集保市值總計')) return 'cathay_sec';
    if (t.includes('現貨對帳單') && t.includes('富邦證券')) return 'fubon_sec';
    if (t.includes('資產持有明細') && t.includes('taipeifubon')) return 'fubon_bank';
    if (t.includes('本期應繳總額') && t.includes('信用卡')) return 'fubon_card';
    return '';
  }

  /* ================= 國泰證券 ================= */
  function parseCathaySec(pages) {
    const res = emptyResult('cathay_sec', '國泰證券');
    res.kind = 'securities';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/(\d{2,3})年(\d{1,2})月/);
    if (pm) res.period = `${Number(pm[1]) + 1911}-${String(pm[2]).padStart(2, '0')}`;
    const am = text.match(/帳號：([0-9*]+)/);
    if (am) res.account = am[1];

    let totals = null, buyTotal = null, sellTotal = null, dayPnl = null, mktTotal = null;
    let inHoldings = false;
    lines.forEach((l, i) => {
      const c = l.cells.map(x => x.t);
      // 交易列：日期｜商品｜類別｜股數｜單價｜金額｜手續費｜交易稅｜…｜委託書號
      if (isDate(c[0]) && c.length >= 9 && /^(集|沖|普|零|盤)?(買|賣)$|買$|賣$/.test(c[2])) {
        const prev = lines[i - 1] ? lines[i - 1].cells.map(x => x.t) : [];
        const net = prev.length === 1 && isNum(prev[0]) ? num(prev[0]) : null;
        const side = c[2].includes('買') ? 'buy' : 'sell';
        const t = {
          date: isoDate(c[0]), name: cleanName(c[1]), code: '', side,
          mode: c[2].startsWith('沖') ? 'daytrade' : 'normal', typeText: c[2],
          shares: num(c[3]), price: num(c[4]), amount: num(c[5]), fee: num(c[6]), tax: num(c[7]),
          net: net, orderNo: c[c.length - 1]
        };
        const expectNet = side === 'buy' ? -(t.amount + t.fee) : t.amount - t.fee - t.tax;
        if (net === null) res.warnings.push(`${c[0]} ${t.name}：找不到應收付金額`);
        else if (Math.abs(net - expectNet) > 0.5) res.warnings.push(`${c[0]} ${t.name}：應收付 ${net} 跟金額算出來的 ${expectNet} 不一樣`);
        res.trades.push(t);
        return;
      }
      if (c[0] === '總合計') totals = { amount: num(c[1]), fee: num(c[2]), tax: num(c[3]) };
      if (c[0] === '買進總計：') { buyTotal = num(c[1]); sellTotal = num(c[3]); }
      if (c.includes('現沖損益：')) dayPnl = num(c[c.indexOf('現沖損益：') + 1]);
      if (c[0] === '代碼' && c[1] === '商品名稱') { inHoldings = true; return; }
      if (inHoldings) {
        if (c[0] === '集保市值總計：') { mktTotal = num(c[1]); inHoldings = false; return; }
        if (/^[0-9A-Z]{4,6}$/.test(c[0]) && c.length >= 5) {
          res.holdings.push({ code: c[0], name: cleanName(c[1]), closePrice: num(c[2]), shares: num(c[3]), marketValue: num(c[4]) });
        }
      }
    });
    // 名稱→代號（庫存裡有的才知道）
    const codeOf = {};
    res.holdings.forEach(h => { codeOf[h.name] = h.code; });
    res.trades.forEach(t => { t.code = codeOf[t.name] || ''; });

    const sum = f => res.trades.reduce((s, t) => s + t[f], 0);
    if (totals) {
      check(res, '成交金額總合計', totals.amount, sum('amount'));
      check(res, '手續費總合計', totals.fee, sum('fee'));
      check(res, '交易稅總合計', totals.tax, sum('tax'));
    } else res.warnings.push('找不到「總合計」');
    if (buyTotal !== null) {
      check(res, '買進總計', buyTotal, res.trades.filter(t => t.side === 'buy').reduce((s, t) => s + t.amount, 0));
      check(res, '賣出總計', sellTotal, res.trades.filter(t => t.side === 'sell').reduce((s, t) => s + t.amount, 0));
    }
    if (dayPnl !== null) {
      check(res, '現沖損益', dayPnl, res.trades.filter(t => t.mode === 'daytrade').reduce((s, t) => s + (t.net || 0), 0));
    }
    if (mktTotal !== null) check(res, '集保市值總計', mktTotal, res.holdings.reduce((s, h) => s + h.marketValue, 0));
    res.statementId = `cathay_sec|${res.account}|${res.period}`;
    return res;
  }

  /* ================= 富邦證券 ================= */
  // 「0.05116/04/13」這種費率和到期日黏在一起的格子拆開
  function splitRateDate(s) {
    const m = String(s || '').match(/^(\d+\.\d{2})(\d{2,3}\/\d{2}\/\d{2})$/);
    return m ? { rate: Number(m[1]), date: m[2] } : null;
  }
  function parseFubonSec(pages) {
    const res = emptyResult('fubon_sec', '富邦證券');
    res.kind = 'securities';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/截至(\d{4})年(\d{1,2})月底/);
    if (pm) res.period = `${pm[1]}-${String(pm[2]).padStart(2, '0')}`;
    const am = text.match(/帳號：([0-9*\-]+)/);
    if (am) res.account = am[1];

    const txt = i => (lines[i] ? lines[i].cells.map(x => x.t) : []);
    let section = '';
    let periodTotal = null, settleTotal = null;
    lines.forEach((l, i) => {
      const c = l.cells.map(x => x.t);
      const joined = c.join('');
      if (/^有價證券買賣現股:/.test(joined)) section = 'trades';
      else if (/^有價證券買賣融資\/融券:/.test(joined)) section = 'margin';
      else if (/客戶出借有價證券:/.test(joined)) section = 'lend';
      else if (/^分戶帳現金餘額明細:/.test(joined)) section = 'cash';
      else if (/^集保異動資料:/.test(joined)) section = 'tdcc';
      else if (/^有價證券/.test(joined) || /^現股當沖/.test(joined) || /^不限用途/.test(joined) || /客戶借入有價證券/.test(joined)) section = 'other';

      if (c[0] === '應收(+)/付(-)金額' && c.length === 2) settleTotal = num(c[1]);

      if (section === 'trades') {
        if (c[0] === '本期合計') { periodTotal = { amount: num(c[1]), fee: num(c[2]), tax: num(c[3]), net: num(c[c.length - 1]) }; return; }
        if (isDate(c[0]) && isDate(c[1]) && c.length >= 8) {
          // 交易類別常被折成兩行（「普買定期定」＋「額」），在上下兩行
          const above = txt(i - 1), below = txt(i + 1);
          const typeText = (above.length === 1 && !isNum(above[0]) ? above[0] : '') + (below.length === 1 && !isNum(below[0]) ? below[0] : '');
          const name = cleanName(c[2]);
          const n = c.slice(3).map(num);   // 股數、價格、金額、手續費、交易稅、…、應收、應付
          const side = typeText.includes('賣') ? 'sell' : 'buy';
          const t = {
            date: isoDate(c[0]), name, code: '', side,
            mode: typeText.includes('定期') ? 'dca' : (typeText.includes('沖') ? 'daytrade' : 'normal'), typeText,
            shares: n[0], price: n[1], amount: n[2], fee: n[3], tax: n[4], net: null, orderNo: ''
          };
          const recv = n[n.length - 2], pay = n[n.length - 1];
          t.net = recv - pay;
          const expectNet = side === 'buy' ? -(t.amount + t.fee) : t.amount - t.fee - t.tax;
          if (Math.abs(t.net - expectNet) > 0.5) res.warnings.push(`${c[0]} ${name}：應收付 ${t.net} 跟金額算出來的 ${expectNet} 不一樣`);
          if (!typeText) res.warnings.push(`${c[0]} ${name}：讀不到交易類別，先當成買進`);
          res.trades.push(t);
        }
      }

      if (section === 'lend') {
        const kindIdx = c.findIndex(x => x === '借券費月結' || x === '權益補償');
        if (kindIdx < 0) return;
        const kindText = c[kindIdx];
        let rest = c.slice(kindIdx + 1);
        // 名稱：同一行在類別後面，或是被拆在上下兩行
        let name = '', payKind = '';
        if (rest.length && !isDate(rest[0]) && !isNum(rest[0])) { name = rest[0]; rest = rest.slice(1); }
        else {
          const above = txt(i - 1), below = txt(i + 1);
          name = (above[0] || '') + (below[0] || '');
          payKind = (above[1] || '') + (below[1] || '');
        }
        name = cleanName(name);
        // 原始出借日期｜申請書號｜股數｜費率+到期日｜…
        const lendDate = rest[0], contractNo = rest[1], shares = num(rest[2]);
        const rd = splitRateDate(rest[3]);
        const after = rest.slice(4);
        if (!isDate(lendDate) || !rd) { res.warnings.push(`出借明細有一行讀不懂：${c.join(' ')}`); return; }
        if (kindText === '借券費月結') {
          const n = after.map(num);
          let fee, tax = 0, service, net;
          if (n.length === 3) [fee, service, net] = n;
          else if (n.length === 4) [fee, tax, service, net] = n;
          else { res.warnings.push(`借券費欄位數不對：${c.join(' ')}`); return; }
          if (Math.abs(fee - tax - service - net) > 0.5) res.warnings.push(`借券費 ${name} ${contractNo}：${fee}-${tax}-${service} 不等於 ${net}`);
          res.lendings.push({ name, lendDate: isoDate(lendDate), contractNo, shares, rate: rd.rate, dueDate: isoDate(rd.date), fee, tax, serviceFee: service, net });
        } else {
          // 權益補償：入帳日｜現金（或股數）
          const payDate = after.find(isDate);
          const amount = num(after[after.length - 1]);
          res.compensations.push({ name, contractNo, shares, payDate: isoDate(payDate), kind: payKind || '現金', amount });
        }
      }

      if (section === 'tdcc' && isDate(c[0]) && c.length >= 5) {
        const type = c[c.length - 1];
        if (type.includes('配發')) {
          res.stockDividends.push({ date: isoDate(c[0]), name: cleanName(c[1]), shares: num(c[3]), typeText: type });
        } else {
          res.warnings.push(`集保異動「${type}」先不處理：${c.join(' ')}`);
        }
      }
    });

    if (periodTotal) {
      check(res, '現股買賣金額本期合計', periodTotal.amount, res.trades.reduce((s, t) => s + t.amount, 0));
      check(res, '現股手續費本期合計', periodTotal.fee, res.trades.reduce((s, t) => s + t.fee, 0));
    } else if (res.trades.length) res.warnings.push('找不到「本期合計」');
    if (settleTotal !== null) check(res, '交割應收付金額合計', settleTotal, res.trades.reduce((s, t) => s + t.net, 0));
    res.statementId = `fubon_sec|${res.account}|${res.period}`;
    return res;
  }

  /* ================= 銀行交易明細共用：用餘額一路往下核對 =================
     每一行的「這筆金額」用前後餘額相減算出來，所以不怕存入／提出欄位對錯；
     第一行沒有前一筆餘額時，看金額的位置靠近「提出」還是「存入」那一欄。 */
  function bankChain(res, accountNo, rows, opening, outX, inX) {
    let prev = opening;
    rows.forEach(r => {
      let amount;
      if (prev !== null) {
        amount = round2(r.balance - prev);
        if (r.amountAbs !== null && Math.abs(Math.abs(amount) - r.amountAbs) > 0.005) {
          res.warnings.push(`${accountNo} ${r.date} ${r.desc}：金額 ${r.amountAbs} 跟餘額變化 ${amount} 對不上`);
        }
      } else {
        const isOut = outX !== null && inX !== null ? Math.abs(r.amountX - outX) < Math.abs(r.amountX - inX) : true;
        amount = isOut ? -r.amountAbs : r.amountAbs;
      }
      prev = r.balance;
      res.bankTx.push({ accountNo, date: r.date, desc: r.desc, amount, balance: r.balance, category: categorizeBankTx(r.desc) });
    });
    return prev;
  }
  // 銀行明細分類：只有「現金股息」會記帳；權益息、借券費只拿來核對證券對帳單
  function categorizeBankTx(desc) {
    if (/現金股息|股利/.test(desc)) return 'cashDividend';
    if (/權益息|權益補償/.test(desc)) return 'compensationRef';
    if (/借券費/.test(desc)) return 'lendingFeeRef';
    if (/交割|證券定期|台股定期|定期定額/.test(desc)) return 'securitiesSettlement';
    return 'other';
  }
  function collectBankRefs(res) {
    res.bankTx.forEach(t => {
      if (t.category === 'cashDividend') {
        // 「委代付 臺灣企銀現金股息」→ 臺灣企銀（只看有「現金股息」的那一段）
        const tok = t.desc.split(' ').find(x => /現金股息|股利/.test(x)) || t.desc;
        const m = tok.match(/^(.*?)(現金股息|股利)/);
        res.cashDividends.push({ date: t.date, name: (m && m[1]) || tok, amount: t.amount, desc: t.desc, accountNo: t.accountNo });
      } else if (t.category === 'compensationRef') {
        res.refs.push({ type: 'compensation', date: t.date, amount: t.amount, desc: t.desc });
      } else if (t.category === 'lendingFeeRef') {
        res.refs.push({ type: 'lendingFee', date: t.date, amount: t.amount, desc: t.desc });
      }
    });
  }

  /* ================= 台北富邦銀行 ================= */
  function parseFubonBank(pages) {
    const res = emptyResult('fubon_bank', '台北富邦銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/對帳單期間：(\d{4})\/(\d{2})\/\d{2}~(\d{4})\/(\d{2})\/\d{2}/);
    if (pm) res.period = `${pm[3]}-${pm[4]}`;

    let section = '', curType = '', twdTotal = null, assetTotal = null;
    let txAcc = '', txRows = [], opening = null, outX = null, inX = null;
    const flushTx = () => {
      if (!txAcc || !txRows.length) return;
      const last = bankChain(res, txAcc, txRows, opening, outX, inX);
      const acc = res.bankAccounts.find(a => a.accountNo === txAcc);
      if (acc) check(res, `${txAcc} 明細最後餘額＝帳戶餘額`, acc.balance, last);
      txRows = []; opening = null;
    };
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (j === '資產持有明細') section = 'holdings';
      if (j === '當月交易明細') section = 'tx';
      if (j === '訊息公告') { flushTx(); section = ''; }
      if (c[0] === '資產總計') assetTotal = num(c[1]);

      if (section === 'holdings') {
        if (/存款$/.test(j) && c.length === 1) curType = j;
        if (c[0] === '台幣存款總計') twdTotal = num(c[1]);
        const accIdx = c.findIndex(x => /^\d{4,}\*+\d+$/.test(x));
        if (accIdx >= 0) {
          const cur = c.find(x => /^[A-Z]{3}$/.test(x)) || 'TWD';
          const bal = c.slice(accIdx + 1).find(x => isNum(x));
          res.bankAccounts.push({ accountNo: c[accIdx], type: c[0], currency: cur, balance: num(bal) });
        }
      }
      if (section === 'tx') {
        if (c.includes('支出') && c.includes('收入')) {
          const cell = n => l.cells.find(x => x.t === n);
          outX = (cell('支出').x0 + cell('支出').x1) / 2; inX = (cell('收入').x0 + cell('收入').x1) / 2;
          return;
        }
        let k = 0;
        if (/^\d{4,}\*+\d+$/.test(c[0])) { flushTx(); txAcc = c[0]; k = 1; }
        if (!isDate(c[k])) return;
        const date = isoDate(c[k]);
        const rest = l.cells.slice(k + 1);
        const balance = num(rest[rest.length - 1].t);
        const mids = rest.slice(0, -1);
        const amtCell = mids.slice().reverse().find(x => isNum(x.t));
        const desc = mids.filter(x => !isNum(x.t)).map(x => x.t).join(' ');
        if (desc.startsWith('承轉結餘') && !amtCell) { opening = balance; return; }
        txRows.push({ date, desc, amountAbs: amtCell ? num(amtCell.t) : null, amountX: amtCell ? (amtCell.x0 + amtCell.x1) / 2 : 0, balance });
      }
    });
    flushTx();
    if (twdTotal !== null) check(res, '台幣存款總計', twdTotal, res.bankAccounts.filter(a => a.currency === 'TWD').reduce((s, a) => s + a.balance, 0));
    if (assetTotal !== null && !res.bankAccounts.some(a => a.currency !== 'TWD')) check(res, '資產總計', assetTotal, res.bankAccounts.reduce((s, a) => s + a.balance, 0));
    collectBankRefs(res);
    res.account = res.bankAccounts.map(a => a.accountNo).join(',');
    res.statementId = `fubon_bank|${res.account}|${res.period}`;
    return res;
  }

  /* ================= 國泰世華銀行 ================= */
  function parseCathayBank(pages) {
    const res = emptyResult('cathay_bank', '國泰世華銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/國泰世華銀行綜合月對帳單(\d{4})\/(\d{2})\/\d{2}~(\d{4})\/(\d{2})\/\d{2}/);
    if (pm) res.period = `${pm[3]}-${pm[4]}`;

    let twdTotal = null;
    let txAcc = '', txRows = [], outX = null, inX = null, inTx = false;
    const flushTx = () => {
      if (!txAcc || !txRows.length) return;
      const last = bankChain(res, txAcc, txRows, null, outX, inX);
      const acc = res.bankAccounts.find(a => a.accountNo === txAcc);
      if (acc) check(res, `${txAcc} 明細最後餘額＝帳戶餘額`, acc.balance, last);
      txRows = [];
    };
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (c[0] === '台幣存款' && c[1] === '餘額') twdTotal = num(c[2]);
      if (j === '本行重要訊息') { flushTx(); inTx = false; return; }
      // 持有明細：帳戶類別｜帳號｜分行｜（幣別）｜餘額
      const accIdx = c.findIndex(x => /^\d{4,}\*+\d+$/.test(x));
      if (!inTx && accIdx === 1 && !c.includes('帳號')) {
        const cur = c.find(x => /^[A-Z]{3}$/.test(x)) || 'TWD';
        const bal = c.slice(accIdx + 1).find(x => isNum(x));
        res.bankAccounts.push({ accountNo: c[accIdx], type: c[0], currency: cur, balance: num(bal) });
        return;
      }
      // 交易明細：「活期存款｜帳號｜699510****22」開始一個帳戶
      if (c.includes('帳號') && accIdx >= 0) { flushTx(); txAcc = c[accIdx]; inTx = true; return; }
      if (inTx && c.includes('提出') && c.includes('存入')) {
        const cell = n => l.cells.find(x => x.t === n);
        outX = (cell('提出').x0 + cell('提出').x1) / 2; inX = (cell('存入').x0 + cell('存入').x1) / 2;
        return;
      }
      if (inTx && isDate(c[0]) && c.length >= 4) {
        const cells = l.cells.slice(1);
        const balance = num(cells[cells.length - 1].t);
        const mids = cells.slice(0, -1);
        const amtCell = mids.slice().reverse().find(x => isNum(x.t));
        const desc = mids.filter(x => !isNum(x.t) && !/^[A-Z]{3}$/.test(x.t)).map(x => x.t).join(' ');
        txRows.push({ date: isoDate(c[0]), desc, amountAbs: amtCell ? num(amtCell.t) : null, amountX: amtCell ? (amtCell.x0 + amtCell.x1) / 2 : 0, balance });
      }
    });
    flushTx();
    if (twdTotal !== null) check(res, '台幣存款合計', twdTotal, res.bankAccounts.filter(a => a.currency === 'TWD').reduce((s, a) => s + a.balance, 0));
    collectBankRefs(res);
    res.account = res.bankAccounts.map(a => a.accountNo).join(',');
    res.statementId = `cathay_bank|${res.account}|${res.period}`;
    return res;
  }

  /* ---------------- 總入口 ---------------- */
  const PARSERS = {
    cathay_sec: parseCathaySec,
    fubon_sec: parseFubonSec,
    fubon_bank: parseFubonBank,
    cathay_bank: parseCathayBank
  };
  const LABELS = {
    cathay_sec: '國泰證券', fubon_sec: '富邦證券', fubon_bank: '台北富邦銀行',
    cathay_bank: '國泰世華銀行', fubon_card: '台北富邦信用卡'
  };

  // 讀一份 PDF：回傳結果（或 {unsupported:true}）
  async function parsePdf(pdfjsLib, data, password) {
    const pages = await extractPages(pdfjsLib, data, password);
    const source = detect(pages);
    if (!source) return { unsupported: true, label: '認不出是哪一家的對帳單' };
    if (!PARSERS[source]) return { unsupported: true, source, label: LABELS[source] + '（目前先不處理）' };
    const res = PARSERS[source](pages);
    res.allChecksOk = res.checks.length > 0 && res.checks.every(c => c.ok) && res.warnings.length === 0;
    return res;
  }

  const api = { parsePdf, extractPages, detect, PARSERS, LABELS, isoDate };
  root.StmtParsers = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
