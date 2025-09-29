// ===== helpers =====
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const qs = new URLSearchParams(location.search);

// --- (опц.) Яндекс.Метрика: если COUNTER_ID определён в окне, отправим goal
function track(goal, params = {}){
  try{
    if (typeof ym === 'function' && typeof window.COUNTER_ID === 'number') {
      ym(window.COUNTER_ID, 'reachGoal', goal, params);
    }
  }catch(e){}
}

async function fetchJSON(url){
  const res = await fetch(url + (url.includes('?')?'&':'?') + 't=' + Date.now()); // против кеша
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
  if(theme.bg)     r.setProperty('--bg', theme.bg);
  if(theme.text)   r.setProperty('--text', theme.text);
  if(theme.accent) r.setProperty('--accent', theme.accent);
  if(theme.accent2)r.setProperty('--accent2', theme.accent2);
  if(theme.font)   document.body.style.setProperty('font-family', theme.font);
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

// простая SVG-иконка для магазинов (единый символ, кроме Читай-города)
function brandIcon(brand){
  const svg = (path) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg','svg');
    el.setAttribute('viewBox','0 0 24 24');
    el.setAttribute('aria-hidden','true');
    el.classList.add('icon');
    el.innerHTML = path;
    return el;
  };
  const b = (brand||'').toLowerCase();
  if (b.includes('chitai') || b.includes('gorod')) {
    return svg('<path d="M5 6h7v12H5z" fill="currentColor"/><path d="M12 6h7v12h-7z" fill="currentColor" opacity=".3"/>');
  }
  return svg('<path d="M4 4h16v16H4z" fill="currentColor" opacity=".15"/><path d="M7 7h10v2H7zm0 4h10v2H7zm0 4h6v2H7z" fill="currentColor"/>');
}

/* =======================
   СЧЁТЧИКИ через Vercel API (GitHub-backed)
   ======================= */

// 🔧 ПОДСТАВЬТЕ свой домен проекта на Vercel:
const API_BASE = window.APP_API_BASE || 'https://vk-quiz-api.vercel.app/api';

