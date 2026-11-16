const {test}=require('node:test');
const assert=require('node:assert/strict');
const {attachProfiles,recordUrl,roleId,profileMetadata}=require('../lib/profiles');
test('every appearance gets a stable independent profile without changing identity links',()=>{
 const entries=[{id:'one',list_id:'first',name_as_printed:'D. Gomez',entity_id:''},{id:'two',list_id:'second',name_as_printed:'D. Gomez',entity_id:''},{id:'three',list_id:'first',entity:{url:'/people/gomez-daniel/'},agent_as_printed:'Mr. Agent'}];
 const roles=[{list_id:'first',name_as_printed:'Mr. Chair',role:'chairman'}];
 attachProfiles(entries,roles);
 assert.notEqual(entries[0].profileUrl,entries[1].profileUrl);
 assert.equal(entries[0].entity_id,''); assert.equal(entries[0].profileUrl,recordUrl('first','one'));
 assert.equal(entries[2].profileUrl,'/people/gomez-daniel/');
 assert.equal(entries[2].agentProfileUrl,recordUrl('first','three',true));
 assert.equal(roles[0].profileId,roleId({...roles[0]}));
 assert.match(roles[0].profileUrl,/entry=role-/);
});
test('catalogue links every entry, named role and unlinked intermediary; metadata preserves provenance',()=>{
 const db=require('../lib/db').build();
 assert.deepEqual(db.errors,[]);
 assert.ok(db.entries.every(e=>e.profileUrl));
 assert.ok(db.roles.filter(r=>r.name_as_printed).every(r=>r.profileUrl));
 assert.ok(db.entries.filter(e=>e.agent_as_printed).every(e=>e.agentProfileUrl));
 const meta=profileMetadata(db);
 assert.equal(Object.keys(meta.lists).length,db.lists.length);
 for(const l of db.lists) {assert.equal(meta.lists[l.id].title,l.title);assert.equal(meta.lists[l.id].roles.length,l.roles.length);}
});
