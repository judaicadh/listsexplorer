const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const expected=require('./fixtures/temple-ledger-checks.json');
test('Temple ledger retains every contributor page, list count and amount without capital/interest duplication',()=>{
 assert.deepEqual(db.errors,[]);
 const lists=expected.map(x=>db.lists.find(l=>l.id===x.id));
 assert.equal(lists.length,22);
 assert.equal(lists.reduce((n,l)=>n+l.entries.length,0),810);
 for(const x of expected){const l=lists.find(l=>l.id===x.id);assert.equal(l.entries.length,x.entries);assert.equal(l.entries.reduce((n,e)=>n+(e.money?.base||0),0),x.cents);}
 assert.ok(lists.flatMap(l=>l.entries).every(e=>/^Scan \d{3}/.test(e.page)));
 assert.ok(!lists.flatMap(l=>l.entries).some(e=>/brought forward|interest on|balance deposited/i.test(e.name_as_printed)));
 assert.equal(lists.flatMap(l=>l.entries).filter(e=>!e.amount).length,3);
 assert.ok(lists.some(l=>/1859/.test(l.date)));
 const s=lists.find(l=>l.id==='hsss-philadelphia-1859-subscriptions');assert.equal(s.entries.length,36);assert.equal(s.list_type,'support');assert.equal(s.copies,null);assert.equal(s.entries.filter(e=>e.amount==='2.25').length,1);
 const raffle=lists.flatMap(l=>l.entries).find(e=>e.name_as_printed.startsWith('proceeds of Raffle'));assert.equal(raffle.role,'agent');
 assert.ok(lists.every(l=>l.roles.some(r=>r.role==='superintendent')));
});
