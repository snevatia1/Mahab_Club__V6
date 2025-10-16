// js/app.js
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
  try{
    const rooms = await loadJSON('data/rooms.json');
    rooms.forEach(r => state.rooms[r.id]=r);

    const totalRooms = Object.keys(state.rooms).length;

    // Render calendar with counts and range picking
    drawSixMonthCalendar(
      document.getElementById('calendarContainer'),
      {
        restricted: state.restricted,
        totalRooms,
        onPickRange: (fromISO, toISO) => {
          // fill inputs then run availability
          const from = document.getElementById('fromDate');
          const to   = document.getElementById('toDate');
          if(from && to){ from.value = fromISO; to.value = toISO; }
          onCheck(); // auto-run
        }
      }
    );

    fillDropdowns();
    document.getElementById('checkBtn').addEventListener('click', onCheck);

    // Assistant (voice+typing)
    assistant = new Assistant('assistantOut','micBtn','assistantInput','sendBtn');

    // global for inline calls (kept)
    window.__filterBlock = filterByBlock;
  }catch(e){
    console.error(e);
    const r = document.getElementById('result');
    if (r) r.innerHTML = "<p class='bad'>Init failed: " + (e.message||e) + "</p>";
  }
}

function fillDropdowns(){
  ['mAdults','mKids','mDepend','tAdults','tKids'].forEach((id,i)=>fill(id,6));
  function fill(id,max){ const s=document.getElementById(id); if(!s) return; s.innerHTML=''; for(let i=0;i<=max;i++){ const o=document.createElement('option'); o.value=i; o.textContent=i; s.appendChild(o);} }
}

/* ---------- Block helpers (robust) ---------- */
function getBlockFor(id){
  const meta = state.rooms[id] || {};
  let b = (meta.block ?? '').toString().trim().toUpperCase();
  if(!b){
    const m = String(id).match(/[A-Za-z]/);
    if(m) b = m[0].toUpperCase();
  }
  return b || 'UNKNOWN';
}

function groupByBlock(list){
  const g = {};
  list.forEach(id => {
    const b = getBlockFor(id);
    if(!g[b]) g[b] = [];
    g[b].push(id);
  });
  return g;
}

function filterByBlock(block){
  const lists = document.querySelectorAll('#roomLists .card');
  lists.forEach(div => {
    const freePills = div.querySelectorAll('.room-pill[data-iso][data-id]');
    freePills.forEach(p => {
      const id = p.dataset.id;
      const b = getBlockFor(id);
      p.style.display = (block === 'ALL' || b === block) ? 'inline-block' : 'none';
    });
  });
  // simple highlight without editing CSS
  document.querySelectorAll('[data-block]').forEach(btn => {
    btn.style.outline = (btn.dataset.block === block) ? '2px solid #111' : '';
  });
}

function renderBlockSummary(freeList){
  const wrap = document.getElementById('blockSummary');
  if(!wrap) return;
  const byBlock = groupByBlock(freeList);
  const blocks = Object.keys(byBlock).sort();

  const btn = (b, label) =>
    `<button class="btn ghost" data-block="${b}" title="Show ${b==='ALL'?'all':b} block rooms" onclick="window.__filterBlock && window.__filterBlock('${b}')">${label}</button>`;

  const allBtn = btn('ALL', `All : ${freeList.length}`);
  wrap.innerHTML = [allBtn, ...blocks.map(b => btn(b, `${b} : ${byBlock[b].length}`))].join(' ');
}
/* ---------- end helpers ---------- */

function listRooms(dates){
  const roomLists = document.getElementById('roomLists'); 
  if(!roomLists){ return {}; }
  roomLists.innerHTML='';

  const bookedMap = {}; // All free in TEST
  let lastFree = [];

  dates.forEach(iso=>{
    const all = Object.keys(state.rooms);
    const booked = bookedMap[iso]||[];
    const free = all.filter(id => !booked.includes(id));
    lastFree = free;

    const div = document.createElement('div'); 
    div.className='card'; 
    div.setAttribute('data-iso', iso);

    const pill = (iso,id) => {
      const block = getBlockFor(id);
      const ac = (state.rooms[id]?.ac ? 'AC' : 'Non-AC');
      return `<span class='room-pill' data-iso='${iso}' data-id='${id}' title='Click to select'>${id} • ${block} • ${ac}</span>`;
    };

    div.innerHTML = `<h4>${iso}</h4>
      <div><strong>FREE:</strong> ${free.map(id=>pill(iso,id)).join(' ')||'—'}</div>
      <div style='margin-top:6px'><strong>BOOKED:</strong> —</div>`;
    roomLists.appendChild(div);
  });

  renderBlockSummary(lastFree);
  return bookedMap;
}

// Selection registry
const selection = { rooms: {} };

function toggleRoom(iso, id){
  if(!selection.rooms[iso]) selection.rooms[iso] = new Set();
  if(selection.rooms[iso].has(id)) selection.rooms[iso].delete(id);
  else selection.rooms[iso].add(id);
  const out = document.getElementById('selectionOut');
  if(out) out.textContent = summarySelection();
}

function summarySelection(){
  const nights = Object.keys(selection.rooms);
  if(!nights.length) return "No rooms selected yet.";
  const parts = nights.sort().map(d => d + ": " + Array.from(selection.rooms[d]).join(", "));
  return parts.join("  •  ");
}

// Clicks for room chips
document.body.addEventListener('click', (e)=>{
  const pill = e.target.closest('.room-pill[data-iso][data-id]');
  if(!pill) return;
  toggleRoom(pill.dataset.iso, pill.dataset.id);
});

function onCheck(){
  const from = document.getElementById('fromDate')?.value;
  const to   = document.getElementById('toDate')?.value;
  const res  = document.getElementById('result'); 
  if(res) res.innerHTML='';

  if(!from||!to){ if(res) res.textContent='Please choose a valid date range.'; return; }
  const start=new Date(from), end=new Date(to);
  if(end<=start){ if(res) res.textContent='“To” must be after “From”.'; return; }

  const dates=[]; for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) dates.push(d.toISOString().slice(0,10));
  // nights = inclusive range → for availability we typically exclude checkout day; keep it simple here.
  if(dates.length > 1) dates.pop(); 

  if(res) res.innerHTML = `<p>Searching ${dates.length} night(s)…</p>`;

  const bookedMap = listRooms(dates);
  const total = Object.keys(state.rooms).length;
  const counts = dates.map(iso => ({ free: total - (bookedMap[iso]||[]).length, booked: (bookedMap[iso]||[]).length }));
  const freeMin = Math.min(...counts.map(x=>x.free));
  if(res) res.innerHTML += `<p><strong>Availability:</strong> Minimum free rooms across your dates: ${freeMin} of ${total}.</p>`;
}

init();
