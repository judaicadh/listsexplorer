const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
test('JPS charter retains legal capacities, shared locality and nonfinancial status',()=>{
 assert.deepEqual(db.errors,[]);
 const s=db.lists.find(l=>l.id==='jps-charter-subscribers-1895');
 const t=db.lists.find(l=>l.id==='jps-charter-trustees-1895');
 assert.equal(s.entries.length,51); assert.equal(t.entries.length,15);
 assert.deepEqual([1,2,3,4].map(c=>s.entries.filter(e=>e.column===String(c)).length),[13,13,13,12]);
 assert.ok(s.entries.every(e=>e.role==='signatory'&&!e.amount&&e.place_id==='philadelphia'));
 assert.ok(t.entries.every(e=>e.role==='officer'&&!e.amount));
 assert.equal(t.entries.filter(e=>e.place_as_printed==='Philadelphia').length,8);
 assert.equal(s.date,'1895-12-31'); assert.equal(t.date,s.date);
 assert.equal(t.entries.at(-1).name_as_printed,'Rev. Joseph Stolz');
 assert.equal(s.entries.filter(e=>e.certainty==='uncertain').length,4);
});
