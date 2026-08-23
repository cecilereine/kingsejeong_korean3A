let LESSONS = [];

/* ---------- RENDER ---------- */
const content=document.getElementById('content');

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function render(){
  content.innerHTML = LESSONS.map(L=>`
    <section class="lesson" data-lesson="${L.lesson}">
      <div class="lesson-head">
        <span class="num">${L.num}</span>
        <h2>${esc(L.title)}</h2>
        <span class="en">${esc(L.en)}</span>
      </div>

      <div class="block-title"><span class="dot v"></span>어휘 · Vocabulary</div>
      ${L.vocab.map(g=>`
        <div class="theme">${esc(g.theme)}</div>
        <div class="grid">
          ${g.items.map(v=>`
            <div class="vcard" data-id="${esc(L.num+'|'+v.kw)}" data-search="${esc((v.kw+' '+v.mean+' '+v.ex+' '+v.exen).toLowerCase())}">
              <span class="learned-badge" title="Learned">✓</span>
              <div class="kw">${esc(v.kw)}</div>
              <div class="mean">${esc(v.mean)}</div>
              <div class="ex">${esc(v.ex)}<span class="exen">${esc(v.exen)}</span></div>
            </div>`).join('')}
        </div>`).join('')}

      <div class="block-title"><span class="dot g"></span>문법 · Grammar</div>
      ${L.grammar.map(gr=>`
        <div class="gcard ${gr.extra?'extra':''}" data-search="${esc((gr.form+' '+gr.tag+' '+gr.def_ko+' '+gr.def_en+' '+gr.ex.map(e=>e.ko+' '+e.en).join(' ')).toLowerCase())}">
          <span class="form">${esc(gr.form)}</span>
          <div class="tagline">${esc(gr.tag)}</div>
          <div class="lbl def">정의 · Definition</div>
          <div class="def-txt"><span class="ko">${esc(gr.def_ko)}</span><span class="en">${esc(gr.def_en)}</span></div>
          <div class="lbl">예시 · Examples</div>
          <ul class="ex-list">
            ${gr.ex.map(e=>`<li>${e.dia?`<span class="dia">${esc(e.dia)}</span> `:''}${esc(e.ko)}<span class="exen">${esc(e.en)}</span></li>`).join('')}
          </ul>
          <div class="lbl">정보 · Form <span style="font-weight:400;text-transform:none;opacity:.85">— ${esc(gr.info_en)}</span></div>
          <div style="overflow-x:auto"><table class="conj">
            <tr>${gr.table.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>
            ${gr.table.rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i===r.length-1?'res':''}">${esc(c)}</td>`).join('')}</tr>`).join('')}
          </table></div>
          ${gr.table2?`<div class="lbl">${esc(gr.table2.caption)}</div>
          <div style="overflow-x:auto"><table class="conj">
            <tr>${gr.table2.head.map(hh=>`<th>${esc(hh)}</th>`).join('')}</tr>
            ${gr.table2.rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i===0?'':'res'}">${esc(c)}</td>`).join('')}</tr>`).join('')}
          </table></div>`:''}
        </div>`).join('')}
    </section>`).join('') + `<div class="noresult hidden" id="noresult">No matches found. Try another word.</div>`;
}
// load lesson data from per-lesson JSON files listed in lessons/manifest.json
fetch('lessons/manifest.json')
  .then(function(r){ return r.json(); })
  .then(function(files){ return Promise.all(files.map(function(f){ return fetch('lessons/' + f).then(function(r){ return r.json(); }); })); })
  .then(function(arr){ LESSONS = arr; render(); refreshBadges(); })
  .catch(function(){ content.innerHTML = "<p style='padding:24px;color:#b45'>Couldn't load the lesson files. Open this page from a web server (like GitHub Pages) instead of double-clicking the file.</p>"; });

/* ---------- INTERACTIONS ---------- */
const search=document.getElementById('search');
const tabs=document.getElementById('tabs');
const enToggle=document.getElementById('enToggle');
let activeLesson='all';

tabs.addEventListener('click',e=>{
  if(!e.target.classList.contains('tab'))return;
  tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  activeLesson=e.target.dataset.lesson;
  applyFilters();
});

enToggle.addEventListener('change',()=>{
  document.querySelector('.wrap').classList.toggle('en-hide',!enToggle.checked);
});

search.addEventListener('input',applyFilters);

// in-place flip: click a vocab card to hide/reveal its answer
content.addEventListener('click',e=>{
  const card=e.target.closest('.vcard');
  if(card) card.classList.toggle('flip');
});

