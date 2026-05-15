/* ============================================================
   MOZZAFIATO — Carrito de Pedido
   Persiste en localStorage, se borra solo manualmente
   ============================================================ */

const STORAGE_KEY = 'mozzafiato_pedido';

/* ── Helpers ── */
function getCart() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

function addItem(name) {
  const cart = getCart();
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ name, qty: 1 });
  }
  saveCart(cart);
  updateBadge();
  showAddedFeedback(name);
}

function removeItem(name) {
  const cart = getCart().filter(i => i.name !== name);
  saveCart(cart);
  renderPanel();
  updateBadge();
}

function changeQty(name, delta) {
  const cart = getCart();
  const item = cart.find(i => i.name === name);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    const idx = cart.indexOf(item);
    cart.splice(idx, 1);
  }
  saveCart(cart);
  renderPanel();
  updateBadge();
}

function clearCart() {
  localStorage.removeItem(STORAGE_KEY);
  renderPanel();
  updateBadge();
}

function totalItems() {
  return getCart().reduce((s, i) => s + i.qty, 0);
}

/* ── Badge ── */
function updateBadge() {
  const badge = document.getElementById('carrito-badge');
  if (!badge) return;
  const n = totalItems();
  badge.textContent = n;
  badge.style.display = n > 0 ? 'flex' : 'none';
}

/* ── Feedback al agregar ── */
function showAddedFeedback(name) {
  const fb = document.getElementById('carrito-feedback');
  if (!fb) return;
  fb.textContent = '+ ' + name;
  fb.classList.add('visible');
  clearTimeout(fb._timer);
  fb._timer = setTimeout(() => fb.classList.remove('visible'), 1800);
}

/* ── Panel render ── */
function renderPanel() {
  const body = document.getElementById('carrito-body');
  const empty = document.getElementById('carrito-empty');
  const actions = document.getElementById('carrito-actions');
  if (!body) return;

  const cart = getCart();
  body.innerHTML = '';

  if (cart.length === 0) {
    empty.style.display = 'block';
    actions.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  actions.style.display = 'flex';

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'carrito-row';
    row.innerHTML = `
      <div class="carrito-row-name">${item.name}</div>
      <div class="carrito-row-controls">
        <button class="carrito-qty-btn" onclick="changeQty('${item.name.replace(/'/g,"\\'")}', -1)">−</button>
        <span class="carrito-qty">${item.qty}</span>
        <button class="carrito-qty-btn" onclick="changeQty('${item.name.replace(/'/g,"\\'")}', 1)">+</button>
        <button class="carrito-remove" onclick="removeItem('${item.name.replace(/'/g,"\\'")}')">✕</button>
      </div>
    `;
    body.appendChild(row);
  });
}

/* ── WhatsApp share with name prompt ── */
function shareWhatsApp() {
  const cart = getCart();
  if (cart.length === 0) return;

  // Show name prompt modal
  const existing = document.getElementById('wa-name-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'wa-name-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:600;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);animation:lbFadeIn .2s ease';
  modal.innerHTML = `
    <div class="tisana-picker-box" style="width:310px">
      <p class="tisana-picker-title">Tu pedido</p>
      <p class="tisana-picker-sub">¿Cuál es tu nombre?</p>
      <input id="wa-name-input" type="text" placeholder="Ej: Gustavo Díaz"
        style="width:100%;padding:10px 14px;border:1px solid rgba(139,122,82,.35);background:transparent;
               font-family:'Baskerville','Baskerville Old Face',Georgia,serif;font-style:italic;
               font-size:.95rem;color:var(--gold-dark);outline:none;margin-bottom:14px;"
        onkeydown="if(event.key==='Enter') sendWA()">
      <div class="pasta-step-nav">
        <button onclick="document.getElementById('wa-name-modal').remove()">Cancelar</button>
        <button class="primary" onclick="sendWA()">Enviar por WhatsApp</button>
      </div>
    </div>`;
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('wa-name-input')?.focus(), 100);
}

function sendWA() {
  const cart = getCart();
  const nameInput = document.getElementById('wa-name-input');
  const name = nameInput?.value?.trim() || 'un cliente';
  document.getElementById('wa-name-modal')?.remove();

  let msg = `Hola, soy *${name}*. Les envío mi pedido desde el menú digital Mozzafiato:\n\n`;
  cart.forEach(item => { msg += `• ${item.qty}x ${item.name}\n`; });
  msg += `\nEspero su confirmación. ¡Gracias! 🙏`;

  window.open('https://wa.me/529984088897?text=' + encodeURIComponent(msg), '_blank');
}

