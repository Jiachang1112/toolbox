// ReactionLab - multi-mode reaction tester
// Storage helpers
const store = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)??'null') ?? d } catch(e){ return d } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)) },
  push(k, v){ const a = store.get(k, []); a.push(v); store.set(k, a) }
};

// UI elements
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

const playArea = $('#playArea');
const stage = $('#stage');
const startBtn = $('#startBtn');
const hint = $('#hint');
const bestList = $('#bestList');
const recentList = $('#recentList');
const achGrid = $('#achGrid');
const achTabs = $('#achTabs');
const viewTitle = $('#viewTitle');

const trialGroup = $('#trialGroup');
const delayGroup = $('#delayGroup');
const areaGroup = $('#areaGroup');
const inputGroup = $('#inputGroup');

const themeBtn = $('#themeBtn');
const resetBtn = $('#resetBtn');
const saveBestBtn = $('#saveBestBtn');
const soundToggle = $('#soundToggle');

let settings = store.get('rx.settings', {
  mode:'simple', trials:5, delay:'2-6', area:'m', input:'mouse', sound:true
});
soundToggle.checked = settings.sound;

// Audio (beep)
let ac = null;
function beep(freq=880, time=0.05){
  if(!settings.sound) return;
  ac = ac || new (window.AudioContext||window.webkitAudioContext)();
  const o = ac.createOscillator(); const g = ac.createGain();
  o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
  g.gain.setValueAtTime(0.15, ac.currentTime);
  o.start(); o.stop(ac.currentTime + time);
}

// Nav & mode switching
function activateButtons(group, value){
  $$('.btn-group button', group.parentElement).forEach(b=>{
    b.classList.toggle('active', b.dataset.v==value);
  });
}
function switchMode(mode){
  settings.mode = mode;
  store.set('rx.settings', settings);
  viewTitle.textContent = {
    simple:'簡單反應', gng:'Go / No-Go', f1:'F1 反應', aim:'點擊目標', wasd:'WASD 鍵',
    records:'成績紀錄', about:'關於 / 說明'
  }[mode] ?? '簡單反應';

  $$('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===mode));
  $$('.mode').forEach(b=>b.classList.toggle('active', b.dataset.view===mode));

  // hint
  const hints = {
    simple:'當畫面變 <b style="color:#39d98a">綠色</b> 時立刻點擊（或按 <kbd>SPACE</kbd>）。',
    gng:'看到 <b style="color:#39d98a">綠色</b> 點擊；<b style="color:#ff6b6b">紅色</b> 不可點。',
    f1:'等待五顆黃燈依序點亮，變 <b style="color:#39d98a">綠色</b> 後按 <kbd>SPACE</kbd> 或點擊。',
    aim:'移動出現的 <b>目標圈</b> 並點擊（WARM-UP 1 秒後出現）。',
    wasd:'根據提示按下 <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>。',
    records:'左側選擇模式開始測試，右側可看個人最佳與成就。',
    about:'本工具在瀏覽器本地運作，不收集資料。'
  }
  hint.innerHTML = hints[mode];

  // clear stage
  stage.innerHTML = ''; stage.className = 'stage'; stage.hidden = true;
  startBtn.hidden = false; startBtn.textContent = '點擊以開始';
}
$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.view)));
$$('.mode').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.view)));

// settings group binds
trialGroup.addEventListener('click', e=>{ const v = e.target.dataset.v; if(!v) return; settings.trials=+v; activateButtons({parentElement:trialGroup}, v); store.set('rx.settings', settings) });
delayGroup.addEventListener('click', e=>{ const v = e.target.dataset.v; if(!v) return; settings.delay=v; activateButtons({parentElement:delayGroup}, v); store.set('rx.settings', settings) });
areaGroup.addEventListener('click', e=>{ const v = e.target.dataset.v; if(!v) return; settings.area=v; activateButtons({parentElement:areaGroup}, v); store.set('rx.settings', settings) });
inputGroup.addEventListener('click', e=>{ const v = e.target.dataset.v; if(!v) return; settings.input=v; activateButtons({parentElement:inputGroup}, v); store.set('rx.settings', settings) });

