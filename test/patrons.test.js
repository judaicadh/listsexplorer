const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const api=require('../src/assets/contribution');
const db=require('../lib/db').build();
const list=db.lists.find(l=>l.id==='jewish-encyclopedia-full-list-of-patrons');

test('the patron import retains every ordered source row, section and place label',()=>{
 assert.deepEqual(db.errors,[]);
 assert.equal(list.entries.length,7560);
 const digest=createHash('sha256').update(JSON.stringify(list.entries.map(e=>[e.section,e.name_as_printed,e.place_as_printed]))).digest('hex');
 assert.equal(digest,'cc8fa8a05bdfbfebbf562fc26d20a6d6902ca21e9491f4de40af3b41485534ee');
 const groups={};for(const e of list.entries){const section=e.section.split(' — ')[0];groups[section]=(groups[section]||0)+1;}
 assert.deepEqual(groups,{'NORTH AND SOUTH AMERICA':5326,'EUROPE, ASIA, AFRICA, AND AUSTRALIA':1529,'LIBRARIES, CLUBS, SOCIETIES, INSTITUTIONS, ETC.':521,'SUPPLEMENTARY LIST, UNITED STATES.':184});
 assert.equal(list.entries[0].name_as_printed,'Aaron, Isaac M.');
 assert.equal(list.entries.at(-1).name_as_printed,'Zweighaft, S.');
 assert.equal(new Set(list.entries.map(e=>e.place_as_printed)).size,978);
 const repeated=list.entries.filter(e=>e.name_as_printed==='Bamberger, Jacob'&&e.place_as_printed==='Baltimore, Md.');
 assert.equal(repeated.length,2);assert.ok(repeated.every(e=>/occurrence [12] retained/.test(e.note)));
});

test('patron listings do not invent gifts, copies, dates, identities or intermediaries',()=>{
 assert.equal(list.list_type,'patron');assert.equal(list.date,'');assert.equal(list.currency,null);
 assert.ok(list.entries.every(e=>e.role==='patron'&&!e.amount&&!e.quantity&&!e.agent_id&&!e.agent_as_printed&&!e.entity_id));
 assert.deepEqual(list.totals,[]);assert.equal(list.copies,null);
 assert.equal(list.entries.find(e=>e.place_as_printed==='New York City').place_id,'new-york');
 assert.ok(list.entries.filter(e=>e.place_as_printed==='Rochester, N. Y.').every(e=>e.place_id!=='rochester'));
 const result=api.validate({version:1,list:{id:'test-patrons',title:'Patrons',list_type:'patron',date:'1906',source_id:'jewish-encyclopedia-online'},entries:[{name_as_printed:'Example patron'}]},api.context(db));
 assert.deepEqual(result.errors,[]);assert.equal(result.contribution.entries[0].role,'patron');
});
