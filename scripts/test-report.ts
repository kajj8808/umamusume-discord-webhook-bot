import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addMonths, loadSettings, payloads, validDate } from '../src/report.ts';
import { ROOT, postMessage } from './daily.ts';
import type { Dataset } from '../src/engine.ts';
const data:Dataset=JSON.parse(await readFile('runtime-data/dataset.json','utf8'));
assert.equal(addMonths('2026-11-30',3),'2027-02-28');
assert.equal(addMonths('2026-12-31',3),'2027-03-31');
assert.equal(validDate('2026-02-30'),false);
const configured=await loadSettings(ROOT,'2026-10-06');
const settings={...configured,pass:false,monthlyHorse:0,monthlySupport:0},messages=payloads(data,settings);
assert.ok(messages.length);
for(const m of messages){assert.deepEqual(m.allowed_mentions,{parse:[]});assert.ok(m.embeds[0].fields.length<=10);assert.ok(JSON.stringify(m.embeds).length<6000);}
assert.ok(messages[0].embeds[0].fields[0].value.includes('7,550'));
const premium=payloads(data,{...settings,pass:true});assert.notEqual(premium[0].embeds[0].fields[0].value,messages[0].embeds[0].fields[0].value);
assert.throws(()=>payloads(data,{...settings,date:'2030-01-01'}));
const saved=process.env.WEBHOOK_URL;
try{
  process.env.WEBHOOK_URL='https://discord.com/api/webhooks/123/local_test_only';
  await postMessage(messages[0],(async(url,options)=>{
    assert.ok(String(url).includes('wait=true'));assert.equal(options?.method,'POST');
    return new Response(JSON.stringify({id:'mock-message'}),{status:200});
  }) as typeof fetch);
  await assert.rejects(()=>postMessage(messages[0],(async()=>new Response('',{status:429})) as typeof fetch));
  await assert.rejects(()=>postMessage(messages[0],(async()=>{throw Error('dummy');}) as typeof fetch));
}finally{if(saved===undefined)delete process.env.WEBHOOK_URL;else process.env.WEBHOOK_URL=saved;}
console.log('PASS: 3-month range across years, invalid dates, payout conditions, premium pass affects income, Discord payload limits. No messages sent.');
