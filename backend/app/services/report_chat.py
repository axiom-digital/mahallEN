import json
import re
import unicodedata
from pathlib import Path
from statistics import median
from urllib.parse import urlsplit

import httpx

from app.core.config import settings


REPORT_DIRECTORY = Path(__file__).resolve().parents[3] / "data" / "reports"
PILOT_SLUGS = {"kotekli", "emirbeyazit", "muslihittin", "orhaniye", "akyaka"}
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
CONTEXT_LIMIT = 5_000
STRICT_MODELS = {
    "openai/gpt-oss-20b", "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b", "meta-models/muse-spark-open",
}
REPLY_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "report_reply",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "answer": {"type": "string"},
                "source_ids": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["answer", "source_ids"],
            "additionalProperties": False,
        },
    },
}

SYSTEM_PROMPT = """MahallEN'de sohbet eden bir asistansın. Kullanıcının dilinde, doğal ve samimi konuş.
Son mesajı sohbetin devamı olarak ele al. Kullanıcının önceki mesajlarda söylediği tercihleri hatırla.
Bir öneri, seçim veya plan isterse ve hangi seçeneğin uygun olacağını belirleyen önemli bir tercih
henüz belli değilse, önce tek bir kısa ve doğal soru sor. O turda liste, fiyat veya öneri sıralama.
Soruyu konuya göre somutlaştır. Mesela film için ruh halini, gezi için nasıl bir gün istediğini,
ev ararken bütçe ve ulaşım arasında neye öncelik verdiğini sorabilirsin.
Bir tercih sorusuna verilen kısa yanıtı o tercihin kesinleşmesi olarak kabul et ve aynı turda
bir veya iki somut öneri ver. Tercihi yeniden soru biçiminde söyleme. Alt türü öğrenmek için
yeniden bekletme. Örneğin "Hafif ve komik bir film olsun" yanıtından sonra film adı öner.
"Evden çıkıp biraz yürümek istiyorum" yanıtından sonra bir yürüyüş planı öner.
Kullanıcı tercihini ilk mesajda verdiyse de doğrudan öneri ver. Net bilgi sorularına doğrudan cevap ver.
Gündelik sohbette doğal karşılık ver. Her mesajı bir öneriye, ankete veya mahalle konusuna çevirme.
Kullanıcı konuyu değiştirirse yeni konuyu izle. Film ve kitap önerisinde yerleşik, bilinen eserleri
özgün adlarıyla öner. Konum belirtilmediyse yürüyüş veya gezi önerisinde belirli park, sokak veya
mekân adı kullanma. Öneriyi bilmediğin yerel ayrıntılarla süsleme.
Markdown başlığı, kalın yazı veya tablo kullanma."""

REPORT_PROMPT = """
Sana mahalle kayıtları verilebilir. Bunları yalnızca kullanıcı o mahalle veya raporu hakkında
soruyorsa kullan. Rapor hakkında konuşurken iddialarını kayıtlara dayandır, eksik bilgiyi açıkça belirt.
Rapor verisinden yararlandığın cümlenin sonuna ilgili [K1] biçimindeki kanıt numarasını ekle. URL üretme.
Kayıtlarda adı geçmeyen işletme ve mekânları önerme. Menü, ürün, kalite ve çalışma saati uydurma.
Fiyatı yalnızca kullanıcı fiyatı sorarsa veya bütçe belirttiyse ve fiyat bu tercihle ilgiliyse ver.
Kira için tarih, konut tipi, örnek sayısı ve kapsamı belirt. Hazır kira özetindeki ortancayı kullan.
Eşya durumu filtrelenmemiş özeti eşyalı veya eşyasız ilanlarla sınırlıymış gibi anlatma.
Aritmetik ortalama verme. İlanları piyasa ortalaması gibi sunma. Tarihsiz veya sezonluk ilanları
ayrı belirt. Duyuruları, seferleri ve mekânları gerçek zamanlı bilgi gibi sunma. Kalkış saati,
mahalle durağından geçiş saati değildir. Haberlerden suç oranı veya güvenlik garantisi çıkarma.
Deprem araştırma gridi bina güvenliği değerlendirmesi veya resmî AFAD sonucu değildir."""

REPORT_FORMAT_PROMPT = """
JSON nesnesi döndür: answer alanında düz metin yanıt, source_ids alanında yalnızca kullanılan
kanıt numaraları (örneğin ["K1", "K2"]). Sadece soru soruyorsan ya da kanıt kullanmadıysan
source_ids boş liste olsun."""

