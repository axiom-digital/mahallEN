"""Read public official route pages; verify titles, timetables and disruption notes."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import json
import re
from urllib.parse import urlparse, urljoin
import requests
from build_static_dataset import ROOT, save, load

OFFICIAL = {'muttas.com.tr', 'www.muttas.com.tr', 'ulasim.muttas.com.tr'}


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables = []; self.current = None; self.row = None; self.cell = None; self.h2 = None; self.heading = ''
    def handle_starttag(self, tag, attrs):
        if tag == 'h2': self.h2 = []
        if tag == 'table': self.current = {'direction': self.heading, 'rows': []}
        if tag == 'tr' and self.current is not None: self.row = []
        if tag in ('td', 'th') and self.row is not None: self.cell = []
    def handle_data(self, data):
        if self.h2 is not None: self.h2.append(data)
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag == 'h2' and self.h2 is not None: self.heading = ' '.join(' '.join(self.h2).split()); self.h2 = None
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(' '.join(self.cell).split())); self.cell = None
        if tag == 'tr' and self.row is not None:
            self.current['rows'].append(self.row); self.row = None
        if tag == 'table' and self.current is not None:
            self.tables.append(self.current); self.current = None


def parse_page(html, code):
    match = re.search(r'<title[^>]*>(.*?)</title>', html, re.S | re.I)
    title = unescape(re.sub('<[^>]+>', '', match[1])).strip() if match else ''
    if not title.startswith(code + ' '): return None
    route_name = title.split('|')[0].removeprefix(code).strip(' -')
    parser = Tables(); parser.feed(html)
    schedules = []
    for table in parser.tables:
        if not table['rows']: continue
        headers = table['rows'][0]
        joined = ' '.join(headers).casefold()
        if not any(day in joined for day in ['cumartesi', 'pazar', 'hafta']): continue
        days = {}
        for index, header in enumerate(headers):
            lower = header.casefold()
            day = 'saturday' if 'cumartesi' in lower else 'sunday' if 'pazar' in lower else 'weekday' if 'hafta' in lower else None
            if not day: continue
            times = [m[0] for row in table['rows'][1:] if len(row) > index for m in [re.findall(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b', row[index])] if m]
            if times: days[day] = {'first': times[0], 'last': times[-1], 'count': len(times), 'times': times}
        if days: schedules.append({'direction': table['direction'], 'days': days})
    plain = re.sub(r'<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>', '', html, flags=re.S | re.I)
    plain = ' '.join(unescape(re.sub('<[^>]+>', ' ', plain)).split())
    updated = re.search(r'Son Güncelleme:\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})', plain)
    window = plain[plain.find('Hat Mesafesi:'):].split('Gidiş Dönüş')[0]
    alerts = []
    # Route notices also appear in a modal AFTER the timetable, outside window.
    for note in re.finditer(rf'(?<!\d){re.escape(code)}\s+G[ÜU]ZERG[ÂA]HINDA[^.]{{5,850}}\.', plain, re.I):
        if re.search(r'çalış|yapılam|değiş|kapan|iptal', note[0], re.I): alerts.append(note[0].strip())
    for match in re.finditer(r'yol çalış|giriş yapılam|geçici güzerg|geçici güzer|güzergah değiş|güzergâh değiş|sefer iptal|trafiğe kap', window, re.I):
        sentence = window[max(0, window.rfind('.', 0, match.start()) + 1):min(len(window), window.find('.', match.end()) + 1 if '.' in window[match.end():] else match.end() + 220)].strip()
        # Remove timetable cells before a note; keep only a short official notice excerpt.
        sentence = re.sub(r'^(?:.*?\b\d{1,2}:\d{2}\b\s*)+', '', sentence).strip()
        if 10 < len(sentence) <= 900 and sentence not in alerts: alerts.append(sentence)
    return {'code': code, 'name': route_name, 'publisherUpdated': updated[1] if updated else None,
            'schedules': schedules, 'alerts': alerts[:8]}


def verify(job):
    code, original = job
    result = {'code': code, 'originalUrl': original, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'unavailable'}
    try:
        url = original
        if urlparse(url).hostname not in OFFICIAL:
            redirect = requests.get(url, timeout=12, allow_redirects=False)
            url = redirect.headers.get('Location', '')
        if urlparse(url).hostname not in OFFICIAL or not url.startswith('https://'): return result
        response = requests.get(url, timeout=15)
        if response.status_code != 200 or urlparse(response.url).hostname not in OFFICIAL: return result
        parsed = parse_page(response.text, code)
        if parsed:
            result.update(parsed); result.update({'status': 'official_page_read', 'url': response.url})
    except requests.RequestException:
        pass
    return result


if __name__ == '__main__':
    reports = load(ROOT / 'data/reports/index.json')['reports']
    targets = {}
    for report in reports:
        for route in report['routes']:
            targets.setdefault(route['code'], set()).update(source['url'] for source in route['sources'])
    # Discover official catalogues from published links; never guess a per-route URL.
    catalogues = {}
    try:
        homepage = requests.get('https://ulasim.muttas.com.tr', timeout=15)
        links = re.findall(r'href=[\"\']([^\"\']+)[\"\']', homepage.text)
        district_links = list(dict.fromkeys(urljoin(homepage.url, unescape(u)) for u in links if u in ['/hatlar/mentese', '/hatlar/ula']))
        for catalogue in district_links:
            page = requests.get(catalogue, timeout=15)
            for raw in re.findall(r'href=[\"\']([^\"\']+)[\"\']', page.text):
                url = urljoin(page.url, unescape(raw))
                code = re.search(r'/hat/(\d{1,2}-\d{1,3})-', url)
                if code and urlparse(url).hostname in OFFICIAL: catalogues[code[1]] = url
    except requests.RequestException:
        pass
    def verify_candidates(code):
        candidates = ([catalogues[code]] if code in catalogues else []) + list(targets[code])
        for url in dict.fromkeys(candidates):
            result = verify((code, url))
            if result['status'] == 'official_page_read':
                result['catalogueFound'] = code in catalogues
                return result
        return {'code': code, 'status': 'unavailable', 'catalogueFound': code in catalogues, 'checkedAt': datetime.now(timezone.utc).isoformat()}
    output = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(verify_candidates, targets):
            output.append(result)
            print(json.dumps({'code': result['code'], 'status': result['status'], 'timetables': len(result.get('schedules', [])), 'alerts': len(result.get('alerts', []))}), flush=True)
    save(ROOT / 'data/verified/official_routes.json', output)
