export type Cell = { v: string | number | boolean | null; f?: string };
export type Workbook = Record<string, Record<string, Cell>>;
export type Pickup = { id: string; name: string; start: string; end: string | null; free: number; image: string; originalImage: string };
export type Dataset = { checkedAt: string; version: string; workbook: Workbook; pickups: Pickup[]; coverageEnd: string };
export type Settings = { date: string; jewels: number; horseTickets: number; supportTickets: number; fragments: number; circle: string; team: string; champion: string; loh: string; daily: boolean; dailyDate: string; pass: boolean; selector: boolean; pack: boolean; medal: boolean; monthlyHorse: number; monthlySupport: number };
export type Reward = { jewels: number; horseTickets: number; supportTickets: number; fragments: number };
export type Plan = { enabled: boolean; kind: 'horse' | 'support' | 'both'; horsePulls: number; supportPulls: number; horseTickets: number; supportTickets: number; freePulls: number; extra: number };
export const zero = (): Reward => ({ jewels: 0, horseTickets: 0, supportTickets: 0, fragments: 0 });
const DAY = 86400000;
export function serial(date: string): number { return Math.round((Date.parse(date + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / DAY); }
export function dateString(value: number): string { return new Date(Date.UTC(1899, 11, 30) + value * DAY).toISOString().slice(0, 10); }
export function today(): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()); }
export function defaults(): Settings { return { date: today(), jewels: 0, horseTickets: 0, supportTickets: 0, fragments: 0, circle: '없음', team: 'CLASS 5', champion: '【그레이드】 A결 3위', loh: '【플레티넘 1】', daily: false, dailyDate: today(), pass: false, selector: false, pack: false, medal: false, monthlyHorse: 0, monthlySupport: 0 }; }
export function defaultPlan(): Plan { return { enabled: false, kind: 'support', horsePulls: 200, supportPulls: 400, horseTickets: 0, supportTickets: 0, freePulls: 0, extra: 0 }; }

// A small interpreter for the source's reward tables. No eval or cached personal results.
export class Evaluator {
  private cache = new Map<string, unknown>();
  private active = new Set<string>();
  private overrides: Record<string, unknown>;
  constructor(private book: Workbook, settings: Settings) {
    const s = settings;
    this.overrides = { B2: serial(s.date), B3: s.jewels, B4: s.horseTickets, B5: s.supportTickets, B6: s.fragments,
      D2: s.circle, D3: s.team, D4: s.champion, D5: s.loh, D6: s.monthlyHorse, D7: s.monthlySupport,
      F2: s.daily ? '구매' : '미구매', G2: serial(s.dailyDate), F3: s.pass ? '구매' : '미구매',
      F4: s.selector ? '구매' : '미구매', F5: s.pack ? '구매' : '미구매', F6: s.medal ? '구매' : '미구매' };
  }
  cell(sheet: string, address: string): any {
    address = address.replaceAll('$', '');
    if (sheet === '계산기(평가x)') {
      if (!(address in this.overrides)) throw Error(`지원하지 않는 개인 입력: ${address}`);
      return this.overrides[address];
    }
    const key = sheet + '!' + address;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.active.has(key)) throw Error('순환 수식: ' + key);
    this.active.add(key);
    try {
      const cell = this.book[sheet]?.[address];
      const result = cell?.f ? this.expression(cell.f.replace(/^=/, ''), sheet) : (cell?.v ?? 0);
      this.cache.set(key, result);
      return result;
    } finally { this.active.delete(key); }
  }
  private split(text: string, separator: string): string[] {
    const parts: string[] = []; let depth = 0; let quote = ''; let start = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
      else if (!depth && c === separator) { parts.push(text.slice(start, i)); start = i + 1; }
    }
    parts.push(text.slice(start)); return parts;
  }
  expression(text: string, sheet: string): any {
    text = text.trim();
    if (/^".*"$/.test(text)) return text.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
    for (const op of ['=', '+', '-']) {
      const parts = this.split(text, op);
      if (parts.length > 1) {
        const values = parts.map(p => this.expression(p, sheet));
        if (op === '=') return values[0] === values[1];
        return values.slice(1).reduce((a, b) => op === '+' ? Number(a) + Number(b) : Number(a) - Number(b), Number(values[0]));
      }
    }
    const fn = text.match(/^([a-z]+)\((.*)\)$/i);
    if (fn) {
      const args = this.split(fn[2], ',');
      switch (fn[1].toLowerCase()) {
        case 'today': return this.cell('계산기(평가x)', 'B2');
        case 'if': return this.expression(args[0], sheet) ? this.expression(args[1], sheet) : this.expression(args[2], sheet);
        case 'vlookup': {
          const lookup = this.expression(args[0], sheet);
          const range = args[1].match(/^'([^']+)'!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/);
          if (!range) throw Error('지원하지 않는 조회 범위: ' + args[1]);
          const column = range[2].charCodeAt(0) + Number(args[2]) - 1;
          for (let row = Number(range[3]); row <= Number(range[5]); row++) {
            if (this.cell(range[1], range[2] + row) === lookup) return this.cell(range[1], String.fromCharCode(column) + row);
          }
          throw Error('보상 등급을 찾을 수 없습니다: ' + lookup);
        }
        default: throw Error('지원하지 않는 수식: ' + text);
      }
    }
    const ref = text.match(/^(?:'([^']+)'!)?(\$?[A-Z]+\$?\d+)$/);
    if (ref) return this.cell(ref[1] ?? sheet, ref[2]);
    throw Error('지원하지 않는 수식: ' + text);
  }
}

