const {createHash} = require('node:crypto');
function recordUrl(listId, id, via = false) {
  return `/people/record/?list=${encodeURIComponent(listId)}&entry=${encodeURIComponent(id)}${via ? '&via=1' : ''}`;
}
function roleId(role) {
  return 'role-' + createHash('sha256').update(JSON.stringify([role.list_id, role.role, role.name_as_printed, role.address_as_printed, role.note])).digest('hex').slice(0,24);
}
function attachProfiles(entries, roles) {
  for (const entry of entries) {
    entry.profileUrl = entry.entity?.url || recordUrl(entry.list_id, entry.id);
    entry.agentProfileUrl = entry.agent?.url || (entry.agent_as_printed ? recordUrl(entry.list_id, entry.id, true) : '');
  }
  for (const role of roles) {
    role.profileId = roleId(role);
    role.profileUrl = role.entity?.url || (role.name_as_printed ? recordUrl(role.list_id, role.profileId) : '');
  }
}
function profileMetadata(db) {
  return {
    lists: Object.fromEntries(db.lists.map(l => [l.id, {
      title:l.title, url:l.url, date:l.dateLabel, status:l.status, citation:l.citation, currency:l.currency?.code || '', images:l.images,
      source: l.source ? {title:l.source.title, url:l.source.url, catalogueUrl:l.source.catalogueUrl} : null,
      roles: l.roles.map(r => ({id:r.profileId, name:r.name_as_printed || r.displayName, role:r.roleLabel, address:r.address_as_printed, note:r.note, entity:r.entity_id, url:r.profileUrl}))
    }])),
    entities: Object.fromEntries([...db.people,...db.organizations].map(e => [e.id,{name:e.name,url:e.url,kind:e.kind}])),
    places: Object.fromEntries(db.places.map(p=>[p.id,p.name])),
    currencies: Object.fromEntries(db.currencies.map(c=>[c.code,{name:c.name,format:c.format}]))
  };
}
module.exports = {recordUrl, roleId, attachProfiles, profileMetadata};
