import XLSX from 'xlsx';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateString, type Workbook, type Dataset, type Pickup } from '../src/engine.ts';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCES = { calculator: '1ryM_NsaMuWCxNWfLr5Y4sb6faL1iXbAasCIAOEbAbEI', gacha: '14Y1k52ueyCWsA0wuJXOQLsaieDuICOtrvHHrs4Mqo1Q' };
const EXCLUDED = new Set(['계산기(평가x)', '(구)계산기', '기간 사료 계산기', '가챠 정보(평가x)']);
async function atomic(path: string, data: unknown) { await writeFile(path + '.tmp', JSON.stringify(data)); await rename(path + '.tmp', path); }
export async function synchronize(localDir?: string) {
  const dir = resolve(ROOT, 'runtime-data'); await mkdir(dir, { recursive: true });
  const checkedAt = new Date().toISOString();
  try {
    const raw = await Promise.all(Object.entries(SOURCES).map(async ([name, id]) => {
      let bytes: Buffer;
      if (localDir) bytes = await readFile(resolve(localDir, id + '.xlsx'));
      else {
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (bytes.length > 30_000_000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw Error(`${name}: XLSX 파일이 아닙니다.`);
      return XLSX.read(bytes, { type: 'buffer', cellDates: false, cellFormula: true });
    }));
    if (!raw[0].Sheets['일일 미션'] || !raw[0].Sheets['PVP 보상'] || !raw[1].Sheets['가챠 정보']) throw Error('원본의 필수 탭이 누락되었습니다.');
    const workbook: Workbook = {};
    for (const name of raw[0].SheetNames) {
      if (EXCLUDED.has(name)) continue;
      workbook[name] = {};
      for (const [addr, cell] of Object.entries(raw[0].Sheets[name])) {
        if (addr.startsWith('!') || cell.t === 'z') continue;
        if (cell.t === 'e') throw Error(`${name}!${addr}: 원본 셀 오류`);
        workbook[name][addr] = { v: cell.v ?? null, ...(cell.f ? { f: cell.f } : {}) };
      }
    }
    const sheet = raw[1].Sheets['가챠 정보']; const range = XLSX.utils.decode_range(sheet['!ref']!); const pickups: Pickup[] = [];
    for (let row = 2; row <= range.e.r + 1; row++) {
      const name = sheet['A' + row]?.v; const start = sheet['C' + row]?.v; const end = sheet['D' + row]?.v;
      if (typeof name !== 'string' || name === '없음' || typeof start !== 'number') continue;
      const originalImage = String(sheet['F' + row]?.v ?? ''); const imageId = originalImage.match(/[?&]id=([^&]+)/)?.[1];
      pickups.push({ id: createHash('sha256').update(name).digest('hex').slice(0, 16), name, start: dateString(start), end: typeof end === 'number' ? dateString(end) : null, free: Number(sheet['E' + row]?.v ?? 0), image: imageId ? `https://drive.google.com/thumbnail?id=${imageId}&sz=w1000` : '', originalImage });
    }
    if (!pickups.length) throw Error('픽업 데이터가 없습니다.');
    const coverageEnd = pickups.map(p => p.start).sort().at(-1)!;
    const stableBook = Object.fromEntries(Object.entries(workbook).map(([sheet, cells]) => [sheet, Object.fromEntries(Object.entries(cells).map(([addr, c]) => [addr, c.f ? { f: c.f } : { v: c.v }]))]));
    const version = createHash('sha256').update(JSON.stringify({ workbook: stableBook, pickups })).digest('hex');
    const dataset: Dataset = { checkedAt, version, workbook, pickups, coverageEnd };
    let old: Dataset | null = null;
    try { old = JSON.parse(await readFile(resolve(dir, 'dataset.json'), 'utf8')); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    const status = !old ? 'baseline' : old.version === version ? 'unchanged' : 'changed';
    const changes: unknown[] = [];
    if (old && status === 'changed') {
      for (const name of new Set([...Object.keys(old.workbook), ...Object.keys(workbook)])) {
        const a = old.workbook[name] ?? {}, b = workbook[name] ?? {};
        for (const addr of new Set([...Object.keys(a), ...Object.keys(b)])) {
          const source = (c: any) => c ? c.f ? { f: c.f } : { v: c.v } : null;
          if (JSON.stringify(source(a[addr])) !== JSON.stringify(source(b[addr]))) changes.push({ sheet: name, cell: addr, before: source(a[addr]), after: source(b[addr]) });
        }
      }
      for (const id of new Set([...old.pickups.map(p => p.id), ...pickups.map(p => p.id)])) {
        const before = old.pickups.find(p => p.id === id), after = pickups.find(p => p.id === id);
        if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ pickup: id, before, after });
      }
    }
    const report = { status, checkedAt, version, sourceIds: SOURCES, mode: localDir ? 'fixture' : 'live', changes, changeCount: changes.length };
    if (status !== 'unchanged') { await mkdir(resolve(dir, 'history'), { recursive: true }); await atomic(resolve(dir, 'history', checkedAt.replaceAll(':', '-') + '.json'), report); }
    await atomic(resolve(dir, 'dataset.json'), dataset); await atomic(resolve(dir, 'status.json'), report);
    console.log(JSON.stringify({ status, pickups: pickups.length, sheets: Object.keys(workbook).length, checkedAt, changeCount: changes.length }));
    return dataset;
  } catch (e: any) { await atomic(resolve(dir, 'status.json'), { status: 'error', checkedAt, error: e.message }); throw e; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await synchronize(process.argv[2]);