export function rewards(data: Dataset, settings: Settings, start: string, end: string, inclusive = false): { total: Reward; breakdown: Record<string, Reward> } {
  if (!start || !end || end < start) throw Error('종료일은 시작일 이후여야 합니다.');
  if (end > data.coverageEnd) throw Error(`원본 데이터 범위는 ${data.coverageEnd}까지입니다.`);
  const lower = serial(start), upper = serial(end); const ev = new Evaluator(data.workbook, settings);
  const breakdown: Record<string, Reward> = {};
  const addTable = (sheet: string, dateCol: string, rewardCols: (string | null)[], first = 2, label = sheet) => {
    const sum = breakdown[label] ??= zero();
    const rows = [...new Set(Object.keys(data.workbook[sheet] ?? {}).map(a => Number(a.match(/\d+$/)?.[0])))].filter(r => r >= first);
    for (const row of rows) {
      if (!data.workbook[sheet][dateCol + row]) continue;
      const date = ev.cell(sheet, dateCol + row);
      if (typeof date !== 'number' || !(date <= upper && (inclusive ? date >= lower : date > lower))) continue;
      rewardCols.forEach((col, i) => {
        if (!col) return;
        const value = ev.cell(sheet, col + row);
        // SUMIFS in the original ignores text (e.g. named guaranteed tickets).
        if (typeof value === 'string') return;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`${sheet}!${col}${row}: 보상 수치 오류`);
        sum[(['jewels', 'horseTickets', 'supportTickets', 'fragments'] as const)[i]] += value;
      });
    }
  };
  addTable('일일 미션', 'A', ['C', null, null, null]);
  addTable('데일리 쥬얼팩', 'A', ['C', null, null, null]);
  addTable('서클 팀레 보상', 'A', ['C', null, null, null], 2, '팀레 보상');
  addTable('서클 팀레 보상', 'E', ['G', null, null, null], 2, '서클 보상');
  addTable('트레이닝 패스', 'A', ['C', 'D', 'E', 'F'], 5);
  addTable('월초 상점', 'A', [null, 'C', 'D', 'E']);
  const common = ['시나리오, 로그인 사료', 'g1 미션 사료', '신캐 사료', '파카라이브 사료', '챔미 사료', '말오스 사료', '먼슬리 매치 사료', '이벤트 사료', '레이싱 카니발 사료', '레전드 레이스 사료', '노려라! 최강팀 사료', '타키온 인자연구 사료', '트레이너 기능 시험 사료', '기타 잡 사료', '마스터즈 챌린지 사료'];
  common.forEach(sheet => {
    const jewelsOnly = ['g1 미션 사료', '신캐 사료'].includes(sheet);
    const noTickets = jewelsOnly || ['파카라이브 사료', '레전드 레이스 사료'].includes(sheet);
    addTable(sheet, 'B', ['D', noTickets ? null : 'E', noTickets ? null : 'F', jewelsOnly ? null : 'G']);
  });
  if (settings.selector) addTable('패키지(선택권,흑우팩)', 'B', ['D', null, null, null], 2, '선택권 패키지');
  if (settings.pack) addTable('패키지(선택권,흑우팩)', 'G', ['I', null, null, null], 2, '쥬얼 패키지');
  const total = zero(); Object.values(breakdown).forEach(r => (Object.keys(total) as (keyof Reward)[]).forEach(k => total[k] += r[k]));
  return { total, breakdown };
}

export function spending(plan: Plan, pickup: Pickup): number {
  if (!plan.enabled) return 0;
  for (const v of [plan.horsePulls, plan.supportPulls, plan.horseTickets, plan.supportTickets, plan.freePulls, plan.extra]) if (!Number.isInteger(v) || v < 0) throw Error('뽑기·티켓·추가 지출은 0 이상의 정수여야 합니다.');
  const horse = plan.kind !== 'support' ? plan.horsePulls : 0;
  const support = plan.kind !== 'horse' ? plan.supportPulls : 0;
  if (plan.horseTickets > horse || plan.supportTickets > support) throw Error('티켓 수가 예정 뽑기 횟수를 초과합니다.');
  if (plan.freePulls > pickup.free) throw Error('무료뽑 횟수가 원본에 기록된 횟수를 초과합니다.');
  // Source applies free pulls only to support banners; expose this convention.
  if (plan.freePulls > support - plan.supportTickets) throw Error('무료뽑과 서폿 티켓의 합이 예정 횟수를 초과합니다.');
  return ((horse - plan.horseTickets) + (support - plan.supportTickets - plan.freePulls)) * 150 + plan.extra;
}

export function forecast(data: Dataset, s: Settings, plans: Record<string, Plan>) {
  let balance: Reward = { jewels: s.jewels, horseTickets: s.horseTickets, supportTickets: s.supportTickets, fragments: s.fragments };
  let previous = s.date;
  return data.pickups.filter(p => p.start >= s.date).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)).map(p => {
    const income = rewards(data, s, previous, p.start).total;
    const before = { ...balance }; (Object.keys(before) as (keyof Reward)[]).forEach(k => before[k] += income[k]);
    const plan = plans[p.id] ?? defaultPlan();
    let error = ''; let cost = 0;
    try {
      cost = spending(plan, p);
      if (plan.enabled && (plan.horseTickets > before.horseTickets || plan.supportTickets > before.supportTickets)) throw Error('보유 티켓보다 많은 티켓을 사용할 수 없습니다.');
    } catch (e) { error = String((e as Error).message); }
    if (error) throw Error(p.name + ': ' + error);
    balance = { ...before, jewels: before.jewels - cost, horseTickets: before.horseTickets - (plan.enabled ? plan.horseTickets : 0), supportTickets: before.supportTickets - (plan.enabled ? plan.supportTickets : 0) };
    previous = p.start;
    return { pickup: p, plan, income, before, after: { ...balance }, cost };
  });
}
