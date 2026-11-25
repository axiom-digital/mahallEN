const routeSeparator = /(?:\s+[-–—]\s+|\s*[→↔]\s*|(?<=\p{L})-(?=\p{L}))/u;

export function routePlaces(route) {
  // Stop sequences in the evidence may include intermediate places omitted from the route title.
  const evidence = String(route.local_evidence || '').split(/\s+güzerg[aâ]h[ıi]nda\b/iu)[0];
  const title = String(route.route || '').trim();
  const prefix = String(route.code || '');
  const sequences = [prefix && (title.startsWith(prefix + ':') || title.startsWith(prefix + ' '))
    ? title.slice(prefix.length).replace(/^[: ]+/, '') : title];
  if (routeSeparator.test(evidence) && evidence.length < 250 && !/[;.!?]/u.test(evidence)) sequences.unshift(evidence);
  const stops = new Set();
  for (const sequence of sequences) {
    const parts = sequence.split(routeSeparator);
    if (parts.length < 2) continue;
    for (const part of parts) {
      const stop = part.replace(/\s*\(gece hattı\)/giu, '').trim();
      if (stop && stop.length <= 55 && !/kaydı|doğrulandı|kalkışında|bulunmaktadır/i.test(stop)) stops.add(stop);
    }
  }
  return [...stops];
}

export function connections(routes) {
  const places = new Map();
  for (const route of routes) {
    if (/kontrol edilmeli|bilinmiyor/iu.test(route.local_evidence || '')) continue;
    for (const stop of routePlaces(route)) {
      const key = stop.toLocaleLowerCase('tr-TR');
      if (!places.has(key)) places.set(key, { name: stop, lines: [] });
      const line = route.code || route.route;
      const lines = places.get(key).lines;
      if (line && !lines.includes(line)) lines.push(line);
    }
  }
  return [...places.values()];
}

export function safetyStories(items) {
  const safetyTerms = /silah|vurul|saldırı|yaralan|hırsız|gasp|kaza|yangın|şiddet|asayiş|soygun|öldür|cinayet|darp|trafik güvenli|şüpheli ölüm/iu;
  return items.filter(item => safetyTerms.test(item.text || ''))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export function prettyDate(value) {
  if (!value) return '';
  const date = new Date(value.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
