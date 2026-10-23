(() => {
  const byId = id => document.getElementById(id);
  const query=byId('map-query'), country=byId('map-country'), type=byId('map-type'), reset=byId('map-reset');
  const summary=byId('map-summary'), detail=byId('map-detail'), results=byId('map-places'), message=byId('map-message');
  const base=(window.SITE_BASE || '/').replace(/\/$/,'');
  const url=path => base + '/' + path.replace(/^\//,'');
  const node=(tag,text,className) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(className)n.className=className; return n; };
  const link=(text,path) => {const a=node('a',text);a.href=url(path);return a;};
  const plural=(n,one,many=one+'s') => `${n} ${n===1?one:many}`;
  let data, map, layer, selected='', visible=[], markers=new Map();
  function notice(text) {message.hidden=false;message.textContent=text;}
  function chosen(place) {
    selected=place.id; detail.replaceChildren(node('h2',place.name));
    detail.append(node('p',[place.modern&&place.modern!==place.name?'Today '+place.modern:'',place.country].filter(Boolean).join(' · '),'muted'));
    const count=place.lists.reduce((n,l)=>n+l.entries,0);
    detail.append(node('p',`${plural(count,'entry','entries')} with this place · ${plural(place.lists.length,'connected list')}`));
    const ul=node('ul');
    for(const l of place.lists) {const li=node('li');li.append(link(l.title,l.url));li.append(node('span',`${l.date} · ${data.types[l.type] || l.type}${l.origin?' · List raised here':''}${l.entries?' · '+plural(l.entries,'entry','entries')+' with this place':''}`,'map-record-note'));ul.append(li);}
    detail.append(ul,link('Explore all records for '+place.name+' →',place.url));
    if(place.lat===null)detail.append(node('p','This place has no mapped coordinates yet.','muted'));
    results.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.place===selected)));
  }
  function select(place) {
    chosen(place);
    const marker=markers.get(place.id);
    if(marker) {map.setView([place.lat,place.lon],Math.max(map.getZoom(),5));marker.openPopup();}
  }
  function fit() {if(map&&markers.size)map.fitBounds([...markers.values()].map(m=>m.getLatLng()),{padding:[30,30],maxZoom:7});}
  function render() {
    const term=query.value.trim().toLocaleLowerCase();
    visible=data.places.map(p=>({...p,lists:p.lists.filter(l=>!type.value||l.type===type.value)})).filter(p=>p.lists.length&&(!country.value||p.country===country.value)&&[p.name,p.modern,...p.variants].join(' ').toLocaleLowerCase().includes(term));
    results.replaceChildren();markers.clear();if(layer)layer.clearLayers();
    let mapped=0;
    for(const p of visible) {
      const b=node('button',undefined,'map-place-button');b.type='button';b.dataset.place=p.id;b.setAttribute('aria-pressed',String(selected===p.id));
      b.append(node('strong',p.name),node('span',`${p.country} · ${plural(p.lists.length,'list')}${p.lat===null?' · Not mapped':''}`));
      b.addEventListener('click',()=>select(p));results.append(b);
      if(p.lat!==null) {
        mapped++;
        if(map) {
          const m=L.circleMarker([p.lat,p.lon],{radius:Math.min(16,5+Math.sqrt(p.lists.length)*1.8),color:'#1f4e79',weight:1.5,fillColor:'#668fab',fillOpacity:.72}).addTo(layer);
          const popup=node('div');popup.append(node('strong',p.name),node('p',plural(p.lists.length,'connected list')),link('Explore this place',p.url));m.bindPopup(popup);m.bindTooltip(p.name);
          m.on('click',()=>chosen(p));m.on('popupopen',()=>chosen(p));
          const el=m.getElement();if(el){el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',p.name+', '+plural(p.lists.length,'connected list'));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(p);}});}
          markers.set(p.id,m);
        }
      }
    }
    summary.textContent=`${plural(visible.length,'place')} · ${mapped} with coordinates · ${visible.length-mapped} not mapped`;
    if(!visible.length)results.append(node('p','No places match. Try another spelling or reset the filters.'));
    const active=visible.find(p=>p.id===selected);if(active)chosen(active);else {selected='';detail.replaceChildren(node('h2','Choose a place'),node('p','Select a point or a place to explore its connected lists.'));}
    fit();
  }
  async function start() {
    try {
      const response=await fetch(url('map-data.json'));if(!response.ok)throw new Error('data');data=await response.json();
      for(const c of [...new Set(data.places.map(p=>p.country))].sort()) {const o=node('option',c);o.value=c;country.append(o);}
      for(const [value,label] of Object.entries(data.types)){if(!data.places.some(p=>p.lists.some(l=>l.type===value)))continue;const o=node('option',label);o.value=value;type.append(o);}
      if(window.L) {
        map=L.map('place-map',{scrollWheelZoom:false,minZoom:1,maxZoom:16});layer=L.layerGroup().addTo(map);
        const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
        tiles.on('tileerror',()=>notice('The background map could not load. Place points and the list below are still available.'));
      } else notice('The interactive map could not load. You can still select places below and explore their records.');
      for(const input of [query,country,type,reset])input.disabled=false;
      query.addEventListener('input',render);country.addEventListener('change',render);type.addEventListener('change',render);
      reset.addEventListener('click',()=>{query.value='';country.value='';type.value='';selected='';render();});
      render();
    }catch(error){summary.textContent='Place data could not load.';notice('Please reload the page, or browse the Places page.');const a=link('Browse all places','/places/');results.append(a);}
  }
  start();
})();
