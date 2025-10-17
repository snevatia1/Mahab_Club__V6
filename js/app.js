
import { drawSixMonthCalendar } from './calendar.js';
import { loadJSON } from './dataLoader.js';
import { Assistant } from './assistant.js';
let assistant;

const state = {
  rooms: {},
  restricted: {
    diwali: ['2025-10-17','2025-11-02'],
    christmas: ['2025-12-19','2026-01-04'],
    monsoon: ['2025-06-09','2025-10-14']
  }
};

async function init(){
  const rooms = await loadJSON('data/rooms.json');
  rooms.forEach(r => state.rooms[r.id]=r);
  const totalRooms = Object.keys(state.rooms).length;

  drawSixMonthCalendar(
    document.getElementById('calendarContainer'),
    { restricted: state.restricted, totalRooms,
      onPickRange: (fromISO, toISO) => {
        const from = document.getElementById('fromDate');
        const to   = document.getElementById('toDate');
        if(from && to){ from.value = fromISO; to.value = toISO; }
        onCheck();
      }}
  );

  ['mAdults','mSeniors','mKids','mDepend','tAdults','tKids'].forEach(id=>fill(id,10));
  function fill(id,max){ const s=document.getElementById(id); if(!s) return; s.innerHTML=''; for(let i=0;i<=max;i++){ const o=document.createElement('option'); o.value=i; o.textContent=i; s.appendChild(o);}}
  document.getElementById('checkBtn').addEventListener('click', onCheck);
  assistant = new Assistant('assistantOut','micBtn','assistantInput','sendBtn');
  window.__filterBlock = filterByBlock;
}

