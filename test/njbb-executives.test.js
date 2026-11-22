const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parse}=require('csv-parse/sync');
const db=require('../lib/db').build();
const list=db.lists.find(l=>l.id==='njbb-1927-executives');
const asset=n=>parse(fs.readFileSync(path.join(__dirname,'../src/assets/reviews/njbb-1927',n),'utf8'),{columns:true,skip_empty_lines:true});
test('Executives has all 126 scan-checked people in source page and column order',()=>{
 assert.equal(list.entries.length,126);
 const counts={};for(const r of list.entries)counts[`${r.page}:${r.column}`]=(counts[`${r.page}:${r.column}`]||0)+1;
 assert.deepEqual(counts,{'36:1':26,'36:2':27,'37:1':28,'37:2':28,'38:1':8,'38:2':9});
 assert.ok(list.entries.every(r=>r.certainty==='certain'&&r.note.includes('Printed details:')));
 assert.match(list.status,/Scan-checked/);
 const names=new Set(list.entries.map(r=>r.name_as_printed));
 for(const n of ['Adlerblum, Israel S.','Efroymson, G. A.','Friedman, Edward','Kohn, August','Miller, Julius','Moskowitz, Henry','Nathan, Benjamin','Stern, Leopold'])assert.ok(names.has(n),n);
 for(const n of ['Exchange Bank','Kew Gardens','Arverne, L. I','Pittsburgh, Pa','Mining Exchange'])assert.ok(!names.has(n),n);
 assert.ok(list.entries.every(r=>!r.amount&&!r.quantity&&!r.agent_id));
});
test('same-person IDs survive and retired OCR fragments are auditable without fabricated merges',()=>{
 const cross=asset('executives-correction-crosswalk.csv');
 assert.equal(cross.filter(r=>r.action==='corrected same source person').length,103);
 assert.equal(cross.filter(r=>r.action==='restored omitted person').length,23);
 const retired=asset('executives-retired-ocr-rows.csv');assert.equal(retired.length,21);
 assert.ok(retired.every(r=>!r.entity_id&&!list.entries.some(e=>e.id===r.id)));
 const first=list.entries.find(e=>e.name_as_printed==='Adlerblum, Israel S.');
 assert.equal(first.id,'njbb-1927-executives-36-1-00001');
 assert.match(list.entries.find(e=>e.name_as_printed==='Strauss, Joseph').note,/Navy Dept/);
});
test('remaining directories are visibly marked for redo without falsely upgrading their readings',()=>{
 const flagged=db.lists.filter(l=>l.source_id===list.source_id&&l.status.startsWith('Needs redo'));
 assert.equal(flagged.length,21);
 assert.ok(flagged.every(l=>l.entries.every(e=>e.certainty==='uncertain')));
});