// Если API_BASE не задан, функции вернут 0/ничего — сайт не сломается
async function countGet(key){
  try{
    if(!API_BASE) return 0;
    const [slug, part] = key.split('_');
    const r = await fetch(`${API_BASE}/stats?slug=${encodeURIComponent(slug)}`, { cache:'no-store' });
    if(!r.ok) return 0;
    const j = await r.json();
    return Number(j?.[part] ?? 0);
  }catch{ return 0; }
}
async function countHit(key){
  try{
    if(!API_BASE) return 0;
    const [slug, part] = key.split('_');
    const r = await fetch(`${API_BASE}/hit`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ slug, key: part })
    });
    const j = await r.json().catch(()=>({}));
    return Number(j?.value ?? 0);
  }catch{ return 0; }
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

  const votes = {}; // {A:n, B:n, ...}
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

  async function finish(){
    // выбираем результат с максимальным количеством голосов
    let bestId = null, bestVal = -Infinity;
    for(const r of cfg.results){
      const val = votes[r.id] || 0;
      if(val > bestVal){ bestVal = val; bestId = r.id; }
    }
    const res = cfg.results.find(r => r.id === bestId) || cfg.results[0];

    // инкремент счётчиков (общий и по персонажу)
    const testKey = (qs.get('test') || 'unknown');
    countHit(`${testKey}_total`);
    countHit(`${testKey}_${res.id}`);

    // (опц.) Метрика
    track('result_view', { test:testKey, result_id: res.id, result_title: res.title||'' });

    const appEl = $('#app');
    appEl.innerHTML = '';

    // заранее посчитаем данные для "Поделиться"
    const slug = qs.get('test') || 'detroit';
    function sharePageUrlFor(resId){
      const base = location.href.replace(/[^/]+$/, ''); // папка test.html
      return new URL(`share/${slug}-${resId}.html`, base).toString();
    }
    const sharePage = sharePageUrlFor(res.id);
    const chitai = "https://www.chitai-gorod.ru/r/JeMOD?erid=2W5zFJWtunQ";
    const shareText = `${res.title} — мой результат в тесте «Какой ты персонаж Детройта?». Книга: Читай-город → ${chitai}`;

    // --- Карточка результата (без "Поделиться") ---
    const card = h('section', { class:'result' },
      res.imagePortrait16x9 ? h('img', {
        class:'rimg',
        src: res.imagePortrait16x9,
        alt: res.title,
        // анти-кроп инлайн (на случай кэша в WebView)
        style: 'object-fit:contain;height:auto;aspect-ratio:auto;max-height:78vh;background:#061f2c;border-radius:12px'
      }) : null,
      h('div', { class:'pad' },
        h('h3', {}, res.title || 'Результат'),
        res.desc ? h('p', {}, h('em', {}, res.desc)) : null,
        h('div', { class:'long' }, ...renderParagraphs(res.long)),
        h('div', { class:'actions' },
          h('a', { class:'btn', href:'index.html' }, 'В каталог'),
          h('button', { class:'btn secondary', onclick: ()=>location.reload() }, 'Пройти ещё раз')
        ),
        Array.isArray(cfg.stores) && cfg.stores.length ? h('section', { class:'stores' },
          h('h4', { class:'muted' }, 'Где почитать книгу'),
          h('div', { class:'store-grid' },
            ...cfg.stores.map(s =>
              h('a', {
                  class:'store-link',
                  href:s.url,
                  target:'_blank',
                  rel:'noopener noreferrer',
                  title:s.label,
                  onclick: () => track('click_store', {
                    test:testKey, result_id: res.id, brand: s.brand || s.label || ''
                  })
                },
                brandIcon(s.brand),
                h('span', {}, s.label)
              )
            )
          )
        ) : null
      )
    );
    appEl.append(card);

    // --- ОТДЕЛЬНАЯ секция "Поделиться" ПОД карточкой результата ---
    const shareSection = h('section', { class:'share gframe narrow' },
      h('h4', { class:'muted' }, 'Поделиться результатом'),
      h('div', { class:'share-grid' },
        h('a', {
          class:'share-link',
          href:`https://t.me/share/url?url=${encodeURIComponent(sharePage)}&text=${encodeURIComponent(shareText)}`,
          target:'_blank', rel:'noopener noreferrer',
          onclick: () => track('share', { test:testKey, result_id: res.id, network: 'telegram' })
        }, 'Telegram'),
        h('a', {
          class:'share-link',
          href:`https://vk.com/share.php?url=${encodeURIComponent(sharePage)}&title=${encodeURIComponent(res.title)}`,
          target:'_blank', rel:'noopener noreferrer',
          onclick: () => track('share', { test:testKey, result_id: res.id, network: 'vk' })
        }, 'ВКонтакте'),
        h('a', {
          class:'share-link',
          href:`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(sharePage)}`,
          target:'_blank', rel:'noopener noreferrer',
          onclick: () => track('share', { test:testKey, result_id: res.id, network: 'x' })
        }, 'X (Twitter)')
      )
    );
    appEl.append(shareSection);
  }

  // показываем первый вопрос
  renderQuestion();
}

// ===== стартовая страница теста + счётчики =====
async function initTest(){
  const app = $('#app');
  const slug = qs.get('test');
  if(!slug){ location.href = 'index.html'; return; }
  try{
    const cfg = await fetchJSON(`data/${slug}.json`);
    applyTheme(cfg.theme);

    app.innerHTML = '';

    // место под строку статистики
    const infoCounts = h('div', { class:'small muted', id:'stats-line' }, '');

    const start = h('section', { class:'cover' },
      cfg.coverFull ? h('img', { class:'img', src: cfg.coverFull, alt: cfg.title }) : null,
      h('div', { class:'pad' },
        h('h2', {}, cfg.title || 'Тест'),
        cfg.subtitle ? h('p', { class:'muted' }, cfg.subtitle) : null,
        h('div', { class:'actions' },
          h('button', { class:'btn', onclick: ()=> startQuiz(cfg) }, 'Начать'),
          h('a', { class:'btn secondary', href:'index.html' }, 'Назад')
        ),
        h('div', { class:'small muted' }, 'Результат покажем только в конце'),
        infoCounts
      )
    );
    app.append(start);

    // Запрашиваем текущие значения счётчиков и выводим
    (async ()=>{
      try{
        const total = await countGet(`${slug}_total`);
        const [A,B,C,D,E] = await Promise.all([
          countGet(`${slug}_A`), // Юрис
          countGet(`${slug}_B`), // Лара
          countGet(`${slug}_C`), // Файдз
          countGet(`${slug}_D`), // Пако
          countGet(`${slug}_E`)  // Раттана
        ]);
        const n = (x)=> (typeof x==='number' ? x : 0);
        infoCounts.textContent =
          `Тест прошли: ${n(total)} раз. ` +
          `Из них: Юрис ${n(A)}, Лара ${n(B)}, Файдз ${n(C)}, Раттана ${n(E)}, Пако ${n(D)}.`;
      }catch{
        infoCounts.style.display='none';
      }
    })();

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
