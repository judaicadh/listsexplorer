const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const get=id=>db.lists.find(l=>l.id===id);
test('Mikveh Israel first subscriptions and cash postings reconcile independently without inventing additional gifts',()=>{
 const pledge=get('mikveh-israel-first-building-subscriptions-1782-04-02');
 const cash=get('mikveh-israel-first-building-receipts-1782-04-02');
 assert.equal(pledge.entries.length,30);assert.equal(cash.entries.length,21);
 assert.equal(pledge.totals[0].display,'£229 7s. 6d.');assert.equal(cash.totals[0].display,'£170 2s. 6d.');
 assert.ok(pledge.entries.every(e=>e.role==='pledger'));assert.ok(cash.entries.every(e=>e.role==='donor'));
 assert.equal(pledge.currency.code,'PHL-LSD');assert.notEqual(pledge.currency.code,'GBP');
});
test('building offering totals preserve pence and exclude expenditure and the bar-mitzvah boy',()=>{
 const bar=get('mikveh-israel-sasportas-bar-mitzvah-offerings-1782');
 const pesach=get('mikveh-israel-passover-building-offerings-1782');
 assert.equal(bar.entries.length,2);assert.equal(bar.totals[0].display,'£6 17s. 6d.');
 assert.equal(pesach.entries.length,13);assert.equal(pesach.totals[0].display,'£38 3s. 0d.');
 assert.equal(pesach.entries.find(e=>e.name_as_printed==='Moses Myers').amount,'17.10.0');
 assert.equal(pesach.entries.find(e=>e.name_as_printed==='Michael Gratz').amount,'0.17.6');
 assert.ok(!bar.entries.some(e=>e.name_as_printed==='Aaron Sasportas'));
 assert.ok(!bar.entries.concat(pesach.entries).some(e=>e.amount==='120.0.0'));
 assert.ok(bar.entries.concat(pesach.entries).every(e=>e.role==='pledger'));
});
test('account-index numbers and minutes names do not become cash donations or invented identities',()=>{
 const index=get('mikveh-israel-offerings-account-index-1786-1788');
 assert.equal(index.entries.length,86);assert.ok(index.entries.every(e=>!e.amount&&!e.quantity&&!e.entity_id));
 assert.equal(index.entries.find(e=>e.name_as_printed==='Franklin').entity_id,'');
 for(const [id,n] of [['mikveh-israel-opening-meeting-attendance-1782',18],['mikveh-israel-opening-meeting-officers-1782',6],['mikveh-israel-building-resolution-names-1782',37]]){
  const l=get(id);assert.equal(l.entries.length,n);assert.ok(l.entries.every(e=>!e.amount));
 }
 assert.ok(db.sources.filter(s=>['mikveh-israel-building-1782-1784','mikveh-israel-minutes-1782-1783','mikveh-israel-offerings-1786-1788'].includes(s.id)).every(s=>/PARTIAL TRANSCRIPTION/.test(s.notes)));
});
test('pledges remain visible as commitments but are excluded from a person’s total given',()=>{
 const person=db.people.find(p=>p.id==='gomez-daniel');
 assert.ok(person.entries.some(e=>e.role==='pledger'));
 assert.equal(person.totals.find(t=>t.code==='NY-CUR').display,'£10 0s. 0d.');
});
