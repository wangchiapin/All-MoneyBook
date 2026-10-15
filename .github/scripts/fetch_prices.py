"""每日抓台股收盤價，存成 data/prices.json，給網頁的「🔄 更新股價」按鈕讀取。

來源（都是公開資料）：
  - 證交所「每日收盤行情」：上市股票與 ETF 當天收盤價（收盤後就有）；
    當天還沒有資料時，改用證交所 OpenAPI（最近一個交易日，但更新比較慢）
  - 櫃買中心 OpenAPI：上櫃股票收盤價（抓不到就沿用上一次的價格）
  - 美股：data/us-symbols.txt 裡列的代號，先試 Yahoo Finance，抓不到再試 Stooq
    （都是非官方免費來源，抓不到就沿用上一次的價格）
  權證不收（用不到，而且會讓檔案變很大）。

輸出格式（只放代號、名稱、收盤價、資料日期，檔案很小）：
  {"twseDate": "1151013", "tpexDate": "1151013", "usDate": "2026-10-12",
   "prices": {"00878": {"n": "國泰永續高股息", "p": 35.34, "d": "1151013"},
              "BTI": {"n": "BTI", "p": 52.1, "d": "2026-10-12", "us": 1}, ...}}

另外把當天價格存成 data/month-end/YYYY-MM.json（台灣時間的月份），同一個月每次覆蓋，
月份結束後留下的就是「該月最後一個交易日」的收盤價，給資產總覽算「上個月底」的股票現值。
格式：{"month": "2026-10", "twseDate": "1151031", "usDate": "2026-10-30", "p": {"00878": 35.6, "BTI": 56.6}}

不放「抓取時間」，這樣價格沒變的日子（例如放假）檔案內容完全一樣，就不會多一筆紀錄。
證交所抓失敗時不覆蓋舊檔案，結束代碼非 0，Actions 頁面會顯示紅色失敗。
"""
import csv
import datetime as dt
import io
import json
import os
import re
import sys
import time
from urllib.request import Request, urlopen

URL_TWSE_DAY = "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date={d}&type=ALLBUT0999&response=json"
URL_TWSE = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
URL_TPEX = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"
URL_YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{s}?range=5d&interval=1d"
URL_STOOQ = "https://stooq.com/q/l/?s={s}.us&f=sd2t2ohlcv&h&e=csv"
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "prices.json")
US_LIST = os.path.join(ROOT, "data", "us-symbols.txt")
MONTH_DIR = os.path.join(ROOT, "data", "month-end")
KEEP_MONTHS = 15  # 月底價保留幾個月
TW = dt.timezone(dt.timedelta(hours=8))


def keep_code(code):
    """只留股票與 ETF/ETN：4 碼股票，或 00/02 開頭的 ETF、ETN；其他 6 碼（權證）不要。"""
    return bool(re.fullmatch(r"\d{4}", code)) or code.startswith(("00", "02"))


