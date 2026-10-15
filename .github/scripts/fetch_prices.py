"""每日抓台股收盤價，存成 data/prices.json，給網頁的「🔄 更新股價」按鈕讀取。

來源（都是公開資料）：
  - 證交所 OpenAPI：上市股票與 ETF 最近一個交易日的收盤價
  - 櫃買中心 OpenAPI：上櫃股票收盤價（抓不到就跳過，不影響上市資料）

輸出格式（只放代號、名稱、收盤價、資料日期，檔案很小）：
  {"twseDate": "1151013", "tpexDate": "1151013",
   "prices": {"00878": {"n": "國泰永續高股息", "p": 35.34, "d": "1151013"}, ...}}

不放「抓取時間」，這樣價格沒變的日子（例如放假）檔案內容完全一樣，就不會多一筆紀錄。
證交所抓失敗時不覆蓋舊檔案，結束代碼非 0，Actions 頁面會顯示紅色失敗。
"""
import json
import os
import sys
import time
from urllib.request import Request, urlopen

URL_TWSE = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
URL_TPEX = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "prices.json")


def get_json(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0 (All-MoneyBook daily prices)", "Accept": "application/json"})
            with urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8-sig"))
        except Exception as e:  # 網路不穩就等一下再試
            last = e
            time.sleep(5 * (i + 1))
    raise last


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
        if code and p:
            out[code] = {"n": str(r.get("Name", "")).strip(), "p": p, "d": str(r.get("Date", "")).strip()}
    return out


def parse_tpex(rows):
    out = {}
    for r in rows or []:
        code = str(r.get("SecuritiesCompanyCode") or r.get("Code") or "").strip().upper()
        p = to_price(r.get("Close") or r.get("ClosingPrice"))
        if code and p:
            out[code] = {"n": str(r.get("CompanyName") or r.get("Name") or "").strip(), "p": p, "d": str(r.get("Date", "")).strip()}
    return out


def build(twse, tpex):
    prices = dict(tpex)
    prices.update(twse)  # 同代號以上市為準
    pick_date = lambda m: max((v["d"] for v in m.values() if v["d"]), default="")
    return {"twseDate": pick_date(twse), "tpexDate": pick_date(tpex),
            "prices": dict(sorted(prices.items()))}


def main():
    try:
        twse = parse_twse(get_json(URL_TWSE))
    except Exception as e:
        print("證交所抓取失敗：", e)
        return 1
    if len(twse) < 500:  # 正常會有一千多檔，太少代表資料不完整，不要覆蓋
        print(f"證交所資料只有 {len(twse)} 筆，看起來不完整，不更新檔案")
        return 1
    try:
        tpex = parse_tpex(get_json(URL_TPEX))
    except Exception as e:
        print("櫃買中心抓取失敗（上櫃沿用上一次的價格，只更新上市）：", e)
        tpex = {}
    if not tpex:
        try:
            with open(OUT, encoding="utf-8") as f:
                old = json.load(f).get("prices", {})
            tpex = {k: v for k, v in old.items() if k not in twse}
        except (OSError, ValueError):
            tpex = {}

    data = build(twse, tpex)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"完成：上市 {len(twse)} 檔（{data['twseDate']}），上櫃 {len(tpex)} 檔（{data['tpexDate']}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