# Keep qualifiers alongside facts and omit search internals and long source URLs from the prompt.
REPORT_FIELDS = {
    "rents": ("Kira ilanı", "rooms amount date furnished lease eligible locationConflict verification"),
    "routes": ("Ulaşım hattı", "code route localEvidence benefit frequency lastDeparture serviceStatus officialHeadingVerified officialCheckedAt"),
    "transportAlerts": ("Ulaşım duyurusu", "date summary affected status"),
    "news": ("Yerel haber", "date type summary verification"),
    "venues": ("Mekân", "name type address scope distance origin openStatus"),
    "priceContext": ("Yerel fiyat örneği", "area type item amount date conditions status"),
}
TOPIC_TERMS = {
    "rent_cost": "kira konut daire esyali esyasiz sezonluk aidat ortanca ilan butce maliyet",
    "transportation": "otobus ulasim dolmus sefer guzergah kampus durak hat kalkis yol",
    "social_life": "sosyal mekan cafe kafe restoran restaurant yemek yesem yiy aciktim park market eglence gece eczane spor kutuphane",
    "safety_news": "guven asayis suc olay haber hirsiz kaza",
    "hazard": "deprem zemin afad pga tehlike bina",
    "price_context": "ucret fiyat tarife maliyet tl lira",
}
SECTION_TOPICS = {
    "rents": "rent_cost",
    "routes": "transportation",
    "transportAlerts": "transportation",
    "news": "safety_news",
    "venues": "social_life",
    "priceContext": "price_context",
}
VENUE_TYPES = {
    "yemek": {"restaurant", "fast_food"},
    "restoran": {"restaurant", "fast_food"},
    "restaurant": {"restaurant", "fast_food"},
    "kafe": {"cafe"},
    "cafe": {"cafe"},
    "kahve": {"cafe"},
    "park": {"park", "playground"},
    "market": {"supermarket", "convenience", "marketplace"},
    "eczane": {"pharmacy"},
    "veteriner": {"veterinary", "veterinary_clinic", "animal_hospital"},
    "hayvan hastanesi": {"veterinary", "veterinary_clinic", "animal_hospital"},
    "kutuphane": {"library"},
    "sinema": {"cinema"},
    "bar": {"bar", "pub", "nightclub"},
    "spor salonu": {"fitness_centre", "sports_centre"},
}
FOOD_SPECIALTIES = {
    "doner", "durum", "kebap", "pide", "lahmacun", "pizza", "burger", "kofte",
    "corba", "sandvic", "tantuni", "tost", "sushi", "makarna", "tatli",
}


def load_report(slug: str) -> dict:
    if slug not in PILOT_SLUGS:
        raise LookupError(slug)
    return json.loads((REPORT_DIRECTORY / f"{slug}.json").read_text(encoding="utf-8"))


def normalized_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower().replace("ı", "i"))
    return "".join(char for char in value if not unicodedata.combining(char))


