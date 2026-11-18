const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
test('new California officers retain distinct roles and the explicit dates of the reports',()=>{
 const school=db.lists.find(l=>l.id==='emanu-el-religious-school-directors-1868-10-30');
 assert.equal(school.entries.length,7);assert.ok(school.entries.every(e=>e.role==='officer'&&!e.amount));
 assert.match(school.entries[0].note,/Director; Chairman/);
 const modin=db.lists.find(l=>l.id==='modin-lodge-elected-officers-1869-01-01');
 assert.ok(modin.entries.some(e=>e.name_as_printed==='Joseph Shoan'));
 assert.ok(modin.entries.some(e=>e.name_as_printed==='Joseph Shaon'));
 assert.equal(db.lists.find(l=>l.id==='beth-israel-portland-officers-1868-10-30').place.id,'portland');
 assert.equal(db.lists.find(l=>l.id==='miriam-lodge-marysville-officers-1869-01-15').place.id,'marysville');
});
test('selected charitable gifts preserve anonymous and noncash contributions without annual-income duplication',()=>{
 const list=db.lists.find(l=>l.id==='first-hebrew-benevolent-selected-gifts-1871-01-27');
 assert.equal(list.entries.length,3);assert.equal(list.entries.reduce((sum,e)=>sum+(e.money?.base || 0),0),40000);
 assert.equal(list.entries[0].agent_as_printed,'Messrs. J. Seligman & Co.');
 assert.equal(list.entries[1].entity_id,'');assert.equal(list.entries[2].amount,'');
 assert.match(list.entries[2].note,/Medical services/);
});
test('Mikveh Israel manuscript retains its carry-forward statement instead of inventing printed names',()=>{
 const list=db.lists.find(l=>l.id==='mikveh-israel-officers-1823-1827');
 assert.equal(list.entries.length,22);assert.equal(list.sections.length,4);
 const reference=list.sections.find(s=>s.title.includes('5586'));
 assert.equal(reference.entries.length,1);assert.equal(reference.entries[0].name_as_printed,'Same as last year');
 assert.ok(list.entries.every(e=>!e.amount&&!e.entity_id));assert.deepEqual(list.totals,[]);
});
