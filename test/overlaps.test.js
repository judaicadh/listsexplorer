const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalize, eligible, scoreMatch, buildOverlaps} = require('../lib/overlaps');
test('names with initials, spousal titles, and organizations are not silently grouped', () => {
  for (const name of ['D. Gomez','Mrs. Daniel Gomez','Gomez & Company','A Friend','London Society']) assert.equal(eligible(name),false,name);
  assert.equal(normalize('Mr. Daniel Gómez'), normalize('Daniel Gomez'));
  assert.equal(eligible('Daniel Gomez'),true);
  assert.equal(eligible('Miss Flora Cohen'),true);
  assert.equal(normalize('Miss Flora Cohen'), normalize('Flora Cohen'));
});
test('conflicts, chronology and collective attributions cap identity scores', () => {
  const a={name:'Daniel Gomez',entity_id:'daniel',place_id:'ny',year:1728};
  assert.equal(scoreMatch(a,{...a}).score,95);
  assert.equal(scoreMatch(a,{...a,entity_id:'other'}).score,20);
  assert.equal(scoreMatch(a,{...a,year:1828}).score,25);
  assert.equal(scoreMatch(a,{...a,name:'Mr. Daniel Gomez & Com.',certainty:'uncertain'}).score,60);
  assert.equal(scoreMatch({...a,entity_id:''},{...a,entity_id:''}).score,80);
});
test('overlaps count distinct lists, preserve raw names and never mutate identity links', () => {
  const entries=[1,2,3].map((n)=>({id:String(n),name_as_printed:'Daniel Gomez',entity_id:'',list:{id:n<3?'a':'b',title:'List',url:'/lists/a/',year:1728,dateLabel:'1728'}}));
  const original=JSON.stringify(entries);
  assert.equal(buildOverlaps([],entries.slice(0,2)).length,0);
  const result=buildOverlaps([],entries);
  assert.equal(result.length,1); assert.equal(result[0].listCount,2);
  assert.equal(result[0].rows[0].name,'Daniel Gomez');
  assert.equal(JSON.stringify(entries),original);
});
