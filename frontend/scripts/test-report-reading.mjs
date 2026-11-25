import assert from 'node:assert/strict';
import { connections, safetyStories } from '../src/components/report/reportReading.mjs';

const routes = [
  { code: '4-1', route: 'Merkez - Gar', local_evidence: 'Merkez - Üniversite - Gar güzergahında mahalle durağı bulunmaktadır' },
  { code: 'T2', route: 'T2: Çarşı→Gar' },
  { code: '8', route: 'Sahil-Gar' },
  { code: '99', route: 'X - Y', local_evidence: 'Mahalle bağlantısı kontrol edilmeli.' },
];
assert.deepEqual(connections(routes).find(row => row.name === 'Gar').lines, ['4-1', 'T2', '8']);
assert(connections(routes).some(row => row.name === 'Üniversite'));
assert(!connections(routes).some(row => row.name === 'X'));
assert.deepEqual(connections([]), []);
const news = [{ text: 'Park açıldı', date: '2026-11-21' }, { text: 'Trafik kazasında bir kişi yaralandı', date: '2026-10-10' }];
assert.deepEqual(safetyStories(news), [news[1]]);
console.log('Güzergâh ve güvenlik haberleri kontrolleri geçti.');