/* ── Open / Close panel ── */
function openCarrito() {
  renderPanel();
  document.getElementById('carrito-panel').classList.add('open');
  document.getElementById('carrito-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCarrito() {
  document.getElementById('carrito-panel').classList.remove('open');
  document.getElementById('carrito-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Inject + buttons next to every dish name ── */
function injectAddButtons() {
  document.querySelectorAll('.dish-name').forEach(el => {
    if (el.querySelector('.add-btn')) return;
    const rawName = el.childNodes[0]?.textContent?.trim().replace(/\.$/, '');
    if (!rawName || rawName.length < 3) return;

    const categoria = el.dataset.categoria || el.closest('[data-categoria]')?.dataset.categoria || '';

    // Waffle/Hotcake dulce — show type picker
    if (el.dataset.waffleDulce) {
      const btn = makeBtn('Agregar ' + rawName);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showWafflePicker(el.dataset.waffleDulce);
      });
      el.appendChild(btn);
      return;
    }

    const fullName = categoria ? categoria + ' · ' + rawName : rawName;
    const btn = makeBtn('Agregar ' + fullName);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Tisana type picker
      if (categoria === 'Tisana') { showTisanaPicker(rawName); return; }
      addItem(fullName);
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 400);
    });
    el.appendChild(btn);
  });

  /* ── Latte picker (data-latte-sabor) ── */
  document.querySelectorAll('[data-latte-sabor]').forEach(el => {
    if (el.querySelector('.add-btn')) return;
    const sabor = el.dataset.latteSabor;
    const btn = makeBtn('Agregar Latte · ' + sabor);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showLattePicker(sabor);
    });
    el.appendChild(btn);
  });

  /* ── Postre-name elements ── */
  document.querySelectorAll('.postre-name[data-bev-item]').forEach(el => {
    if (el.querySelector('.add-btn')) return;
    const fullName = el.dataset.bevItem;
    const btn = makeBtn('Agregar ' + fullName);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addItem(fullName);
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 400);
    });
    el.appendChild(btn);
  });

  /* ── Generic bev-item elements ── */
  document.querySelectorAll('[data-bev-item]:not(.postre-name)').forEach(el => {
    if (el.querySelector('.add-btn')) return;
    const fullName = el.dataset.bevItem;
    if (!fullName) return;
    const btn = makeBtn('Agregar ' + fullName);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addItem(fullName);
      btn.classList.add('added');
      setTimeout(() => btn.classList.remove('added'), 400);
    });
    el.appendChild(btn);
  });

  /* ── Tisana type-picker override ── */
  document.querySelectorAll('.dish-name[data-categoria="Tisana"]').forEach(el => {
    const addBtn = el.querySelector('.add-btn');
    if (!addBtn) return;
    const rawName = el.childNodes[0]?.textContent?.trim().replace(/\.$/, '');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showTisanaPicker(rawName);
    }, true);
  });
}

function makeBtn(label) {
  const btn = document.createElement('button');
  btn.className = 'add-btn';
  btn.setAttribute('aria-label', label);
  btn.innerHTML = '+';
  return btn;
}

/* ── Pasta 3-step modal ── */
const PASTA_SALSAS = [
  { name: 'Alfredo',      desc: 'Salsa blanca cremosa con vino blanco, queso parmesano y albahaca.',                                    precio: 185 },
  { name: 'Amatriciana',  desc: 'Concasse de tomate, chile guindilla, tocino crujiente y cherrys salteados con parmesano.',             precio: 175 },
  { name: 'Boloñesa',     desc: 'Cocción lenta de carne molida mixta en jugo de tomate fresco con ralladura de parmesano.',             precio: 210 },
  { name: 'Vegetariana',  desc: 'Pesto cremoso con vegetales salteados, pimientos, calabaza, zanahoria, brócoli y champiñones.',        precio: 196 },
  { name: 'Cuatro Quesos',desc: 'Salsa cremosa de mozarella, cheddar, holandés de gallo y parmesano.',                                  precio: 175 },
  { name: 'Carbonara',    desc: 'Cebollas, tocino crujiente y ajo con salsa bechamel, parmesano y perejil.',                            precio: 175 },
  { name: 'Portobello',   desc: 'Salsa cremosa de la casa con champiñones portobello, parmesano y vino blanco.',                        precio: 175 },
];

