const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];
const PALETTE = ["#3C7A73","#E3A23C","#8B5A8C","#4C6EA8","#B25D3F","#5C8A5C","#A34E6C","#7A6B3C"];
let seq = 0;

let state = { courses: [] };

function uid(prefix){ return prefix + (++seq) + '_' + Math.random().toString(36).slice(2,7); }

function newCourse(name){
  const color = PALETTE[state.courses.length % PALETTE.length];
  return {
    id: uid('c'), name: name || ('Course ' + (state.courses.length+1)), color,
    components: [ newComponent('Class') ]
  };
}
function newComponent(name){
  return { id: uid('m'), name: name || 'Component', options: [ newSlot() ] };
}
function newSlot(){
  return { id: uid('s'), day: 'Mon', start: '10:00', end: '11:00' };
}

function addCourse(){ state.courses.push(newCourse()); render(); }
function removeCourse(cid){ state.courses = state.courses.filter(c => c.id !== cid); render(); }
function addComponent(cid){
  const c = state.courses.find(c=>c.id===cid);
  c.components.push(newComponent('Component ' + (c.components.length+1)));
  render();
}
function removeComponent(cid, mid){
  const c = state.courses.find(c=>c.id===cid);
  c.components = c.components.filter(m=>m.id!==mid);
  render();
}
function addSlot(cid, mid){
  const c = state.courses.find(c=>c.id===cid);
  const m = c.components.find(m=>m.id===mid);
  m.options.push(newSlot());
  render();
}
function removeSlot(cid, mid, sid){
  const c = state.courses.find(c=>c.id===cid);
  const m = c.components.find(m=>m.id===mid);
  m.options = m.options.filter(s=>s.id!==sid);
  render();
}

function render(){
  const list = document.getElementById('courseList');
  list.innerHTML = '';
  state.courses.forEach(course => {
    const div = document.createElement('div');
    div.className = 'course';
    div.innerHTML = `
      <div class="course-head">
        <div class="swatch" style="background:${course.color}"></div>
        <input class="cname" value="${escapeAttr(course.name)}" data-cid="${course.id}" />
        <button class="icon-btn" title="Remove course" data-action="removeCourse" data-cid="${course.id}">✕</button>
      </div>
      <div class="comps" data-cid="${course.id}"></div>
      <div style="padding:6px 10px 10px 14px;">
        <button class="add-comp-btn" data-action="addComponent" data-cid="${course.id}">+ Add component (e.g. Tutorial)</button>
      </div>
    `;
    list.appendChild(div);
    const compsWrap = div.querySelector('.comps');
    course.components.forEach(comp => {
      const cdiv = document.createElement('div');
      cdiv.className = 'component';
      cdiv.innerHTML = `
        <div class="component-head">
          <input class="compname" value="${escapeAttr(comp.name)}" data-cid="${course.id}" data-mid="${comp.id}" />
          ${course.components.length > 1 ? `<button class="icon-btn" title="Remove component" data-action="removeComponent" data-cid="${course.id}" data-mid="${comp.id}">✕</button>` : ''}
        </div>
        <div class="slots" data-cid="${course.id}" data-mid="${comp.id}"></div>
        <button class="add-slot-btn" data-action="addSlot" data-cid="${course.id}" data-mid="${comp.id}">+ Add possible time</button>
      `;
      compsWrap.appendChild(cdiv);
      const slotsWrap = cdiv.querySelector('.slots');
      comp.options.forEach(slot => {
        const sdiv = document.createElement('div');
        sdiv.className = 'slot-row';
        sdiv.innerHTML = `
          <select data-action="slotDay" data-cid="${course.id}" data-mid="${comp.id}" data-sid="${slot.id}">
            ${DAYS.map(d => `<option value="${d}" ${d===slot.day?'selected':''}>${d}</option>`).join('')}
          </select>
          <input type="time" value="${slot.start}" data-action="slotStart" data-cid="${course.id}" data-mid="${comp.id}" data-sid="${slot.id}" />
          <input type="time" value="${slot.end}" data-action="slotEnd" data-cid="${course.id}" data-mid="${comp.id}" data-sid="${slot.id}" />
          ${comp.options.length > 1 ? `<button class="icon-btn" title="Remove time" data-action="removeSlot" data-cid="${course.id}" data-mid="${comp.id}" data-sid="${slot.id}">✕</button>` : '<span></span>'}
        `;
        slotsWrap.appendChild(sdiv);
      });
    });
  });
  attachHandlers();
}

