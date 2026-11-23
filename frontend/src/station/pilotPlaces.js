export const pilotPlaces = [
  { slug: 'kotekli', name: 'Kötekli', district: 'Menteşe', city: 'Muğla' },
  { slug: 'emirbeyazit', name: 'Emirbeyazıt', district: 'Menteşe', city: 'Muğla' },
  { slug: 'muslihittin', name: 'Muslihittin', district: 'Menteşe', city: 'Muğla' },
  { slug: 'orhaniye', name: 'Orhaniye', district: 'Menteşe', city: 'Muğla' },
  { slug: 'akyaka', name: 'Akyaka', district: 'Ula', city: 'Muğla' },
  { slug: 'caferaga', name: 'Caferağa', district: 'Kadıköy', city: 'İstanbul' },
  { slug: 'bahcelievler', name: 'Bahçelievler', district: 'Çankaya', city: 'Ankara' },
  { slug: 'kultur', name: 'Kültür', district: 'Konak', city: 'İzmir' },
  { slug: 'yenibaglar', name: 'Yenibağlar', district: 'Tepebaşı', city: 'Eskişehir' },
  { slug: 'gorukle', name: 'Görükle', district: 'Nilüfer', city: 'Bursa' },
].map((place) => ({ ...place, kind: 'pilot' }));

export function placeQuery({ name, district, city }) {
  return [name, district, city].filter(Boolean).join(' ');
}

export function samePlace(a, b) {
  return placeQuery(a).localeCompare(placeQuery(b), 'tr', { sensitivity: 'accent' }) === 0;
}