function showPastaModal() {
  const existing = document.getElementById('pasta-modal');
  if (existing) existing.remove();

  const state = { tipo: null, salsa: null, proteina: null };

  const modal = document.createElement('div');
  modal.id = 'pasta-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);animation:lbFadeIn .2s ease';

  function render(step) {
    const summary = [state.tipo, state.salsa].filter(Boolean).join(' · ');
    const dots = [1,2,3].map((i,idx) => `<div class="pasta-progress-dot${idx < step ? ' active' : ''}"></div>`).join('');

    let content = '';

    if (step === 1) {
      content = `
        <p class="tisana-picker-title">Arma tu pasta</p>
        <p class="tisana-picker-sub">Paso 1 — Elige el tipo de pasta</p>
        <div class="pasta-progress">${dots}</div>
        <div class="pasta-options-list">
          ${['Fetuccini','Fusilli'].map(t => `
            <button class="pasta-option-btn${state.tipo===t?' selected':''}" onclick="pastaSelect(1,'${t}')">
              <span class="opt-name">${t}</span>
            </button>`).join('')}
        </div>
        <div class="pasta-step-nav">
          <button onclick="document.getElementById('pasta-modal').remove()">Cancelar</button>
          <button class="primary" onclick="pastaNext(2)" ${!state.tipo?'disabled':''}>Siguiente →</button>
        </div>`;
    }

    if (step === 2) {
      content = `
        <p class="tisana-picker-title">${state.tipo}</p>
        <p class="tisana-picker-sub">Paso 2 — Elige la salsa</p>
        <div class="pasta-progress">${dots}</div>
        <p class="pasta-summary">${summary}</p>
        <div class="pasta-options-list">
          ${PASTA_SALSAS.map(s => `
            <button class="pasta-option-btn${state.salsa===s.name?' selected':''}" onclick="pastaSelect(2,'${s.name}')">
              <span class="opt-name">${s.name} <span style="font-weight:normal;font-size:.8rem;color:var(--gold)">$${s.precio}</span></span>
              <span class="opt-desc">${s.desc}</span>
            </button>`).join('')}
        </div>
        <div class="pasta-step-nav">
          <button onclick="pastaNext(1)">← Atrás</button>
          <button class="primary" onclick="pastaNext(3)" ${!state.salsa?'disabled':''}>Siguiente →</button>
        </div>`;
    }

    if (step === 3) {
      content = `
        <p class="tisana-picker-title">${state.tipo} · ${state.salsa}</p>
        <p class="tisana-picker-sub">Paso 3 — Proteína (opcional)</p>
        <div class="pasta-progress">${dots}</div>
        <p class="pasta-summary">${summary}</p>
        <div class="pasta-options-list">
          ${[
            { name: 'Sin proteína', note: '' },
            { name: 'Pechuga de pollo', note: '+$60' },
            { name: 'Arrachera', note: '+$70' },
            { name: 'Camarón', note: '+$90' },
          ].map(p => `
            <button class="pasta-option-btn${state.proteina===p.name?' selected':''}" onclick="pastaSelect(3,'${p.name.replace(/'/g,"\\'")}')">
              <span class="opt-name">${p.name} ${p.note ? `<span style="font-weight:normal;font-size:.8rem;color:var(--gold)">${p.note}</span>` : ''}</span>
            </button>`).join('')}
        </div>
        <div class="pasta-step-nav">
          <button onclick="pastaNext(2)">← Atrás</button>
          <button class="primary" onclick="pastaConfirm()" ${!state.proteina?'disabled':''}>Agregar al pedido</button>
        </div>`;
    }

    modal.innerHTML = `<div class="tisana-picker-box" style="max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">${content}</div>`;

    // Re-bind functions to modal state
    modal._state = state;
    modal._step  = step;
  }

  window.pastaSelect = (step, value) => {
    const s = document.getElementById('pasta-modal')?._state;
    if (!s) return;
    if (step === 1) s.tipo = value;
    if (step === 2) s.salsa = value;
    if (step === 3) s.proteina = value;
    render(step);
  };
  window.pastaNext = (step) => {
    render(step);
  };
  window.pastaConfirm = () => {
    const s = document.getElementById('pasta-modal')?._state;
    if (!s) return;
    const fullName = s.proteina === 'Sin proteína'
      ? s.tipo + ' · ' + s.salsa
      : s.tipo + ' · ' + s.salsa + ' con ' + s.proteina;
    addItem(fullName);
    document.getElementById('pasta-modal').remove();
  };

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  render(1);
}

