const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compare}=require('../src/assets/list-sort');
test('recent additions sort by catalogue timestamp rather than historical date or current row order',()=>{
 const records=[{title:'Newly added old document',date:'1800',added:'2026-10-24T12:00:00Z',index:0},{title:'Earlier modern document',date:'1906',added:'2026-10-22T12:00:00Z',index:10}];
 assert.equal([...records].sort((a,b)=>compare(a,b,'recent'))[0].date,'1800');
 assert.equal([...records].sort((a,b)=>compare(a,b,'date-desc'))[0].date,'1906');
 assert.equal(compare({...records[0],added:'',index:11},records[1],'recent'),-1);
});
test('historical sorting puts undated lists last and title sorting remains available',()=>{
 const records=[{title:'Z',date:''},{title:'B',date:'1906'},{title:'A',date:'1843'}];
 assert.deepEqual([...records].sort((a,b)=>compare(a,b,'date')).map(r=>r.title),['A','B','Z']);
 assert.deepEqual([...records].sort((a,b)=>compare(a,b,'date-desc')).map(r=>r.title),['B','A','Z']);
 assert.deepEqual([...records].sort((a,b)=>compare(a,b,'title')).map(r=>r.title),['A','B','Z']);
});
