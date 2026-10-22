import test from 'node:test';
import assert from 'node:assert/strict';
import {publicImageUrls} from '../server/media.js';
const a='/api/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const b='/api/media/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
test('public image URLs batch unique images, excluding file downloads and disabled links',async()=>{
 let calls=0;
 const profile={photo:a,logo:a,links:[{enabled:false,thumbnail:b}],files:[{data:b}]};
 const storage={async createSignedUrls(paths,ttl){calls++;assert.deepEqual(paths,[a.split('/').pop()]);assert.equal(ttl,60);return {data:paths.map(path=>({path,signedUrl:'https://storage.example/'+path}))}}};
 const result=await publicImageUrls(profile,storage);
 assert.equal(calls,1);assert.deepEqual(Object.keys(result),[a]);assert.equal(profile.photo,a);
});
test('signing failure retains original authorized image fallback',async()=>{
 assert.deepEqual(await publicImageUrls({photo:a},{async createSignedUrls(){throw Error('unavailable')}}),{});
 assert.deepEqual(await publicImageUrls({photo:a},null),{});
});
