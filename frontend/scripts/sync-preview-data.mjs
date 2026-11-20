import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const data = JSON.parse(await readFile(path.join(root, 'data/reports/index.json'), 'utf8'));
if (data.reports.length !== 5 || data.reports.some(r => r.schemaVersion !== '2.0')) throw new Error('Five consistent report records are required');
const output = path.join(root, 'frontend/src/data/reports.json');
await mkdir(path.dirname(output), { recursive: true });
const view = { ...data, reports: data.reports.map(r => ({ ...r, provenance: undefined, exclusions: undefined, quarantined: undefined,
  rents: r.rents.map(({supports, ...row}) => row), routes: r.routes.map(({supports, ...row}) => row),
  news: r.news.map(({supports, ...row}) => row), venues: r.venues.map(({supports, ...row}) => row) })) };
const reportDirectory = path.join(root, 'frontend/src/data/reports');
await mkdir(reportDirectory, { recursive: true });
if (new Set(view.reports.map(r => r.id)).size !== 5 || view.reports.some(r => !/^[a-z]+$/.test(r.id))) throw new Error('Invalid pilot IDs');
for (const r of view.reports) await writeFile(path.join(reportDirectory, `${r.id}.json`), JSON.stringify(r) + '\n', 'utf8');
const modules = view.reports.map((r, i) => `import report${i} from './reports/${r.id}.json';`).join('\n');
await writeFile(path.join(root, 'frontend/src/data/report-data.mjs'), `${modules}\nexport default {version:'2.0', reports:[${view.reports.map((r,i)=>`report${i}`).join(',')}]};\n`);
await writeFile(path.join(root, 'frontend/src/data/income-reference.json'), await readFile(path.join(root, 'data/reference/income_2026.json'), 'utf8'));
console.log('Five cached source-backed reports prepared. No provider requests.');
