// Team decision recorded in docs/survey/survey-analysis.md, section 5.
export const agreedWeights = { rent: 32, transport: 10, social: 28, news: 20, hazard: 10 };
export const profiles = {
  general: { label: 'Genel', weights: agreedWeights },
  student: { label: 'Öğrenci', weights: { rent: 30, transport: 25, social: 25, news: 10, hazard: 10 } },
  family: { label: 'Aile', weights: { rent: 20, transport: 15, social: 15, news: 25, hazard: 25 } },
  professional: { label: 'Çalışan', weights: { rent: 20, transport: 30, social: 15, news: 20, hazard: 15 } },
};
export const roomTypes = ['1+0', '1+1', '2+0', '2+1', '3+1'];
export function housingPreferences(roomType, budgetInput) {
  const budget = Number(budgetInput);
  if (!roomTypes.includes(roomType) || !Number.isFinite(budget) || budget < 1000 || budget > 1000000) return null;
  return { roomType, budget };
}
export function housingComparison(rents, preferences) {
  if (!preferences) return { listings: [], median: null, score: null };
  const listings = rents.filter(r => r.rooms === preferences.roomType && Number.isFinite(r.amount) && r.amount > 0);
  const amount = median(listings.map(r => r.amount));
  return { listings, median: amount, score: budgetScore(amount, preferences.budget) };
}
export function budgetScore(amount, budget) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(budget) || budget <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(50 + 200 * (budget - amount) / budget)));
}
export function weightedScore(scores, weights) {
  let total = 0, weight = 0;
  for (const [key, value] of Object.entries(scores)) {
    if (Number.isFinite(value) && value >= 0 && value <= 100 && Number.isFinite(weights[key]) && weights[key] > 0) {
      total += value * weights[key]; weight += weights[key];
    }
  }
  return weight ? Math.round(total / weight) : null;
}
export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