def get_text(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0 (All-MoneyBook daily prices)", "Accept": "*/*"})
            with urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8-sig")
        except Exception as e:  # 網路不穩就等一下再試
            last = e
            time.sleep(5 * (i + 1))
    raise last


def get_json(url, tries=3):
    return json.loads(get_text(url, tries))


def to_price(v):
    try:
        p = float(str(v).replace(",", "").strip())
        return round(p, 4) if p > 0 else None
    except ValueError:
        return None


def parse_twse(rows):
    out = {}
    for r in rows or []:
        code = str(r.get("Code", "")).strip().upper()
        p = to_price(r.get("ClosingPrice"))
        if code and p and keep_code(code):
            out[code] = {"n": str(r.get("Name", "")).strip(), "p": p, "d": str(r.get("Date", "")).strip()}
    return out


def parse_tpex(rows):
    out = {}
    for r in rows or []:
        code = str(r.get("SecuritiesCompanyCode") or r.get("Code") or "").strip().upper()
        p = to_price(r.get("Close") or r.get("ClosingPrice"))
        if code and p and keep_code(code):
            out[code] = {"n": str(r.get("CompanyName") or r.get("Name") or "").strip(), "p": p, "d": str(r.get("Date", "")).strip()}
    return out


def parse_twse_day(js, roc_date):
    """證交所每日收盤行情（MI_INDEX）→ {代號: {...}}"""
    out = {}
    for t in js.get("tables") or []:
        fields = t.get("fields") or []
        if "證券代號" not in fields or "收盤價" not in fields:
            continue
        ix = {f: i for i, f in enumerate(fields)}
        for r in t.get("data") or []:
            code = str(r[ix["證券代號"]]).strip().upper()
            p = to_price(r[ix["收盤價"]])
            if code and p and keep_code(code):
                out[code] = {"n": str(r[ix.get("證券名稱", ix["證券代號"])]).strip(), "p": p, "d": roc_date}
    return out


def fetch_twse():
    """先抓今天（台灣時間）的每日收盤行情；今天沒資料（放假或還沒出來）就用 OpenAPI 的最近一天。"""
    today = dt.datetime.now(TW).date()
    roc = f"{today.year - 1911}{today:%m%d}"
    try:
        js = get_json(URL_TWSE_DAY.format(d=today.strftime("%Y%m%d")))
        if str(js.get("stat", "")) == "OK":
            data = parse_twse_day(js, roc)
            if len(data) >= 500:
                return data
            print(f"每日收盤行情只解析到 {len(data)} 筆，改用 OpenAPI")
        else:
            print("每日收盤行情今天沒有資料：", js.get("stat"))
    except Exception as e:
        print("每日收盤行情抓取失敗，改用 OpenAPI：", e)
    return parse_twse(get_json(URL_TWSE))


def read_us_symbols():
    try:
        with open(US_LIST, encoding="utf-8") as f:
            lines = [ln.split("#")[0].strip().upper() for ln in f]
        return [x for x in lines if re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,9}", x)]
    except OSError:
        return []


def fetch_us_one(sym):
    try:
        js = get_json(URL_YAHOO.format(s=sym), tries=2)
        meta = js["chart"]["result"][0]["meta"]
        p = to_price(meta.get("regularMarketPrice"))
        ts = meta.get("regularMarketTime")
        if p:
            tz = dt.timezone(dt.timedelta(seconds=int(meta.get("gmtoffset") or -14400)))  # 美東時間
            d = dt.datetime.fromtimestamp(ts, tz).date().isoformat() if ts else ""
            return {"n": sym, "p": p, "d": d, "us": 1}
    except Exception as e:
        print(f"{sym}：Yahoo 抓不到，改試 Stooq（{e}）")
    try:
        rows = list(csv.DictReader(io.StringIO(get_text(URL_STOOQ.format(s=sym.lower()), tries=2))))
        if rows:
            p = to_price(rows[0].get("Close"))
            if p:
                return {"n": sym, "p": p, "d": rows[0].get("Date", ""), "us": 1}
    except Exception as e:
        print(f"{sym}：Stooq 也抓不到（{e}）")
    return None


def build(twse, tpex):
    prices = dict(tpex)
    prices.update(twse)  # 同代號以上市為準
    pick_date = lambda m: max((v["d"] for v in m.values() if v["d"]), default="")
    return {"twseDate": pick_date(twse), "tpexDate": pick_date(tpex),
            "prices": dict(sorted(prices.items()))}


def write_month_end(data):
    month = dt.datetime.now(TW).strftime("%Y-%m")
    os.makedirs(MONTH_DIR, exist_ok=True)
    out = {"month": month, "twseDate": data["twseDate"], "usDate": data.get("usDate", ""),
           "p": {k: v["p"] for k, v in data["prices"].items()}}
    with open(os.path.join(MONTH_DIR, month + ".json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    files = sorted(fn for fn in os.listdir(MONTH_DIR) if re.fullmatch(r"\d{4}-\d{2}\.json", fn))
    for fn in files[:-KEEP_MONTHS]:
        os.remove(os.path.join(MONTH_DIR, fn))


def main():
    try:
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f).get("prices", {})
    except (OSError, ValueError):
        old = {}

    try:
        twse = fetch_twse()
    except Exception as e:
        print("證交所抓取失敗：", e)
        return 1
    if len(twse) < 500:  # 正常會有一千多檔，太少代表資料不完整，不要覆蓋
        print(f"證交所資料只有 {len(twse)} 筆，看起來不完整，不更新檔案")
        return 1

    try:
        tpex = parse_tpex(get_json(URL_TPEX))
    except Exception as e:
        print("櫃買中心抓取失敗（上櫃沿用上一次的價格）：", e)
        tpex = {}
    if not tpex:
        tpex = {k: v for k, v in old.items() if k not in twse and not v.get("us") and keep_code(k)}

    us = {}
    for sym in read_us_symbols():
        hit = fetch_us_one(sym)
        if hit:
            us[sym] = hit
        elif sym in old and old[sym].get("us"):
            print(f"{sym}：沿用上一次的價格")
            us[sym] = old[sym]

    data = build(twse, tpex)
    data["usDate"] = max((v["d"] for v in us.values() if v.get("d")), default="")
    data["prices"].update(us)
    data["prices"] = dict(sorted(data["prices"].items()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    write_month_end(data)
    print(f"完成：上市 {len(twse)} 檔（{data['twseDate']}），上櫃 {len(tpex)} 檔（{data['tpexDate']}），美股 {len(us)} 檔（{data['usDate']}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