function escapeAttr(s){ return (s||'').replace(/"/g,'&quot;'); }

function attachHandlers(){
  document.querySelectorAll('[data-action]').forEach(el => {
    const action = el.getAttribute('data-action');
    const cid = el.getAttribute('data-cid');
    const mid = el.getAttribute('data-mid');
    const sid = el.getAttribute('data-sid');
    if(action === 'removeCourse') el.onclick = () => removeCourse(cid);
    if(action === 'addComponent') el.onclick = () => addComponent(cid);
    if(action === 'removeComponent') el.onclick = () => removeComponent(cid, mid);
    if(action === 'addSlot') el.onclick = () => addSlot(cid, mid);
    if(action === 'removeSlot') el.onclick = () => removeSlot(cid, mid, sid);
    if(action === 'slotDay') el.onchange = (e) => { getSlot(cid,mid,sid).day = e.target.value; };
    if(action === 'slotStart') el.onchange = (e) => { getSlot(cid,mid,sid).start = e.target.value; };
    if(action === 'slotEnd') el.onchange = (e) => { getSlot(cid,mid,sid).end = e.target.value; };
  });
  document.querySelectorAll('.cname').forEach(el => {
    el.onchange = (e) => { getCourse(el.getAttribute('data-cid')).name = e.target.value; };
  });
  document.querySelectorAll('.compname').forEach(el => {
    el.onchange = (e) => { getComponent(el.getAttribute('data-cid'), el.getAttribute('data-mid')).name = e.target.value; };
  });
  document.getElementById('addCourseBtn').onclick = addCourse;
  document.getElementById('generateBtn').onclick = runGenerate;
}

function getCourse(cid){ return state.courses.find(c=>c.id===cid); }
function getComponent(cid, mid){ return getCourse(cid).components.find(m=>m.id===mid); }
function getSlot(cid, mid, sid){ return getComponent(cid,mid).options.find(s=>s.id===sid); }

function toMin(t){ const [h,m] = t.split(':').map(Number); return h*60+m; }

// ---- talk to the Python backend ----
async function runGenerate(){
  const statusEl = document.getElementById('statusMsg');
  const btn = document.getElementById('generateBtn');
  statusEl.className = 'status';
  statusEl.textContent = 'Searching…';
  btn.disabled = true;

  try{
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courses: state.courses })
    });
    const data = await res.json();

    if(!data.ok){
      statusEl.className = 'status error';
      statusEl.textContent = data.error || 'Something went wrong.';
      renderEmptyResults();
      return;
    }

    statusEl.textContent = data.message;
    renderResults(data.byDays, data.byGap);
  } catch(err){
    statusEl.className = 'status error';
    statusEl.textContent = 'Could not reach the server. Is app.py running?';
  } finally {
    btn.disabled = false;
  }
}

let resultsState = { mode: 'days', index: 0, byDays: [], byGap: [] };

function renderEmptyResults(){
  document.getElementById('resultsArea').innerHTML = `<div class="panel"><div class="empty-note">No valid timetable found with the current options — try widening some class times.</div></div>`;
}

function renderResults(byDays, byGap){
  resultsState = { mode: 'days', index: 0, byDays, byGap };
  const area = document.getElementById('resultsArea');
  area.innerHTML = `
    <div class="results-tabs">
      <button class="tab-btn active" id="tabDays">
        <div class="num">${byDays[0].daysUsed}</div>
        <div class="lab">days on campus &mdash; best option</div>
      </button>
      <button class="tab-btn" id="tabGap">
        <div class="num">${fmtHours(byGap[0].totalGap)}</div>
        <div class="lab">total gap time &mdash; best option</div>
      </button>
    </div>
    <div class="grid-wrap" id="gridWrap"></div>
  `;
  document.getElementById('tabDays').onclick = () => { resultsState.mode='days'; resultsState.index=0; refreshTabs(); drawGrid(); };
  document.getElementById('tabGap').onclick = () => { resultsState.mode='gap'; resultsState.index=0; refreshTabs(); drawGrid(); };
  drawGrid();
}

