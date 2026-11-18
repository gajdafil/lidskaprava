const K1='hra:aktivni',K2='hra:pokusy',$=s=>document.querySelector(s),M=$('#main');
let G,S,muted=false,fz=17;
const ld=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}},sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const beep=f=>{if(muted)return;try{const a=new AudioContext(),o=a.createOscillator();o.frequency.value=f;o.connect(a.destination);o.start();o.stop(a.currentTime+.12)}catch{}};
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const F=[1,.55,.25];
const total=()=>Object.values(S.a).reduce((t,x)=>t+(x.pts||0),0);
const save=()=>{sv(K1,S);$('#pts').textContent=S?'Body: '+total().toFixed(1):''};
const M0=x=>x.c.reduce((s,q)=>s+q[1],0)||1,it=()=>G.items[S.i],vis=x=>!x.if||Object.entries(x.if).every(([k,v])=>v.includes(S.a[k]?.choice));
function home(){const h=ld(K2)||[],a=ld(K1);S=null;$('#pts').textContent='';
M.innerHTML=`<h2>L'état, c'est moi – anebo ne?</h2><p>Jméno: <input id="nm" value="${esc(a?.name||'')}"></p>
${a&&!a.done?'<button class="btn" id="go">Pokračovat v kampani</button>':''}<button class="btn alt" id="nw">Nová kampaň</button>
<h3>Předchozí pokusy</h3>${h.length?h.map((x,i)=>`<p>${esc(x.name)}, ${x.date}, ${x.pct} % <button class="btn alt" data-d="${i}">Smazat</button></p>`).join('')+'<button class="btn alt" id="da">Smazat celou historii</button>':'<p class="small">Zatím žádný pokus.</p>'}
<p class="small">Tutoriál: u vzdělávacích úloh máte nejvýše 3 pokusy (100 / 55 / 25 % bodů), nápovědy body nesnižují, strategická volba se po potvrzení uzamkne. Data zůstávají jen v tomto prohlížeči.</p>`;
$('#nw').onclick=()=>{const n=$('#nm').value.trim();if(!n)return alert('Zadejte jméno.');if(a&&!a.done&&!confirm('Rozehraná kampaň bude nahrazena. Pokračovat?'))return;S={name:n,i:0,a:{},docs:[],ch:{},done:false};save();show()};
if($('#go'))$('#go').onclick=()=>{S=a;show()};
M.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{if(confirm('Smazat pokus?')){h.splice(+b.dataset.d,1);sv(K2,h);home()}});
if($('#da'))$('#da').onclick=()=>{if(confirm('Smazat celou historii?')){sv(K2,[]);home()}}}
function show(){save();while(S.i<G.items.length&&!vis(it()))S.i++;if(S.i>=G.items.length)return end();const x=it(),r=S.a[x.id]||(S.a[x.id]={at:[],pts:0,tags:[],hint:0,closed:false});
M.innerHTML=`<p class="small">Úloha ${S.i+1} z ${G.items.length}</p><h2>${x.t=='S'?'Strategické rozhodnutí':x.t=='N'?'Náprava':'Vzdělávací úloha'}</h2><p>${esc(x.q)}</p><div id="os"></div><div id="fb"></div><div id="ac"></div>`;
if(x.t=='A'||x.t=='P')return ap(x,r);const os=$('#os');let sel=null;
x.o.forEach((o,k)=>{const b=document.createElement('button');b.className='opt';b.textContent=o[0];b.onclick=()=>{if(r.closed)return;sel=k;os.querySelectorAll('.opt').forEach(e=>e.classList.remove('sel'));b.classList.add('sel')};os.append(b)});
const ac=$('#ac');ac.innerHTML=`<button class="btn" id="ok">${x.t!='E'?'Potvrdit rozhodnutí':'Odpovědět'}</button>`+(x.t=='E'?'<button class="btn alt" id="hn">Nápověda</button>':'');
if(x.t=='E')$('#hn').onclick=()=>{r.hint=Math.min(3,r.hint+1);save();$('#fb').innerHTML=`<div class="note">Nápověda ${r.hint}: ${esc(x.h[r.hint-1])}</div>`};
$('#ok').onclick=()=>{if(sel===null||r.closed)return;const o=x.o[sel],bs=os.children;
if(x.t!='E'){r.closed=true;r.choice=sel;const lv=o[4]!==undefined&&[0,2].includes(S.a.S5?.choice)?o[4]:o[1];r.pts=x.t=='N'?o[1]:M0(x)*lv/3;r.lvl=lv;(o[3]||[]).forEach(d=>!S.docs.includes(d)&&S.docs.push(d));beep(660);
$('#fb').innerHTML=`<div class="note">${x.t=='N'?'Body k C8: '+o[1]:'Stupeň právní obhajitelnosti: '+r.lvl+' z 3'}. ${esc(o[2])}</div>`;fin()}
else{r.at.push(sel);if(!o[1]){const n=r.at.length-1;r.pts=M0(x)*F[n];r.closed=true;(x.u||[]).forEach(d=>!S.docs.includes(d)&&S.docs.push(d));bs[sel].classList.add('good');beep(660);$('#fb').innerHTML=`<div class="note">Správně. ${esc(x.law)}</div>`;fin()}
else{r.tags.push(o[1]);bs[sel].classList.add('bad');beep(220);$('#fb').innerHTML=`<div class="note">Nesprávně. ${esc(o[2])}</div>`;if(r.at.length>=x.o.length-1){r.closed=true;r.pts=0;$('#fb').innerHTML+=`<div class="note">Správně: ${esc(x.o.find(q=>!q[1])[0])} ${esc(x.law)}</div>`;fin()}}}
save()};
function fin(){ac.innerHTML='<button class="btn" id="nx">Pokračovat</button>';$('#nx').onclick=()=>{S.i++;show()}}
if(r.closed){$('#ok').remove();fin()}}
function ap(x,r){const fb=$('#fb'),ac=$('#ac');$('#main h2').textContent=x.t=='A'?'Výběr argumentů':'Sestavení podání';$('#ac').innerHTML='';
const L=x.t=='A'?x.a.filter(q=>!q[2]||Object.entries(q[2]).every(([k,v])=>v.includes(S.a[k]?.choice))):x.s;
let ord=(r.ord||(S.a.ARG?.sel||[]).slice());const AR=G.items.find(i=>i.id=='ARG').a;$('#os').innerHTML=x.t=='A'?L.map((q,k)=>`<label class="opt"><input type="checkbox" data-k="${k}"> ${esc(q[0])}</label>`).join(''):L.map((s,k)=>`<h4>${esc(s[0])}</h4>`+s[1].map((v,j)=>`<label class="opt"><input type="radio" name="s${k}" value="${j}"> ${esc(v[0])}</label>`).join('')).join('')+'<h4>Pořadí argumentů v aplikaci</h4><div id="ol"></div>';
const draw=()=>{const o=$('#ol');if(!o)return;o.innerHTML=ord.map((k,i)=>`<div class="opt">${i+1}. ${esc(AR[k][0])} <button class="btn alt" data-m="${i}:-1">↑</button><button class="btn alt" data-m="${i}:1">↓</button></div>`).join('')||'<p class="small">Nevybrali jste žádné argumenty.</p>';o.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const[i,d]=b.dataset.m.split(':').map(Number),j=i+d;if(j<0||j>=ord.length)return;[ord[i],ord[j]]=[ord[j],ord[i]];r.ord=ord;save();draw()})};if(x.t=='P')draw();
if(r.closed){fb.innerHTML=`<div class="note">Hotovo: ${r.pts.toFixed(1)} bodů.</div>`+nx();return bind()}
ac.innerHTML='<button class="btn" id="ok">Odeslat</button>';$('#ok').onclick=()=>{let p;
if(x.t=='A'){const mx=L.reduce((s,q)=>s+(q[1]>0?q[1]:0),0);const s=[...document.querySelectorAll('[data-k]:checked')].reduce((t,e)=>t+L[+e.dataset.k][1],0);p=20*Math.max(0,s)/mx;r.sel=[...document.querySelectorAll('[data-k]:checked')].map(e=>x.a.indexOf(L[+e.dataset.k]))}
else{p=0;for(let k=0;k<L.length;k++){const e=document.querySelector(`[name=s${k}]:checked`);if(!e)return alert('Vyberte variantu v každém oddílu.');const v=L[k][1][+e.value];p+=v[2]!==undefined?(S.a.S6?.choice===v[2]?5:2):v[1]}
const P=[[0,1],[1,2],[2,3],[3,5],[5,6],[7,2]].filter(([u,w])=>ord.includes(u)&&ord.includes(w));p+=P.length?10*P.filter(([u,w])=>ord.indexOf(u)<ord.indexOf(w)).length/P.length:0;r.ord=ord}
r.pts=p;r.closed=true;save();fb.innerHTML=`<div class="note">Hodnocení: ${p.toFixed(1)} z ${M0(x)} bodů.</div>`+nx();ac.innerHTML='';bind()}}
const nx=()=>'<button class="btn" id="nx">Pokračovat</button>',bind=()=>{$('#nx').onclick=()=>{S.i++;show()}};
function end(){S.done=true;const V=G.items.filter(vis);const c={};Object.keys(G.comp).forEach(k=>c[k]={e:0,m:0});
const cnt={};V.forEach(x=>{const r=S.a[x.id];if(x.t=='N')c.C8.e+=r?.pts||0;x.c.forEach(([k,p])=>{c[k].m+=p;c[k].e+=(r?.pts||0)*p/M0(x)});(r?.tags||[]).forEach(t=>cnt[t]=(cnt[t]||0)+1)});
V.forEach(x=>{(S.a[x.id]?.tags||[]).forEach(t=>{if(cnt[t]==2&&!S.a[x.id].pen){S.a[x.id].pen=1;c[x.c[0][0]].e-=2}})});
const used=Object.keys(c).filter(k=>c[k].m);const pc=k=>Math.max(0,Math.min(100,100*c[k].e/c[k].m));
const pct=Math.round(used.reduce((t,k)=>t+c[k].e,0)/used.reduce((t,k)=>t+c[k].m,0)*1000)/10;
const band=v=>v<40?'nevyhověla':v<60?'základní':v<80?'dobrá':'velmi dobrá';
const hints=Object.entries(S.a).filter(([,r])=>r.hint).map(([i,r])=>`${i} (úroveň ${r.hint})`);
const rep=Object.entries(cnt).filter(([,n])=>n>1).map(([t,n])=>`${t} (${n}×)`);
const h=ld(K2)||[];if(!S.saved){h.push({name:S.name,date:new Date().toLocaleDateString('cs'),pct});sv(K2,h);S.saved=1}
sv(K1,S);
M.innerHTML=`<h2>Akademický posudek</h2><p><b>${esc(S.name)}</b>, ${new Date().toLocaleDateString('cs')}<br>Výsledek: ${pct} % (${total().toFixed(1)} bodů)..</p>
${used.map(k=>`<p>${G.comp[k]}: ${pc(k).toFixed(0)} / 100, pásmo „${band(pc(k))}“<div class="bar"><i style="width:${pc(k)}%"></i></div></p>`).join('')}
<h3>Chyby a opravy</h3>${V.filter(x=>S.a[x.id]?.tags?.length).map(x=>{const r=S.a[x.id];return `<p>V úloze ${x.id} jste zvolil odpověď označenou jako „${esc(G.tags[r.tags[0]]||r.tags[0])}“; ${r.pts>0?'úlohu jste vyřešil správně v pokusu '+r.at.length+'.':'úloha zůstala nevyřešena.'}</p>`}).join('')||'<p>Žádné chybné odpovědi.</p>'}<p>${rep.length?'Opakované chybové štítky: '+rep.join(', ')+'.':'Žádný chybový štítek se neopakoval.'}</p>
<p>${hints.length?'Nápovědy byly použity u úloh: '+hints.join(', ')+'.':'Nápovědy nebyly použity.'}</p>
<p>Strategické volby: ${V.filter(x=>x.t=='S').map(x=>`${x.id}: stupeň ${S.a[x.id]?.lvl??'–'}`).join('; ')}.</p>
<button class="btn noprint" onclick="print()">Vytisknout</button><button class="btn alt noprint" id="hm">Úvodní obrazovka</button>`;$('#hm').onclick=home}
let tab=null,cat='Vše';
function arch(){const d=$('#drawer');if(!S){d.hidden=true;return}
const hl=window.hlOn&&G.items[S.i]?.hl||[],mk=t=>{let h=esc(t);hl.forEach(s=>h=h.replace(esc(s),'<mark>$&</mark>'));return h};
const cats=['Vše',...new Set(S.docs.map(k=>G.docs[k].cat))],list=S.docs.filter(k=>cat=='Vše'||G.docs[k].cat==cat);if(!list.includes(tab))tab=list[0]||null;
d.innerHTML=`<div class="dv" id="dv"></div><h3>Archiv</h3><select id="cf">${cats.map(c=>`<option${c==cat?' selected':''}>${esc(c)}</option>`).join('')}</select> <button class="btn alt" id="hlb">Zvýraznit relevantní pasáž</button>
<div class="tabs">${list.map(k=>`<button class="tb${k==tab?' on':''}" data-t="${k}">${esc(G.docs[k].t.split(',')[0])}</button>`).join('')}</div>
${tab?`<h4>${esc(G.docs[tab].t)}</h4><p class="small">${esc(G.docs[tab].cat)}</p><p>${mk(G.docs[tab].b)}</p>`:'<p>Zatím nic neodemčeno.</p>'}
<h3>Instituce</h3>${G.inst.filter(i=>S.a[i[2]]?.closed).map(i=>`<p><b>${esc(i[0])}</b><br>${esc(i[1])}</p>`).join('')||'<p class="small">Zatím žádné.</p>'}
<h3>Schéma řízení o nesplnění povinnosti</h3><svg viewBox="0 0 300 40" width="100%"><g fill="#2457a6" font-size="9" fill-opacity=".9"><rect x="0" y="8" width="90" height="24"/><rect x="105" y="8" width="90" height="24"/><rect x="210" y="8" width="90" height="24"/></g><g fill="#fff" font-size="9" text-anchor="middle"><text x="45" y="24">Komise zjistí</text><text x="150" y="24">Řízení Komise</text><text x="255" y="24">Žaloba k SDEU</text></g></svg><p class="small">Čl. 258 SFEU (ověřeno).</p>`;
d.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab=b.dataset.t;arch()});$('#cf').onchange=e=>{cat=e.target.value;arch()};$('#hlb').onclick=()=>{window.hlOn=!window.hlOn;arch()};
$('#dv').onpointerdown=e=>{const mv=ev=>{const w=Math.min(innerWidth*.7,Math.max(260,innerWidth-ev.clientX));d.style.width=w+'px';M.style.marginRight=w+20+'px'};addEventListener('pointermove',mv);addEventListener('pointerup',()=>removeEventListener('pointermove',mv),{once:true})}}
$('#arch').onclick=()=>{const d=$('#drawer');d.hidden=!d.hidden;if(d.hidden){M.style.marginRight='';return}arch();M.style.marginRight=(d.offsetWidth+20)+'px'};
$('#mute').onclick=e=>{muted=!muted;e.target.textContent=muted?'Zvuk vypnut':'Zvuk'};
$('#fz').onclick=()=>{fz=fz>=21?15:fz+2;document.documentElement.style.setProperty('--fs',fz+'px')};
window.addEventListener('beforeunload',e=>{if(S&&!S.done){save();e.preventDefault()}});
fetch('data/game.json').then(r=>r.json()).then(j=>{G=j;home()}).catch(()=>M.innerHTML='<h2>Chyba</h2><p>Obsah se nepodařilo načíst. Otevřete hru přes webový server (např. GitHub Pages).</p>');
