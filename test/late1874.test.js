const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const list=id=>db.lists.find(l=>l.id===id);
test('family-relief instalments reconcile without creating donations from carry-forwards or corrections',()=>{
 assert.deepEqual(db.errors,[]);
 const ids=['1874-07-10','1874-07-17','1874-07-24','1874-07-31'];
 const lists=ids.map(d=>list('appeal-to-benevolent-'+d));
 assert.deepEqual(lists.map(l=>l.entries.length),[25,14,8,9]);
 assert.deepEqual(lists.map(l=>l.totals[0].display),['£36 2s. 0d.','£8 8s. 0d.','£6 2s. 0d.','£5 2s. 6d.']);
 assert.ok(lists.flatMap(l=>l.entries).every(e=>!/Amount acknowledged/i.test(e.name_as_printed)));
 assert.match(lists[0].entries.find(e=>e.name_as_printed==='M. Michael').note,/corrects this to M. Michaelis/);
 assert.match(lists[0].entries.find(e=>e.name_as_printed==='Leviathan Clothing Company').note,/corrects this to Lewis Levy/);
 assert.equal(lists[0].entries.filter(e=>e.name_as_printed==='A Friend').length,2);
 assert.ok(!lists[1].entries.some(e=>e.name_as_printed==='M. Michaelis'||e.name_as_printed==='Lewis Levy'));
});
test('Burns fund preserves forwarded joint gifts and an additional personal guinea',()=>{
 const l=list('burns-boys-fund-1874-06-05');assert.equal(l.entries.length,14);
 const employees=l.entries.find(e=>e.name_as_printed==='employees of Feldheim, Jacobs and Co.');
 assert.equal(employees.amount,'3.11.6');assert.equal(employees.agent_as_printed,'I. Jacobs');
 const own=l.entries.find(e=>e.name_as_printed==='I. Jacobs');assert.equal(own.amount,'1.1.0');assert.equal(own.agent_as_printed,'');
 const collected=l.entries.find(e=>e.name_as_printed==='Collected by M. E. B.');assert.equal(collected.role,'agent');assert.equal(collected.amount,'0.14.0');
 assert.equal(l.entries.find(e=>e.name_as_printed==='John Jacobs and Sons').agent_as_printed,'Sydney Jacobs');
});
test('theatre notices keep reprinted patrons once and materially changed casts separately',()=>{
 const p=list('princess-theatre-patrons-1874-10-23');assert.equal(p.entries.length,39);assert.equal(p.images.length,2);
 assert.ok(!db.lists.some(l=>l.id==='princess-theatre-patrons-1874-10-30'));
 assert.ok(p.entries.every(e=>e.role==='patron'&&!e.amount));
 const early=list('princess-theatre-cast-1874-10-23'),late=list('princess-theatre-cast-1874-10-30');
 assert.equal(early.entries.length,16);assert.equal(late.entries.length,15);
 const character=(l,n)=>l.entries.find(e=>e.note==='Character: '+n+'.');
 assert.equal(character(early,'Jessop').name_as_printed,'„ M. Marks.');assert.equal(character(late,'Jessop').name_as_printed,'„ A. Benjamin.');
 assert.ok(character(early,'Servant'));assert.ok(!character(late,'Servant'));
 assert.equal(early.roles.find(r=>r.role==='stage-manager').name_as_printed,'ASHER HART');
 assert.equal(early.agents[0].name_as_printed,'Wilkie, Webster, and Allen');
 assert.equal(late.agents[0].name_as_printed,'Wilkie, Webster, and Allan');
});
test('qualifications, committee offices, famine agents and noncash awards retain their capacities',()=>{
 const s=list('east-melbourne-statement-signatures-1874-11-13');assert.equal(s.entries.length,19);
 assert.ok(s.entries.slice(-3).every(e=>/Except in so far as second paragraph/.test(e.note)));
 assert.equal(list('holy-land-famine-signatures-1874-08-28').entries.length,8);
 const a=list('holy-land-famine-receiving-agents-1874-08-28');assert.equal(a.entries.length,10);assert.ok(a.entries.every(e=>e.role==='agent'&&!e.amount));
 const c=list('mrs-ornstien-testimonial-committee-1874-10-23');assert.equal(c.entries.length,18);assert.equal(c.entries.filter(e=>e.role==='agent').length,2);
 assert.equal(list('melbourne-atonement-donations-1874-09-25').entries.length,54);
 assert.equal(list('scotch-college-prizes-1874-12-18').entries.length,19);
 const w=list('wesley-college-prizes-1874-12-18');assert.equal(w.entries.length,11);
 const books=w.entries.find(e=>e.amount==='3.3.0');assert.equal(books.role,'prize-recipient');assert.match(books.note,/valuation of books, not cash/);
});