function applyFilters(){
  const q=search.value.trim().toLowerCase();
  let anyVisible=false;
  document.querySelectorAll('section.lesson').forEach(sec=>{
    const lessonMatch = activeLesson==='all' || sec.dataset.lesson===activeLesson;
    if(!lessonMatch){
      sec.classList.add('hidden');return;
    }
    let secHas=false;
    sec.querySelectorAll('[data-search]').forEach(card=>{
      const hit = !q || card.dataset.search.includes(q);
      card.classList.toggle('hidden',!hit);
      if(hit)secHas=true;
    });
    sec.querySelectorAll('.grid').forEach(grid=>{
      const visible=[...grid.querySelectorAll('.vcard')].some(c=>!c.classList.contains('hidden'));
      grid.classList.toggle('hidden',!visible);
      const theme=grid.previousElementSibling;
      if(theme&&theme.classList.contains('theme'))theme.classList.toggle('hidden',!visible);
    });
    sec.classList.toggle('hidden',!secHas);
    if(secHas)anyVisible=true;
  });
  const nr=document.getElementById('noresult');
  if(nr)nr.classList.toggle('hidden',anyVisible);
  highlight(q);
}

function highlight(q){
  document.querySelectorAll('mark').forEach(m=>{
    m.replaceWith(document.createTextNode(m.textContent));
  });
  if(!q)return;
  const rx=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
  document.querySelectorAll('.vcard:not(.hidden), .gcard:not(.hidden)').forEach(card=>{
    walk(card,rx);
  });
}
function walk(node,rx){
  for(const child of [...node.childNodes]){
    if(child.nodeType===3){
      if(rx.test(child.textContent)){
        const span=document.createElement('span');
        span.innerHTML=child.textContent.replace(rx,'<mark>$1</mark>');
        child.replaceWith(...span.childNodes);
      }
    }else if(child.nodeType===1 && child.tagName!=='MARK' && child.tagName!=='TABLE'){
      walk(child,rx);
    }
  }
}

/* ---------- FLASHCARD REVIEW ---------- */
const overlay=document.getElementById('overlay');
const fcBody=document.getElementById('fcBody');
const fcMeta=document.getElementById('fcMeta');
const fcControls=document.getElementById('fcControls');
const fcPrevBtn=document.getElementById('fcPrev');
const fcNextBtn=document.getElementById('fcNext');
const fcFlipBtn=document.getElementById('fcFlip');
const fcDirBtn=document.getElementById('fcDir');
const fcLearnBtn=document.getElementById('fcLearn');
const fcUnlearnBtn=document.getElementById('fcUnlearn');
const fcIncludeChk=document.getElementById('fcInclude');
const fcBar=document.getElementById('fcBar');
const fcMark=document.getElementById('fcMark');

let deck=[], idx=0, showBack=false, scope='all', dir='ko'; // dir: 'ko' Korean first, 'en' English first

/* ----- learned progress (saved in the browser) ----- */
const LS_KEY='ksi3a_learned';
let learned=loadLearned();
function loadLearned(){
  try{ return new Set(JSON.parse(localStorage.getItem(LS_KEY)||'[]')); }
  catch(e){ return new Set(); }
}
function saveLearned(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify([...learned])); }catch(e){}
}
const cardId = c => `${c.lesson}|${c.kw}`;
function isLearned(c){ return learned.has(cardId(c)); }

function refreshBadges(){
  document.querySelectorAll('.vcard').forEach(el=>{
    el.classList.toggle('is-learned', learned.has(el.dataset.id));
  });
}
refreshBadges();

