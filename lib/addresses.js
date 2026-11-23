const LABELS={residence:'Residence',office:'Office',listed:'Listed address'};
const STATUSES=new Set(['pending','needs-context','candidate','accepted','rejected','no-match','ambiguous']);
function validCoordinates(a){return String(a.lat||'').trim()!==''&&String(a.lon||'').trim()!==''&&Number.isFinite(Number(a.lat))&&Number.isFinite(Number(a.lon))&&Math.abs(Number(a.lat))<=90&&Math.abs(Number(a.lon))<=180;}
function attachAddresses(rows,entries,lists){
 const byEntry=new Map(entries.map(e=>[e.id,e])),byList=new Map(lists.map(l=>[l.id,l])),errors=[],seen=new Set();
 for(const e of entries)e.addresses=[];
 for(const a of rows){
  if(!a.id||seen.has(a.id))errors.push('addresses: missing or duplicate id '+a.id);seen.add(a.id);
  const e=byEntry.get(a.entry_id);if(!e){errors.push('addresses: missing entry '+a.entry_id);continue;}
  if(!byList.has(a.list_id)||e.list_id!==a.list_id)errors.push('addresses: entry/list mismatch for '+a.id);
  if(!LABELS[a.kind]||!STATUSES.has(a.geocode_status)||!a.address_as_printed)errors.push('addresses: invalid kind, status or printed address for '+a.id);
  if((a.lat||a.lon)&&!validCoordinates(a))errors.push('addresses: invalid coordinate pair for '+a.id);
  if(['accepted','candidate'].includes(a.geocode_status)&&(!validCoordinates(a)||!a.precision||!a.provider||!a.matched_address))errors.push('addresses: mapped address needs valid coordinates, precision, matched address and provider for '+a.id);
  a.label=LABELS[a.kind]||'Address';a.hasCoordinates=validCoordinates(a)&&['accepted','candidate'].includes(a.geocode_status);a.mapUrl=a.hasCoordinates?'/addresses/#'+a.id:'';a.locationLabel=a.geocode_status==='accepted'?'Reviewed modern location':a.hasCoordinates?'Modern location candidate — needs review':a.geocode_status==='ambiguous'?'Multiple matches — needs review':a.geocode_status==='no-match'?'No modern match':'Location not matched';
  a.entry=e;e.addresses.push(a);
 }
 for(const l of lists){l.addresses=l.entries.flatMap(e=>e.addresses);l.hasAddresses=l.addresses.length>0;}
 return errors;
}
function addressData(db){return db.addresses.map(a=>({id:a.id,entry_id:a.entry_id,list_id:a.list_id,kind:a.kind,label:a.label,address:a.address_as_printed,name:a.entry.name_as_printed,profile:a.entry.profileUrl,list:a.entry.list.title,date:a.entry.list.dateLabel,url:a.entry.list.url+'#'+a.entry_id,lat:a.hasCoordinates?Number(a.lat):null,lon:a.hasCoordinates?Number(a.lon):null,status:a.geocode_status,precision:a.precision,matched:a.matched_address,provider:a.provider,note:a.note,locationLabel:a.locationLabel}));}
module.exports={LABELS,STATUSES,validCoordinates,attachAddresses,addressData};
