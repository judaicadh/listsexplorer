(async()=>{
const $=id=>document.getElementById(id),base=(window.SITE_BASE||'/').replace(/\/$/,''),query=$('address-query'),status=$('address-status'),list=$('address-list'),rows=$('address-rows'),summary=$('address-summary');
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};const link=(label,url)=>{const e=node('a',label);e.href=base+url;return e;};
try{
const response=await fetch(base+'/address-data.json');if(!response.ok)throw Error();const data=await response.json();
let map,layer;if(window.L){map=L.map('address-map',{scrollWheelZoom:false}).setView([39,-96],4);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19}).addTo(map);layer=L.layerGroup().addTo(map);}else $('address-map').textContent='Map unavailable. Addresses and result details are listed below.';
for(const [id,title]of [...new Map(data.map(a=>[a.list_id,a.list]))].sort((a,b)=>a[1].localeCompare(b[1]))){const o=node('option',title);o.value=id;list.append(o);}
list.value=new URLSearchParams(location.search).get('list')||'';
function render(){const q=query.value.trim().toLocaleLowerCase(),visible=data.filter(a=>(!list.value||a.list_id===list.value)&&(!status.value||status.value==='unmapped'?(!status.value||a.lat===null):a.status===status.value)&&[a.name,a.address,a.list].join(' ').toLocaleLowerCase().includes(q));rows.replaceChildren();layer?.clearLayers();const bounds=[];
for(const a of visible){const card=node('article',undefined,'panel');card.id=a.id;card.append(link(a.name,a.profile),node('p',a.label+': '+a.address),node('p',a.date+' · '+a.list,'muted'),node('p',a.locationLabel,'small-note'));
if(a.matched)card.append(node('p','Modern match: '+a.matched+' · '+a.precision+' · '+a.provider,'small-note'));card.append(link('View source entry',a.url));rows.append(card);
if(a.lat!==null&&map){const m=L.circleMarker([a.lat,a.lon],{radius:6,color:a.status==='accepted'?'#21633d':'#b55d10',fillOpacity:.65}).addTo(layer);const p=node('div');p.append(node('strong',a.name),node('p',a.label+': '+a.address),node('p',a.locationLabel),link('View source entry',a.url));m.bindPopup(p);card.append(document.createTextNode(' · '));const show=node('button','Show on map');show.type='button';show.addEventListener('click',()=>{map.setView([a.lat,a.lon],16);m.openPopup();$('address-map').scrollIntoView({block:'center'});});card.append(show);bounds.push([a.lat,a.lon]);if(location.hash==='#'+a.id){m.openPopup();map.setView([a.lat,a.lon],15);}}
}summary.textContent=visible.length+' addresses · '+visible.filter(a=>a.lat!==null).length+' modern location candidates or reviewed locations · '+visible.filter(a=>a.lat===null).length+' not mapped';
if(bounds.length&&!location.hash)map?.fitBounds(bounds,{padding:[20,20],maxZoom:12});}
query.addEventListener('input',render);status.addEventListener('change',render);list.addEventListener('change',render);window.addEventListener('hashchange',render);render();
}catch{summary.textContent='Addresses could not load. Please retry or download the CSV.';}
})();
