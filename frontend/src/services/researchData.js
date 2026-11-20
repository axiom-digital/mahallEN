import dataset from '../data/report-data.mjs';
import reference from '../data/income-reference.json';
import safety from '../data/safety-research.json';
import { adaptResearchReport, researchList } from './researchAdapter.mjs';

export function list(query, profile) { return researchList(dataset.reports, reference, [safety], query, profile); }
export function report(slug) {
  const record = dataset.reports.find(r => r.id === slug);
  if (!record) throw new Error('Mahalle araştırma kaydı bulunamadı.');
  return adaptResearchReport(record, reference, [safety]);
}
