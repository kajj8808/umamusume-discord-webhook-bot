import assert from 'node:assert/strict';
import {cleanPosts,noticePayload}from '../src/kakao.ts';
const rows=cleanPosts([{title:'같은 제목',link:'https://pf.kakao.com/_DzxjIb/1'},{title:'같은 제목',link:'https://pf.kakao.com/_DzxjIb/2',description:'본문'},{title:'같은 제목',link:'https://pf.kakao.com/_DzxjIb/1'},{title:'프로필',link:'https://pf.kakao.com/_DzxjIb'}]);
assert.equal(rows.length,2);assert.equal(rows[0].image,undefined);assert.ok(noticePayload(rows[0]).embeds[0].description);assert.deepEqual(noticePayload(rows[0]).allowed_mentions,{parse:[]});
assert.equal(cleanPosts([{title:'bad',link:'https://example.com/1'}]).length,0);
console.log('PASS: URL IDs, same-title distinct posts, deduplication, missing image/body, unrelated cards, no mentions.');
