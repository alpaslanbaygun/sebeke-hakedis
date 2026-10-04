const fs=require('fs');
function lit(src, name, from=0){
  const re=new RegExp('(?:const |, |\\b)'+name.replace(/\$/g,'\\$')+'\\s*=\\s*','g'); re.lastIndex=from;
  const m=re.exec(src); if(!m) return undefined;
  let i=m.index+m[0].length; const open=src[i]; const close=open==='{'?'}':open==='['?']':null;
  if(!close) return undefined;
  let d=0, j=i, str=null;
  for(;j<src.length;j++){const c=src[j];
    if(str){ if(c==='\\'){j++;continue;} if(c===str) str=null; continue;}
    if(c==='"'||c==="'"||c==='`'){str=c;continue;}
    if(c===open) d++; else if(c===close){d--; if(d===0) break;}
  }
  const text=src.slice(i,j+1);
  try { return eval('('+text+')'); } catch(e){ return {__err:e.message, text:text.slice(0,200)}; }
}
const p1=fs.readFileSync('page01_ec90b119.js','utf8');
const p3=fs.readFileSync('page03_b7864bb5.js','utf8');
const p7=fs.readFileSync('page07_0896b727.js','utf8');
const p9=fs.readFileSync('page09_37cbb5d2.js','utf8');
const out={};
for(const n of ['CAT','TR_DIREK','TR_HERM','TR_KURU','PANO_H','PANO_D','QDEF','CIV','B561','B562','DAG','DMUS','DOG','AGAC','AYD','CD','DEF','AL','TECH','TD','KOSK','AB']) out[n]=lit(p1,n);
out.P7_DATA=lit(p7,'DATA'); out.P7_GROUPS=lit(p7,'GROUPS');
out.P9_TIPS=lit(p9,'TIPS'); out.P9_ACSR=lit(p9,'ACSR'); out.P9_KOSKDEF=lit(p9,'KOSKDEF'); out.P9_CAT=lit(p9,'CAT');
out.P3_PICK=lit(p3,'PICK'); out.P3_CAT=lit(p3,'CAT');
for(const [k,v] of Object.entries(out)){ console.log(k, v===undefined?'MISSING': v.__err? 'ERR '+v.__err : Array.isArray(v)? 'array '+v.length : typeof v==='object'? 'obj '+Object.keys(v).length : v); }
console.log('CAT same p1/p9:', JSON.stringify(out.CAT)===JSON.stringify(out.P9_CAT), 'p3:', JSON.stringify(out.CAT)===JSON.stringify(out.P3_CAT));
fs.writeFileSync('/home/claude/voltapp/seed/design_raw.json', JSON.stringify(out,null,1));
