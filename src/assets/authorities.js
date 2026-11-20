(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ListAuthorities=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 function links(input){const values=Array.isArray(input)?input:String(input||'').split('|'),result=[],seen=new Set();for(let raw of values){raw=String(raw||'').trim();if(/^Q[1-9]\d*$/.test(raw))raw='https://www.wikidata.org/wiki/'+raw;let u;try{u=new URL(raw);}catch{continue;}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;let label=u.hostname.replace(/^www\./,''),id='';const host=u.hostname.toLowerCase(),path=u.pathname;let m;
 if(['wikidata.org','www.wikidata.org'].includes(host)&&(m=path.match(/^\/(?:wiki|entity)\/(Q[1-9]\d*)\/?$/i))){label='Wikidata';id=m[1].toUpperCase();u=new URL('https://www.wikidata.org/wiki/'+id);}
 else if(host==='id.loc.gov'&&(m=path.match(/^\/authorities\/(names|subjects)\/([a-z]{1,3}\d+)(?:\.html)?\/?$/i))){label='Library of Congress';id=m[2];u=new URL('https://id.loc.gov/authorities/'+m[1]+'/'+id);}
 else if(['viaf.org','www.viaf.org'].includes(host)&&(m=path.match(/^\/viaf\/(\d+)\/?$/))){label='VIAF';id=m[1];u=new URL('https://viaf.org/viaf/'+id);}
 else if(host==='d-nb.info'&&(m=path.match(/^\/gnd\/([\dXx-]+)\/?$/))){label='German National Library';id=m[1];u=new URL('https://d-nb.info/gnd/'+id);}
 else if(['geonames.org','www.geonames.org','sws.geonames.org'].includes(host)&&(m=path.match(/^\/(\d+)(?:\/.*)?$/))){label='GeoNames';id=m[1];}
 if(seen.has(u.href))continue;seen.add(u.href);result.push({url:u.href,label,id});}return result;}
 return {links};
});
