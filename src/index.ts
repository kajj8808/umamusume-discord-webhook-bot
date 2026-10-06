import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import schedule from 'node-schedule';
import { readFile } from 'node:fs/promises';
import { synchronize } from '../scripts/sync.ts';
import { daily, ROOT } from '../scripts/daily.ts';
import { today, type Dataset } from './engine.ts';
import { loadSettings, forecastReport, conditions } from './report.ts';
import { notices } from '../scripts/notices.ts';
const dry=process.argv.includes('--dry-run'),offline=process.argv.includes('--offline');
if(!dry&&!(process.env.WEBHOOK_URL??process.env.DISCORD_WEBHOOK_URL))throw Error('WEBHOOK_URL을 설정하거나 --dry-run으로 실행해주세요.');
if(offline&&!dry)throw Error('--offline은 --dry-run과 함께 사용해주세요.');
if(!offline)await synchronize();
async function snapshot():Promise<Dataset>{return JSON.parse(await readFile(ROOT+'/runtime-data/dataset.json','utf8'));}
const app=new Hono();
app.get('/health',c=>c.json({ok:true,mode:dry?'dry-run':'live',schedule:'00:05 Asia/Seoul',notice:'프로세스가 실행 중일 때만 정기 작업이 동작합니다.'}));
app.get('/get/main-pickup',async c=>c.json({ok:true,results:(await snapshot()).pickups}));
app.get('/get/forecast',async c=>{const data=await snapshot(),s=await loadSettings(ROOT,today());return c.json({ok:true,checkedAt:data.checkedAt,conditions:conditions(s),results:forecastReport(data,s)});});
app.get('/get/rewords',async c=>c.json({ok:true,format:'workbook-cells',results:(await snapshot()).workbook}));
app.onError((_error,c)=>c.json({ok:false,error:'원본 데이터 또는 계산 설정을 확인해주세요.'},500));
const rule=new schedule.RecurrenceRule();rule.tz='Asia/Seoul';rule.hour=0;rule.minute=5;
let running=false;
const job=schedule.scheduleJob(rule,async()=>{if(running)return;running=true;try{await daily({dryRun:dry,offline});}catch(e:any){console.error('일일 알림 실패: '+e.message);}finally{running=false;}});
let collecting=false;
const noticeJob=process.env.KAKAO_NOTICES==='true'?schedule.scheduleJob('*/30 * * * *',async()=>{
  if(collecting)return;collecting=true;
  try{await notices({dryRun:dry});}catch(e:any){console.error('카카오 수집 실패: '+e.message);}finally{collecting=false;}
}):null;
const port=Number(process.env.PORT??3000);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT 설정을 확인해주세요.');
const host=process.env.HOST??'127.0.0.1';
const server=serve({fetch:app.fetch,port,hostname:host},()=>console.log(`봇 서버: http://${host}:${port} · 매일 00:05 Asia/Seoul · ${dry?'전송 없는 검증 모드':'웹훅 전송 모드'}`));
function stop(){job?.cancel();noticeJob?.cancel();server.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