function refreshTabs(){
  document.getElementById('tabDays').classList.toggle('active', resultsState.mode==='days');
  document.getElementById('tabGap').classList.toggle('active', resultsState.mode==='gap');
}

function fmtHours(mins){
  const h = Math.floor(mins/60), m = mins%60;
  if(h===0) return m+'m';
  return h+'h' + (m? ' '+m+'m' : '');
}
function fmtTime(mins){
  const h = Math.floor(mins/60), m = mins%60;
  const ampm = h>=12 ? 'pm':'am';
  let hh = h%12; if(hh===0) hh=12;
  return hh + (m? ':'+String(m).padStart(2,'0') : '') + ampm;
}

function drawGrid(){
  const list = resultsState.mode === 'days' ? resultsState.byDays : resultsState.byGap;
  const entry = list[Math.min(resultsState.index, list.length-1)];
  const wrap = document.getElementById('gridWrap');

  let minStart = 8*60, maxEnd = 18*60;
  entry.chosen.forEach(({slot}) => {
    minStart = Math.min(minStart, toMin(slot.start));
    maxEnd = Math.max(maxEnd, toMin(slot.end));
  });
  minStart = Math.floor(minStart/60)*60 - 30;
  maxEnd = Math.ceil(maxEnd/60)*60 + 30;
  minStart = Math.max(0, minStart);

  const activeDays = DAYS.filter(d => entry.chosen.some(({slot}) => slot.day === d));
  const daysToShow = activeDays.length ? activeDays : ['Mon'];

  const pxPerMin = 0.9;
  const gridHeight = (maxEnd-minStart) * pxPerMin;
  const hourMarks = [];
  for(let t = Math.ceil(minStart/60)*60; t <= maxEnd; t += 60) hourMarks.push(t);

  let html = `
    <div class="grid-nav">
      <div class="stats"><b>${entry.daysUsed}</b> day${entry.daysUsed===1?'':'s'} on campus &nbsp;·&nbsp; <b>${fmtHours(entry.totalGap)}</b> total gap time</div>
      <div class="arrows">
        <button id="prevBtn" ${list.length<=1?'disabled':''}>&larr;</button>
        <span style="font-size:12px;color:var(--ink-soft);margin:0 6px;">${resultsState.index+1} / ${list.length}</span>
        <button id="nextBtn" ${list.length<=1?'disabled':''}>&rarr;</button>
      </div>
    </div>
    <div class="week" style="grid-template-columns:56px repeat(${daysToShow.length}, 1fr); grid-template-rows:32px ${gridHeight}px;">
      <div class="time-col-head"></div>
      ${daysToShow.map(d => `<div class="day-col-head">${d}</div>`).join('')}
      <div style="position:relative;">
        ${hourMarks.map(t => `<div class="time-label" style="position:absolute;top:${(t-minStart)*pxPerMin - 6}px;width:100%;">${fmtTime(t)}</div>`).join('')}
      </div>
      ${daysToShow.map(d => {
        const sessions = entry.chosen.filter(({slot}) => slot.day === d);
        return `<div class="day-cell" style="height:${gridHeight}px;">
          ${sessions.map(({course,comp,slot}) => {
            const top = (toMin(slot.start)-minStart)*pxPerMin;
            const h = Math.max(20,(toMin(slot.end)-toMin(slot.start))*pxPerMin);
            return `<div class="block" style="top:${top}px;height:${h}px;background:${course.color};">
                <div class="bname">${escapeAttr(course.name)}</div>
                <div class="btime">${escapeAttr(comp.name)} · ${fmtTime(toMin(slot.start))}&ndash;${fmtTime(toMin(slot.end))}</div>
              </div>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>
    <div class="legend">
      ${state.courses.map(c => `<div class="item"><div class="sw" style="background:${c.color}"></div>${escapeAttr(c.name)}</div>`).join('')}
    </div>
  `;
  wrap.innerHTML = html;
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if(prevBtn) prevBtn.onclick = () => { resultsState.index = (resultsState.index-1+list.length)%list.length; drawGrid(); };
  if(nextBtn) nextBtn.onclick = () => { resultsState.index = (resultsState.index+1)%list.length; drawGrid(); };
}

// seed with a couple of example courses to show the shape
state.courses.push(newCourse('Engineering Mechanics'));
state.courses.push(newCourse('Electronic Systems'));
render();
