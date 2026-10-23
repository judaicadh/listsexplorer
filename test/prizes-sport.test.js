const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const api=require('../src/assets/contribution');
const {parse}=require('csv-parse/sync');
const root=path.resolve(__dirname,'..');
const db=require('../lib/db').build();
const list=id=>db.lists.find(l=>l.id===id);

test('1873 agent issues and school lists preserve distinct dated appearances and awards',()=>{
  assert.deepEqual(db.errors,[]);
  const agents=db.lists.filter(l=>l.id.startsWith('australian-israelite-agents-1873-'));
  assert.equal(agents.length,16);
  for(const l of agents){
    assert.equal(l.entries.length,4);
    assert.ok(l.entries.every(e=>e.role==='agent'&&!e.amount&&!e.agent_as_printed));
    assert.match(l.entries[0].note,/158 Castlereagh-street/);
    assert.equal(l.entries[3].place_id,'london');
  }
  assert.equal(db.lists.filter(l=>l.id==='anglo-jewish-association-victoria-1873').length,1);
  assert.equal(list('anglo-jewish-association-victoria-1873').entries.length,61);
  const school=list('school-180-prizes-1873-04-18');
  assert.equal(school.entries.length,35);
  assert.ok(school.entries.every(e=>e.role==='prize-recipient'&&!e.agent_id&&!e.agent_as_printed));
  assert.deepEqual(school.entries.filter(e=>e.money).map(e=>[e.name_as_printed,e.amount]),[['Miriam Davis','5.5.0']]);
  assert.equal(school.entries.filter(e=>e.section==='Fifth class — Arithmetic').length,3);
  const contributors=list('school-180-prize-contributors-1873-04-18');
  assert.equal(contributors.entries.length,11);
  assert.equal(contributors.entries.at(-1).role,'pledger');
  assert.equal(contributors.entries.at(-1).amount,'');
  assert.equal(list('auckland-hebrew-school-prizes-1873-04-25').entries.length,15);
  assert.equal(list('auckland-hebrew-school-reciters-1873-04-25').entries.length,11);
});

test('sports scores and recitations do not become donations or copy quantities',()=>{
  const sport=list('jewish-cricket-match-1873-04-18');
  assert.equal(sport.entries.length,22);
  assert.ok(sport.entries.every(e=>e.role==='participant'&&!e.amount&&!e.currency&&!e.quantity&&!e.agent_id&&!e.agent_as_printed));
  assert.deepEqual(sport.totals,[]);
  assert.match(sport.notes,/sum to 82/);
  assert.match(sport.notes,/total 85/);
  assert.match(sport.entries.find(e=>e.name_as_printed==='Friedman').note,/First innings: 34.*Second innings: 11/);
  for(const [type,role] of [['prize','prize-recipient'],['sport','participant'],['roster','participant']]){
    const result=api.validate({version:1,list:{id:'test-'+type,title:'Test',date:'1873',list_type:type,source_id:'australian-israelite'},entries:[{name_as_printed:'Test name'}]},api.context(db));
    assert.deepEqual(result.errors,[]);
    assert.equal(result.contribution.entries[0].role,role);
  }
  const nj=require('nunjucks');const env=new nj.Environment(new nj.FileSystemLoader(path.join(root,'src/_includes')));
  const html=env.renderString(fs.readFileSync(path.join(root,'src/lists/list.njk'),'utf8'),{list:sport,site:{}});
  assert.match(html,/Participant as printed/);
  assert.doesNotMatch(html,/>Amount<|>Printed prize value</);
});

test('linked prize recipients do not acquire a total given',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lists-prize-test-'));
  try{
    for(const folder of ['data','lib'])fs.cpSync(path.join(root,folder),path.join(dir,folder),{recursive:true});
    fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
    const file=path.join(dir,'data/entries.csv');const rows=parse(fs.readFileSync(file,'utf8'),{columns:true,skip_empty_lines:true});
    rows.find(e=>e.list_id==='school-180-prizes-1873-04-18'&&e.amount).entity_id='lyons-eleazer';
    fs.writeFileSync(file,api.stringify(rows));
    const joined=require(path.join(dir,'lib/db')).build();assert.deepEqual(joined.errors,[]);
    const person=joined.people.find(p=>p.id==='lyons-eleazer');
    assert.ok(person.entries.some(e=>e.role==='prize-recipient'&&e.money));
    const gifts=person.entries.filter(e=>!['offering-purpose','debtor','beneficiary','officer','agent','signatory','prize-recipient','participant'].includes(e.role)&&e.money);
    assert.equal(person.totals.reduce((n,t)=>n+t.count,0),gifts.length);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
