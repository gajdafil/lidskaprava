import fs from 'fs';const g=JSON.parse(fs.readFileSync(new URL('../data/game.json',import.meta.url)));let bad=0;const ids=new Set(g.items.map(x=>x.id)),err=m=>{console.log('CHYBA',m);bad++};
for(const x of g.items){if(x.t=='E'){if(x.o.filter(o=>!o[1]).length!=1)err(x.id+' počet správných');if(x.h.length!=3)err(x.id+' nápovědy');for(const o of x.o)if(o[1]&&!g.tags[o[1]])err(x.id+' štítek '+o[1])}
for(const d of [...(x.u||[]),...(x.o||[]).flatMap(o=>x.t!='E'&&Array.isArray(o[3])?o[3]:[])])if(!g.docs[d])err(x.id+' dokument '+d);
if(x.if)for(const k of Object.keys(x.if))if(!ids.has(k))err(x.id+' podmínka '+k)}
const S6=g.items.find(x=>x.id=='S6');for(const ch of [0,1,2,3])for(let k=0;k<3;k++){const o=S6.o[k],lv=o[4]!==undefined&&[0,2].includes(ch)?o[4]:o[1];if(lv<0||lv>3)err('S6')}
console.log(bad?'Chyb: '+bad:'Všechny kontroly prošly ('+g.items.length+' položek)');process.exit(bad?1:0)
