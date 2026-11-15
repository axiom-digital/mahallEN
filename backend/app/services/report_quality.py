"""Keep collection coverage separate from neighborhood quality judgments."""
from datetime import date

INFORMATIONAL_REASONS = {
    "social_life": "Aramada bulunan mekânlar örnektir; eksik bir liste mahallenin sosyal yaşam kalitesine sayısal puan vermez.",
    "safety_news": "Tekil haberler karşılaştırılabilir suç oranı veya mahalle güvenliği ölçümü değildir; güvenlik puanına dönüştürülmez.",
}


def evidence_view(report):
    """Old/undated articles remain accessible without becoming current headlines."""
    try:
        today = date.fromisoformat(report["reference_date"][:10])
    except (KeyError, TypeError, ValueError):
        return report
    categories = []
    for category in report.get("categories", []):
        if category["id"] != "safety_news":
            categories.append(category)
            continue
        recent, historical, seen = [], [], set()
        for item in [*category.get("items", []), *category.get("historical_items", [])]:
            key = (item.get("text"), tuple(sorted(s["url"] for s in item.get("sources", []))))
            if key in seen: continue
            seen.add(key)
            try:
                age = (today - date.fromisoformat(item["date"][:10])).days
                current = 0 <= age <= 365
            except (KeyError, TypeError, ValueError):
                current = False
            (recent if current else historical).append(item)
        categories.append({**category, "items": recent, "historical_items": historical,
            "missing_reason": None if recent else "Son bir yıl için tarihi doğrulanmış yerel haber kaydı bulunmadı."})
    return {**report, "categories": categories}
