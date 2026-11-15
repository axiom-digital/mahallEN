"""Collect a bounded, dated asking-rent sample; never a neighborhood average.

Reads the publisher's listing cards, then checks each selected detail page.
Only the detail's leading address block can support the neighborhood identity.
Footer recommendations, agent addresses and search snippets cannot qualify it.
"""
from datetime import date
import re
import unicodedata

from check_issue32_sources import ROOT, fetch, read_json, write_json, norm

MONTHS = {name: i for i, name in enumerate(
    "Ocak Şubat Mart Nisan Mayıs Haziran Temmuz Ağustos Eylül Ekim Kasım Aralık".split(), 1)}
AS_OF = date(2026, 11, 6)


def folded(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold().replace("ı", "i")) if not unicodedata.combining(c))


def parse_detail(page, target):
    text = page["text"]
    # The address is near the top, well before similar listings and neighbor links.
    prefix = text.split("- Haritada Gör")[0]
    address = f"{target['name']} Mahallesi, {target['district']} , {target['city']}"
    if folded(norm(address)) not in folded(prefix) or len(prefix) > 1500:
        raise ValueError("detail_address_does_not_match_target")
    price = re.search(r"([\d.]+)\s*₺", prefix)
    rooms = re.search(r"\b(\d\+\d)\b", prefix)
    posted = re.search(r"İlan Güncelleme Tarihi (\d{1,2}) (\w+) (20\d{2})", text)
    if not price or not rooms or not posted:
        raise ValueError("price_rooms_or_update_date_missing")
    when = date(int(posted[3]), MONTHS[posted[2]], int(posted[1]))
    if not 0 <= (AS_OF - when).days <= 90:
        raise ValueError("outside_90_day_window")
    if "Kategori Kiralık Daire" not in text:
        raise ValueError("not_a_rental_apartment")
    furnishing = re.search(r"Eşya Durumu (Eşyalı|Eşyasız)", text)
    source_id = "emlakjet-" + page["final_url"].rsplit("-", 1)[-1]
    # A source's update date is not its original publication date.
    date_quote = posted[0]
    location_quote = address
    return {"id": source_id, "target_id": target["id"], "category": "rent_cost",
        "source_id": source_id, "text": f"Yayıncıda {rooms[1]} kiralık daire için {int(price[1].replace('.', '')):,} TL isteniyor; tekil ilan örneği.",
        "evidence_quotes": [location_quote, date_quote, price[0], rooms[1]],
        "location_basis": "Listing detail address explicitly names the neighborhood, district and city; not advertiser/footer location.",
        "rooms": rooms[1], "asking_amount_tl": int(price[1].replace(".", "")),
        "amount_tl_month": None, "price_period": "not_explicitly_stated",
        "furnished": None if not furnishing else furnishing[1] == "Eşyalı",
        "date": when.isoformat(), "date_basis": "listing_updated_at", "publication_date": None,
        "lease_term": "unknown", "eligible_for_current_comparison": False,
        "eligible_for_dated_asking_sample": True,
        "limitations": "Sözleşme süresi, ödeme dönemi, ilan ilk yayın tarihi ve işlemin gerçekleştiği fiyat bilinmiyor. İstenen bedel aylık bedele dönüştürülmedi; mahalle ortalaması değildir."}


def main():
    targets = read_json(ROOT / "data/issue32/targets.json")
    collected, sources, rejected = [], [], []
    for target in targets:
        url = "https://www.emlakjet.com/kiralik-daire/" + target["rental_path"]
        page = fetch(url)
        # Old cache format did not retain article cards.
        if page["status"] == "page_read" and "listing_cards" not in page:
            page = fetch(url, refresh=True)
        sources.append({"id": "emlakjet-search-" + target["id"], "url": url})
        seen_rooms, attempts = set(), 0
        for card in page.get("listing_cards", []):
            if len(seen_rooms) >= 3 or attempts >= 6:
                break
            rooms = re.search(r"\b\d\+\d\b", card["text"])
            if not rooms or rooms[0] in seen_rooms:
                continue
            attempts += 1
            detail = fetch(card["url"])
            sources.append({"id": "emlakjet-" + card["id"], "url": card["url"]})
            try:
                if detail["status"] != "page_read":
                    raise ValueError("detail_not_readable")
                claim = parse_detail(detail, target)
                collected.append(claim)
                seen_rooms.add(claim["rooms"])
            except (ValueError, KeyError) as error:
                rejected.append({"target_id": target["id"], "url": card["url"], "reason": str(error)})
        print(target["id"], "dated samples:", len(seen_rooms), "attempts:", attempts, flush=True)
    write_json(ROOT / "data/issue32/rental_samples.json", {"reference_date": AS_OF.isoformat(),
        "sampling": "First readable detail for up to three distinct room types from the first result page; at most six detail attempts per neighborhood. Not random or representative.",
        "sources": sources, "claims": collected, "rejected": rejected})


if __name__ == "__main__":
    main()
