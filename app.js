```js
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
  for(const [k,v] of Object.entries(attrs)){
    if(k === 'class') el.className = v;
    else if(k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for(const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ''));
  return el;
}

function applyTheme(theme){
  if(!theme) return;
  const r = document.documentElement.style;
  if(theme.bg) r.setProperty('--bg', theme.bg);
  if(theme.text) r.setProperty('--text', theme.text);
  if(theme.accent) r.setProperty('--accent', theme.accent);
  if(theme.font) document.body.style.setProperty('font-family', theme.font);
}

async function initIndex(){
  const grid = $('#grid');
  try{
    const data = await fetchJSON('data/tests.json');
    const tests = (data?.tests || []).filter(t => t.isActive !== false);
    if(!tests.length){ grid.append(h('p', {class:'muted'}, 'Пока нет активных тестов.')); return; }

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

function startQuiz(cfg){
  const app = $('#app');
  let i = 0;
  const scores = {}; // {Юрис: 0, Лара: 0, ...}

  function addPoints(points){
    for(const [k,v] of Object.entries(points||{})) scores[k] = (scores[k]||0) + Number(v||0);
  }

  function renderQuestion(){
    const q = cfg.questions[i];
    app.innerHTML = '';
    const block = h('section', { class:'q-block' },
      q.image16x9 ? h('img', { class:'qimg', src:q.image16x9, alt:'' }) : null,
      h('div', { class:'pad' },
        h('div', { class:'small muted' }, `Вопрос ${i+1} из ${cfg.questions.length}`),
        h('h3', {}, q.text),
        h('div', { class:'answers' },
          ...q.answers.map(a => h('button', { class:'answer', onclick: ()=>{ addPoints(a.points); next(); } }, a.label))
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
    // найти ключ с максимальным количеством баллов
    let bestKey = null, bestVal = -Infinity;
    for(const r of cfg.results){
      const val = scores[r.id] || 0;
      if(val > bestVal){ bestVal = val; bestKey = r.id; }
    }
    const res = cfg.results.find(r => r.id === bestKey) || cfg.results[0];

    app.innerHTML = '';
    const card = h('section', { class:'result' },
      res.imagePortrait16x9 ? h('img', { class:'rimg', src: res.imagePortrait16x9, alt: res.title }) : null,
      h('div', { class:'pad' },
        h('h3', {}, res.title || 'Результат'),
        res.desc ? h('p', {}, res.desc) : null,
        h('div', { class:'actions' },
          h('a', { class:'btn', href:'index.html' }, 'В каталог'),
          h('button', { class:'btn secondary', onclick: ()=>location.reload() }, 'Пройти ещё раз')
        )
      )
    );
    app.append(card);
  }

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

(function(){
  const page = document.body.getAttribute('data-page');
  if(page === 'index') initIndex();
  if(page === 'test') initTest();
})();
```
