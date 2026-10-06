import { mkdir, readFile,writeFile,rename,open,unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPosts,noticePayload,type Post } from '../src/kakao.ts';
import { postMessage,ROOT } from './daily.ts';
type State={seen:string[];pending:Post[]};
const folder=resolve(ROOT,'runtime-data');const path=resolve(folder,'notices.json');
async function save(state:State){await writeFile(path+'.tmp',JSON.stringify(state));await rename(path+'.tmp',path);}
export async function notices(options:{dryRun?:boolean;initialize?:boolean}={}){
  await mkdir(folder,{recursive:true});
  const lockPath=resolve(folder,'notices.lock');let lock;
  try{lock=await open(lockPath,'wx');}catch{throw Error('다른 카카오 수집 작업이 실행 중이거나 잠금 파일이 남아 있습니다.');}
  const checkedAt=new Date().toISOString();
  try{
    const posts=await collectPosts();
    await writeFile(resolve(folder,'notices-preview.json'),JSON.stringify(posts.map(noticePayload),null,2));
    let state:State|null=null;
    try{state=JSON.parse(await readFile(path,'utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}
    if(options.dryRun){console.log(JSON.stringify({status:'dry-run',count:posts.length,latest:posts[0]},null,2));return posts;}
    if(!state){state={seen:posts.map(p=>p.id),pending:[]};await save(state);console.log(`기준 공지 ${posts.length}개 저장. 과거 공지는 전송하지 않습니다.`);}
    else{
      if(options.initialize)throw Error('이미 공지 기준이 저장되어 있습니다. 초기화로 미전송 공지를 버리지 않습니다.');
      const seen=new Set([...state.seen,...state.pending.map(p=>p.id)]);
      state.pending.push(...posts.filter(p=>!seen.has(p.id)).reverse());await save(state);
      while(state.pending.length){const post=state.pending[0];await postMessage(noticePayload(post));state.seen.push(post.id);state.pending.shift();await save(state);}
      console.log('카카오 새 공지 전송 확인 완료.');
    }
    await writeFile(resolve(folder,'notices-status.json'),JSON.stringify({status:'ok',checkedAt,collected:posts.length}));return posts;
  }catch(e:any){await writeFile(resolve(folder,'notices-status.json'),JSON.stringify({status:'error',checkedAt,error:e.message}));throw e;}
  finally{await lock.close();await unlink(lockPath);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await notices({dryRun:process.argv.includes('--dry-run'),initialize:process.argv.includes('--initialize')});}catch(e:any){console.error(e.message);process.exitCode=1;}
}
