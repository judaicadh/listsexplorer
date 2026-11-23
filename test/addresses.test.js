const {test}=require('node:test'),assert=require('node:assert/strict');
const {attachAddresses,validCoordinates,addressData}=require('../lib/addresses');
test('address coordinates distinguish zero, missing, invalid, rejected and candidate values',()=>{
 assert.equal(validCoordinates({lat:'',lon:''}),false);assert.equal(validCoordinates({lat:'0',lon:'0'}),true);assert.equal(validCoordinates({lat:'100',lon:'4'}),false);
 const e={id:'e',list_id:'l'},l={id:'l',entries:[e]},a={id:'a',entry_id:'e',list_id:'l',kind:'office',address_as_printed:'1 Example St',lat:'40',lon:'-74',geocode_status:'candidate',precision:'street-range',provider:'Test',matched_address:'1 EXAMPLE ST'};
 assert.deepEqual(attachAddresses([a],[e],[l]),[]);assert.equal(e.addresses[0].label,'Office');assert.match(a.locationLabel,/candidate/);a.geocode_status='rejected';attachAddresses([a],[e],[l]);assert.equal(a.mapUrl,'');
 assert.ok(attachAddresses([{...a,list_id:'other'}],[e],[l]).some(e=>e.includes('mismatch')));
});
test('addresses retain historical appearances, split residences and offices, and expose geocoding uncertainty',()=>{
 const db=require('../lib/db').build();assert.deepEqual(db.errors,[]);assert.equal(db.addresses.length,470);
 const exec=db.lists.find(l=>l.id==='njbb-1927-executives');assert.equal(exec.addresses.length,225);assert.ok(exec.hasAddresses);
 const entry=exec.entries.find(e=>e.name_as_printed==='Adlerblum, Israel S.');assert.equal(entry.addresses.length,2);assert.equal(entry.addresses[0].kind,'listed');assert.equal(entry.addresses[1].kind,'office');
 assert.equal(db.addresses.filter(a=>a.geocode_status==='accepted').length,0);assert.equal(db.addresses.filter(a=>a.hasCoordinates).length,141);
 assert.ok(addressData(db).every(a=>a.name&&a.date&&a.url));assert.ok(db.addresses.every(a=>!a.lat||a.provider));
});
