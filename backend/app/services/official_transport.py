"""Read the timetable endpoint used by the public IETT route page itself."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from html import unescape
from html.parser import HTMLParser
import re

import httpx
from app.services.place_service import normalize


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.table, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table": self.table = []
        if tag == "tr" and self.table is not None: self.row = []
        if tag in {"th", "td"} and self.row is not None: self.cell = []

    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in {"th", "td"} and self.cell is not None:
            self.row.append(" ".join(self.cell).strip()); self.cell = None
        if tag == "tr" and self.row is not None:
            self.table.append(self.row); self.row = None
        if tag == "table" and self.table is not None:
            self.tables.append(self.table); self.table = None


def parse_timetable(html):
    parser = Tables(); parser.feed(html)
    schedules = []
    for rows in parser.tables:
        header = next((i for i, row in enumerate(rows) if any("pazar" in normalize(cell) for cell in row)), None)
        if header is None:
            continue
        days = {}
        for index, label in enumerate(rows[header]):
            text = normalize(label)
            day = "saturday" if "cumartesi" in text else "sunday" if "pazar" in text else "weekday" if "is gun" in text or "hafta" in text else None
            if not day: continue
            values = [f"{int(h):02}:{m}" for row in rows[header+1:] if len(row) > index
                for h, m in re.findall(r"\b([0-1]?\d|2[0-3])[:.]([0-5]\d)\b", row[index])]
            if values:
                days[day] = {"times": values, "count": len(values), "first": values[0], "last": values[-1]}
        if days:
            schedules.append({"direction": " ".join(rows[0]), "days": days})
    return schedules


def read_iett(route):
    code = route.get("code") or ""
    if not re.fullmatch(r"\d{1,3}[A-Z]{0,3}", code, re.I): return route
    with httpx.Client(timeout=10) as client:
        response = client.get("https://iett.istanbul/RouteDetail", params={"hkod": code})
        response.raise_for_status()
        fields = {}
        for tag in re.findall(r"<input\b[^>]+>", response.text, re.I):
            attrs = dict(re.findall(r'(\w+)="([^"]*)"', tag))
            if attrs.get("id"):
                fields[attrs["id"]] = unescape(attrs.get("value", ""))
        if fields.get("hatkod", "").upper() != code.upper(): return route
        result = client.post("https://iett.istanbul/tr/RouteStation/GetScheduledDepartureTimes", data={
            "rstart": fields.get("SHATBASI", ""), "rend": fields.get("SHATSONU", ""),
            "timeschule": fields.get("GetPlanlananSeferSaati", ""), "freq": fields.get("GetMetobusFrekans", ""),
            "lngid": "1", "hCode": code})
        result.raise_for_status()
    schedules = parse_timetable(result.text)
    if not schedules: return route
    return {**route, "timetable": schedules, "officialCheckedAt": datetime.now(timezone(timedelta(hours=3))).date().isoformat(),
        "sources": [*route["sources"], {"url": str(response.url), "publisher": "İETT · yayımlanmış hareket saatleri"}]}


def enrich_transport(record):
    def read(route):
        if not any("iett.istanbul" in s["url"] for s in route.get("sources", [])): return route
        try: return read_iett(route)
        except (httpx.HTTPError, ValueError): return route
    selected = record.get("routes", [])[:3]
    with ThreadPoolExecutor(max_workers=3) as executor:
        record["routes"] = list(executor.map(read, selected)) + record.get("routes", [])[3:]
    return record
