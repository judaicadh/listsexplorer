const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db').build();
const stats=require('../src/_data/sourceTables.json')['jdc-population-report-68-1949'].tables;
const directory=db.lists.find(l=>l.id==='philadelphia-associations-directory-1923');
test('all six directory pages preserve 150 organizations and 142 contact appearances without invented donations',()=>{
 assert.equal(directory.entries.length,292);
 const orgs=directory.entries.filter(e=>e.role==='listed-organization'),contacts=directory.entries.filter(e=>e.role==='listed-contact');
 assert.equal(orgs.length,150);assert.equal(contacts.length,142);
 assert.equal(new Set(orgs.map(e=>e.entity_id)).size,150);
 assert.ok(orgs.every(e=>e.entity?.kind==='organization'));
 assert.ok(contacts.every(e=>!e.entity_id&&e.profileUrl.includes('/people/record/')));
 assert.ok(directory.entries.every(e=>!e.amount&&!e.quantity&&!e.agent_id&&!e.agent_as_printed));
 assert.equal(directory.totals.length,0);
 const expected=[27,29,28,28,28,10];
 expected.forEach((count,i)=>assert.equal(orgs.filter(e=>e.page===`PDF p. ${i+1}`).length,count));
 assert.ok(directory.entries.some(e=>e.certainty==='uncertain'));
});
test('directory contact relationships retain repeated people, multiple offices, missing data and Camden NJ',()=>{
 const contacts=directory.entries.filter(e=>e.role==='listed-contact');
 const woliner=contacts.filter(e=>e.section.includes('WOLINER UNTER. VEREIN'));
 assert.equal(woliner.length,2);assert.ok(woliner.some(e=>e.note.includes('Pres.')));assert.ok(woliner.some(e=>e.note.includes("Sec'y")));
 const repeated=contacts.filter(e=>e.name_as_printed==='J. Aberman');assert.equal(repeated.length,3);assert.ok(repeated.every(e=>!e.entity_id));
 const camden=contacts.find(e=>e.place_as_printed.includes('Camden, N.J.'));
 assert.equal(camden.place_id,'camden-new-jersey');assert.notEqual(camden.place_id,'camden');
 assert.ok(contacts.some(e=>!e.place_as_printed));
 assert.match(directory.notes,/not assumed to be officers/);
});
test('the four 1949 statistical tables stay outside the person database and preserve exact reported ranges',()=>{
 assert.equal(stats.length,4);assert.equal(stats.reduce((n,t)=>n+t.rows.length,0),70);
 assert.ok(!db.lists.some(l=>l.source_id==='jdc-population-report-68-1949'));
 const c=stats.find(t=>t.id==='country-estimates').rows;
 assert.deepEqual(c.find(r=>r[0]==='Finland').slice(0,2),['Finland','1,800']);
 assert.equal(c.find(r=>r[0]==='France')[1],'280-300,000');
 assert.equal(c.find(r=>r[0]==='Total Europe')[1],'1,218,500-1,263,500');
 assert.equal(c.find(r=>r[0]==='Libya')[1],'30,000');assert.equal(c.find(r=>r[0]==='Tripolitania')[1],'30,000');
 assert.equal(c.find(r=>r[0]==='Total North Africa')[1],'726,000');
 const low=c.slice(0,23).reduce((sum,r)=>sum+Number(r[1].includes('-')?r[1].split('-')[0]*1000:r[1].replaceAll(',','')),0);
 assert.equal(low,1218500);
});
test('Berlin and Russian-zone printed subtotals reconcile while blank cells and dashes remain distinct',()=>{
 const b=stats.find(t=>t.id==='berlin-community');
 assert.equal(b.rows.at(-1)[5],'6835');assert.equal(b.rows[5][6],'736');assert.equal(b.rows[11][6],'6099');
 assert.ok(b.rows.some(r=>r[1]===''));
 const n=stats.find(t=>t.id==='russian-zone-northern'),s=stats.find(t=>t.id==='russian-zone-southern');
 assert.equal(n.rows.at(-1)[6],'405');assert.equal(s.rows.at(-1)[6],'875');
 assert.equal(Number(n.rows.at(-1)[6])+Number(s.rows.at(-1)[6]),1280);
 for(const t of [n,s]) {
  for(const indexes of [[0,1,2,3,4],[5,6,7],[8,9,10]]) {
   const subtotal=t.rows[indexes.at(-1)];
   for(let col=2;col<6;col++)assert.equal(indexes.slice(0,-1).reduce((sum,i)=>sum+Number(t.rows[i][col]==='-'?0:t.rows[i][col]),0),Number(subtotal[col]));
  }
 }
 assert.ok(n.rows.some(r=>r.includes('-')));
});
test('directory imports preserve organization and contact roles instead of defaulting to donors',()=>{
 const api=require('../src/assets/contribution');
 const data={version:1,list:{id:'test-association-directory',title:'Association directory',list_type:'directory',source_id:db.sources[0].id,date:'1923'},entries:[{name_as_printed:'A. Contact',certainty:'certain'},{name_as_printed:'Example association',role:'listed-organization',certainty:'uncertain'}]};
 const result=api.validate(data,api.context(db));
 assert.deepEqual(result.errors,[]);assert.equal(result.contribution.entries[0].role,'listed-contact');assert.equal(result.contribution.entries[1].role,'listed-organization');
});
