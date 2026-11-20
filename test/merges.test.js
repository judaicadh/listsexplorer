const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {parse}=require('csv-parse/sync');const {stringify}=require('../src/assets/contribution');const {build}=require('../lib/db');
test('reviewed identity merges keep former routes, canonical references and original printed names',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lists-merges-'));
 try{fs.cpSync(path.join(__dirname,'../data'),dir,{recursive:true});
 const load=n=>parse(fs.readFileSync(path.join(dir,n+'.csv'),'utf8'),{columns:true,bom:true,skip_empty_lines:true});
 const write=(n,rows)=>fs.writeFileSync(path.join(dir,n+'.csv'),stringify(rows,Object.keys(rows[0])));
 const people=load('people');const make=(id,name,merged_into)=>Object.fromEntries(Object.keys(people[0]).map(k=>[k,{id,name,merged_into}[k]||'']));
 people.push(make('merge-test-old','Old printed form','merge-test-keep'),make('merge-test-keep','Preferred form',''));write('people',people);
 const entries=load('entries'),entry={...entries[0],id:'merge-test-entry',entity_id:'merge-test-old',name_as_printed:'Exact old spelling',amount:'',quantity:'',agent_id:''};entries.push(entry);write('entries',entries);
 const db=build({dataDir:dir});assert.deepEqual(db.errors,[]);const survivor=db.people.find(p=>p.id==='merge-test-keep');const old=db.peoplePages.find(p=>p.id==='merge-test-old');
 assert.equal(old.mergedInto,survivor);assert.ok(!db.people.some(p=>p.id==='merge-test-old'));assert.ok(survivor.variants.includes('Old printed form'));assert.equal(db.entries.find(e=>e.id==='merge-test-entry').entity,survivor);assert.equal(db.entries.find(e=>e.id==='merge-test-entry').name_as_printed,'Exact old spelling');
 people.find(p=>p.id==='merge-test-keep').merged_into='merge-test-old';write('people',people);assert.ok(build({dataDir:dir}).errors.some(e=>e.includes('merge cycle')));
 people.find(p=>p.id==='merge-test-keep').merged_into='';people.find(p=>p.id==='merge-test-old').merged_into='not-present';write('people',people);assert.ok(build({dataDir:dir}).errors.some(e=>e.includes('merge target')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
