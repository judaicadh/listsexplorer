const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const list=id=>db.lists.find(l=>l.id===id);

test('late 1873 receipts preserve terms, corrections and the explicit forwarding subscriber',()=>{
 assert.deepEqual(db.errors,[]);
 assert.equal(db.lists.filter(l=>l.id==='australian-israelite-subscriptions-1873-08-22').length,1);
 const original=list('australian-israelite-subscriptions-1873-11-07');
 const correction=list('australian-israelite-subscriptions-1873-11-14');
 assert.equal(original.entries[0].amount,'2.12.6');
 assert.equal(original.entries[0].section,'Yearly');
 assert.match(original.entries[0].note,/corrected to Half-Yearly/);
 assert.ok(!correction.entries.some(e=>e.name_as_printed==='The Melbourne Hebrew Congregation'));
 assert.match(correction.notes,/not counted as another payment/);
 const nov=list('australian-israelite-subscriptions-1873-11-28');
 assert.equal(nov.entries.find(e=>e.name_as_printed==='J. Jacobs').section,'Half-Yearly');
 assert.match(nov.entries.find(e=>e.name_as_printed==='J. Jacobs').note,/quarterly/);
 assert.equal(nov.entries.find(e=>e.name_as_printed==='B. Gollin').place_id,'adelaide');
 const via=list('australian-israelite-subscriptions-1873-08-29').entries.find(e=>e.name_as_printed==='Samuel Moses');
 assert.equal(via.amount,'2.6.0');assert.equal(via.agent_as_printed,'Louis Walford, Maharatta');assert.equal(via.place_id,'london');
 assert.ok(list('australian-israelite-subscriptions-1873-11-21').entries.some(e=>e.name_as_printed==='Bentwitch'&&e.certainty==='uncertain'));
});

test('Toowoomba objects and ball offices stay distinct from priced payments',()=>{
 const t=list('toowoomba-synagogue-donations-1873-11-28');
 assert.equal(t.entries.length,84);assert.equal(t.agents.length,5);
 assert.ok(t.entries.every(e=>e.role==='donor'&&!e.agent_as_printed&&!e.agent_id&&!e.quantity));
 assert.match(t.entries.find(e=>e.name_as_printed==='Mr. R. B. Lewin').note,/Also an Ark/);
 assert.match(t.entries.find(e=>e.name_as_printed==='Mr. Samuel Phillips').note,/Mizrach/);
 assert.equal(t.entries.find(e=>e.name_as_printed==='Mr. Joseph Isaacs').place_as_printed,'do.');
 assert.equal(t.entries.find(e=>e.name_as_printed==='Mr. Joseph Isaacs').place_id,'brisbane');
 const both=t.entries.find(e=>e.name_as_printed==='Feldheim, Jacobs and Co.');
 assert.equal(both.place_as_printed,'Sydney and Melbourne');assert.equal(both.amount,'5.5.0');assert.equal(both.place_id,'');
 const ball=list('second-annual-jewish-ball-roster-1873-11-14');
 assert.equal(ball.entries.length,42);assert.equal(ball.roles.filter(r=>r.role==='steward').length,17);
 assert.ok(ball.entries.every(e=>e.role==='officer'&&!e.amount));assert.deepEqual(ball.totals,[]);
 for(const date of ['1873-08-29','1873-09-05','1873-09-12']){
  const a=list('australian-israelite-agents-'+date);assert.equal(a.entries.length,11);
  assert.ok(a.entries.every(e=>e.role==='agent'&&!e.amount));
  assert.equal(a.entries.find(e=>e.name_as_printed==='Mr. J. M. Solomon, jun.').note,'Address as printed: The Exchange.');
  assert.equal(a.entries.at(-1).place_as_printed,date==='1873-09-12'?'United States':'England');
 }
});