function buildDeck(sc){
  const cards=[];
  LESSONS.forEach(L=>{
    if(sc!=='all' && L.lesson!==sc) return;
    L.vocab.forEach(g=>g.items.forEach(v=>{
      const card={...v, lesson:L.num, theme:g.theme};
      if(!fcIncludeChk.checked && isLearned(card)) return; // hide learned unless included
      cards.push(card);
    }));
  });
  return cards;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function startReview(){
  deck=buildDeck(scope); idx=0; showBack=false;
  overlay.classList.add('on');
  renderCard();
}
function totalLearnedInScope(){
  return buildDeckAll(scope).filter(isLearned).length;
}
function buildDeckAll(sc){
  const cards=[];
  LESSONS.forEach(L=>{
    if(sc!=='all' && L.lesson!==sc) return;
    L.vocab.forEach(g=>g.items.forEach(v=>cards.push({...v, lesson:L.num, theme:g.theme})));
  });
  return cards;
}
function setControls(v){ fcControls.style.visibility=v; fcMark.style.visibility=v; }

function renderCard(){
  const totalInScope=buildDeckAll(scope).length;
  const learnedCount=totalLearnedInScope();
  fcBar.style.width = totalInScope ? (learnedCount/totalInScope*100)+'%' : '0';

  if(deck.length===0){
    const allLearned = totalInScope>0 && learnedCount===totalInScope;
    fcBody.innerHTML=`<div class="fc-done"><h3>${allLearned?'🎉 All learned!':'No cards'}</h3><p>${allLearned?'You\'ve marked every card as learned. Reset to review them again.':'No cards in this selection. Try "Include learned" or Reset.'}</p></div>`;
    fcMeta.textContent=`Learned ${learnedCount} / ${totalInScope}`;
    setControls('hidden');
    return;
  }
  if(idx>=deck.length){
    fcBody.innerHTML=`<div class="fc-done"><h3>🎉 Round done!</h3><p>You went through ${deck.length} card${deck.length>1?'s':''}. Learned ${learnedCount} of ${totalInScope} total.</p></div>`;
    fcMeta.textContent=`Learned ${learnedCount} / ${totalInScope}`;
    setControls('hidden');
    return;
  }
  setControls('visible');
  const c=deck[idx];
  const done=isLearned(c);
  fcMeta.textContent=`${c.lesson} · ${idx+1}/${deck.length} · learned ${learnedCount}/${totalInScope}`;
  const front = dir==='ko'
    ? `<div class="side-label">Korean</div><div class="big">${esc(c.kw)}</div>`
    : `<div class="side-label">English</div><div class="mean2">${esc(c.mean)}</div>`;
  const back = dir==='ko'
    ? `<div class="side-label">Meaning</div><div class="mean2">${esc(c.mean)}</div><div class="ex2">${esc(c.ex)}<span class="en2">${esc(c.exen)}</span></div>`
    : `<div class="side-label">Korean</div><div class="big">${esc(c.kw)}</div><div class="ex2" style="margin-top:12px">${esc(c.ex)}<span class="en2">${esc(c.exen)}</span></div>`;
  const statusChip = done ? `<div class="fc-status yes">✓ learned</div>` : `<div class="fc-status no">still learning</div>`;
  fcBody.innerHTML=`<div class="fc-card ${done?'learned-card':''}" id="fcCard">${showBack?back:front}${statusChip}${showBack?'':'<div class="tapflip">tap card to flip</div>'}</div>`;
  document.getElementById('fcCard').onclick=()=>{showBack=!showBack;renderCard();};
  fcPrevBtn.disabled = idx===0;
  fcFlipBtn.textContent = showBack ? 'Hide' : 'Flip';
  fcLearnBtn.textContent = done ? '✓ Learned' : '✓ Got it — learned';
  fcUnlearnBtn.style.display = done ? 'block' : 'none';
}

function markLearned(){
  const c=deck[idx]; if(!c) return;
  learned.add(cardId(c)); saveLearned(); refreshBadges();
  if(fcIncludeChk.checked){
    renderCard();                 // keep it in view, just flip status
  }else{
    deck.splice(idx,1);           // remove from this round
    showBack=false; renderCard(); // idx now points to next card
  }
}
function markUnlearned(){
  const c=deck[idx]; if(!c) return;
  learned.delete(cardId(c)); saveLearned(); refreshBadges();
  renderCard();
}

document.getElementById('fcStart').onclick=()=>{
  scope=activeLesson;
  document.querySelectorAll('#fcScope button').forEach(x=>x.classList.toggle('on',x.dataset.scope===scope));
  startReview();
};
document.getElementById('fcClose').onclick=()=>overlay.classList.remove('on');
overlay.addEventListener('click',e=>{ if(e.target===overlay) overlay.classList.remove('on'); });
fcFlipBtn.onclick=()=>{ showBack=!showBack; renderCard(); };
fcNextBtn.onclick=()=>{ idx++; showBack=false; renderCard(); };
fcPrevBtn.onclick=()=>{ if(idx>0){idx--; showBack=false; renderCard();} };
document.getElementById('fcShuffle').onclick=()=>{ shuffle(deck); idx=0; showBack=false; renderCard(); };
fcLearnBtn.onclick=markLearned;
fcUnlearnBtn.onclick=markUnlearned;
fcIncludeChk.onchange=()=>startReview();   // rebuild deck when toggling learned cards
document.getElementById('fcReset').onclick=()=>{
  if(confirm('Reset progress? All cards will go back into the deck.')){
    learned.clear(); saveLearned(); refreshBadges(); startReview();
  }
};
fcDirBtn.onclick=()=>{
  dir = dir==='ko' ? 'en' : 'ko';
  fcDirBtn.textContent = dir==='ko' ? '한 → EN' : 'EN → 한';
  showBack=false; renderCard();
};
// scope buttons inside the panel
document.getElementById('fcScope').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  document.querySelectorAll('#fcScope button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  scope=b.dataset.scope;
  startReview();
});
// keyboard: arrows to navigate, space to flip, esc to close
document.addEventListener('keydown',e=>{
  if(!overlay.classList.contains('on'))return;
  if(e.key==='Escape')overlay.classList.remove('on');
  else if(e.key==='ArrowRight'){idx++;showBack=false;renderCard();}
  else if(e.key==='ArrowLeft'){if(idx>0){idx--;showBack=false;renderCard();}}
  else if(e.key===' '){e.preventDefault();showBack=!showBack;renderCard();}
});
