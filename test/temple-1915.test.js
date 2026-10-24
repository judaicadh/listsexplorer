const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const lists=db.lists.filter(l=>l.source_id==='hsss-philadelphia-annual-report-1915');
const find=key=>lists.find(l=>l.id==='temple-1915-'+key);
test('1915 report preserves all identified rosters with original scan references and separate graduation year',()=>{
 assert.deepEqual(db.errors,[]);
 assert.equal(lists.length,13);
 assert.equal(lists.reduce((n,l)=>n+l.entries.length,0),513);
 assert.equal(find('graduates').date,'1914-06-07');
 assert.equal(find('graduates').entries.filter(e=>e.section.startsWith('Graduates')).length,40);
 assert.equal(find('graduates').entries.filter(e=>e.section.startsWith('Post-graduates')).length,20);
 assert.equal(find('staff').entries.length,209);
 assert.equal(find('prizes').entries.length,84);
 assert.ok(lists.flatMap(l=>l.entries).every(e=>/^Scan \d{3}/.test(e.page)));
 assert.ok(lists.every(l=>l.images.length && Number.isFinite(Date.parse(l.added_at))));
});
test('1915 register affiliation, capital values and prize promises do not become invented new cash or copies',()=>{
 for(const key of ['memorial-funds','special-endowments']){
  assert.equal(find(key).organizer_id,'federation-jewish-charities-philadelphia');
  assert.ok(find(key).entries.every(e=>!e.amount && !e.currency && /Historical reported value/.test(e.note)));
 }
 assert.equal(find('memorial-funds').entries.length,58);
 assert.equal(find('special-endowments').entries.length,4);
 assert.ok(find('prize-gifts').entries.every(e=>!e.amount));
 assert.ok(lists.flatMap(l=>l.entries).every(e=>!e.quantity));
 const collection=find('named-receipts').entries.find(e=>e.name_as_printed==='Grace Aguilar School');
 assert.equal(collection.amount,'33.21');
 assert.match(collection.note,/Collection/);
 assert.ok(find('prizes').entries.every(e=>e.role==='prize-recipient' && !e.amount));
 assert.ok(find('election').entries.some(e=>e.name_as_printed==='Mrs. Eugene M. Stein'));
 assert.ok(find('officers').entries.some(e=>e.name_as_printed==='Mrs. Eugene M. Stern'));
});
