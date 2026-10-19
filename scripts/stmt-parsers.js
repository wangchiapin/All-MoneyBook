/* ====================================================================
   對帳單讀取程式（第 1 步）
   - 把 PDF 對帳單轉成「一行一行、一格一格」的文字，再依各家的格式讀出資料
   - 不用 AI、不連網：PDF 在使用者自己的裝置上打開（之後自動流程則在 GitHub 私人倉庫的臨時電腦上跑）
   - 同一份程式可以在瀏覽器（網頁的「📥 匯入對帳單」）和 Node（自動流程、測試）使用

   目前支援：國泰證券、富邦證券、永豐金證券、台北富邦銀行、國泰世華銀行、第一銀行、
             永豐銀行、台新銀行、將來銀行、華南銀行、中國信託
   信用卡：國泰世華、台北富邦（富邦還沒有真實帳單驗證過，結果要自己核對）

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
      card: null,                 // 信用卡帳單的總覽：{closingDate, dueDate, creditLimit, totalDue, minDue}
      cardTx: [],                 // 信用卡消費明細：{date, postDate, desc, amount(消費為正、退款為負), last4, currency, foreignAmount, country}
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
  // docOpts：字型對照表的位置（cMapUrl、cMapPacked、standardFontDataUrl），有些中文字型要有它才讀得出字
  async function extractPages(pdfjsLib, data, password, docOpts) {
    const task = pdfjsLib.getDocument(Object.assign({ data, password: password || undefined, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }, docOpts || {}));
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
    if (t.includes('信用卡帳單') && t.includes('國泰世華')) return 'cathay_card';
    if (t.includes('本期應繳總額') && t.includes('信用卡') && (t.includes('富邦') || /fubon/i.test(t))) return 'fubon_card';
    if (t.includes('綜合業務對帳單') && (t.includes('第一銀行') || t.includes('firstbank'))) return 'first_bank';
    if (t.includes('證券電子對帳單') && t.includes('sinotrade')) return 'sinopac_sec';
    if (t.includes('綜合對帳單') && t.includes('永豐銀行')) return 'sinopac_bank';
    if (t.includes('台新銀行綜合對帳單') || (t.includes('綜合對帳單') && t.includes('taishinbank'))) return 'taishin_bank';
    if (t.includes('綜合對帳單') && t.includes('nextbank')) return 'next_bank';
    if (t.includes('綜合對帳單') && t.includes('華南銀行')) return 'hncb_bank';
    if (t.includes('ctbcbank.com')) return 'ctbc_bank';
    if (t.includes('存款電子對帳單') && (t.includes('bot.com.tw') || t.includes('台灣銀行'))) return 'bot_bank';
    // 圖片型（OCR 讀出來的字會有些錯，所以認的是比較不容易認錯的字）
    if (t.includes('私校') && t.includes('儲金')) return 'pension_private';   // 公教那份也有「投資組合績效概況」，所以不能用它來分
    if (/PublicServicePensionFund/i.test(t) || (t.includes('退撫') && t.includes('儲金'))) return 'pension_fund';
    if (/bok\.?com/i.test(t) || t.includes('高雄銀行') || /BANKOFKAOHSIUNG/i.test(t)) return 'kaohsiung_bank';
    // 玉山：只看第 1 頁最上面幾行（別家對帳單的明細裡也可能出現「玉山銀行」四個字）
    const head = (pages[0] || []).slice(0, 5).map(lineText).join('').replace(/\s+/g, '');
    if (/玉山銀行|esunbank/i.test(head) || t.includes('玉山客服中心')) return 'esun_bank';
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
    let inLend = false, lendNet = null, lendNetSum = 0, lendRows = 0;
    lines.forEach((l, i) => {
      const c = l.cells.map(x => x.t);
      // 有價證券借貸對帳單：序號（出借日期-流水號）｜出借／還券｜名稱代號｜張數｜費率%｜出借收入｜手續費｜代扣稅款
      // 出借收入只在「還券」那一行；對帳單沒有寫還券日期
      if (c.join('').includes('有價證券借貸對帳單')) { inLend = true; return; }
      if (inLend) {
        if (c[0] === '淨收金額') { lendNet = num(c[c.length - 1]); return; }
        if (/^\d{8}-\d{4}$/.test(c[0]) && (c[1] === '出借' || c[1] === '還券') && c.length >= 8) {
          const nm = String(c[2]).match(/^(.+?)(\d{4,6}[A-Z]?)$/);
          const lots = num(c[3]), income = num(c[5]), service = num(c[6]), tax = num(c[7]);
          lendRows++;
          lendNetSum += income - service - tax;
          if (c[1] === '還券' && income > 0) {
            res.lendings.push({
              name: cleanName(nm ? nm[1] : c[2]), code: nm ? nm[2] : '',
              lendDate: `${c[0].slice(0, 4)}-${c[0].slice(4, 6)}-${c[0].slice(6, 8)}`, contractNo: c[0],
              shares: lots * 1000, rate: parseFloat(c[4]) || 0, dueDate: '',
              fee: income, tax, serviceFee: service, net: round2(income - service - tax),
              noLentSync: true,   // 只有當月出借／還券的合約才會列出來，不能拿來算「目前出借張數」
              payUnknown: true    // 對帳單沒寫還券日期，入款日要自己確認
            });
          }
          return;
        }
      }
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
    if (lendNet !== null) check(res, '借券淨收金額', lendNet, lendNetSum);
    else if (lendRows > 0) res.warnings.push('借貸對帳單找不到「淨收金額」，沒辦法核對');
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
  // 銀行明細分類：各家銀行用字不同，所以每一類放一串關鍵字，看到任何一個就算。
  // 之後看到新的寫法，直接補在這裡（兩個網站共用這個檔案）。
  // 只有「現金股息」會記到持股；權益息、借券費只拿來核對證券對帳單。
  const BANK_KEYWORDS = {
    cashDividend: ['現金股息', '現金股利', '股息', '股利', '配息', '息金入帳', '息金'],
    compensationRef: ['權益息', '權益補償', '補償金', '除權息補償', '股息補償', '現金補償'],
    lendingFeeRef: ['借券費', '借券收入', '借券利息', '出借收益', '出借費', '借券手續費退'],
    securitiesSettlement: ['交割', '證券定期', '台股定期', '定期定額', '定期買股', '證券扣款', '證券交易', '委託買賣', '買賣股款', '股票款', '證券款']
  };
  let userBankKeywords = {};   // 使用者自己教的：{ 類別: ['關鍵字', …] }（網站在讀對帳單前設定）
  function setUserKeywords(obj) { userBankKeywords = obj && typeof obj === 'object' ? obj : {}; }
  function categorizeBankTx(desc) {
    const d = String(desc || '');
    const hit = cat => (BANK_KEYWORDS[cat] || []).concat(userBankKeywords[cat] || []).some(k => k && d.includes(k));
    // 先看比較具體的：權益／借券，再看股息、交割（「股息」「息金」比較廣，放後面）
    if (hit('compensationRef')) return 'compensationRef';
    if (hit('lendingFeeRef')) return 'lendingFeeRef';
    if (hit('cashDividend')) return 'cashDividend';
    if (hit('securitiesSettlement')) return 'securitiesSettlement';
    return 'other';
  }
  function collectBankRefs(res) {
    res.bankTx.forEach(t => {
      if (t.category === 'cashDividend' && /配息\s*([0-9]{4,6}[A-Z]?)/.test(t.desc)) {
        // 「基金配息00878」→ 代號 00878
        const code = t.desc.match(/配息\s*([0-9]{4,6}[A-Z]?)/)[1];
        res.cashDividends.push({ date: t.date, name: code, code, amount: t.amount, desc: t.desc, accountNo: t.accountNo });
      } else if (t.category === 'cashDividend') {
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

  /* ================= 第一銀行（綜合業務對帳單／餘額核對單） =================
     只有「活期性存款餘額」：每個帳戶的月底餘額；後面的「電子銀行轉帳交易清單」只列轉出，不讀。
     對帳單沒有印總計，自我檢查改成：看起來像帳戶的每一列，都要讀到帳號、幣別和餘額。 */
  function parseFirstBank(pages) {
    const res = emptyResult('first_bank', '第一銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/資料基準日期(\d{2,3})\/(\d{2})\/\d{2}/);
    if (pm) res.period = `${Number(pm[1]) + 1911}-${pm[2]}`;

    let section = false, seen = 0;
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (j === '活期性存款餘額') { section = true; return; }
      if (!section) return;
      if (/^說明|轉帳交易清單/.test(j)) { section = false; return; }
      const accIdx = c.findIndex(x => /^[\d*]+(-[\d*]+)+$/.test(x) && /\d{3,}$/.test(x));
      if (accIdx < 0) return;
      seen++;
      const curRaw = c.slice(accIdx + 1).find(x => /^[A-Z]{3}$/.test(x));
      const bal = c.slice(accIdx + 1).reverse().find(x => isNum(x));
      if (!curRaw || bal === undefined) return;
      const currency = curRaw === 'NTD' ? 'TWD' : curRaw;
      res.bankAccounts.push({ accountNo: c[accIdx], type: c.slice(0, accIdx).join(''), currency, balance: num(bal) });
    });
    check(res, '帳戶列都讀到餘額', seen, res.bankAccounts.length);
    if (!res.bankAccounts.length) res.warnings.push('沒有讀到任何帳戶餘額');
    if (!res.period) res.warnings.push('沒有讀到對帳單月份');
    res.account = res.bankAccounts.map(a => a.accountNo).join(',');
    res.statementId = `first_bank|${res.account}|${res.period}`;
    return res;
  }

  /* ================= 共用：銀行明細（已知支出／存入欄） =================
     rows: [{date, desc, out, in, balance}]；金額＝存入－支出，並核對「上一筆餘額＋金額＝這筆餘額」 */
  function bankColTx(res, accountNo, rows, currency) {
    let prev = null;
    rows.forEach(r => {
      const amount = round2((r.in || 0) - (r.out || 0));
      if (prev !== null && Math.abs(round2(prev + amount) - r.balance) > 0.005) {
        res.warnings.push(`${accountNo} ${r.date} ${r.desc}：餘額接不起來（${prev} ${amount >= 0 ? '+' : ''}${amount} ≠ ${r.balance}）`);
      }
      prev = r.balance;
      res.bankTx.push({ accountNo, date: r.date, desc: r.desc, amount, balance: r.balance, currency: currency || 'TWD', category: categorizeBankTx(r.desc) });
    });
    return prev;
  }
  // 看數字格靠近哪一欄的標題（用中心點比）
  function nearestCol(cell, cols) {
    const cx = (cell.x0 + cell.x1) / 2;
    let best = null, bd = Infinity;
    Object.keys(cols).forEach(k => { const d = Math.abs(cx - cols[k]); if (d < bd) { bd = d; best = k; } });
    return best;
  }
  function colCenters(line, names) {
    const out = {};
    Object.keys(names).forEach(k => { const c = line.cells.find(x => x.t === names[k]); if (c) out[k] = (c.x0 + c.x1) / 2; });
    return out;
  }
  const money = t => num(String(t).replace(/^\$/, '').replace(/^NT\$/, ''));
  const isMoney = t => isNum(String(t).replace(/^-?\$/, m => m.replace('$', '')).replace(/^NT\$/, '')) || /^-?\$[\d,]+(\.\d+)?$/.test(t);
  function finishBank(res, source) {
    collectBankRefs(res);
    res.account = res.bankAccounts.map(a => a.accountNo).filter((x, i, a) => a.indexOf(x) === i).join(',');
    res.statementId = `${source}|${res.account}|${res.period}`;
    if (!res.bankAccounts.length) res.warnings.push('沒有讀到任何帳戶餘額');
    if (!res.period) res.warnings.push('沒有讀到對帳單月份');
    return res;
  }
  // 每個帳戶：明細最後一筆餘額＝帳戶餘額
  function checkLastBalance(res, accountNo, last, currency) {
    const acc = res.bankAccounts.find(a => a.accountNo === accountNo && (!currency || a.currency === currency));
    if (acc && last !== null && last !== undefined) check(res, `${accountNo} 明細最後餘額＝帳戶餘額`, acc.balance, last);
  }

  /* ================= 永豐銀行 ================= */
  function parseSinopacBank(pages) {
    const res = emptyResult('sinopac_bank', '永豐銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/對帳單期間：\d{4}\/\d{2}\/\d{2}~(\d{4})\/(\d{2})\/\d{2}/);
    if (pm) res.period = `${pm[1]}-${pm[2]}`;
    const CUR = { '新臺幣': 'TWD', '美元': 'USD', '人民幣': 'CNY', '日圓': 'JPY', '歐元': 'EUR', '港幣': 'HKD', '澳幣': 'AUD' };
    let twdOverview = null, cols = null, txAcc = '', txRows = [];
    const flush = () => { if (txAcc && txRows.length) checkLastBalance(res, txAcc, bankColTx(res, txAcc, txRows, 'TWD')); txRows = []; };
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      if (l.page === 1 && c[0] === '臺幣' && c.length === 2 && twdOverview === null) twdOverview = num(c[1]);
      const accIdx = c.findIndex(x => /^\d{3}-\d{2}\*-\*\*\d+-\*$/.test(x));
      if (accIdx > 0 && CUR[c[0]]) {
        const bal = c.slice(accIdx + 1).find(x => isNum(x));
        res.bankAccounts.push({ accountNo: c[accIdx], type: c.slice(1, accIdx).join(''), currency: CUR[c[0]], balance: num(bal) });
        return;
      }
      if (c.includes('支出') && c.includes('存入') && c.includes('餘額')) { cols = colCenters(l, { out: '支出', in: '存入', bal: '餘額' }); return; }
      const am = c[0] && c[0].match(/^帳號:(.+?)\((.+)\)$/);
      if (am) { flush(); txAcc = am[1]; return; }
      if (txAcc && cols && isDate(c[0])) {
        const row = { date: isoDate(c[0]), desc: '', out: 0, in: 0, balance: null };
        const descs = [];
        l.cells.slice(1).forEach(cell => {
          if (isNum(cell.t) && cell.x0 > 180 && cell.x1 < 420) {
            const k = nearestCol(cell, cols);
            if (k === 'bal') row.balance = num(cell.t); else row[k] = num(cell.t);
          } else descs.push(cell.t);
        });
        row.desc = descs.join(' ');
        if (row.balance !== null) txRows.push(row);
      }
      if (/^【/.test(c[0] || '')) { flush(); txAcc = ''; }
    });
    flush();
    if (twdOverview !== null) check(res, '臺幣存款合計', twdOverview, res.bankAccounts.filter(a => a.currency === 'TWD').reduce((s, a) => s + a.balance, 0));
    return finishBank(res, 'sinopac_bank');
  }

  /* ================= 台新銀行（含 Richart） ================= */
  function parseTaishinBank(pages) {
    const res = emptyResult('taishin_bank', '台新銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/資料期間：\d{4}\/\d{2}\/\d{2}~(\d{4})\/(\d{2})\/\d{2}/);
    if (pm) res.period = `${pm[1]}-${pm[2]}`;
    let section = '', twdTotal = null, lastCur = '', cols = null, txSec = '';
    const txByAcc = {};
    const dollar = t => /^-?\$[\d,]+(\.\d+)?$/.test(t);
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (j.startsWith('新臺幣帳戶概要區')) { section = 'twd'; return; }
      if (j.startsWith('外幣帳戶概要區')) { section = 'fx'; return; }
      if (j === '您在本行的交易往來') { section = ''; return; }
      if (j === '新臺幣帳戶的往來明細' && c.length === 1) { txSec = 'twd'; section = ''; return; }
      if (j === '外幣帳戶的往來明細' && c.length === 1) { txSec = 'fx'; section = ''; return; }
      if (j === '各產品訊息區') { txSec = ''; return; }
      if (section === 'twd') {
        if (c[0] === '合計') { twdTotal = money(c[c.length - 1]); return; }
        const accIdx = c.findIndex(x => /^\d{6,}\*+\d+$/.test(x));
        if (accIdx >= 0 && /活存|定存/.test(c[0])) {
          const bal = c.slice(accIdx + 1).find(dollar);
          res.bankAccounts.push({ accountNo: c[accIdx], type: c[0] + (c.includes('Richart') ? '（Richart）' : ''), currency: 'TWD', balance: money(bal) });
        }
      }
      if (section === 'fx') {
        if (c.length === 1 && /^[A-Z]{3}$/.test(c[0])) { lastCur = c[0]; return; }
        const accIdx = c.findIndex(x => /^\d{5,}\*+\d+$/.test(x));
        if (accIdx >= 0 && /活存|定存/.test(c[0])) {
          const bal = c.slice(accIdx + 1).find(dollar); // 第一個是原幣
          res.bankAccounts.push({ accountNo: c[accIdx], type: c[0] + (c.includes('Richart') ? '（Richart）' : ''), currency: lastCur || 'USD', balance: money(bal) });
        }
      }
      if (txSec) {
        if (c.includes('支出金額') && c.includes('存入金額')) { cols = colCenters(l, { out: '支出金額', in: '存入金額', bal: '帳戶餘額' }); return; }
        if (!cols || !/^\d{5,}\*+\d+$/.test(c[0] || '') || !isDate(c[1])) return;
        let cur = 'TWD';
        const row = { date: isoDate(c[1]), desc: '', out: 0, in: 0, balance: null };
        const descs = [];
        l.cells.slice(2).forEach(cell => {
          if (txSec === 'fx' && /^[A-Z]{3}$/.test(cell.t)) { cur = cell.t; return; }
          if (dollar(cell.t)) { const k = nearestCol(cell, cols); if (k === 'bal') row.balance = money(cell.t); else row[k] = money(cell.t); }
          else descs.push(cell.t);
        });
        row.desc = descs.join(' ');
        const key = c[0] + '|' + cur;
        (txByAcc[key] = txByAcc[key] || []).push(row);
      }
    });
    Object.keys(txByAcc).forEach(key => {
      const [acc, cur] = key.split('|');
      const last = bankColTx(res, acc, txByAcc[key], cur);
      checkLastBalance(res, acc, last, cur);
    });
    if (twdTotal !== null) check(res, '新臺幣帳戶合計', twdTotal, res.bankAccounts.filter(a => a.currency === 'TWD').reduce((s, a) => s + a.balance, 0));
    return finishBank(res, 'taishin_bank');
  }

  /* ================= 將來銀行 ================= */
  function parseNextBank(pages) {
    const res = emptyResult('next_bank', '將來銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/帳單期間\d{4}\/\d{2}\/\d{2}~(\d{4})\/(\d{2})\/\d{2}/);
    if (pm) res.period = `${pm[1]}-${pm[2]}`;
    let total = null, inOverview = false, cols = null, txAcc = '', txRows = [], pendingTd = null;
    const flush = () => { if (txAcc && txRows.length) checkLastBalance(res, txAcc, bankColTx(res, txAcc, txRows, 'TWD')); txRows = []; };
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      const tm = j.match(/總餘額：NT\$([\d,]+)/);
      if (tm && total === null) total = num(tm[1]);
      if (j.startsWith('臺外幣帳戶總覽')) { inOverview = true; return; }
      if (inOverview) {
        if (/^\d{6,}\*+\d+$/.test(c[0] || '') && /^[A-Z]{3}$/.test(c[1] || '')) {
          const nums = c.slice(2).filter(isNum);
          res.bankAccounts.push({ accountNo: c[0], type: '活存', currency: c[1], balance: num(nums[0]) });
          return;
        }
        if (c[0] === '帳戶號碼') return; // 表頭
        if (c.length && !/^\d/.test(c[0])) inOverview = false;
      }
      const am = j.match(/^帳號：(\d{6,}\*+\d+)/);
      if (am) { flush(); txAcc = am[1]; return; }
      // 活存口袋：序號：xxxx｜開立日期：…｜餘額：NT$0
      const pk = j.match(/^序號：([0-9A-Za-z]+)｜開立日期：[\d/]+｜餘額：NT\$([\d,]+)/);
      if (pk) { flush(); txAcc = ''; res.bankAccounts.push({ accountNo: '口袋' + pk[1], type: '活存口袋', currency: 'TWD', balance: num(pk[2]) }); return; }
      // 定存口袋：定存單號：xxx｜幣別：TWD，下一列是 期間 ｜ 年利率 ｜ 本金 ｜ 領息 ｜ 續存
      const td = j.match(/^定存單號：(\d{6,}\*+\d+)｜幣別：([A-Z]{3})/);
      if (td) { flush(); txAcc = ''; pendingTd = { accountNo: td[1], currency: td[2] }; return; }
      if (pendingTd && /^\d{4}\/\d{2}\/\d{2}~\d{4}\/\d{2}\/\d{2}$/.test(c[0] || '')) {
        const nums = c.slice(1).filter(isNum);
        const rate = (c[1] || '').match(/([\d.]+)%/);
        const principal = nums.length ? num(nums[nums.length - 1]) : NaN;
        const [from, to] = c[0].split('~');
        if (isFinite(principal)) res.bankAccounts.push({ accountNo: pendingTd.accountNo, type: '定存', currency: pendingTd.currency, balance: principal, rate: rate ? Number(rate[1]) : null, startDate: isoDate(from), maturity: isoDate(to) });
        pendingTd = null;
        return;
      }
      if (c.includes('收入') && c.includes('支出') && c.includes('餘額')) { cols = colCenters(l, { in: '收入', out: '支出', bal: '餘額' }); return; }
      if (j.startsWith('活存口袋明細')) { flush(); txAcc = ''; return; }
      if (txAcc && cols && isDate(c[0])) {
        const row = { date: isoDate(c[0]), desc: '', out: 0, in: 0, balance: null };
        const descs = [];
        l.cells.slice(1).forEach(cell => {
          if (isNum(cell.t)) { const k = nearestCol(cell, cols); if (k === 'bal') row.balance = num(cell.t); else row[k] = num(cell.t); }
          else descs.push(cell.t);
        });
        row.desc = descs.join(' ');
        if (row.balance !== null) txRows.push(row);
      }
    });
    flush();
    if (total !== null) check(res, '存款總餘額', total, res.bankAccounts.reduce((s, a) => s + (a.currency === 'TWD' ? a.balance : 0), 0));
    return finishBank(res, 'next_bank');
  }

  /* ================= 台灣銀行（存款電子對帳單：只有餘額表，沒有交易明細） ================= */
  const BOT_CUR = { 新臺幣: 'TWD', 新台幣: 'TWD', 美元: 'USD', 日圓: 'JPY', 日幣: 'JPY', 歐元: 'EUR', 港幣: 'HKD', 人民幣: 'CNY', 澳幣: 'AUD', 英鎊: 'GBP' };
  function parseBotBank(pages) {
    const res = emptyResult('bot_bank', '台灣銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/對帳基準日：\D*?(\d{4})\/(\d{2})\/\d{2}/);
    if (pm) res.period = `${pm[1]}-${pm[2]}`;
    const sums = {};   // 幣別 → {cur, fix}（對帳單下方的小計）
    let inSum = false;
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (j.startsWith('幣別活期筆數')) { inSum = true; return; }
      const ai = c.findIndex(x => /^\d{6,}\*+\d+$/.test(x));
      if (ai >= 0) {
        const kind = c.find(x => /活期|定期/.test(x)) || '';
        const cur = BOT_CUR[c.find(x => BOT_CUR[x]) || ''] || '';
        const bal = c.slice(ai + 1).find(x => isNum(x) && /\./.test(x));
        if (cur && bal !== undefined) {
          const acc = { accountNo: c[ai], type: /定期/.test(kind) ? '定存' : '活存', currency: cur, balance: num(bal) };
          const ds = c.filter(isDate);
          if (acc.type === '定存' && ds.length) { acc.startDate = isoDate(ds[0]); acc.maturity = ds[1] ? isoDate(ds[1]) : ''; }
          res.bankAccounts.push(acc);
        }
        return;
      }
      if (inSum && BOT_CUR[c[0]]) {
        const n = c.slice(1).filter(isNum).map(num);
        if (n.length >= 4) sums[BOT_CUR[c[0]]] = { cur: n[1], fix: n[3] };
        return;
      }
      if (inSum && c.length && !BOT_CUR[c[0]] && !/^-+$/.test(c[0])) inSum = false;
    });
    Object.keys(sums).forEach(cur => {
      check(res, `${cur} 存款合計（活期＋定期）`, round2(sums[cur].cur + sums[cur].fix), res.bankAccounts.filter(a => a.currency === cur).reduce((s, a) => s + a.balance, 0));
    });
    if (!Object.keys(sums).length) res.warnings.push('沒有讀到對帳單下方的合計，沒辦法自我檢查');
    return finishBank(res, 'bot_bank');
  }

  /* ================= 華南銀行 ================= */
  function parseHncbBank(pages) {
    const res = emptyResult('hncb_bank', '華南銀行');
    res.kind = 'bank';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/餘額基準日：(\d{2,3})年(\d{2})月/);
    if (pm) res.period = `${Number(pm[1]) + 1911}-${pm[2]}`;
    let twdOverview = null, cols = null, txAcc = '', txRows = [], inSummary = false;
    const flush = () => { if (txAcc && txRows.length) checkLastBalance(res, txAcc, bankColTx(res, txAcc, txRows, 'TWD')); txRows = []; };
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (/^1\.台幣存款/.test(j) && twdOverview === null) { const n = c.slice(1).find(isNum); twdOverview = n !== undefined ? num(n) : 0; }
      if (j.startsWith('[往來帳戶餘額彙整表]')) { inSummary = true; return; }
      if (j.startsWith('附註')) inSummary = false;
      if (inSummary) {
        const accIdx = c.findIndex(x => /^\d{4,}X+\d+$/.test(x));
        const curIdx = c.findIndex(x => /^[A-Z]{3}$/.test(x));
        if (accIdx >= 0 && curIdx > accIdx) {
          // 台幣帳戶只有「台幣餘額」；外幣帳戶第一個數字是外幣餘額
          const nums = l.cells.slice(curIdx + 1).filter(x => isNum(x.t));
          res.bankAccounts.push({ accountNo: c[accIdx], type: c.slice(0, accIdx).join(''), currency: c[curIdx], balance: nums.length ? num(nums[0].t) : 0 });
        }
        return;
      }
      const am = j.match(/^帳號：(\d{4,}X+\d+)$/);
      if (am) { flush(); txAcc = am[1]; return; }
      if (c.includes('支出金額') && c.includes('存入金額')) { cols = colCenters(l, { out: '支出金額', in: '存入金額', bal: '餘額' }); return; }
      if (/^◎|^\[外幣帳戶明細\]/.test(j)) { flush(); txAcc = ''; return; }
      if (txAcc && cols && isDate(c[0])) {
        const row = { date: isoDate(c[0]), desc: '', out: 0, in: 0, balance: null };
        const descs = [];
        l.cells.slice(1).forEach(cell => {
          if (isNum(cell.t) && cell.x1 < (cols.bal || 400) + 40) { const k = nearestCol(cell, cols); if (k === 'bal') row.balance = num(cell.t); else row[k] = num(cell.t); }
          else if (!/^[A-Z]{3}$/.test(cell.t)) descs.push(cell.t);
        });
        row.desc = descs.join(' ');
        if (row.balance !== null) txRows.push(row);
      }
    });
    flush();
    if (twdOverview !== null) check(res, '台幣存款合計', twdOverview, res.bankAccounts.filter(a => a.currency === 'TWD').reduce((s, a) => s + a.balance, 0));
    return finishBank(res, 'hncb_bank');
  }

  /* ================= 中國信託 =================
     這家的中文字是用圖畫的（讀不出字），只能靠數字、帳號和位置：
     第 2 頁先列台幣帳戶（帳號＋餘額），下一列只有一個數字的是「合計」；之後的帳戶是外幣（餘額有小數點）。
     交易明細：帳號那列的數字是「上期結餘」，之後「日期 … 金額 … 餘額」，最後只有餘額的是「本期結餘」。 */
  function parseCtbcBank(pages) {
    const res = emptyResult('ctbc_bank', '中國信託');
    res.kind = 'bank';
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/(\d{4})\/(\d{2})\/\d{2}(\d{4})\/(\d{2})\/(\d{2})/);
    if (pm) res.period = `${pm[3]}-${pm[4]}`;
    const accRe = /^\d{5}\*\*\d{4}\*$/;
    let stage = 'twd', twdTotal = null, txAcc = '', opening = null, txRows = [], seenTx = new Set();
    const p2 = pages[1] || [];
    p2.forEach(l => {
      const c = l.cells.map(x => x.t);
      const accIdx = c.findIndex(x => accRe.test(x));
      // 帳戶持有明細（帳號在左邊、x < 200）
      if (accIdx >= 0 && l.cells[accIdx].x0 > 100 && l.cells[accIdx].x0 < 200 && !txAcc) {
        const n = c.slice(accIdx + 1).find(isNum);
        res.bankAccounts.push({ accountNo: c[accIdx], type: stage === 'twd' ? '台幣存款' : '外幣存款', currency: stage === 'twd' ? 'TWD' : 'USD', balance: num(n) });
        return;
      }
      if (stage === 'twd' && res.bankAccounts.length && c.length === 1 && isNum(c[0])) { twdTotal = num(c[0]); stage = 'fx'; return; }
      // 交易明細：帳號在最左邊（x < 60）。有的版面帳號單獨一行（後面是上期餘額），有的每筆明細前面都印帳號
      let dateCol = -1;
      if (accIdx === 0 && l.cells[0].x0 < 60) {
        dateCol = c.findIndex(isDate);
        if (txAcc !== c[0]) {
          if (txAcc) checkLastBalance(res, txAcc, bankColTx(res, txAcc, txRows, 'TWD'));
          txAcc = c[0]; txRows = []; seenTx.add(txAcc);
          const n = c.slice(1).filter(isNum);
          opening = dateCol < 0 && n.length ? num(n[n.length - 1]) : null;
        }
        if (dateCol < 0) return;
      }
      if (txAcc && (dateCol >= 0 || isDate(c[0]))) {
        const di = dateCol >= 0 ? dateCol : 0;
        const nums = l.cells.slice(di + 1).filter(x => isNum(x.t));
        if (nums.length >= 2) {
          const bal = num(nums[nums.length - 1].t), amtCell = nums[nums.length - 2], amt = num(amtCell.t);
          const prev = txRows.length ? txRows[txRows.length - 1].balance : opening;
          // 知道上一筆餘額就用加減判斷；不知道（第一筆）就看金額靠哪一欄：支出欄右緣約 371、存入欄約 408（中信版面固定）
          const isIn = prev === null ? Math.abs(amtCell.x1 - 408) < Math.abs(amtCell.x1 - 371) : Math.abs(round2(prev + amt) - bal) < 0.005;
          txRows.push({ date: isoDate(c[di]), desc: '（中信明細，摘要讀不出字）', out: isIn ? 0 : amt, in: isIn ? amt : 0, balance: bal });
        }
      }
    });
    if (txAcc) checkLastBalance(res, txAcc, bankColTx(res, txAcc, txRows, 'TWD'));
    if (twdTotal !== null) check(res, '台幣存款合計', twdTotal, res.bankAccounts.filter(a => a.currency === 'TWD').reduce((s, a) => s + a.balance, 0));
    res.warnings = res.warnings.filter(w => !/摘要讀不出字/.test(w));
    return finishBank(res, 'ctbc_bank');
  }

  /* ================= 永豐金證券（證券電子對帳單） =================
     App 裡寫到「媽的永豐」分頁（買進明細、股數），所以結果多一個 yfMode */
  function parseSinopacSec(pages) {
    const res = emptyResult('sinopac_sec', '永豐金證券');
    res.kind = 'securities';
    res.yfMode = true;
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/成交年月：(\d{4})(\d{2})/);
    if (pm) res.period = `${pm[1]}-${pm[2]}`;
    const am = text.match(/客戶帳號：([0-9A-Z*\-]+)/);
    if (am) res.account = am[1];
    let section = '', holdSub = null, tradeSub = null, net = null;
    lines.forEach((l, i) => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (j === '證券庫存') { section = 'hold'; return; }
      if (j === '證券交易明細') { section = 'trade'; return; }
      if (section === 'hold') {
        if (c[0] === '小計') { holdSub = { shares: num(c[1]), cost: num(c[2]), value: num(c[3]) }; return; }
        const ci = c.findIndex(x => /^\d{4,6}[A-Z]?$/.test(x));
        if (ci >= 0 && /現股|融資|融券/.test(c[0])) {
          // 名稱可能被拆成上下兩行（例如「國泰永續高股」「息」）
          const up = lines[i - 1] && lines[i - 1].page === l.page ? lineText(lines[i - 1]).replace(/\s+/g, '') : '';
          const down = lines[i + 1] && lines[i + 1].page === l.page ? lineText(lines[i + 1]).replace(/\s+/g, '') : '';
          const name = (/^[^\d]{1,12}$/.test(up) ? up : '') + (/^[^\d]{1,4}$/.test(down) ? down : '');
          res.holdings.push({ code: c[ci], name: name || c[ci], shares: num(c[ci + 1]), avgCost: num(c[ci + 2]), totalCost: num(c[ci + 3]), closePrice: num(c[ci + 4]), marketValue: num(c[ci + 5]) });
        }
      }
      if (section === 'trade') {
        if (c[0] === '小計') { tradeSub = { shares: num(c[1]), amount: num(c[2]), fee: num(c[3]), total: num(c[c.length - 1]) }; return; }
        if (c.includes('客戶淨收付：')) { net = num(c[c.length - 1]); return; }
        if (isDate(c[0]) && /買|賣/.test(c[1] || '')) {
          const side = /賣/.test(c[1]) ? 'sell' : 'buy';
          const nums = l.cells.slice(3).map(x => x.t);
          const shares = num(nums[0]), price = num(nums[1]), amount = num(nums[2]), fee = num(nums[3]);
          const tax = side === 'sell' && nums.length > 5 ? num(nums[4]) : 0;
          const netAmt = num(nums[nums.length - 1]);
          res.trades.push({ date: isoDate(c[0]), name: c[2], code: '', side, mode: 'normal', shares, price, amount, fee, tax, net: side === 'buy' ? -netAmt : netAmt, orderNo: '' });
        }
      }
    });
    // 名稱沒代號：用庫存裡名稱開頭一樣的那檔補上代號
    res.trades.forEach(t => { const h = res.holdings.find(h => h.name.startsWith(t.name) || t.name.startsWith(h.name)); if (h) t.code = h.code; });
    if (holdSub) {
      check(res, '庫存股數小計', holdSub.shares, res.holdings.reduce((s, h) => s + h.shares, 0));
      check(res, '庫存成本小計', holdSub.cost, res.holdings.reduce((s, h) => s + h.totalCost, 0));
    }
    if (tradeSub) {
      check(res, '成交金額小計', tradeSub.amount, res.trades.reduce((s, t) => s + t.amount, 0));
      check(res, '手續費小計', tradeSub.fee, res.trades.reduce((s, t) => s + t.fee, 0));
    }
    if (net !== null) check(res, '客戶淨收付', net, res.trades.reduce((s, t) => s + t.net, 0));
    res.statementId = `sinopac_sec|${res.account}|${res.period}`;
    if (!res.period) res.warnings.push('沒有讀到對帳單月份');
    return res;
  }

  /* ================= 圖片型 PDF：用 OCR（看圖認字）讀出文字 =================
     有些對帳單（例如高雄銀行、公教退撫儲金）整份是圖片，PDF 裡沒有文字。
     這時候把每一頁畫成圖、用 tesseract.js 認字，再整理成跟一般 PDF 一樣的「一行一行的格子」，後面的解析程式就能共用。
     只有遇到圖片型 PDF 才會載入 OCR（第一次要下載辨識程式和中文資料，約 6 MB，之後瀏覽器會記住）。
     OCR 的數字大多準、中文字比較容易錯，所以用 OCR 讀的對帳單一定要通過自我檢查才算過。 */
  const OCR_DEFAULTS = {
    scriptUrl: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_tra/4.0.0_best_int',
    lang: 'chi_tra',
    dpi: 300
  };
  let ocrWorkerPromise = null;
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url; s.onload = resolve; s.onerror = () => reject(new Error('OCR 程式載入失敗（需要網路）'));
      document.head.appendChild(s);
    });
  }
  async function getOcrWorker(cfg, onProgress) {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = (async () => {
        if (typeof root.Tesseract === 'undefined') await loadScript(cfg.scriptUrl);
        const opts = { langPath: cfg.langPath, logger: m => { if (onProgress && m && m.status) onProgress(m.status, m.progress); } };
        if (cfg.corePath) opts.corePath = cfg.corePath;
        if (cfg.workerPath) opts.workerPath = cfg.workerPath;
        if (cfg.gzip === false) opts.gzip = false;
        return root.Tesseract.createWorker(cfg.lang, 1, opts);
      })().catch(e => { ocrWorkerPromise = null; throw e; });
    }
    return ocrWorkerPromise;
  }
  // OCR 的單字（含位置）→ pages 格式。pageH：頁面高（像素）、scale：像素 ÷ 這裡要的座標單位
  function ocrWordsToPage(words, pageH, scale) {
    const W = (words || []).filter(w => w && String(w.text || '').trim() && w.bbox).map(w => ({
      s: String(w.text).trim(), x0: w.bbox.x0 / scale, x1: w.bbox.x1 / scale,
      yc: (w.bbox.y0 + w.bbox.y1) / 2 / scale, h: Math.max(1, (w.bbox.y1 - w.bbox.y0) / scale)
    })).sort((a, b) => a.yc - b.yc);
    const rows = [];
    W.forEach(w => {
      const r = rows.find(x => Math.abs(x.yc - w.yc) < Math.max(2, 0.55 * Math.min(x.h, w.h)));
      if (r) { r.items.push(w); r.yc = (r.yc * (r.items.length - 1) + w.yc) / r.items.length; r.h = Math.max(r.h, w.h); }
      else rows.push({ yc: w.yc, h: w.h, items: [w] });
    });
    rows.sort((a, b) => a.yc - b.yc);
    return rows.map(r => {
      r.items.sort((a, b) => a.x0 - b.x0);
      const cells = [];
      r.items.forEach(it => {
        const last = cells[cells.length - 1];
        if (last && it.x0 - last.x1 <= 1.2 * r.h) { last.t += it.s; last.x1 = it.x1; }
        else cells.push({ x0: it.x0, x1: it.x1, t: it.s });
      });
      cells.forEach(c => { c.t = c.t.replace(/\s+/g, '').replace(/[﹒․‧]/g, '.').replace(/[﹐，]/g, ','); });
      return { y: pageH / scale - r.yc, cells: cells.filter(c => c.t) };
    });
  }
  function isImageOnly(pages) {
    const chars = pages.reduce((n, p) => n + p.reduce((m, l) => m + l.cells.reduce((k, c) => k + c.t.length, 0), 0), 0);
    return chars < 20;
  }
  async function ocrPages(pdfjsLib, data, password, pdfOpts, ocrOpts) {
    const cfg = Object.assign({}, OCR_DEFAULTS, (ocrOpts && ocrOpts.ocr) || {});
    const onProgress = ocrOpts && ocrOpts.onOcrProgress;
    const task = pdfjsLib.getDocument(Object.assign({ data, password: password || undefined, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }, pdfOpts || {}));
    const doc = await task.promise;
    const worker = await getOcrWorker(cfg, onProgress);
    const scale = cfg.dpi / 72;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      if (onProgress) onProgress(`第 ${p}／${doc.numPages} 頁認字中`, null);
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
      const r = await worker.recognize(canvas);
      pages.push(ocrWordsToPage(r.data.words || [], canvas.height, scale));
      canvas.width = canvas.height = 0;
    }
    try { doc.destroy(); } catch (e) { /* 略過 */ }
    return pages;
  }

  /* ================= 高雄銀行（綜合對帳單；圖片型，用 OCR） =================
     OCR 讀不準帳號，所以帳號用「活存1、定存1、外幣活存1」這種順序代號 */
  const KH_CUR = { 美金: 'USD', 美元: 'USD', 日圓: 'JPY', 日幣: 'JPY', 歐元: 'EUR', 港幣: 'HKD', 人民幣: 'CNY', 澳幣: 'AUD', 英鎊: 'GBP' };
  function parseKaohsiungBank(pages) {
    const res = emptyResult('kaohsiung_bank', '高雄銀行');
    res.kind = 'bank';
    res.viaOcr = true;
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/(\d{2,3})年(\d{1,2})月綜合對帳單/);
    if (pm) res.period = `${Number(pm[1]) + 1911}-${String(pm[2]).padStart(2, '0')}`;
    let stage = '', counter = { 活存: 0, 定存: 0, 外幣活存: 0, 外幣定存: 0 }, txAcc = '', total = null, equivSum = 0, inTx = false;
    const lastNum = c => { for (let i = c.length - 1; i >= 0; i--) if (isNum(c[i])) return i; return -1; };
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      const tm = l.page === 1 ? j.match(/(?:產|資產)?合計([\d,]+)元/) : null;   // OCR 常把「資」認成別的字，所以只認「合計」   // 第 1 頁「資產合計」（有買基金、外股的月份，這個數字會比存款多，自我檢查就會不過、請你自己看）
      if (tm && total === null) total = num(tm[1]);
      if (j.includes('存款種類(台幣)')) { stage = 'twd'; return; }
      if (j.includes('存款種類(外幣)')) { stage = 'fx'; return; }
      if (j.includes('電子銀行交易明細')) { stage = 'tx'; return; }
      if (stage === 'twd' && /^(活期儲蓄存款|活期存款|定期存款|定期儲蓄存款)/.test(j)) {
        const k = lastNum(c);
        if (k > 0) {
          const type = /^定期/.test(j) ? '定存' : '活存';
          counter[type]++;
          res.bankAccounts.push({ accountNo: `${type}${counter[type]}`, type, currency: 'TWD', balance: num(c[k]) });
          equivSum += num(c[k]);
        }
        return;
      }
      if (stage === 'fx' && /^(活期|定期)/.test(j) && !/^定期性存款/.test(j) && !/^外幣活期/.test(j)) {
        const ci = c.findIndex(x => KH_CUR[x]);
        if (ci >= 0) {
          const nums = c.slice(ci + 1).filter(isNum);
          const type = /^定期/.test(j) ? '外幣定存' : '外幣活存';
          counter[type]++;
          res.bankAccounts.push({ accountNo: `${type}${counter[type]}`, type, currency: KH_CUR[c[ci]], balance: num(nums[0]), twdEquiv: nums.length >= 3 ? num(nums[2]) : 0 });
          equivSum += nums.length >= 3 ? num(nums[2]) : 0;
        }
        return;
      }
      if (stage === 'tx') {
        if (/^帳號[:：]/.test(j)) { txAcc = '活存1'; return; }
        if (/^\d{3}\/\d{2}\/\d{2}$/.test(c[0] || '')) {
          const ai = c.findIndex((x, i) => i > 0 && isNum(x));
          if (ai > 1) {
            const amount = num(c[ai]);
            const desc = c.slice(1, ai).join(' ');
            const more = c.slice(ai + 1).join(' ');
            res.bankTx.push({ accountNo: txAcc || '活存1', date: isoDate(c[0]), desc: more ? `${desc}（轉入 ${more}）` : desc, amount: -amount, balance: null, currency: 'TWD', category: categorizeBankTx(desc) });
          }
        }
      }
    });
    if (total !== null) check(res, '資產合計（第 1 頁）＝各存款帳戶餘額加總', total, equivSum);
    else res.warnings.push('沒有認到第 1 頁的資產合計，無法自我檢查（OCR 可能認錯）');
    if (!res.bankAccounts.length) res.warnings.push('沒有認到任何帳戶');
    collectBankRefs(res);
    res.account = res.bankAccounts.map(a => a.accountNo).join(',');
    res.statementId = `kaohsiung_bank|${res.account}|${res.period}`;
    if (!res.period) res.warnings.push('沒有讀到對帳單月份');
    res.warnings.push('這份是圖片型對帳單，用 OCR 認字讀的，請核對一下數字');
    return res;
  }

  /* ================= 公教退撫儲金（專戶對帳單；圖片型，用 OCR） =================
     不是銀行：帳戶價值、累積提存、單位數、淨值、本月提存。結果放在 res.pension */
  function parsePensionFund(pages) {
    const res = emptyResult('pension_fund', '公教退撫儲金');
    res.kind = 'pension';
    res.viaOcr = true;
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/(\d{4})\D{0,2}\/(\d{2})\/(\d{2})[~～－-](\d{4})\D{0,2}\/(\d{2})\/(\d{2})/);
    let endDate = '';
    if (pm) { res.period = `${pm[4]}-${pm[5]}`; endDate = `${pm[4]}-${pm[5]}-${pm[6]}`; }
    // 每個「小計」那一行的數字
    const subs = [];
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      if (!c.join('').includes('小計')) return;
      const nums = c.filter(isNum).map(num);
      if (nums.length >= 2) subs.push(nums);
    });
    const summary = subs.find(n => n.length >= 3 && Math.abs(n[0] + n[2] - n[1]) < 0.5 && n[1] > 0);
    const month = subs.find(n => n.length >= 4 && Math.abs(n[0] + n[1] + n[2] - n[3]) < 0.5 && n[3] > 0);
    const prevM = text.match(/前期累積提存金額[:：]?([\d,]+)/);
    const pen = { value: null, contributed: null, pnl: null, units: null, nav: null, date: endDate, month: null, prevContributed: prevM ? num(prevM[1]) : null };
    if (summary) { pen.contributed = summary[0]; pen.value = summary[1]; pen.pnl = summary[2]; }
    if (month) pen.month = { own: month[0], gov: month[1], other: month[2], total: month[3] };
    // 本期提存的日期：每一行最前面是日期、後面接 4 個金額
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      if (pen.month && !pen.month.date && /^\d{4}.*\d{2}\/\d{2}$/.test(c[0] || '') && c.filter(isNum).length >= 4) {
        const m = c[0].match(/(\d{2})\/(\d{2})$/);
        if (m && pen.date) pen.month.date = `${pen.date.slice(0, 4)}-${m[1]}-${m[2]}`;
      }
    });
    // 單位數 × 淨值＝帳戶價值（找出符合的那一組四位小數）
    const d4 = [];
    lines.forEach(l => l.cells.forEach(cell => { if (/^\d{1,3}(,\d{3})*\.\d{4}$/.test(cell.t)) d4.push(num(cell.t)); }));
    if (pen.value !== null) {
      for (const u of d4) for (const n of d4) if (!pen.units && u !== n && Math.abs(u * n - pen.value) <= 1) { pen.units = u; pen.nav = n; }
    }
    res.pension = pen;
    res.account = '公教人員專戶';
    res.statementId = `pension_fund|${res.period}`;
    if (!summary) res.warnings.push('沒有認到「儲金帳戶概況」的累積提存、帳戶價值、損益（OCR 可能認錯）');
    else check(res, '累積提存金額＋投資損益＝帳戶價值', pen.contributed + pen.pnl, pen.value);
    if (summary && pen.units !== null) check(res, '單位數×淨值≈帳戶價值（差 1 元內）', pen.value, Math.abs(pen.units * pen.nav - pen.value) <= 1 ? pen.value : pen.units * pen.nav);
    else if (summary) res.warnings.push('沒有認到單位數和淨值');
    if (month) check(res, '本期提存：個人＋政府＋其他＝小計', month[0] + month[1] + month[2], month[3]);
    if (month && pen.prevContributed !== null && summary) check(res, '前期累積＋本期提存＝累積提存金額', pen.prevContributed + month[3], pen.contributed);
    if (!res.period) res.warnings.push('沒有讀到對帳單月份');
    res.warnings.push('這份是圖片型對帳單，用 OCR 認字讀的，請核對一下數字');
    return res;
  }


  /* ================= 玉山銀行（綜合對帳單；圖片型，用 OCR） ================= */
  const ESUN_CODES = ['TWD', 'USD', 'CNY', 'AUD', 'ZAR', 'NZD', 'EUR', 'HKD', 'JPY', 'MXN', 'CAD', 'CHF', 'GBP', 'SEK', 'SGD', 'THB'];
  function editDist(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // OCR 常把幣別認錯一個字（USD → UspD），找最像的那一個
  function guessCurrency(s) {
    const u = String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (ESUN_CODES.includes(u)) return u;
    const best = ESUN_CODES.map(c => ({ c, d: editDist(u, c) })).sort((a, b) => a.d - b.d)[0];
    return best && best.d <= 1 && u.length >= 3 ? best.c : '';
  }
  const MONEY2 = /^\d{1,3}(,\d{3})*\.\d{2}$/;
  function parseEsunBank(pages) {
    const res = emptyResult('esun_bank', '玉山銀行');
    res.kind = 'bank';
    res.viaOcr = true;
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/(\d{4})年(\d{1,2})月/);
    if (pm) res.period = `${pm[1]}-${String(pm[2]).padStart(2, '0')}`;
    let stage = '', total = null, counter = { 活存: 0, 定存: 0, 外幣活存: 0, 外幣定存: 0 }, txAcc = '', outMid = null, rows = [], fxTx = 0;
    const accs = [];
    const flush = () => {
      if (txAcc && rows.length) {
        let prev = null;
        rows.forEach(r => {
          let out = r.isOut;
          if (out === null || out === undefined) out = prev !== null ? Math.abs(round2(prev + r.amountAbs) - r.balance) > 0.005 : true;
          r.out = out ? r.amountAbs : 0;
          r.in = out ? 0 : r.amountAbs;
          prev = r.balance;
        });
        const last = bankColTx(res, txAcc, rows, 'TWD');
        checkLastBalance(res, txAcc, last, 'TWD');
      }
      rows = [];
    };
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (l.page === 1 && total === null && /^.{0,2}合計$/.test(c[0] || '') && isNum(c[1])) total = num(c[1]);   // 第 1 頁「資產合計」
      if (/^存款/.test(j) && /資料日期/.test(j)) { stage = 'acc'; return; }
      if (j.includes('臺幣活存交易明細') || j.includes('臺幣定存交易明細')) { flush(); stage = 'tx'; return; }
      if (/外幣.{0,2}交易明細/.test(j)) { flush(); stage = 'fx'; return; }
      if (stage === 'acc' && /^(臺|台)?(幣|敝)?(活存|定存)|^外(幣|敝)(活存|定存)/.test(c[0] || '') && c.length >= 3) {
        const fx = /^外/.test(c[0]);
        const isTime = /定存/.test(c[0]);
        const bal = [...c].reverse().find(x => MONEY2.test(x));
        if (bal === undefined) return;
        const ci = c.findIndex((x, i) => i > 0 && /^[A-Za-z]{3,4}$/.test(x));
        const cur = fx ? (guessCurrency(ci >= 0 ? c[ci] : '') || 'USD') : 'TWD';
        const type = (fx ? '外幣' : '') + (isTime ? '定存' : '活存');
        counter[type]++;
        // 帳號被遮掉一半、OCR 又容易認錯，所以用「活存1」這種編號當帳號
        const acc = { accountNo: `${type}${counter[type]}`, type: isTime ? '定存' : '活存', currency: cur, balance: num(bal), maskedNo: (c[1] || '').replace(/[^\d*]/g, '') };
        res.bankAccounts.push(acc);
        accs.push(acc);
        return;
      }
      if (stage === 'tx' || stage === 'fx') {
        if (/銀行帳號/.test(j)) { txAcc = stage === 'tx' ? (accs.find(a => a.currency === 'TWD' && a.type === '活存') || {}).accountNo || '活存1' : ''; return; }
        if (/提款/.test(j) && /餘額/.test(j)) {
          const o = l.cells.find(x => x.t === '提款');
          const d = l.cells.find(x => /^存款/.test(x.t));
          outMid = o && d ? (o.x1 + d.x0) / 2 : null;
          return;
        }
        const dm = /^(\d{3})\/(\d{2})\/(\d{2})(.*)$/.exec(c[0] || '');
        if (dm) {
          if (stage === 'fx') { fxTx++; return; }
          const money = l.cells.filter(x => MONEY2.test(x.t));
          if (money.length < 2) { res.warnings.push(`${c[0]}：這一行認不出金額和餘額`); return; }
          const amt = money[0], bal = money[money.length - 1];
          const desc = (dm[4].replace(/^[^一-鿿A-Za-z0-9]+/, '') + (dm[4].trim() ? '' : (c[1] || ''))).trim();
          const isOut = outMid !== null ? amt.x1 < outMid : null;
          rows.push({ date: isoDate(`${dm[1]}/${dm[2]}/${dm[3]}`), desc: desc || (c[1] || ''), amountAbs: num(amt.t), isOut, balance: num(bal.t) });
        }
      }
    });
    flush();
    if (fxTx) res.warnings.push(`外幣帳戶的明細有 ${fxTx} 筆，這份還沒有讀（記帳只記台幣）`);
    if (total !== null) {
      // 外幣沒有折合臺幣欄，只能在外幣都是 0 的時候核對
      const fxBal = accs.filter(a => a.currency !== 'TWD' && a.balance).length;
      if (!fxBal) check(res, '資產合計（第 1 頁）＝各存款帳戶餘額加總', total, accs.reduce((s, a) => s + a.balance, 0));
      else res.warnings.push('有外幣餘額，資產合計（折合臺幣）沒辦法自動核對');
    } else res.warnings.push('沒有認到第 1 頁的資產合計，無法自我檢查（OCR 可能認錯）');
    if (!accs.length) res.warnings.push('沒有認到任何帳戶');
    collectBankRefs(res);
    res.account = accs.map(a => a.accountNo).join(',');
    res.statementId = `esun_bank|${res.account}|${res.period}`;
    if (!res.period) res.warnings.push('沒有讀到對帳單月份');
    res.warnings.push('這份是圖片型對帳單，用 OCR 認字讀的，請核對一下數字');
    return res;
  }

  /* ================= 私校退撫儲金（專戶對帳單；圖片型，用 OCR） =================
     跟公教那份版面不同：三種儲金類別（學校／教職員／主管機關）加上兩個投資組合。結果同樣放在 res.pension */
  const DEC4 = /^\d{1,3}(,\d{3})*\.\d{4}$/;
  const INTC = /^\d{1,3}(,\d{3})*$/;
  // 四位小數（單位數、淨值）。OCR 有時把小數點認成逗號（27,5195），也收進來
  function dec4(t) {
    if (DEC4.test(t)) return num(t);
    const m = /^(\d{1,3}),(\d{4})$/.exec(t);
    return m ? Number(m[1] + '.' + m[2]) : null;
  }
  // OCR 偶爾把「淨值」其中一個數字認錯（5 看成 9）：單位數×淨值要等於現值，不等就試著改一個數字，改了剛好吻合才採用
  function repairNav(units, nav, value) {
    if (Math.abs(units * nav - value) <= 1) return { nav, fixed: false };
    const s = nav.toFixed(4);
    const alt = { '0': '86', '1': '7', '3': '85', '5': '963', '6': '58', '7': '1', '8': '036', '9': '5' };
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '.') continue;
      for (const ch of (alt[s[i]] || '')) {
        const n = Number(s.slice(0, i) + ch + s.slice(i + 1));
        if (Math.abs(units * n - value) <= 0.5) return { nav: n, fixed: true, from: nav };
      }
    }
    return { nav, fixed: false };
  }
  function parsePensionPrivate(pages) {
    const res = emptyResult('pension_private', '私校退撫儲金');
    res.kind = 'pension';
    res.viaOcr = true;
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/(\d{4})\D{0,2}\/(\d{2})\/(\d{2})[~～－-](\d{4})\D{0,2}\/(\d{2})\/(\d{2})/);
    let endDate = '';
    if (pm) { res.period = `${pm[4]}-${pm[5]}`; endDate = `${pm[4]}-${pm[5]}-${pm[6]}`; }
    let stage = '';
    const cats = [], ports = [];
    let catSub = null, portSub = null;
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const j = c.join('');
      if (j.includes('儲金帳戶概況')) { stage = 'cat'; return; }
      if (j.includes('投資組合績效概況')) { stage = 'port'; return; }
      if (j.includes('交易明細')) { stage = 'tx'; return; }
      if (stage === 'cat') {
        const ints = c.slice(1).filter(x => INTC.test(x)).map(num);
        if (/^小計/.test(c[0] || '') && ints.length >= 3) catSub = ints;
        else if (ints.length >= 3 && c[0]) cats.push({ name: c[0], contributed: ints[0], value: ints[1], pnl: ints[2] });
      } else if (stage === 'port') {
        const ints = c.slice(1).filter(x => INTC.test(x)).map(num);
        const dec = c.slice(1).map(dec4).filter(x => x !== null);
        if (/^小計/.test(c[0] || '') && ints.length >= 3) portSub = ints;
        else if (/組合/.test(c[0] || '') && dec.length >= 2 && ints.length >= 3) ports.push({ name: c[0].replace(/投資標的組合$/, ''), contributed: ints[0], value: ints[1], pnl: ints[2], units: dec[0], nav: dec[1] });
      }
    });
    const prevM = text.match(/前期累積提存金額[:：]?([\d,]+)/);
    const pen = { value: null, contributed: null, pnl: null, units: null, nav: null, date: endDate, month: null, prevContributed: prevM ? num(prevM[1]) : null, portfolios: ports, categories: cats };
    if (catSub) { pen.contributed = catSub[0]; pen.value = catSub[1]; pen.pnl = catSub[2]; }
    res.pension = pen;
    res.account = '私校退撫專戶';
    res.statementId = `pension_private|${res.period}`;
    if (!catSub) res.warnings.push('沒有認到「儲金帳戶概況」的小計（OCR 可能認錯）');
    else {
      check(res, '累積提存金額＋投資損益＝帳戶價值', pen.contributed + pen.pnl, pen.value);
      if (cats.length) {
        check(res, `${cats.length} 種儲金的累積提存加總＝小計`, cats.reduce((s, x) => s + x.contributed, 0), pen.contributed);
        check(res, `${cats.length} 種儲金的帳戶價值加總＝小計`, cats.reduce((s, x) => s + x.value, 0), pen.value);
        cats.forEach(x => check(res, `${x.name}：累積提存＋損益＝帳戶價值`, x.contributed + x.pnl, x.value));
      } else res.warnings.push('沒有認到各種儲金類別的明細');
    }
    if (ports.length) {
      ports.forEach(p => {
        const r = repairNav(p.units, p.nav, p.value);
        if (r.fixed) { p.navOcr = p.nav; p.nav = r.nav; }
        check(res, `${p.name}：單位數×淨值≈現值（差 1 元內）${r.fixed ? `（OCR 把淨值 ${r.from} 認錯了一個數字，已改成 ${r.nav}）` : ''}`, p.value, Math.abs(p.units * p.nav - p.value) <= 1 ? p.value : p.units * p.nav);
      });
      if (catSub) check(res, '各投資組合現值加總＝帳戶價值', pen.value, ports.reduce((s, x) => s + x.value, 0));
      if (portSub) check(res, '投資組合小計的現值＝各組合加總', portSub[1], ports.reduce((s, x) => s + x.value, 0));
    } else res.warnings.push('沒有認到投資組合');
    // 本期有沒有新增提存：前期累積提存和這期一樣就是沒有
    if (pen.prevContributed !== null && pen.contributed !== null && pen.prevContributed !== pen.contributed) {
      pen.month = { own: 0, gov: 0, other: 0, total: pen.contributed - pen.prevContributed, derived: true };
    }
    if (!res.period) res.warnings.push('沒有讀到對帳單月份');
    res.warnings.push('這份是圖片型對帳單，用 OCR 認字讀的，請核對一下數字');
    return res;
  }

  /* ================= 信用卡帳單 =================
     結果：res.kind 'card'；res.card 總覽；res.cardTx 每一筆消費（消費為正、退款為負） */
  function cardYear(mm, closing) {   // 消費日只有月/日：比結帳日的月份大，就是前一年
    const cy = Number(closing.slice(0, 4)), cm = Number(closing.slice(5, 7));
    return Number(mm) > cm ? cy - 1 : cy;
  }
  function cardRow(c, closing) {
    // 前兩格是日期（消費日、入帳起息日）
    if (!/^\d{2}\/\d{2}$/.test(c[0] || '') || !/^\d{2}\/\d{2}$/.test(c[1] || '')) return null;
    const ai = c.findIndex((x, i) => i >= 2 && isNum(x));
    if (ai < 0) return null;
    const date = d => { const [m, dd] = d.split('/'); return `${cardYear(m, closing)}-${m}-${dd}`; };
    const rest = c.slice(ai + 1);
    const last4 = rest.filter(x => /^\d{4}$/.test(x));
    const tail = rest.filter(x => !/^\d{4}$/.test(x));
    const cur = tail.find(x => /^[A-Z]{3}$/.test(x)) || '';
    const country = tail.find(x => /^[A-Z]{2}$/.test(x)) || '';
    const fa = tail.find(x => isNum(x));
    return {
      date: date(c[0]), postDate: date(c[1]), desc: c.slice(2, ai).join(' '), amount: num(c[ai]),
      last4: last4[0] || '', currency: cur && cur !== 'TWD' ? cur : 'TWD', country, foreignAmount: fa !== undefined ? num(fa) : null
    };
  }
  function parseCathayCard(pages) {
    const res = emptyResult('cathay_card', '國泰世華信用卡');
    res.kind = 'card';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const pm = text.match(/信用卡帳單(\d{2,3})年(\d{1,2})月/);
    if (pm) res.period = `${Number(pm[1]) + 1911}-${String(pm[2]).padStart(2, '0')}`;
    const card = { closingDate: '', dueDate: '', creditLimit: null, totalDue: null, minDue: null };
    // 第 1 頁：結帳日是第一個日期、旁邊是信用額度（標題是圖片，沒有文字，所以靠位置）
    const p1 = lines.filter(l => l.page === 1);
    const dl = p1.find(l => l.cells.some(x => /^\d{3}\/\d{2}\/\d{2}$/.test(x.t)));
    if (dl) {
      card.closingDate = isoDate(dl.cells.find(x => /^\d{3}\/\d{2}\/\d{2}$/.test(x.t)).t);
      const lim = dl.cells.find(x => /^\d{1,3}(,\d{3})+$/.test(x.t));
      if (lim) card.creditLimit = num(lim.t);
    }
    const ext = text.match(/順延[^。，]{0,20}至(\d{3}\/\d{2}\/\d{2})/);
    if (ext) card.dueDate = isoDate(ext[1]);
    const closing = card.closingDate || (res.period ? res.period + '-28' : '');
    let subtotal = null, totalDueLine = null, summary = null;
    lines.filter(l => l.page >= 2).forEach(l => {
      const c = l.cells.map(x => x.t);
      if (/^新臺幣TWD$/.test(c[0] || '') && c.filter(isNum).length >= 5) { summary = c.filter(isNum).map(num); return; }
      if (/^(正卡|附卡)?本期消費$/.test(c[0] || '') && isNum(c[1])) { subtotal = (subtotal || 0) + num(c[1]); return; }
      if (c[0] === '本期應繳總額' && isNum(c[1])) { totalDueLine = num(c[1]); return; }
      const r = closing ? cardRow(c, closing) : null;
      if (r) res.cardTx.push(r);
    });
    const mm = text.match(/新臺幣最低應繳\$([\d,]+)元/), tm = text.match(/新臺幣應繳總額\$([\d,]+)元/);
    if (mm) card.minDue = num(mm[1]);
    if (tm) card.totalDue = num(tm[1]);
    res.card = card;
    // 繳款條碼的代碼尾數（每個人不一樣，用來分辨不同持卡人的帳單）
    const code = text.match(/(\d{4})-(\d{4})-(\d{4})-(\d{4})/);
    res.account = code ? code[4] : '';
    res.statementId = `cathay_card|${res.account}|${res.period}`;
    if (!res.period) res.warnings.push('沒有讀到帳單月份');
    if (!card.closingDate) res.warnings.push('沒有讀到帳單結帳日');
    // 自我檢查：用帳單自己印的總數互相核對
    if (subtotal !== null) check(res, '消費明細加總＝正卡本期消費', subtotal, res.cardTx.reduce((s, x) => s + (x.currency === 'TWD' ? x.amount : 0), 0));
    if (totalDueLine !== null && card.totalDue !== null) check(res, '本期應繳總額（明細頁）＝繳款條碼上的應繳總額', totalDueLine, card.totalDue);
    if (summary && totalDueLine !== null) check(res, '本期應繳總額（明細頁）＝總覽表最後一格', totalDueLine, summary[summary.length - 1]);
    if (!res.checks.length) res.warnings.push('沒有讀到可以自我核對的總數');
    return res;
  }
  // 台北富邦信用卡：還沒有真實帳單可以對照，先用通用規則讀，結果一律要你自己核對
  function parseFubonCard(pages) {
    const res = emptyResult('fubon_card', '台北富邦信用卡');
    res.kind = 'card';
    const lines = flatLines(pages);
    const text = allText(pages).replace(/\s+/g, '');
    const card = { closingDate: '', dueDate: '', creditLimit: null, totalDue: null, minDue: null };
    const cm = text.match(/(?:帳單結帳日|結帳日|帳單日)[:：]?(\d{2,4}\/\d{1,2}\/\d{1,2})/);
    if (cm) card.closingDate = isoDate(cm[1]);
    const dm = text.match(/繳款截止日[:：]?(\d{2,4}\/\d{1,2}\/\d{1,2})/);
    if (dm) card.dueDate = isoDate(dm[1]);
    const tm = text.match(/本期應繳總額[:：]?\$?([\d,]+)/);
    if (tm) card.totalDue = num(tm[1]);
    const mm = text.match(/最低應繳金額[:：]?\$?([\d,]+)/);
    if (mm) card.minDue = num(mm[1]);
    if (card.closingDate) res.period = card.closingDate.slice(0, 7);
    const closing = card.closingDate;
    lines.forEach(l => {
      const c = l.cells.map(x => x.t);
      const r = closing ? cardRow(c, closing) : null;
      if (r) res.cardTx.push(r);
    });
    res.card = card;
    res.account = '';
    res.statementId = `fubon_card||${res.period}`;
    if (!closing) res.warnings.push('沒有讀到帳單結帳日');
    res.warnings.push('台北富邦信用卡的版面還沒有用真實帳單驗證過，請逐筆核對');
    return res;
  }

  /* ---------------- 總入口 ---------------- */
  const PARSERS = {
    cathay_sec: parseCathaySec,
    fubon_sec: parseFubonSec,
    fubon_bank: parseFubonBank,
    cathay_bank: parseCathayBank,
    first_bank: parseFirstBank,
    sinopac_bank: parseSinopacBank,
    taishin_bank: parseTaishinBank,
    next_bank: parseNextBank,
    hncb_bank: parseHncbBank,
    ctbc_bank: parseCtbcBank,
    bot_bank: parseBotBank,
    kaohsiung_bank: parseKaohsiungBank,
    pension_fund: parsePensionFund,
    pension_private: parsePensionPrivate,
    esun_bank: parseEsunBank,
    cathay_card: parseCathayCard,
    fubon_card: parseFubonCard,
    sinopac_sec: parseSinopacSec
  };
  const LABELS = {
    cathay_sec: '國泰證券', fubon_sec: '富邦證券', fubon_bank: '台北富邦銀行',
    cathay_bank: '國泰世華銀行', fubon_card: '台北富邦信用卡', first_bank: '第一銀行',
    sinopac_bank: '永豐銀行', taishin_bank: '台新銀行', next_bank: '將來銀行', hncb_bank: '華南銀行', ctbc_bank: '中國信託', bot_bank: '台灣銀行', kaohsiung_bank: '高雄銀行', pension_fund: '公教退撫儲金', pension_private: '私校退撫儲金', esun_bank: '玉山銀行', cathay_card: '國泰世華信用卡',
    sinopac_sec: '永豐金證券'
  };

  // 讀一份 PDF：回傳結果（或 {unsupported:true}）
  async function parsePdf(pdfjsLib, data, password, docOpts) {
    const keep = data && data.slice ? data.slice(0) : data;   // pdf.js 會把資料「搬走」，圖片型要再讀一次所以先留一份
    const { ocr, onOcrProgress, noOcr, ...pdfOpts } = docOpts || {};   // 其餘是 pdf.js 自己的選項（字型對照表位置）
    let pages = await extractPages(pdfjsLib, data, password, pdfOpts);
    let viaOcr = false;
    if (isImageOnly(pages) && !noOcr) {
      pages = await ocrPages(pdfjsLib, keep, password, pdfOpts, { ocr, onOcrProgress });
      viaOcr = true;
    }
    const source = detect(pages);
    if (!source) return { unsupported: true, imageOnly: viaOcr, label: viaOcr ? '圖片型對帳單，認不出是哪一家' : '認不出是哪一家的對帳單' };
    if (!PARSERS[source]) return { unsupported: true, source, label: LABELS[source] + '（目前先不處理）' };
    const res = PARSERS[source](pages);
    // 用 OCR 讀的：一定要有自我檢查、而且全部通過，才算通過（提醒文字不算）
    const realWarn = res.warnings.filter(w => !/OCR 認字讀的/.test(w));
    res.allChecksOk = res.checks.length > 0 && res.checks.every(c => c.ok) && realWarn.length === 0;
    return res;
  }

  const api = { parsePdf, extractPages, ocrPages, ocrWordsToPage, isImageOnly, detect, PARSERS, LABELS, isoDate, BANK_KEYWORDS, categorizeBankTx, setUserKeywords };
  root.StmtParsers = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
