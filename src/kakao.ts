import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
export type Post={id:string;title:string;description:string;image?:string;link:string};
export function cleanPosts(rows:Partial<Post>[]):Post[]{
  const posts=new Map<string,Post>();
  for(const row of rows){
    const match=row.link?.match(/^https:\/\/pf\.kakao\.com\/_DzxjIb\/(\d+)$/);
    if(!match||!row.title?.trim())continue;
    let image:string|undefined;
    if(row.image){try{const u=new URL(row.image);if(u.protocol==='https:')image=u.href;}catch{}}
    posts.set(match[1],{id:match[1],title:row.title.trim(),description:row.description?.trim()??'',link:row.link!,...(image?{image}:{})});
  }
  return [...posts.values()];
}
export function noticePayload(post:Post){
  return {username:'우마무스메 공식 소식',allowed_mentions:{parse:[]},embeds:[{title:post.title.slice(0,256),description:(post.description||'자세한 내용은 공지 링크에서 확인해주세요.').slice(0,1800),url:post.link,color:0x57F287,...(post.image?{image:{url:post.image}}:{}),footer:{text:'우마무스메 공식 카카오 채널 · 채널에 게시된 내용 기준'}}]};
}
export async function collectPosts():Promise<Post[]>{
  const executablePath=process.env.CHROME_EXECUTABLE||[
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
  ].find(path=>existsSync(path));
  if(!executablePath)throw Error('카카오 수집에는 Chrome/Chromium이 필요합니다. CHROME_EXECUTABLE을 설정해주세요.');
  const browser=await puppeteer.launch({executablePath,headless:true});
  try{
    const page=await browser.newPage();page.setDefaultTimeout(20000);
    const response=await page.goto('https://pf.kakao.com/_DzxjIb/posts',{waitUntil:'domcontentloaded',timeout:45000});
    if(!response?.ok())throw Error(`카카오 페이지 응답 오류: ${response?.status()}`);
    await page.waitForSelector('a[href*="/_DzxjIb/"]');
    const gathered:Partial<Post>[]=[];
    for(let pass=0;pass<3;pass++){
      const rows=await page.evaluate(()=>Array.from(document.querySelectorAll('.area_card')).map(card=>{
        const link=Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]')).find(a=>/^https:\/\/pf\.kakao\.com\/_DzxjIb\/\d+$/.test(a.href))?.href;
        const title=card.querySelector('strong')?.textContent??'';
        const description=card.querySelector<HTMLElement>('.desc_card')?.innerText??'';
        const thumb=card.querySelector<HTMLElement>('.wrap_fit_thumb');
        const background=thumb?getComputedStyle(thumb).backgroundImage:'';
        const image=thumb?.querySelector<HTMLImageElement>('img')?.src??background.match(/url\(["']?(.*?)["']?\)/)?.[1];
        return {title,description,link,image};
      }));
      gathered.push(...rows);
      const count=rows.filter(r=>r.link).length;
      if(pass===2)break;
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      try{await page.waitForFunction(n=>Array.from(document.querySelectorAll('a[href]')).filter(a=>/^https:\/\/pf\.kakao\.com\/_DzxjIb\/\d+$/.test((a as HTMLAnchorElement).href)).length>n,{timeout:5000},count*2);}catch{break;}
    }
    const posts=cleanPosts(gathered);
    if(!posts.length)throw Error('카카오 공지 0개: 페이지 구조 또는 접속 상태를 확인해주세요.');
    return posts;
  }finally{await browser.close();}
}