// theme & reset
themeBtn.addEventListener('click', ()=>{ document.body.classList.toggle('light'); });
resetBtn.addEventListener('click', ()=>{
  if(confirm('確定要清除所有成績與成就？')){ localStorage.removeItem('rx.records'); localStorage.removeItem('rx.best'); localStorage.removeItem('rx.ach'); renderAll(); }
});
saveBestBtn.addEventListener('click', ()=>{
  const best = store.get('rx.best', {}); delete best[settings.mode]; store.set('rx.best', best); renderBest();
});
soundToggle.addEventListener('change', ()=>{ settings.sound = soundToggle.checked; store.set('rx.settings', settings); });

// Utilities
function now(){ return new Date().toLocaleString() }
function rand(min,max){ return Math.random()*(max-min)+min }
function delayMs(ms){ return new Promise(res=>setTimeout(res,ms)) }
function delayRange(tag){
  const [a,b] = settings.delay.split('-').map(Number);
  return rand(a*1000, b*1000);
}
function areaPadding(){
  return {s:60, m:30, l:10}[settings.area];
}

// Records / Achievements
function pushRecord(mode, samples){
  // samples: array of milliseconds or objects
  const nums = samples.map(v=>typeof v==='number'?v:v.ms).filter(v=>isFinite(v));
  const avg = nums.reduce((a,b)=>a+b,0)/nums.length;
  const best = Math.min.apply(null, nums);
  store.push('rx.records', {mode, avg:Math.round(avg), best:Math.round(best), time:Date.now()});
  // best
  const b = store.get('rx.best', {});
  b[mode] = Math.min(b[mode]??Infinity, best);
  store.set('rx.best', b);
  // Achievements
  unlockAchievements(mode, best, avg, samples);
  renderAll();
}

function unlockAchievements(mode, best, avg, samples){
  const ach = store.get('rx.ach', {});
  function set(id, title, desc, tag){
    if(ach[id]) return;
    ach[id] = {title, desc, tag, time:Date.now()};
  }
  if(best<200) set('fast200', '閃電手 I', '任一模式最佳 &lt; 200ms', mode);
  if(best<150) set('fast150', '閃電手 II', '任一模式最佳 &lt; 150ms', mode);
  if(avg<220 && settings.trials>=5) set('consist', '穩定發揮', '5 次平均 &lt; 220ms', mode);
  if(mode==='gng'){
    const wrong = samples.filter(s=>s.wrong).length;
    if(wrong===0) set('nogood', '零失誤', 'Go/No-Go 0 失誤', 'gng');
  }
  if(mode==='aim'){
    if(best<250) set('shooter', '神射手', '目標點擊最佳 &lt; 250ms', 'aim');
  }
  if(mode==='f1'){
    if(best<300) set('lights', '起跑王', 'F1 模式最佳 &lt; 300ms', 'f1');
  }
  if(mode==='wasd'){
    if(best<250) set('racer', '飆速打字', 'WASD 最佳 &lt; 250ms', 'wasd');
  }
  store.set('rx.ach', ach);
}

