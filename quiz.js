/* =============================================================
   Typed-answer quiz.

   Loaded after app.js, which exposes window.KSI (see the interface
   block at the bottom of app.js). Nothing here writes to app.js state.

   Direction:
     'ko' → shows the Korean word, you type the English meaning
     'en' → shows the English meaning, you type the Korean word

   Answer checking is deliberately forgiving, because a meaning is
   written as prose rather than as a list. See answersFor() below.
   ============================================================= */

/* Wrapped in an IIFE: classic scripts share one global scope, so declaring
   `esc`, `$`, `shuffle`, `overlay`… at top level here would collide with the
   same names in app.js and throw a SyntaxError before any of this runs. */
(() => {
'use strict';

const { esc, $, $$, cardsInScope } = window.KSI;

/* ---------- answer matching ---------- */

/* Lowercase, drop trailing punctuation, collapse whitespace. */
const normalize = text =>
  String(text ?? '').toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();

/* Additionally drop parenthetical qualifiers and a leading article or
   infinitive "to", so "to sign up", "sign up", and "alumnus (same year)"
   all reduce to a comparable form. Applied to BOTH the expected answers and
   what the user types, so the two meet in the middle. */
const canonical = text =>
  normalize(text)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(to|a|an|the)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const bothForms = text => [normalize(text), canonical(text)].filter(Boolean);

/* A meaning like "to join, sign up" or "alumni reunion / association" holds
   several acceptable answers; any single one counts as correct. */
function englishAnswers(meaning) {
  const answers = new Set(bothForms(meaning));            // the whole string, as written
  for (const piece of meaning.split(/[,/;]| or /)) bothForms(piece).forEach(f => answers.add(f));
  return [...answers];
}

/* A bracketed ending is optional and may offer alternatives:
     가입(하다)      → 가입, 가입하다
     기대(하다/되다)  → 기대, 기대하다, 기대되다
   The form as written is accepted too. */
function koreanAnswers(word) {
  const answers = new Set(bothForms(word));
  const stem = word.replace(/\([^)]*\)/g, '').trim();
  bothForms(stem).forEach(form => answers.add(form));

  const endings = word.match(/\(([^)]*)\)/)?.[1] ?? '';
  for (const ending of endings.split('/')) {
    const suffix = ending.trim();
    if (suffix) bothForms(stem + suffix).forEach(form => answers.add(form));
  }
  return [...answers];
}

const answersFor = (card, direction) =>
  direction === 'ko' ? englishAnswers(card.mean) : koreanAnswers(card.kw);

const isCorrect = (typed, answers) => bothForms(typed).some(form => answers.includes(form));

/* ---------- state ---------- */
const overlay   = $('#quizOverlay');
const qMeta     = $('#qzMeta');
const qBar      = $('#qzBar');
const qPrompt   = $('#qzPrompt');
const qInput    = $('#qzInput');
const qCheckBtn = $('#qzCheck');
const qNextBtn  = $('#qzNext');
const qSkipBtn  = $('#qzSkip');
const qFeedback = $('#qzFeedback');
const qDirBtn   = $('#qzDir');

let questions = [];
let qIdx = 0;
let score = 0;
let answered = false;
let scope = 'all';
let direction = 'ko';

const shuffle = items => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/* ---------- rendering ---------- */

function startQuiz() {
  questions = shuffle(cardsInScope(scope));
  qIdx = 0;
  score = 0;
  overlay.classList.add('on');
  renderQuestion();
}

function setStage(stage) {          // 'asking' | 'answered' | 'done'
  qCheckBtn.classList.toggle('hidden', stage !== 'asking');
  qSkipBtn.classList.toggle('hidden', stage !== 'asking');
  qNextBtn.classList.toggle('hidden', stage !== 'answered');
  qInput.classList.toggle('hidden', stage === 'done');
  qInput.disabled = stage !== 'asking';
}