function getBlockFor(id){ const meta=state.rooms[id]||{}; let b=(meta.block??'').toString().trim().toUpperCase(); if(!b){ const m=String(id).match(/[A-Za-z]/); if(m) b=m[0].toUpperCase(); } return b||'UNKNOWN'; }
function groupByBlock(list){ const g={}; list.forEach(id=>{ const b=getBlockFor(id); (g[b]??=[]).push(id);}); return g; }
function filterByBlock(block){
  scrollToRooms();
  document.querySelectorAll('#roomLists .card').forEach(div=>{
    div.querySelectorAll('.room-pill[data-iso][data-id]').forEach(p=>{
      const id=p.dataset.id; const b=getBlockFor(id);
      p.style.display=(block==='ALL'||b===block)?'inline-block':'none';
    });
  });
  document.querySelectorAll('[data-block]').forEach(btn=>btn.classList.toggle('active', btn.dataset.block===block));
}
function scrollToRooms(){ const el=document.getElementById('roomLists'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }

function renderBlockSummary(freeList){
  const wrap=document.getElementById('blockSummary'); if(!wrap) return;
  const byBlock=groupByBlock(freeList); const blocks=Object.keys(byBlock).sort();
  const btn=(b,l)=>`<button class="btn ghost" data-block="${b}" onclick="window.__filterBlock && window.__filterBlock('${b}')">${l}</button>`;
  wrap.innerHTML=[btn('ALL',`All : ${freeList.length}`),...blocks.map(b=>btn(b,`${b} : ${byBlock[b].length}`))].join(' ');
}

function listRooms(dates){
  const roomLists=document.getElementById('roomLists'); roomLists.innerHTML='';
  const bookedMap={}; let lastFree=[];
  dates.forEach(iso=>{
    const all=Object.keys(state.rooms);
    const booked=bookedMap[iso]||[];
    const free=all.filter(id=>!booked.includes(id));
    lastFree=free;
    const div=document.createElement('div'); div.className='card'; div.setAttribute('data-iso',iso);
    const pill=(iso,id)=>{ const block=getBlockFor(id); const ac=(state.rooms[id]?.ac?'AC':'Non-AC'); const cap=(state.rooms[id]?.max_persons??2); return `<span class='room-pill' data-iso='${iso}' data-id='${id}' title='Click to select'>${id} • ${block} • ${ac} • cap ${cap}</span>`; };
    div.innerHTML=`<h4>${iso}</h4><div><strong>FREE:</strong> ${free.map(id=>pill(iso,id)).join(' ')||'—'}</div><div style='margin-top:6px'><strong>BOOKED:</strong> —</div>`;
    roomLists.appendChild(div);
  });
  renderBlockSummary(lastFree);
  return bookedMap;
}

const selection={rooms:{}};
document.body.addEventListener('click',e=>{ const pill=e.target.closest('.room-pill[data-iso][data-id]'); if(!pill)return; toggleRoom(pill.dataset.iso,pill.dataset.id); buildAssignPanel(); });
function toggleRoom(iso,id){ if(!selection.rooms[iso]) selection.rooms[iso]=new Set(); if(selection.rooms[iso].has(id)) selection.rooms[iso].delete(id); else selection.rooms[iso].add(id); document.getElementById('selectionOut').textContent=summarySelection(); }
function summarySelection(){ const nights=Object.keys(selection.rooms); if(!nights.length)return'No rooms selected yet.'; const parts=nights.sort().map(d=>d+': '+Array.from(selection.rooms[d]).join(', ')); return parts.join('  •  '); }

function capacity(id){ const r=state.rooms[id]||{}; return {ad:(r.max_persons??2)}; }
function buildAssignPanel(){
  const wrap=document.getElementById('assignWrap'); const panel=document.getElementById('assignPanel'); panel.innerHTML='';
  const nights=Object.keys(selection.rooms).sort(); if(!nights.length){ wrap.style.display='none'; return;} wrap.style.display='block';
  const chosen=Array.from(selection.rooms[nights[0]]||[]); if(!chosen.length){ panel.innerHTML='<em>Select at least one room to assign occupants.</em>'; return; }
  chosen.forEach(id=>{
    const cap=capacity(id);
    const row=document.createElement('div'); row.className='assign-row';
    row.innerHTML=`
      <div><strong>${id}</strong><br><label>cap: ${cap.ad} persons</label>${state.rooms[id]?.groupBookingPermitted ? '<br><span class="small">Group booking permitted</span>' : ''}</div>
      <div><label>People</label><input type="number" min="0" max="${cap.ad}" value="0" data-for="${id}" data-k="ad"></div>
      <div><label>Temp A</label><input type="number" min="0" value="0" data-for="${id}" data-k="tad"></div>
      <div><label>Temp 5–10</label><input type="number" min="0" value="0" data-for="${id}" data-k="tkid"></div>
      <div><label>11–21</label><input type="number" min="0" value="0" data-for="${id}" data-k="dep"></div>
      <div><label>≤10</label><input type="number" min="0" value="0" data-for="${id}" data-k="u10"></div>`;
    panel.appendChild(row);
  });
  panel.querySelectorAll('input[type="number"]').forEach(inp=> inp.addEventListener('input', updateAssignSummary));
  updateAssignSummary();
}
function updateAssignSummary(){
  const panel=document.getElementById('assignPanel'); const out=document.getElementById('assignSummary');
  const rows=[...panel.querySelectorAll('.assign-row')];
  let total={ad:0,u10:0,dep:0,tad:0,tkid:0}, ok=true, issues=[];
  rows.forEach(r=>{
    const id=r.querySelector('input').dataset.for; const cap=capacity(id);
    const get=k=>parseInt(r.querySelector(`input[data-for="${id}"][data-k="${k}"]`).value||'0',10);
    const ad=get('ad'); total.ad+=ad; total.u10+=get('u10'); total.dep+=get('dep'); total.tad+=get('tad'); total.tkid+=get('tkid');
    if(ad>cap.ad){ ok=false; issues.push(`${id}: People>${cap.ad}`); }
  });
  out.innerHTML=`Members A: ${document.getElementById('mAdults').value} • Senior A: ${document.getElementById('mSeniors').value} • U10: ${document.getElementById('mKids').value} • 11–21: ${document.getElementById('mDepend').value} • Temp A: ${document.getElementById('tAdults').value} • Temp 5–10: ${document.getElementById('tKids').value}<br>Assigned (rooms): People ${total.ad}, 11–21 ${total.dep}, ≤10 ${total.u10}, Temp A ${total.tad}, Temp 5–10 ${total.tkid}<br>${ ok ? "<span style='color:green'>Within room capacities.</span>" : "<span style='color:#b91c1c'>Check limits → "+issues.join("; ")+"</span>" }<br><em>Tariffs are inclusive of GST.</em>`;
}
function onCheck(){
  const from=document.getElementById('fromDate')?.value; const to=document.getElementById('toDate')?.value; const res=document.getElementById('result'); res.innerHTML='';
  if(!from||!to){ res.textContent='Please choose a valid date range.'; return; }
  const start=new Date(from), checkout=new Date(to); if(checkout<=start){ res.textContent='“To” must be after “From” (checkout day).'; return; }
  const nights=[]; for(let d=new Date(start); d<checkout; d.setDate(d.getDate()+1)) nights.push(d.toISOString().slice(0,10));
  res.innerHTML=`<p>Searching ${nights.length} night(s)…</p>`; const bookedMap=listRooms(nights);
  const total=Object.keys(state.rooms).length; const freeMin=Math.min(...nights.map(iso=>total-(bookedMap[iso]||[]).length));
  res.innerHTML+=`<p><strong>Availability:</strong> Minimum free rooms across your dates: ${freeMin} of ${total}.</p>`;
  document.getElementById('assignWrap').style.display='none'; document.getElementById('assignPanel').innerHTML=''; document.getElementById('selectionOut').textContent='No rooms selected yet.';
  for(const k in selection.rooms) delete selection.rooms[k];
}
init();