function showFeedback(msg) {
  const fb = document.getElementById('carrito-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.classList.add('visible');
  clearTimeout(fb._timer);
  fb._timer = setTimeout(() => fb.classList.remove('visible'), 2500);
}


/* ── Latte/Cappuccino two-step picker ── */
function showLattePicker(sabor) {
  showGenericPicker({
    title: sabor,
    sub: '¿Tipo de bebida?',
    options: ['Cappuccino', 'Latte'],
    onSelect: (tipo) => {
      showGenericPicker({
        title: tipo + ' · ' + sabor,
        sub: '¿Qué tamaño?',
        options: [{ label: 'Mediano', note: '$85' }, { label: 'Grande', note: '$89' }],
        onSelect: (tam) => addItem(tipo + ' ' + tam + ' · ' + sabor),
      });
    },
  });
}

/* ── Waffle / Hotcake picker ── */
function showWafflePicker(sabor) {
  showGenericPicker({
    title: sabor,
    sub: '¿Waffle o Hotcake?',
    options: ['Waffle', 'Hotcake'],
    onSelect: (tipo) => addItem(tipo + ' · ' + sabor),
  });
}

/* ── Generic two-step picker ── */
function showGenericPicker({ title, sub, options, onSelect }) {
  const existing = document.getElementById('generic-picker');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'generic-picker';

  const btns = options.map(opt => {
    const label = typeof opt === 'string' ? opt : opt.label;
    const note  = typeof opt === 'string' ? ''  : opt.note;
    return `<button onclick="genericPickerSelect('${label.replace(/'/g,"\\'")}')">
      ${label}${note ? `<br><span>${note}</span>` : ''}
    </button>`;
  }).join('');

  modal.innerHTML = `
    <div class="tisana-picker-box">
      <p class="tisana-picker-title">${title}</p>
      <p class="tisana-picker-sub">${sub}</p>
      <div class="tisana-picker-btns">${btns}</div>
      <button class="tisana-picker-cancel" onclick="document.getElementById('generic-picker').remove()">Cancelar</button>
    </div>`;

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  modal._onSelect = onSelect;
  document.body.appendChild(modal);
}

function genericPickerSelect(value) {
  const modal = document.getElementById('generic-picker');
  const cb = modal?._onSelect;
  modal?.remove();
  if (cb) cb(value);
}

/* ── Tisana type picker ── */
function showTisanaPicker(sabor) {
  showGenericPicker({
    title: sabor,
    sub: '¿En qué presentación?',
    options: [
      { label: 'Caliente', note: '$99'  },
      { label: 'Fría',     note: '$105' },
      { label: 'Smoothie', note: '$115' },
    ],
    onSelect: (tipo) => addItem('Tisana ' + tipo + ' · ' + sabor),
  });
}

function chooseTisana(tipo, sabor) {
  addItem(tipo + ' · ' + sabor);
  document.getElementById('tisana-picker')?.remove();
}

/* ── Build DOM ── */
function buildCartDOM() {
  /* Floating button - top right */
  const fab = document.createElement('button');
  fab.id = 'carrito-fab';
  fab.setAttribute('aria-label', 'Ver pedido');
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
    <span id="carrito-badge" style="display:none">0</span>
  `;
  fab.addEventListener('click', openCarrito);
  document.body.appendChild(fab);

  /* Feedback toast */
  const fb = document.createElement('div');
  fb.id = 'carrito-feedback';
  document.body.appendChild(fb);

  /* Overlay */
  const overlay = document.createElement('div');
  overlay.id = 'carrito-overlay';
  overlay.addEventListener('click', closeCarrito);
  document.body.appendChild(overlay);

  /* Panel */
  const panel = document.createElement('div');
  panel.id = 'carrito-panel';
  panel.innerHTML = `
    <div class="carrito-header">
      <img src="images/logo.png" class="carrito-logo" alt="Mozzafiato" onerror="this.style.display='none'">
      <div class="carrito-title">Mi Pedido</div>
      <button class="carrito-close" onclick="closeCarrito()">✕</button>
    </div>
    <div id="carrito-empty" class="carrito-empty">
      <p>Tu pedido está vacío.<br>Toca <strong>+</strong> junto a cualquier platillo para agregarlo.</p>
    </div>
    <div id="carrito-body" class="carrito-body"></div>
    <div id="carrito-actions" class="carrito-actions" style="display:none">
      <button class="carrito-btn-wa" onclick="shareWhatsApp()">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        Compartir pedido
      </button>
      <button class="carrito-btn-clear" onclick="if(confirm('¿Limpiar todo el pedido?')) clearCart()">
        Limpiar pedido
      </button>
    </div>
  `;
  document.body.appendChild(panel);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  buildCartDOM();
  injectAddButtons();
  updateBadge();
});
