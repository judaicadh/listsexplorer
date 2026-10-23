const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const list=id=>db.lists.find(l=>l.id===id);
test('1874 receipts retain unspecified terms, printed coverage, initials and ditto places',()=>{
 assert.deepEqual(db.errors,[]);
 const subs=db.lists.filter(l=>l.id.startsWith('australian-israelite-subscriptions-1874-')&&l.date<='1874-05-01');
 assert.equal(subs.length,18);assert.equal(subs.reduce((n,l)=>n+l.entries.length,0),197);
 for(const date of ['1874-04-17','1874-02-13'])assert.ok(list('australian-israelite-subscriptions-'+date).entries.every(e=>e.section===''));
 const feb=list('australian-israelite-subscriptions-1874-02-20');
 assert.equal(feb.entries.find(e=>e.name_as_printed==='H. Levison').place_id,'ballarat');
 assert.equal(feb.entries.find(e=>e.name_as_printed==='J. Bernstein').place_id,'stawell');
 assert.match(feb.entries.find(e=>e.name_as_printed==='J. Bernstein').note,/February 13th, 1874/);
 const apr=list('australian-israelite-subscriptions-1874-04-24');
 assert.match(apr.entries.find(e=>e.name_as_printed==='B. Barnett').note,/February, 1874/);
 assert.equal(list('australian-israelite-subscriptions-1874-04-10').entries[0].name_as_printed,'C.');
 assert.ok(subs.flatMap(l=>l.entries).every(e=>e.role==='subscriber'&&!e.quantity&&!e.agent_id&&!e.agent_as_printed));
});
test('1874 prizes, offices and emergency selections remain separate noncash capacities',()=>{
 const prize=list('ballarat-school-prizes-1874-04-10');assert.equal(prize.entries.length,10);
 assert.ok(prize.entries.some(e=>e.name_as_printed==='S. Bernstien'));assert.ok(prize.entries.some(e=>e.name_as_printed==='S. Bernstein'));
 const officers=list('ballarat-congregation-officers-1874-04-10');assert.equal(officers.entries.length,8);assert.equal(officers.roles.filter(r=>r.role==='committee').length,5);
 const medal=list('melbourne-ladies-college-medals-1874-04-03');assert.equal(medal.entries.length,2);
 const cricket=list('jewish-cricket-teams-1874-04-03');assert.equal(cricket.entries.length,26);
 assert.equal(cricket.entries.filter(e=>e.section.includes('Emergency')).length,4);
 assert.equal(cricket.entries.filter(e=>e.section==='Left-hand side').length,11);assert.equal(cricket.entries.filter(e=>e.section==='Right-hand side').length,11);
 for(const l of [prize,officers,medal,cricket]){
  assert.ok(l.entries.every(e=>!e.amount&&!e.quantity&&!e.agent_id&&!e.agent_as_printed));assert.deepEqual(l.totals,[]);
 }
});