function renderBest(){
  const best = store.get('rx.best', {});
  const modes = {simple:'簡單反應', gng:'Go / No-Go', f1:'F1 反應', aim:'點擊目標', wasd:'WASD 鍵'};
  bestList.innerHTML = Object.keys(modes).map(k=>{
    const v = best[k];
    return `<div class="row"><span>${modes[k]}</span><b>${v?Math.round(v)+' ms':'無紀錄'}</b></div>`;
  }).join('');
}
function renderRecent(){
  const tmpl = $('#recentTmpl').content;
  recentList.innerHTML = '';
  const recs = store.get('rx.records', []).slice(-20).reverse();
  recs.forEach(r=>{
    const el = tmpl.cloneNode(true);
    el.querySelector('.mode').textContent = r.mode.toUpperCase();
    el.querySelector('.stamp').textContent = new Date(r.time).toLocaleString();
    el.querySelector('.best').textContent = r.best + ' ms';
    el.querySelector('.avg').textContent = r.avg + ' ms';
    recentList.appendChild(el);
  });
}
function renderAch(tag='all'){
  const ach = store.get('rx.ach', {});
  const list = Object.values(ach).filter(a=> tag==='all' || a.tag===tag);
  achGrid.innerHTML = '';
  if(list.length===0){ achGrid.innerHTML = '<div class="muted">尚無成就，開始測試吧！</div>'; return }
  const tmpl = $('#achTmpl').content;
  list.sort((a,b)=>a.time-b.time).forEach(a=>{
    const el = tmpl.cloneNode(true);
    el.querySelector('.title').textContent = a.title;
    el.querySelector('.desc').textContent = a.desc;
    achGrid.appendChild(el);
  });
}
achTabs.addEventListener('click', e=>{
  const tag = e.target.dataset.tag; if(!tag) return;
  $$('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tag===tag));
  renderAch(tag);
});

function renderAll(){ renderBest(); renderRecent(); renderAch('all'); }
renderAll();

// ===== Modes implementation =====
let running = false;
let keyHandler = null;
function bindKey(fn){
  if(keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if(fn) document.addEventListener('keydown', keyHandler);
}
function within(el, e){
  const r = el.getBoundingClientRect();
  return e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom;
}

async function runTest(){
  if(running) return;
  running = true; startBtn.hidden = true; stage.hidden = false; stage.className='stage ready'; stage.innerHTML='準備中…'; beep(660, .04);
  const trials = settings.trials;
  const res = [];
  const sizeClass = settings.area==='s' ? 'small' : settings.area==='l' ? 'large' : '';

  if(settings.mode==='simple'){
    for(let i=0;i<trials;i++){
      stage.className='stage wait'; stage.innerHTML='等待變綠…';
      await delayMs(delayRange());
      stage.className='stage go'; stage.innerHTML='點！';
      const t0 = performance.now();
      const handler = (e)=>{
        if(settings.input==='mouse' && e.type==='click' && !within(stage, e)) return;
        const t = Math.round(performance.now()-t0);
        res.push(t); stage.className='stage ready'; stage.innerHTML = `第 ${i+1}/${trials} 次：<b>${t} ms</b>`; beep(880,.05);
        stage.removeEventListener('click', handler); document.removeEventListener('keydown', handler);
        next();
      };
      function next(){}
      if(settings.input==='mouse') stage.addEventListener('click', handler, {once:true});
      else document.addEventListener('keydown', e=>{ if(e.code==='Space') handler(e) }, {once:true});
      await new Promise(done=>{ next = done; });
      await delayMs(400);
    }
  }

  if(settings.mode==='gng'){
    for(let i=0;i<trials;i++){
      stage.className='stage wait'; stage.innerHTML='等待顏色…';
      await delayMs(delayRange());
      const isGo = Math.random()>0.35; // 65% go
      stage.className= isGo ? 'stage go' : 'stage stop';
      stage.innerHTML = isGo ? '綠色！點！' : '紅色，別點…';
      const t0 = performance.now();
      let done=false;
      const onClick = (e)=>{
        if(done) return;
        done=true;
        const t = Math.round(performance.now()-t0);
        res.push({ms:t, wrong:!isGo});
        stage.className='stage ready'; stage.innerHTML = isGo ? `✅ ${t} ms` : `❌ 誤擊 (${t} ms)`;
        finish();
      };
      const onSpace = (e)=>{ if(e.code==='Space') onClick(e) };
      if(settings.input==='mouse') stage.addEventListener('click', onClick, {once:true});
      else document.addEventListener('keydown', onSpace, {once:true});
      // timeout for No-Go (no click)
      await delayMs(1200);
      if(!done){
        if(isGo){ stage.innerHTML='慢了點…'; res.push({ms:1200, wrong:true}); }
        else { stage.innerHTML='👍 成功抑制'; res.push({ms:0, wrong:false}); }
      }
      stage.removeEventListener('click', onClick); document.removeEventListener('keydown', onSpace);
      await delayMs(500);
    }
  }

  if(settings.mode==='f1'){
    for(let i=0;i<trials;i++){
      stage.className='stage wait'; stage.innerHTML='等待起跑燈…';
      await delayMs(rand(600, 1200));
      // show five lights (emoji)
      stage.innerHTML='🟡 🟡 🟡 🟡 🟡'; beep(520,.05);
      await delayMs(rand(400, 800)); stage.innerHTML='🟡 🟡 🟡 🟡 🟡';
      await delayMs(rand(400, 800)); stage.innerHTML='🟡 🟡 🟡 🟡 🟡';
      await delayMs(rand(400, 800)); // suspense
      stage.className='stage go'; stage.innerHTML='🟢 GO';
      const t0 = performance.now();
      const handler = (e)=>{
        const t = Math.round(performance.now()-t0);
        res.push(t); stage.className='stage ready'; stage.innerHTML = `第 ${i+1}/${trials} 次：<b>${t} ms</b>`; beep(880,.05);
        stage.removeEventListener('click', handler); document.removeEventListener('keydown', handler);
        next();
      };
      if(settings.input==='mouse') stage.addEventListener('click', handler, {once:true});
      else document.addEventListener('keydown', e=>{ if(e.code==='Space') handler(e) }, {once:true});
      let next; await new Promise(done=>{ next = done; });
      await delayMs(400);
    }
  }

  if(settings.mode==='aim'){
    for(let i=0;i<trials;i++){
      stage.className='stage wait'; stage.innerHTML='準備…';
      await delayMs(1000);
      stage.className='stage ready'; stage.innerHTML='';
      const t0 = performance.now();
      const target = document.createElement('div');
      target.className = 'target '+(sizeClass||'');
      target.textContent = '🎯';
      const pad = areaPadding();
      const rect = stage.getBoundingClientRect();
      const x = rand(pad, rect.width-pad-80); const y = rand(pad, rect.height-pad-80);
      target.style.position='absolute'; target.style.left=x+'px'; target.style.top=y+'px';
      stage.appendChild(target);
      await new Promise(done=>{
        target.addEventListener('click', ()=>{
          const t = Math.round(performance.now()-t0); res.push(t);
          target.remove(); stage.innerHTML = `第 ${i+1}/${trials} 次：<b>${t} ms</b>`; beep(880,.05);
          done();
        }, {once:true});
      });
      await delayMs(400);
    }
  }

  if(settings.mode==='wasd'){
    const keys = ['W','A','S','D'];
    for(let i=0;i<trials;i++){
      stage.className='stage wait'; stage.innerHTML='準備方向…';
      await delayMs(delayRange());
      const need = keys[Math.floor(Math.random()*keys.length)];
      stage.className='stage go'; stage.innerHTML=`請按 <kbd>${need}</kbd>`;
      const t0 = performance.now();
      const onKey = (e)=>{
        const k = e.key.toUpperCase();
        if(['W','A','S','D'].includes(k)){
          const t = Math.round(performance.now()-t0);
          if(k===need){ res.push(t); stage.className='stage ready'; stage.innerHTML = `✅ ${t} ms`; }
          else { res.push(1200); stage.className='stage ready'; stage.innerHTML = `❌ 誤鍵 (${k})`; }
          document.removeEventListener('keydown', onKey);
          next();
        }
      };
      let next; document.addEventListener('keydown', onKey);
      await new Promise(done=>{ next = done; });
      await delayMs(400);
    }
  }

  pushRecord(settings.mode, res);
  running = false; startBtn.hidden = false; stage.className='stage'; stage.innerHTML='完成！再來一次？';
}

// Bind start
startBtn.addEventListener('click', runTest);
// allow space to start when focused not running
document.addEventListener('keydown', e=>{
  if(e.code==='Space' && !running && settings.input==='space'){ runTest(); }
});

// init active buttons
activateButtons({parentElement:trialGroup}, settings.trials);
activateButtons({parentElement:delayGroup}, settings.delay);
activateButtons({parentElement:areaGroup}, settings.area);
activateButtons({parentElement:inputGroup}, settings.input);

// initial mode
switchMode(settings.mode);
