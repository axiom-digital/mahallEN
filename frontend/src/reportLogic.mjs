import { median } from './scoring.mjs';

export const groups = {
  food: { label: 'Yeme içme', types: ['restaurant', 'fast_food'] },
  nightlife: { label: 'Gece hayatı', types: ['bar', 'pub', 'nightclub', 'live_music'] },
  coffee: { label: 'Kafeler', types: ['cafe'] },
  shopping: { label: 'Market ve alışveriş', types: ['supermarket', 'convenience', 'marketplace'] },
  outdoors: { label: 'Park ve açık hava', types: ['park', 'playground', 'camp_site'] },
  culture: { label: 'Kültür ve etkinlik', types: ['community_centre', 'arts_centre', 'cinema', 'theatre', 'library'] },
};
export const typeLabels = { pharmacy: 'Eczane', sports_centre: 'Spor merkezi', fitness_centre: 'Spor salonu', restaurant: 'Restoran', fast_food: 'Hızlı yemek', cafe: 'Kafe', bar: 'Bar', pub: 'Pub', nightclub: 'Gece kulübü', live_music: 'Canlı müzik', supermarket: 'Market', convenience: 'Market', marketplace: 'Pazar yeri', park: 'Park', playground: 'Oyun alanı', camp_site: 'Kamp alanı', community_centre: 'Kültür merkezi', arts_centre: 'Sanat merkezi', other: 'Mekân', water_park: 'Su parkı', library: 'Kütüphane', theatre: 'Tiyatro', cinema: 'Sinema' };
export function evaluate(report, preferences) {
  const selected = report.rents.filter(r => (!preferences?.roomType || preferences.roomType === 'all' || r.rooms === preferences.roomType) && r.amount > 0 && r.lease !== 'seasonal' && (!preferences?.furnished || preferences.furnished === 'any' || r.furnished === (preferences.furnished === 'yes')));
  const dated = selected.filter(r => r.eligible && r.date);
  const typeStats = [...new Set(selected.map(r => r.rooms))].sort().map(rooms => {
    const samples = selected.filter(r => r.rooms === rooms && r.eligible && r.date);
    return { rooms, median: median(samples.map(r => r.amount)), count: samples.length, candidateCount: selected.filter(r => r.rooms === rooms).length };
  });
  const mid = typeStats.length === 1 ? typeStats[0].median : null;
  const finances = housingCosts(mid, preferences);
  const rent = null;
  const routeText = report.routes.map(r => `${r.route} ${r.localEvidence} ${r.benefit}`).join(' ').toLocaleLowerCase('tr-TR');
  const destinations = [
    { label: 'Otogar', found: /otogar|terminal/.test(routeText) },
    { label: 'Kampüs / yurt', found: /kampüs|üniversite|kyk|yurt|mskü/.test(routeText) },
    { label: 'Hastane', found: /hastane|tıp/.test(routeText) },
    { label: 'Merkez / AVM', found: /merkez|şehir içi|şehiriçi|avm/.test(routeText) },
  ];
  // Connections alone do not measure reliability, detours, roadworks or frequency.
  // A numeric transport rating is withheld until these dimensions are assessed.
  const transport = null;
  const groupCounts = Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, report.venues.filter(v => group.types.includes(v.type) && v.scope !== 'nearby').length]));
  const foundGroups = Object.values(groupCounts).filter(n => n > 0).length;
  const social = null;
  const compatibility = null;
  return { selected, dated, median: mid, typeStats, rent, transport, social, compatibility, destinations, groupCounts, foundGroups, finances,
    withinBudget: preferences ? dated.filter(r => r.amount <= preferences.budget).length : 0 };
}
export function housingCosts(monthlyRent, preferences) {
  const valid = Number.isFinite(monthlyRent) && monthlyRent > 0;
  const payers = Number.isInteger(preferences?.payers) && preferences.payers >= 1 && preferences.payers <= 8 ? preferences.payers : 1;
  const income = Number.isFinite(preferences?.income) && preferences.income > 0 ? preferences.income : null;
  const extras = Number.isFinite(preferences?.extras) && preferences.extras >= 0 ? preferences.extras : null;
  const personalRent = valid ? monthlyRent / payers : null;
  const personalHousing = valid && extras != null ? (monthlyRent + extras) / payers : null;
  const incomePercent = income && personalRent != null ? personalRent / income * 100 : null;
  const totalIncomePercent = income && personalHousing != null ? personalHousing / income * 100 : null;
  return { payers, income, extras, personalRent, personalHousing, incomePercent, totalIncomePercent,
    remainingAfterRent: income && personalRent != null ? income - personalRent : null };
}
export function diverseVenues(venues) {
  const buckets = Object.values(groups).map(g => venues.filter(v => g.types.includes(v.type)));
  buckets.push(venues.filter(v => !Object.values(groups).some(g => g.types.includes(v.type))));
  const output = [];
  for (let i = 0; i < Math.max(0, ...buckets.map(b => b.length)); i++) for (const bucket of buckets) if (bucket[i]) output.push(bucket[i]);
  return output;
}
