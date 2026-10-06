import { readFile, writeFile, rename, open, unlink, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { synchronize } from './sync.ts';
import { today, type Dataset } from '../src/engine.ts';
import { loadSettings, payloads } from '../src/report.ts';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
const statePath=resolve(ROOT,'runtime-data/delivery.json');
type Delivery={date:string;complete:boolean;next:number;messages:ReturnType<typeof payloads>};
async function store(state:Delivery){await writeFile(statePath+'.tmp',JSON.stringify(state));await rename(statePath+'.tmp',statePath);}
export async function postMessage(payload:unknown,request:typeof fetch=fetch){
  let url:URL;
  try{url=new URL(process.env.WEBHOOK_URL??process.env.DISCORD_WEBHOOK_URL??'');}catch{throw Error('WEBHOOK_URL을 실행 환경에 설정해주세요.');}
  if(url.protocol!=='https:'||url.hostname!=='discord.com'||!/^\/api\/(?:v\d+\/)?webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.username||url.password)throw Error('WEBHOOK_URL은 discord.com 웹훅 주소여야 합니다.');
  url.searchParams.set('wait','true');
  let response:Response;
  try{response=await request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('웹훅 전송 결과를 확인하지 못했습니다. 다음 실행에서 재시도합니다.');}
  if(!response.ok)throw Error(`웹훅 전송 실패: HTTP ${response.status}`);
  const result=await response.json();if(!result.id)throw Error('메시지 저장 확인에 실패했습니다.');
}
export async function daily(options:{dryRun?:boolean;offline?:boolean;date?:string}={}){
  const date=options.date??today(),settings=await loadSettings(ROOT,date);
  if(options.dryRun){
    const data:Dataset=options.offline?JSON.parse(await readFile(resolve(ROOT,'runtime-data/dataset.json'),'utf8')):await synchronize();
    const messages=payloads(data,settings);
    await writeFile(resolve(ROOT,'runtime-data/preview.json'),JSON.stringify(messages,null,2));
    console.log(JSON.stringify(messages,null,2));return messages;
  }
  if(options.offline||options.date)throw Error('오프라인·과거 날짜 데이터는 미리보기에서만 사용할 수 있습니다.');
  if(!(process.env.WEBHOOK_URL??process.env.DISCORD_WEBHOOK_URL))throw Error('WEBHOOK_URL이 없어 실제 전송을 시작하지 않았습니다.');
  await mkdir(resolve(ROOT,'runtime-data'),{recursive:true});
  const lockPath=resolve(ROOT,'runtime-data/daily.lock');let lock;
  try{lock=await open(lockPath,'wx');}catch(e:any){if(e.code==='EEXIST')throw Error('다른 알림 작업이 실행 중입니다.');throw e;}
  try{
    let state:Delivery|null=null;
    try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}
    if(state?.date===date&&state.complete){console.log('오늘 알림은 이미 전송했습니다.');return;}
    if(!state||state.date!==date){const data=await synchronize();state={date,complete:false,next:0,messages:payloads(data,settings)};await store(state);}
    for(;state.next<state.messages.length;){await postMessage(state.messages[state.next]);state.next++;await store(state);}
    state.complete=true;await store(state);console.log(`${date} 예상 획득량 ${state.messages.length}개 메시지 전송 완료`);
  }finally{await lock.close();await unlink(lockPath);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),i=args.indexOf('--date');
  try{await daily({dryRun:args.includes('--dry-run'),offline:args.includes('--offline'),date:i>=0?args[i+1]:undefined});}catch(e:any){console.error(e.message);process.exitCode=1;}
}
