// js/calendar.js
export function drawSixMonthCalendar(container, opts){
  const { restricted, totalRooms, onPickRange } = opts;
  container.innerHTML='';
  const today = new Date();

  // range state
  let startISO = null, endISO = null;

  function iso(d){ return d.toISOString().slice(0,10); }
  function mk(y,m,d){ return new Date(y,m,d,0,0,0,0); }
  function inRange(d,a,b){ return d>=a && d<=b; }
  function parseISO(s){ return new Date(s+'T00:00:00'); }

  function tagFor(day){
    const diwali = inRange(day, parseISO(restricted.diwali[0]), parseISO(restricted.diwali[1]));
    const xmas   = inRange(day, parseISO(restricted.christmas[0]), parseISO(restricted.christmas[1]));
    const mon    = inRange(day, parseISO(restricted.monsoon[0]), parseISO(restricted.monsoon[1]));
    if(mon) return {label:'Closed', cls:'closed', free: 0};
    if(diwali || xmas) return {label:'Special', cls:'special', free: totalRooms}; // all free in TEST
    return {label:'Regular', cls:'season', free: totalRooms};                      // all free in TEST
  }

  function dayClass(dISO){
    if(!startISO) return '';
    if(startISO && !endISO && dISO===startISO) return ' selected';
    if(startISO && endISO){
      if(dISO===startISO || dISO===endISO) return ' selected';
      if(dISO>startISO && dISO<endISO) return ' in-range';
    }
    return '';
  }

  function clickDay(dISO){
    if(!startISO){ startISO = dISO; endISO = null; paint(); return; }
    // if second click is before start, make it the new start
    if(dISO < startISO){ startISO = dISO; endISO = null; paint(); return; }
    // set end and fire callback
    endISO = dISO;
    paint();
    // auto-fill the inputs and trigger search
    if(typeof onPickRange === 'function'){ onPickRange(startISO, endISO); }
  }

  function paint(){
    container.innerHTML='';
    for(let add=0; add<6; add++){
      const dt = new Date(today.getFullYear(), today.getMonth()+add, 1);
      const wrap = document.createElement('div');
      wrap.className = 'card';
      wrap.innerHTML = `<h3>${dt.toLocaleString('en',{month:'long'})} ${dt.getFullYear()}</h3>`;
      const grid = document.createElement('div');
      grid.className = 'calendar';

      // header row
      const head = document.createElement('div'); head.className='cal-head'; head.style.gridColumn='1 / span 7';
      const row = document.createElement('div'); row.style.display='grid'; row.style.gridTemplateColumns='repeat(7,1fr)';
      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(w=>{ const c=document.createElement('div'); c.textContent=w; row.appendChild(c); });
      head.appendChild(row); grid.appendChild(head);

      const startDay = mk(dt.getFullYear(), dt.getMonth(), 1).getDay();
      const daysInMonth = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate();

      for(let i=0;i<startDay;i++){ const e=document.createElement('div'); e.className='day disabled'; grid.appendChild(e); }

      for(let d=1; d<=daysInMonth; d++){
        const day = mk(dt.getFullYear(), dt.getMonth(), d);
        const dISO = iso(day);
        const meta = tagFor(day);

        const cell = document.createElement('div'); 
        cell.className='day' + dayClass(dISO);
        cell.innerHTML = `
          <div style="font-weight:600">${d}</div>
          <div class="tag ${meta.cls}">${meta.label}</div>
          <div class="badge">Free: ${meta.free}</div>
        `;
        if(meta.cls!=='closed'){ // allow click only if not closed
          cell.style.cursor = 'pointer';
          cell.addEventListener('click', ()=> clickDay(dISO));
        } else {
          cell.classList.add('disabled');
        }
        grid.appendChild(cell);
      }
      wrap.appendChild(grid);
      container.appendChild(wrap);
    }
  }

  paint();
}
