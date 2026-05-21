/* ══════════════════════════════════════════════════════════════
   PASH — Shared data utilities (localStorage)
   ══════════════════════════════════════════════════════════════ */

const MONTHS_SQ = ['Janar','Shkurt','Mars','Prill','Maj','Qershor',
                   'Korrik','Gusht','Shtator','Tetor','Nëntor','Dhjetor'];

const DB = {
  get furnitoret(){ return JSON.parse(localStorage.getItem('pash_furnitoret')||'[]') },
  set furnitoret(v){ localStorage.setItem('pash_furnitoret',JSON.stringify(v)) },
  get zerat(){ return JSON.parse(localStorage.getItem('pash_zerat')||'[]') },
  set zerat(v){ localStorage.setItem('pash_zerat',JSON.stringify(v)) },
  get blerjet(){ return JSON.parse(localStorage.getItem('pash_blerjet')||'[]') },
  set blerjet(v){ localStorage.setItem('pash_blerjet',JSON.stringify(v)) },
  get shpenzime(){ return JSON.parse(localStorage.getItem('pash_shpenzime')||'[]') },
  set shpenzime(v){ localStorage.setItem('pash_shpenzime',JSON.stringify(v)) },
};

function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6) }

function nextNr(list){ return list.length ? Math.max(...list.map(x=>x.nr||0))+1 : 1001 }

function fmtL(n){
  return new Intl.NumberFormat('sq-AL',{minimumFractionDigits:0,maximumFractionDigits:2}).format(n||0)+' L'
}

function fmtDate(iso){
  if(!iso) return '';
  const d=new Date(iso);
  return d.getDate()+' '+MONTHS_SQ[d.getMonth()]+' '+d.getFullYear();
}

