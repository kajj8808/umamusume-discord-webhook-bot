import { readFile } from 'node:fs/promises';
import { defaults, rewards, serial, dateString, type Dataset, type Settings } from './engine.ts';

export function addMonths(date: string, count: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year, month - 1 + count + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + count, Math.min(day, last))).toISOString().slice(0,10);
}
export function validDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(serial(date)) && dateString(serial(date)) === date;
}
export async function loadSettings(root: string, date: string): Promise<Settings> {
  if(!validDate(date))throw Error('기준일은 유효한 YYYY-MM-DD 형식이어야 합니다.');
  let config: any;
  try { config=JSON.parse(await readFile(root+'/config.json','utf8')); }
  catch(e:any) { if(e.code!=='ENOENT')throw e; config=JSON.parse(await readFile(root+'/config.example.json','utf8')); }
  const s={...defaults(),date,dailyDate:date,circle:'S',loh:'【플레티넘 3】'};
  const choices:Record<string,string[]>={circle:['없음','SS','S+','S','A+','A','B+','B','C+','C','D+'],team:['CLASS 5','CLASS 6'],champion:Array.from({length:12},(_,i)=>`【${i<6?'그레이드':'오픈'}】 ${i%6<3?'A':'B'}결 ${i%3+1}위`),loh:['【플레티넘 1】','【플레티넘 2】','【플레티넘 3】','【플레티넘 4】']};
  for(const [key,values]of Object.entries(choices)){if(!values.includes(config[key]))throw Error(`config.json의 ${key} 등급을 확인해주세요.`);(s as any)[key]=config[key];}
  for(const key of ['daily','pass','selector','pack','medal']){if(typeof config[key]!=='boolean')throw Error(`${key}는 true/false여야 합니다.`);(s as any)[key]=config[key];}
  for(const key of ['monthlyHorse','monthlySupport']){if(!Number.isInteger(config[key])||config[key]<0)throw Error(`${key}는 0 이상의 정수여야 합니다.`);(s as any)[key]=config[key];}
  if(s.daily){if(!validDate(config.dailyDate)||config.dailyDate>date)throw Error('데일리팩 포함 시 실제 최초 구매일 dailyDate를 기준일 이하 날짜로 설정해주세요.');s.dailyDate=config.dailyDate;}
  return s;
}
export function conditions(s:Settings):string {
  return `서클 ${s.circle} / 팀레 ${s.team} / 챔미 ${s.champion} / 말오스 ${s.loh}\n데일리팩 ${s.daily?'반복 구매 ('+s.dailyDate+')':'미구매'} / 트레이닝 패스 ${s.pass?'프리미엄':'일반 무료 보상'}\n월초 말뽑 ${s.monthlyHorse}장·서폿 ${s.monthlySupport}장 / 메달 조각 ${s.medal?'구매':'미구매'} / 선택권 ${s.selector?'구매':'미구매'} / 쥬얼 패키지 ${s.pack?'구매':'미구매'}`;
}
export function forecastReport(data:Dataset,s:Settings){
  const end=addMonths(s.date,3);
  if(end>data.coverageEnd)throw Error(`3개월 전체를 계산할 원본 데이터가 부족합니다. 범위: ${data.coverageEnd}까지`);
  return data.pickups.filter(p=>p.start>=s.date&&p.start<=end).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id)).map(p=>({pickup:p,days:serial(p.start)-serial(s.date),income:rewards(data,s,s.date,p.start).total}));
}
export function payloads(data:Dataset,s:Settings){
  const rows=forecastReport(data,s), chunks=[];
  const champion=s.champion.replace('【그레이드】 ','').replace('【오픈】 ','오픈 ');
  const extras=[s.selector?'선택권 구매':'',s.pack?'쥬얼팩 구매':'',s.medal?'메달조각 구매':''].filter(Boolean);
  const compactConditions=`\`\`\`[ 서클 ${s.circle} / 팀레 ${s.team.replace('CLASS ','')} / 챔미 ${champion} / 말오스 ${s.loh.replace('【플레티넘 ','플레 ').replace('】','')} ]\n[ 월정액 ${s.daily?'구매':'미구매'} / 프리미엄 패스 ${s.pass?'구매':'미구매'} ]\n[ 월초 티켓: 말뽑 ${s.monthlyHorse}장 / 서폿 ${s.monthlySupport}장 ]${extras.length?'\n[ '+extras.join(' / ')+' ]':''}\`\`\``;
  const pages=Math.max(Math.ceil(rows.length/10),1);
  for(let start=0;start<Math.max(rows.length,1);start+=10){
    const selected=rows.slice(start,start+10);
    chunks.push({username:'우마무스메 미래시 알림',allowed_mentions:{parse:[]},embeds:[{
      title:`사료 계산기 ${s.date.replaceAll('-','. ')}${pages>1?` (${Math.floor(start/10)+1}/${pages})`:''}`,
      description:compactConditions+(rows.length?'':'\n향후 3개월에 기록된 픽업이 없습니다.'),
      color:0x57F287,url:'https://docs.google.com/spreadsheets/d/1ryM_NsaMuWCxNWfLr5Y4sb6faL1iXbAasCIAOEbAbEI/edit',
      fields:selected.map(r=>({name:`${r.pickup.name.replace(/^\([^)]*\)\s*/, '').replace(/\s*\+\s*/g, ' / ')} [D-${r.days}] (${r.pickup.start.slice(2).replaceAll('-', '.')})`.slice(0,256),value:`- 쥬얼: **${r.income.jewels.toLocaleString('ko-KR')}**\n- 무지개 조각: **${r.income.fragments}**\n- 캐릭터 티켓: **${r.income.horseTickets}**\n- 서포트 티켓: **${r.income.supportTickets}**`,inline:false})),
      footer:{text:'오늘 이후 픽업 시작일까지 얻을 수 있는 재화 · 이벤트·미션 보상 모두 수령 기준'},timestamp:data.checkedAt,
    }]});
  }
  return chunks;
}
