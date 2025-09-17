// ===== helpers =====
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const qs = new URLSearchParams(location.search);

async function fetchJSON(url){
  const res = await fetch(url + (url.includes('?')?'&':'?') + 't=' + Date.now()); // без кеша
  if(!res.ok) throw new Error('Не найден файл: ' + url);
  return res.json();
}

function h(tag, attrs={}, ...children){
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if(k === 'class') el.className = v;
    else if(k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ''));
  return el;
}

function applyTheme(theme){
  if(!theme) return;
  const r = document.documentElement.style;
  if(theme.bg)    r.setProperty('--bg', theme.bg);
  if(theme.text)  r.setProperty('--text', theme.text);
  if(theme.accent)r.setProperty('--accent', theme.accent);
  if(theme.font)  document.body.style.setProperty('font-family', theme.font);
}

function shuffleArray(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// превращаем \n\n в абзацы
function renderParagraphs(text){
  if(!text) return [];
  return text.split(/\n\s*\n/).map(p => h('p', {}, p));
}

// ===== index page =====
async function initIndex(){
  const grid = $('#grid');
  try{
    const data = await fetchJSON('data/tests.json');
    const tests = (data?.tests || []).filter(t => t.isActive !== false);
    if(!tests.length){
      grid.append(h('p', {class:'muted'}, 'Пока нет активных тестов.'));
      return;
    }
    for(const t of tests){
      const card = h('a', { class:'card', href:`test.html?test=${encodeURIComponent(t.slug)}` },
        h('img', { class:'thumb', src: t.tile16x9, alt: t.title }),
        h('div', { class:'body' },
          h('h3', { class:'title' }, t.title),
          t.tag ? h('span', { class:'tag' }, t.tag) : null
        )
      );
      grid.append(card);
    }
  }catch(e){
    grid.append(h('p', {}, 'Ошибка загрузки каталога. Проверь файл /data/tests.json'));
    console.error(e);
  }
}

// ===== quiz page =====
function startQuiz(cfg){
  const app = $('#app');
  let i = 0;

  // голоса по категориям (A/B/C/D/E)
  const votes = {}; // {A: n, B: n, ...}
  function vote(category){
    if(!category) return;
    votes[category] = (votes[category] || 0) + 1;
  }

  // Перемешиваем варианты для каждого вопроса ОДИН РАЗ на старте
  const shuffledAnswers = cfg.questions.map(q => shuffleArray(q.answers));

  function renderQuestion(){
    const q = cfg.questions[i];
    const answersForThis = shuffledAnswers[i];

    app.innerHTML = '';
    const block = h('section', { class:'q-block' },
      q.image16x9 ? h('img', { class:'qimg', src:q.image16x9, alt:'' }) : null,
      h('div', { class:'pad' },
        h('div', { class:'small muted' }, `Вопрос ${i+1} из ${cfg.questions.length}`),
        h('h3', {}, q.text),
        q.subtitle ? h('p', {}, h('em', {}, q.subtitle)) : null,
        h('div', { class:'answers' },
          ...answersForThis.map(a =>
            h('button', { class:'answer', onclick: ()=>{ vote(a.key); next(); } }, a.label)
          )
        ),
        // Кнопка "В каталог" под ответами слева
        h('div', { class:'actions actions-left' },
          h('a', { class:'btn secondary', href:'index.html' }, 'В каталог')
        )
      )
    );
    app.append(block);
  }

  function next(){
    i++;
    if(i < cfg.questions.length) renderQuestion();
    else finish();
  }

  function finish(){
    // выбираем результат с максимальным количеством голосов (при ничьей — кто раньше в cfg.results)
    let bestId = null, bestVal = -Infinity;
    for(const r of cfg.results){
      const val = votes[r.id] || 0;
      if(val > bestVal){ bestVal = val; bestId = r.id; }
    }
    const res = cfg.results.find(r => r.id === bestId) || cfg.results[0];

    app.innerHTML = '';

    // Карточка результата — сразу полностью: заголовок (жирно) + подзаголовок (курсив) + длинный текст
    const card = h('section', { class:'result' },
      res.imagePortrait16x9 ? h('img', { class:'rimg', src: res.imagePortrait16x9, alt: res.title }) : null,
      h('div', { class:'pad' },
        h('h3', {}, res.title || 'Результат'),
        res.desc ? h('p', {}, h('em', {}, res.desc)) : null,
        ...renderParagraphs(res.long),
        h('div', { class:'actions' },
          h('a', { class:'btn', href:'index.html' }, 'В каталог'),
          h('button', { class:'btn secondary', onclick: ()=>location.reload() }, 'Пройти ещё раз')
        )
      )
    );
    app.append(card);
  }

  // показываем первый вопрос
  renderQuestion();
}

async function initTest(){
  const app = $('#app');
  const slug = qs.get('test');
  if(!slug){ location.href = 'index.html'; return; }
  try{
    const cfg = await fetchJSON(`data/${slug}.json`);
    applyTheme(cfg.theme);

    // экран стартовой обложки
    app.innerHTML = '';
    const start = h('section', { class:'cover' },
      cfg.coverFull ? h('img', { class:'img', src: cfg.coverFull, alt: cfg.title }) : null,
      h('div', { class:'pad' },
        h('h2', {}, cfg.title || 'Тест'),
        cfg.subtitle ? h('p', { class:'muted' }, cfg.subtitle) : null,
        h('div', { class:'actions' },
          h('button', { class:'btn', onclick: ()=> startQuiz(cfg) }, 'Начать'),
          h('a', { class:'btn secondary', href:'index.html' }, 'Назад')
        ),
        h('div', { class:'small muted' }, 'Результат покажем только в конце')
      )
    );
    app.append(start);
  }catch(e){
    app.innerHTML = '<p>Не удалось загрузить тест. Проверь ссылку и файл JSON.</p>';
    console.error(e);
  }
}

// ===== boot =====
(function(){
  const page = document.body.getAttribute('data-page');
  if(page === 'index') initIndex();
  if(page === 'test')  initTest();
})();