function renderQuestion() {
  const total = questions.length;
  qBar.style.width = total ? `${(qIdx / total) * 100}%` : '0';

  if (qIdx >= total) {
    const perfect = total > 0 && score === total;
    qMeta.textContent = `Score ${score} / ${total}`;
    qPrompt.innerHTML =
      `<div class="qz-done">
         <h3>${perfect ? '🎉 Perfect!' : 'Quiz complete'}</h3>
         <p>You got ${score} of ${total} right.</p>
       </div>`;
    qFeedback.className = 'qz-feedback';
    qFeedback.textContent = '';
    setStage('done');
    return;
  }

  const card = questions[qIdx];
  qMeta.textContent = `${card.lesson} · ${qIdx + 1}/${total} · score ${score}`;

  const promptText = direction === 'ko' ? card.kw : card.mean;
  const askLabel = direction === 'ko' ? 'Type the meaning in English' : 'Type the word in Korean';

  qPrompt.innerHTML =
    `<div class="qz-side">${direction === 'ko' ? 'Korean' : 'English'}</div>
     <div class="qz-word">${esc(promptText)}</div>
     <div class="qz-ask">${esc(askLabel)}</div>`;

  qFeedback.className = 'qz-feedback';
  qFeedback.textContent = '';
  qInput.value = '';
  qInput.placeholder = direction === 'ko' ? 'your answer in English…' : '한국어로 답을 쓰세요…';
  answered = false;
  setStage('asking');
  qInput.focus();
}

/* Shows the full written meaning plus the example sentence, so a wrong answer
   still teaches something. */
function revealAnswer(card) {
  const expected = direction === 'ko' ? card.mean : card.kw;
  return `<div class="qz-expected">${esc(expected)}</div>
          <div class="qz-example">${esc(card.ex)}<span class="qz-example-en">${esc(card.exen)}</span></div>`;
}

function checkAnswer() {
  if (answered) return;
  const typed = qInput.value.trim();
  if (!typed) return;

  const card = questions[qIdx];
  const correct = isCorrect(typed, answersFor(card, direction));
  if (correct) score++;

  answered = true;
  qFeedback.className = `qz-feedback ${correct ? 'right' : 'wrong'}`;
  qFeedback.innerHTML = correct
    ? `<div class="qz-verdict">✓ Correct</div>${revealAnswer(card)}`
    : `<div class="qz-verdict">✗ Not quite — you wrote “${esc(typed)}”</div>${revealAnswer(card)}`;

  qMeta.textContent = `${card.lesson} · ${qIdx + 1}/${questions.length} · score ${score}`;
  setStage('answered');
  qNextBtn.focus();
}

function skipQuestion() {
  if (answered) return;
  const card = questions[qIdx];
  answered = true;
  qFeedback.className = 'qz-feedback wrong';
  qFeedback.innerHTML = `<div class="qz-verdict">Skipped</div>${revealAnswer(card)}`;
  setStage('answered');
  qNextBtn.focus();
}

function nextQuestion() {
  qIdx++;
  renderQuestion();
}

function setScope(nextScope) {
  scope = nextScope;
  $$('#qzScope button').forEach(button => button.classList.toggle('on', button.dataset.scope === scope));
  startQuiz();
}

/* ---------- wiring ---------- */
$('#qzStart').addEventListener('click', () => setScope(window.KSI.activeLesson()));
$('#qzScope').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) setScope(button.dataset.scope);
});

$('#qzClose').addEventListener('click', () => overlay.classList.remove('on'));
overlay.addEventListener('click', event => {
  if (event.target === overlay) overlay.classList.remove('on');
});

qCheckBtn.addEventListener('click', checkAnswer);
qNextBtn.addEventListener('click', nextQuestion);
qSkipBtn.addEventListener('click', skipQuestion);
$('#qzRestart').addEventListener('click', startQuiz);

qDirBtn.addEventListener('click', () => {
  direction = direction === 'ko' ? 'en' : 'ko';
  qDirBtn.textContent = direction === 'ko' ? '한 → EN' : 'EN → 한';
  startQuiz();
});

// Enter checks the answer, then Enter again moves on.
qInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); checkAnswer(); }
});

document.addEventListener('keydown', event => {
  if (!overlay.classList.contains('on')) return;
  if (event.key === 'Escape') overlay.classList.remove('on');
  else if (event.key === 'Enter' && answered) { event.preventDefault(); nextQuestion(); }
});

})();
