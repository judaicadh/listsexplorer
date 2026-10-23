const test=require('node:test');const assert=require('node:assert/strict');
const {mapData}=require('../lib/map-data');
const list={id:'example',title:'Example',url:'/lists/example/',list_type:'petition',dateLabel:'1872'};
const place=(overrides={})=>({id:'zero',name:'Zero',url:'/places/zero/',modern_name:'',variants:[],country:'Example',lat:'0',lon:'0',lists:[list],entries:[],...overrides});
test('map data accepts real zero coordinates but never locates missing or invalid coordinates at zero',()=>{
 const db={vocab:{LIST_TYPES:{petition:'Petition'}},places:[place(),place({id:'blank',lat:'',lon:''}),place({id:'bad',lat:'north'}),place({id:'range',lat:'91'}),place({id:'unused',lists:[]})]};
 const rows=mapData(db).places;assert.equal(rows.length,4);assert.equal(rows[0].lat,0);assert.equal(rows[0].lon,0);assert.ok(rows.slice(1).every(p=>p.lat===null&&p.lon===null));
});
test('a list connected through both its origin and multiple entries appears once with separate counts',()=>{
 const rows=mapData({vocab:{LIST_TYPES:{}},places:[place({entries:[{list},{list}]})]}).places;
 assert.equal(rows[0].lists.length,1);assert.equal(rows[0].lists[0].entries,2);assert.equal(rows[0].lists[0].origin,true);
});
test('catalogue map includes entry places and list origins, with routes back to their records',()=>{
 const db=require('../lib/db').build();const result=mapData(db);assert.deepEqual(db.errors,[]);
 const london=result.places.find(p=>p.id==='london');assert.ok(london.lists.length);assert.ok(Number.isFinite(london.lat));
 const melbourne=result.places.find(p=>p.id==='melbourne');assert.ok(melbourne.lists.some(l=>l.origin));
 for(const p of result.places){assert.equal(new Set(p.lists.map(l=>l.id)).size,p.lists.length);assert.match(p.url,/^\/places\//);assert.ok(p.lists.every(l=>l.url.startsWith('/lists/')));}
});