function todayISO(){
  const n=new Date();
  return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function initials(name){
  return (name||'?').split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';
}

function monthLabel(y,m){ return MONTHS_SQ[m]+' '+y }

let _toastTimer;
function toast(msg){
  let el=document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent=msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}

/* ══════════════════════════════════════════════════════════════
   DATE PICKER COMPONENT
   ══════════════════════════════════════════════════════════════ */
const DP = {
  mode:'day', year:new Date().getFullYear(), month:new Date().getMonth(),
  selected:null, onchange:null,

  open(){ document.getElementById('dp-popup').classList.add('open'); this.render(); },
  close(){ document.getElementById('dp-popup').classList.remove('open'); },
  toggle(){ document.getElementById('dp-popup').classList.contains('open')?this.close():this.open(); },

  render(){
    if(this.mode==='day') this._renderDays();
    else if(this.mode==='month') this._renderMonths();
    else this._renderYears();
    const t=this.mode==='day'?`${MONTHS_SQ[this.month]} ${this.year}`:this.mode==='month'?`${this.year}`:`${this.year-5} – ${this.year+6}`;
    document.getElementById('dp-title').textContent=t+' ▾';
  },

  _renderDays(){
    const body=document.getElementById('dp-body');
    const WD=['Hë','Ma','Më','En','Pr','Sh','Di'];
    let h=`<div class="dp-weekdays">${WD.map(d=>`<span>${d}</span>`).join('')}</div><div class="dp-days">`;
    const first=new Date(this.year,this.month,1).getDay();
    const dim=new Date(this.year,this.month+1,0).getDate();
    const prevDim=new Date(this.year,this.month,0).getDate();
    const start=(first===0?6:first-1);
    for(let i=start-1;i>=0;i--) h+=`<span class="dp-day other">${prevDim-i}</span>`;
    const tod=new Date();
    for(let d=1;d<=dim;d++){
      const isT=d===tod.getDate()&&this.month===tod.getMonth()&&this.year===tod.getFullYear();
      const isS=this.selected?.type==='date'&&this.selected.y===this.year&&this.selected.m===this.month&&this.selected.d===d;
      h+=`<span class="dp-day${isT?' today':''}${isS?' sel':''}" data-d="${d}">${d}</span>`;
    }
    const fill=(start+dim)%7===0?0:7-(start+dim)%7;
    for(let d=1;d<=fill;d++) h+=`<span class="dp-day other">${d}</span>`;
    h+='</div>';
    body.innerHTML=h;
    body.querySelectorAll('.dp-day[data-d]').forEach(el=>el.addEventListener('click',()=>{
      this.selected={type:'date',y:this.year,m:this.month,d:+el.dataset.d};
      this._update(); this.close();
    }));
  },

  _renderMonths(){
    const body=document.getElementById('dp-body');
    body.innerHTML=`<div class="dp-months">${MONTHS_SQ.map((n,m)=>{
      const s=this.selected?.type==='month'&&this.selected.y===this.year&&this.selected.m===m;
      return `<span class="dp-month${s?' sel':''}" data-m="${m}">${n.slice(0,3)}</span>`;
    }).join('')}</div>`;
    body.querySelectorAll('.dp-month').forEach(el=>el.addEventListener('click',()=>{
      this.selected={type:'month',y:this.year,m:+el.dataset.m};
      this.month=+el.dataset.m; this.mode='day';
      this._update();
    }));
  },

  _renderYears(){
    const body=document.getElementById('dp-body');
    let h='<div class="dp-months">';
    for(let y=this.year-5;y<=this.year+6;y++){
      const s=this.selected?.type==='year'&&this.selected.y===y;
      h+=`<span class="dp-month${s?' sel':''}" data-y="${y}">${y}</span>`;
    }
    h+='</div>';
    body.innerHTML=h;
    body.querySelectorAll('[data-y]').forEach(el=>el.addEventListener('click',()=>{
      this.selected={type:'year',y:+el.dataset.y};
      this.year=+el.dataset.y; this.mode='month';
      this._update();
    }));
  },

  nav(dir){
    if(this.mode==='day'){this.month+=dir;if(this.month>11){this.month=0;this.year++;}if(this.month<0){this.month=11;this.year--;}}
    else if(this.mode==='month'){this.year+=dir;}
    else{this.year+=dir*12;}
    this.render();
  },

  toggleMode(){
    this.mode=this.mode==='day'?'month':this.mode==='month'?'year':'day';
    this.render();
  },

  clear(){
    this.selected=null;
    document.getElementById('dp-label').textContent='Të gjithë datat';
    if(this.onchange)this.onchange();
    this.close();
  },

  today(){
    const t=new Date();
    this.selected={type:'date',y:t.getFullYear(),m:t.getMonth(),d:t.getDate()};
    this.year=t.getFullYear(); this.month=t.getMonth(); this.mode='day';
    this._update(); this.close();
  },

  _update(){
    const el=document.getElementById('dp-label');
    if(!this.selected){el.textContent='Të gjithë datat';}
    else if(this.selected.type==='date') el.textContent=`${this.selected.d} ${MONTHS_SQ[this.selected.m].slice(0,3)} ${this.selected.y}`;
    else if(this.selected.type==='month') el.textContent=`${MONTHS_SQ[this.selected.m]} ${this.selected.y}`;
    else el.textContent=`${this.selected.y}`;
    if(this.onchange)this.onchange();
    this.render();
  },

  matches(dateStr){
    if(!this.selected) return true;
    if(!dateStr) return false;
    const d=new Date(dateStr); if(isNaN(d)) return false;
    const s=this.selected;
    if(s.type==='date') return d.getFullYear()===s.y&&d.getMonth()===s.m&&d.getDate()===s.d;
    if(s.type==='month') return d.getFullYear()===s.y&&d.getMonth()===s.m;
    if(s.type==='year') return d.getFullYear()===s.y;
    return true;
  }
};

/* Close DP on outside click */
document.addEventListener('click',e=>{
  const popup=document.getElementById('dp-popup');
  const wrap=document.getElementById('dp-wrap');
  if(popup&&wrap&&!wrap.contains(e.target)) DP.close();
});

/* Furnitor total spent */
function furnitorTotal(fid){
  return DB.blerjet.filter(b=>b.furnitori_id===fid).reduce((s,b)=>s+(b.totali||0),0);
}
function furnitorPaguar(fid){
  return DB.blerjet.filter(b=>b.furnitori_id===fid&&b.statusi==='paguar').reduce((s,b)=>s+(b.totali||0),0);
}

/* Zëri total used */
function zeriTotal(zid){
  let s=0;
  DB.blerjet.forEach(b=>(b.items||[]).forEach(it=>{ if(it.zeri_id===zid) s+=it.totali||0; }));
  return s;
}