def words(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+(?:[+-][0-9]+)?", normalized_text(value)))


def mentioned_reports(question: str) -> set[str]:
    text = normalized_text(question)
    matches = set()
    for slug in PILOT_SLUGS:
        name = r"emir\s*beyazit" if slug == "emirbeyazit" else slug
        if re.search(rf"\b{name}(?:['’]?(?:de|da|te|ta|den|dan|ten|tan|nin|nun|in|un|e|a|i|u))?\b", text):
            matches.add(slug)
    return matches


def asks_open_choice(question: str) -> bool:
    return bool(re.search(
        r"\b(?:ne|nereye|nerede|hangisini)\s+\w+(?:sam|sem)\s*[?!.]*\s*$",
        normalized_text(question),
    ))


def matching_topics(terms_in_question: set[str]) -> set[str]:
    return {
        topic for topic, terms in TOPIC_TERMS.items()
        if any(word.startswith(term) for word in terms_in_question for term in terms.split())
    }


def is_report_question(report: dict, question: str, previous_question: str = "") -> bool:
    terms = words(question)
    location_terms = {*words(report["name"]), report["id"]}
    if (terms & location_terms or report["id"] in mentioned_reports(question)
            or any(word.startswith(("mahalle", "rapor")) for word in terms)):
        return True
    if any(re.fullmatch(r"\d+[+-]\d+", word) for word in terms):
        return True
    if terms & {"burada", "burasi", "orasi", "orada", "buranin", "oranin"}:
        return True
    if matching_topics(terms) and len(terms) <= 5:
        return True
    return (
        bool(previous_question)
        and len(terms) <= 7
        and bool(terms & {"peki", "kac", "hangisi", "digeri", "saat", "olsun", "olabilir", "isterim", "istiyorum"})
        and is_report_question(report, previous_question)
    )


def source_link(raw_sources, source_id: str) -> dict | None:
    for source in raw_sources:
        url = source.get("url") or ""
        parsed = urlsplit(url)
        if parsed.scheme == "https" and parsed.hostname:
            return {"id": source_id, "url": url, "label": source.get("publisher") or "Rapor kaynağı"}
    return None


def venue_matches(report: dict, question: str, previous_question: str = "", *, search_other_reports: bool = False):
    current = words(question)
    specialties = {term for term in FOOD_SPECIALTIES if any(word.startswith(term) for word in current)}
    if "dürüm" not in question.lower():
        specialties.discard("durum")
    normalized = normalized_text(question)
    types = set().union(*(types for name, types in VENUE_TYPES.items()
                          if re.search(rf"\b{re.escape(name)}\w*\b", normalized)))
    if not (specialties or types) or any(word.startswith(("yemekhane", "tarif", "pisir", "yapilir", "nedir"))
                                         for word in current):
        return None
    if "price_context" in matching_topics(current):
        return None

    slug = report["id"]
    location = {*words(report["name"]), slug, f"{slug}de", f"{slug}da", f"{slug}te", f"{slug}ta",
                "buralarda", "burada", "yakinda", "mahalle", "mahallede"}
    if current & {"olmak", "okumak", "kariyer", "meslek"} and not current & location:
        return None
    if not (search_other_reports or current & location or current & {"nerede", "mekan", "var", "oner", "onerir", "hangi"}
            or is_report_question(report, previous_question) or len(current) <= 5):
        return None
    if not search_other_reports and mentioned_reports(question) - {report["id"]}:
        return None

    venues = []
    for row in report["venues"]:
        if specialties:
            if row["type"] not in {"restaurant", "fast_food", "cafe"}:
                continue
            if not any(word.startswith(term) for word in words(row["name"]) for term in specialties):
                continue
        elif row["type"] not in types:
            continue
        if source := source_link(row["sources"], f"K{len(venues) + 1}"):
            venues.append((row, source))
    return sorted(venues, key=lambda match: match[0]["scope"] == "nearby")[:10]


def venue_answer(report: dict, venues: list, selected_ids=()) -> dict:
    if not venues:
        return {"answer": f"{report['name']} raporunda bu isteğe uyan kaynaklı bir mekân kaydı bulamadım. Başka bir tür düşünür müsün?",
                "sources": []}
    selected = [match for match in venues if match[1]["id"] in selected_ids] or venues
    selected = selected[:2]
    lines = [f"{report['name']} raporunda şu seçenekler var:"]
    for row, source in selected:
        area = " · yakın çevre" if row["scope"] == "nearby" else ""
        address = f" — {row['address']}" if row.get("address") else ""
        lines.append(f"• {row['name']}{address}{area} [{source['id']}]")
    lines.append("Gitmeden önce güncel saatleri kontrol edebilirsin.")
    return {"answer": "\n".join(lines), "sources": [source for _, source in selected]}


def other_neighborhood_venues(report: dict, question: str, previous_question: str = "") -> dict | None:
    wants_other = bool(re.search(r"\b(?:baska|diger)\s+(?:bir\s+)?mahalle", normalized_text(question)))
    local = venue_matches(report, question, previous_question)
    lookup = question
    if local is None and wants_other:
        lookup = previous_question
        local = venue_matches(report, lookup, search_other_reports=True)
    if asks_open_choice(question) or local is None or (local and not wants_other):
        return None

    lines = ["Diğer pilot mahallelerin raporlarında şu kayıtlar var:"]
    sources = []
    for slug in sorted(PILOT_SLUGS - {report["id"]}):
        try:
            other = load_report(slug)
        except (OSError, ValueError):
            continue
        found = venue_matches(other, lookup, search_other_reports=True)
        if not found:
            continue
        venue, source = found[0]
        source = {**source, "id": f"K{len(sources) + 1}"}
        area = " (yakın çevre kaydı)" if venue["scope"] in {"nearby", "reference_radius"} else ""
        address = f" — {venue['address']}" if venue.get("address") else ""
        lines.append(f"• {other['name']}{area}: {venue['name']}{address} [{source['id']}]")
        sources.append(source)
        if len(sources) == 2:
            break
    if not sources:
        if wants_other:
            return {"answer": "Diğer pilot mahallelerin raporlarında bu isteğe uyan kaynaklı bir mekân kaydı bulamadım.",
                    "sources": []}
        return None
    if not local:
        lines.insert(0, f"{report['name']} raporunda eşleşen kayıt bulamadım.")
    return {"answer": "\n".join(lines), "sources": sources}


def report_evidence(report: dict, include_timetable: bool):
    for section, (label, fields) in REPORT_FIELDS.items():
        for row in report.get(section, []):
            data = {field: row[field] for field in fields.split() if row.get(field) is not None}
            if section == "routes" and include_timetable and row.get("timetable"):
                data["timetable"] = row["timetable"]
            yield SECTION_TOPICS[section], label, data, row.get("sources", [])
    for topic, findings in report.get("assessments", {}).items():
        for row in findings:
            data = {field: row.get(field) for field in ("criterion", "date", "summary", "status", "sentiment")}
            yield topic, "Rapor bulgusu", data, row.get("sources", [])
    if hazard := report.get("hazard"):
        data = {field: hazard.get(field) for field in ("value", "gridDistance", "sourceYear", "probability", "officialAfad")}
        yield "hazard", "Araştırma gridi (PGA, g)", data, [
            {"url": hazard.get("url"), "publisher": hazard.get("title")}
        ]


def select_evidence(report: dict, question: str, prior_questions: list[str]):
    current = words(question)
    previous = words(" ".join(prior_questions))
    topics = matching_topics(current) or matching_topics(previous)
    include_timetable = any(word.startswith(("saat", "kalkis", "tarife", "hafta", "cumartesi", "pazar"))
                            for word in current | previous)
    candidates = []
    for topic, label, data, raw_sources in report_evidence(report, include_timetable):
        if topic == "price_context" and topic not in topics:
            continue
        line = f"{label} {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}"
        evidence_words = words(line)
        score = 4 * len(current & evidence_words) + len(previous & evidence_words) + 8 * (topic in topics)
        candidates.append((score, topic, line, raw_sources, data if label == "Kira ilanı" else None))
    candidates.sort(key=lambda row: row[0], reverse=True)

    lines = []
    sources = {}
    cited_rents = {}
    remaining = CONTEXT_LIMIT
    topic_counts = {}
    for _, topic, line, raw_sources, rent in candidates:
        limit = 18 if topic in topics else (1 if topics else 3)
        if len(line) + 12 > remaining or topic_counts.get(topic, 0) >= limit:
            continue
        source_id = f"K{len(lines) + 1}"
        lines.append(f"[{source_id}] {line}")
        if rent and rent.get("eligible") and rent.get("date") and rent.get("lease") != "seasonal" and rent.get("amount", 0) > 0:
            cited_rents.setdefault(rent["rooms"], []).append((source_id, rent["amount"]))
        remaining -= len(lines[-1]) + 1
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
        if source := source_link(raw_sources, source_id):
            sources[source_id] = source
    for rooms, samples in sorted(cited_rents.items()):
        eligible_count = sum(
            row["rooms"] == rooms and row.get("eligible") and bool(row.get("date"))
            and row.get("lease") != "seasonal" and row.get("amount", 0) > 0
            for row in report["rents"]
        )
        if eligible_count == len(samples):
            ids = "".join(f"[{source_id}]" for source_id, _ in samples)
            amounts = [amount for _, amount in samples]
            lines.append(f"Kira özeti {rooms}: {len(samples)} tarihli ilan, "
                         f"ortanca {median(amounts):g} TL, aralık {min(amounts):g}–{max(amounts):g} TL. {ids}")
    return "\n".join(lines), sources


def fallback_answer(report: dict, question: str, previous_question: str = "") -> dict:
    if asks_open_choice(question):
        return {"answer": "Nasıl bir şey arıyorsun? Biraz tarif edebilir misin?", "sources": []}
    if (venues := venue_matches(report, question, previous_question)) is not None:
        return venue_answer(report, venues)
    terms = words(question)
    topics = matching_topics(terms)
    rooms = {word for word in terms if re.fullmatch(r"\d+\+\d+", word)}
    codes = {word for word in terms if re.fullmatch(r"\d+-\d+", word)}
    if rooms:
        topics.add("rent_cost")
    if codes:
        topics.add("transportation")
    if not topics and len(terms) <= 5 and terms & {"peki", "kac", "ortanca", "fiyati", "saat"}:
        topics = matching_topics(words(previous_question))

    name = report["name"]
    if terms & (PILOT_SLUGS - {report["id"]}):
        return {"answer": f"Bu sohbet {name} raporuna bağlı. Diğer mahalleyi seçerek onun raporuna soru sorabilirsin.",
                "sources": []}

    overview = any(phrase in question.lower() for phrase in ("bir mahalle", "mahalleyi anlat", "özetle", "genel bilgi"))
    if not topics and not overview:
        return {"answer": f"{name} hakkında hangi konuyu merak ediyorsun? Kira, ulaşım, sosyal yaşam ve güvenlik konusunda rapordaki kayıtları paylaşabilirim.",
                "sources": []}

    lines = [f"{name} raporundaki kayıtlar"]
    sources = []

    def add(text, raw_sources):
        source_id = f"K{len(sources) + 1}"
        if source := source_link(raw_sources, source_id):
            sources.append(source)
            text += f" [{source_id}]"
        lines.append(text)

    if overview or "rent_cost" in topics:
        rent_types = rooms or {"1+1"}
        for room in sorted(rent_types):
            listings = [
                row for row in report["rents"] if row["rooms"] == room and row["eligible"]
                and row["date"] and row["lease"] != "seasonal" and row["amount"] > 0
            ]
            if "esyasiz" in terms:
                listings = [row for row in listings if row["furnished"] is False]
            elif "esyali" in terms:
                listings = [row for row in listings if row["furnished"] is True]
            if listings:
                amount = f"{median(row['amount'] for row in listings):,.0f}".replace(",", ".")
                lines.append(f"{room} için {len(listings)} tarihli ilan örneğinin ortancası {amount} TL.")
                for row in listings[:4]:
                    if source := source_link(row["sources"], f"K{len(sources) + 1}"):
                        sources.append(source)
            else:
                lines.append(f"{room} için bu ölçütlere uyan tarihli kira örneği raporda yok.")

    if overview or "transportation" in topics:
        routes = [row for row in report["routes"] if not codes or row["code"] in codes]
        for route in routes[:4 if not overview else 2]:
            add(f"{route['code']} · {route['route']}. {route['localEvidence']}", route["sources"])
        if not routes:
            lines.append("Bu hat için raporda kayıt bulamadım.")
        elif any(word.startswith(("saat", "kalkis")) for word in terms):
            lines.append("Kalkış saatleri ve yön bilgisi için hat bağlantısını açabilirsin.")

    if overview or ("social_life" in topics and "price_context" not in topics):
        venues = report["venues"]
        if terms & {"cafe", "kafe", "yemek", "restoran", "restaurant"}:
            venues = [row for row in venues if row["type"] in {"cafe", "restaurant", "fast_food"}]
        for venue in venues[:3 if not overview else 2]:
            area = " (yakın çevre)" if venue["scope"] == "nearby" else ""
            add(f"{venue['name']}{area} · {venue['address']}", venue["sources"])
        if venues:
            lines.append("Mekânların güncel çalışma durumu teyit edilmeli.")
    if "price_context" in topics and "rent_cost" not in topics:
        prices = sorted(report.get("priceContext", []), key=lambda row: row["date"] or "", reverse=True)
        for price in prices[:3]:
            add(f"{price['item']} · {price['amount']} TL ({price['date'] or 'tarih belirsiz'}). {price['conditions']}",
                price["sources"])
        if prices:
            lines.append("Bunlar rapordaki fiyat örnekleri. Bugünkü fiyat değişmiş olabilir.")
    if "safety_news" in topics:
        events = sorted(report["news"], key=lambda row: row["date"] or "", reverse=True)[:2]
        for event in events:
            add(f"{event['date'] or 'Tarih belirsiz'} · {event['summary']}", event["sources"])
        if events:
            lines.append("Bu haberlerden mahalle genelinin suç oranı çıkarılamaz.")
    if "hazard" in topics and (hazard := report.get("hazard")) and hazard.get("value") is not None:
        add(f"Araştırma gridindeki PGA değeri {hazard['value']} g. Bina güvenliği için ayrı değerlendirme gerekir.",
            [{"url": hazard.get("url"), "publisher": hazard.get("title")}])
    if len(lines) == 1:
        lines.append("Bu soruya doğrudan yanıt verecek bir kayıt bulamadım. Sorunu biraz daha açabilir misin?")
    return {"answer": "\n\n".join(lines), "sources": sources}


async def answer_question(report: dict, question: str, history: list[dict]) -> dict:
    previous_question = history[-1]["question"] if history else ""
    asks_for_preference = asks_open_choice(question)
    venues = None if asks_for_preference else venue_matches(report, question, previous_question)
    if venues == []:
        return venue_answer(report, venues)
    about_report = not asks_for_preference and (venues is not None or is_report_question(report, question, previous_question))
    sources = {}
    system_prompt = SYSTEM_PROMPT
    if about_report:
        if venues is None:
            evidence, sources = select_evidence(report, question, [turn["question"] for turn in history[-2:]])
        else:
            evidence = "\n".join(f"[{source['id']}] {row['name']} · {row['type']} · {row['address']}"
                                 for row, source in venues)
            system_prompt += "\nMekân listesinden en uygun iki kaydın kimliğini source_ids alanına yaz."
        context = f"Seçili mahalle: {report['name']}, {report['district']}, {report['city']}. Rapor tarihi: {report['asOf']}."
        system_prompt += f"\n{REPORT_PROMPT}\n\n{context}\n\nRapor kayıtları:\n{evidence}\n{REPORT_FORMAT_PROMPT}"
    if asks_for_preference:
        system_prompt += (
            "\n\nSon soru açık uçlu bir seçim istiyor. Bu turda yanıt olarak yalnızca "
            "tercihi netleştiren, konuya uygun tek bir soru yaz. Seçenek tavsiye etme."
        )
    elif history and "?" in history[-1]["answer"] and "?" not in question:
        system_prompt += (
            "\n\nSon mesaj önceki tercih sorusunu yanıtlıyorsa artık öneri turundasın. "
            "Yanıta doğrudan bu tercihe uygun bir veya iki gerçek, somut öneriyle başla. "
            "Yeni tercih sorusu sorma. Eksik ayrıntılar için makul bir varsayımla uygulanabilir "
            "bir öneri ver. Örnek: 'Dışarıda yürüyüş yapmak istiyorum' mesajına "
            "'Yakınındaki bir parkta 30 dakikalık, kısa bir yürüyüşle başlayabilirsin' diye yanıt ver."
        )
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history[-6:]:
        previous_answer = re.sub(r"\[K\d+\]", "", turn["answer"][:900]).strip() or "—"
        if about_report:
            previous_answer = json.dumps({"answer": previous_answer, "source_ids": []}, ensure_ascii=False)
        messages.extend([
            {"role": "user", "content": turn["question"]},
            {"role": "assistant", "content": previous_answer},
        ])
    messages.append({"role": "user", "content": question})
    payload = {
        "model": settings.GROQ_CHAT_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_completion_tokens": 650,
    }
    if about_report:
        payload["response_format"] = REPLY_FORMAT if settings.GROQ_CHAT_MODEL in STRICT_MODELS else {"type": "json_object"}
    if settings.GROQ_CHAT_MODEL.startswith("openai/gpt-oss-"):
        payload.update(reasoning_effort="low", include_reasoning=False)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10, connect=4)) as client:
        response = await client.post(
            GROQ_URL, json=payload, headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
        )
        response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    reply = json.loads(content) if about_report else {"answer": content}
    if venues is not None:
        # Present only catalog entries, even if the model's prose invents a place or menu.
        ids = reply.get("source_ids")
        return venue_answer(report, venues, ids if isinstance(ids, list) else ())
    answer = reply["answer"]
    if not isinstance(answer, str) or not answer.strip() or len(answer) > 3000:
        raise ValueError("Invalid Groq response")
    cited = dict.fromkeys(re.findall(r"\[(K\d+)\]", answer))
    if isinstance(reply.get("source_ids"), list):
        cited.update((key, None) for key in reply["source_ids"] if isinstance(key, str))
    answer = re.sub(r"\s*\[(K\d+)\]", lambda match: match[0] if match[1] in sources else "", answer)
    if not answer.strip():
        raise ValueError("Empty Groq response")
    if about_report and words(answer) in ({"yok"}, {"bilgi", "yok"}, {"bilmiyorum"}):
        return {"answer": "Raporda bu soruya yanıt verecek kadar bilgi bulamadım. Sorunu biraz açabilir misin?",
                "sources": []}
    return {"answer": answer.strip(), "sources": [sources[key] for key in cited if key in sources]}
