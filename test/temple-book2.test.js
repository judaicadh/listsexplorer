const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const lists=db.lists.filter(l=>l.source_id==='hsss-philadelphia-book2-1882-1888');
const find=key=>lists.find(l=>l.id==='temple-book2-'+key);
test('Book 2 preserves 58 named lists with scan provenance and source images',()=>{
 assert.deepEqual(db.errors,[]);
 assert.equal(lists.length,58);
 assert.equal(lists.reduce((n,l)=>n+l.entries.length,0),1213);
 assert.ok(lists.every(l=>l.images.length));
 assert.ok(lists.flatMap(l=>l.entries).every(e=>/^Scan \d{3}/.test(e.page)));
 assert.equal(find('1883-prizes').entries.length,119);
 const pages=new Set(find('1883-prizes').entries.map(e=>e.page));
 assert.ok([...pages].some(p=>p.startsWith('Scan 027')));
 assert.ok([...pages].some(p=>p.startsWith('Scan 029')));
});
test('Book 2 offices, awards, material gifts and uncertain amounts retain their meanings',()=>{
 assert.ok(lists.flatMap(l=>l.entries).every(e=>!e.quantity));
 assert.ok(find('1887-sewing-prizes').entries.every(e=>e.role==='prize-recipient'));
 assert.ok(find('attendance-1888').entries.every(e=>!e.amount && !e.currency));
 const workbox=find('1887-sewing-gifts').entries.find(e=>/Espen/.test(e.name_as_printed));
 assert.ok(!workbox.amount);assert.match(workbox.note,/work-boxes/);
 const amount=find('1888-building-gifts').entries.find(e=>/L\. Mayer/.test(e.name_as_printed));
 assert.equal(amount.certainty,'uncertain');assert.match(amount.note,/checking/);
 assert.match(find('board-tables').notes,/not converted/);
});
