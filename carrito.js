/* ============================================================
   MOZZAFIATO — Carrito de Pedido
   Persiste en localStorage, se borra solo manualmente
   ============================================================ */

const STORAGE_KEY    = 'mozzafiato_pedido';
const MODE_KEY       = 'mozzafiato_mode';      // 'active' when + buttons shown
const TUTORIAL_KEY   = 'mozzafiato_tutorial';  // 'seen' after first view

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
  // Keep panel open after removing item
  document.getElementById('carrito-panel')?.classList.add('open');
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
  // Keep panel open after changing qty
  document.getElementById('carrito-panel')?.classList.add('open');
}

function clearCart() {
  localStorage.removeItem(STORAGE_KEY);
  renderPanel();
  updateBadge();
  document.getElementById('carrito-panel')?.classList.add('open');
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

  /* Bounce the FAB icon on every update */
  const fab = document.getElementById('carrito-fab');
  if (!fab || n === 0) return;
  fab.classList.remove('fab-bounce');
  void fab.offsetWidth; /* force reflow to restart animation */
  fab.classList.add('fab-bounce');
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
        <button class="carrito-qty-btn" onclick="event.stopPropagation();changeQty('${item.name.replace(/'/g,"\\'")}', -1)">−</button>
        <span class="carrito-qty">${item.qty}</span>
        <button class="carrito-qty-btn" onclick="event.stopPropagation();changeQty('${item.name.replace(/'/g,"\\'")}', 1)">+</button>
        <button class="carrito-remove" onclick="event.stopPropagation();removeItem('${item.name.replace(/'/g,"\\'")}')">✕</button>
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

/* ── Active mode (+ buttons visible) ── */
function isActiveMode() {
  return localStorage.getItem(MODE_KEY) === 'active';
}

function toggleMode() {
  const active = isActiveMode();
  if (active) {
    localStorage.removeItem(MODE_KEY);
    document.body.classList.remove('carrito-active');
  } else {
    localStorage.setItem(MODE_KEY, 'active');
    document.body.classList.add('carrito-active');
    // Brief cascade animation to show + buttons
    document.querySelectorAll('.add-btn').forEach((btn, i) => {
      setTimeout(() => {
        btn.classList.add('added');
        setTimeout(() => btn.classList.remove('added'), 400);
      }, i * 14);
    });
  }
  updateToggleUI();
}

function updateToggleUI() {
  const fab    = document.getElementById('mode-fab');
  const label  = document.getElementById('mode-fab-label');
  const svg    = document.getElementById('mode-fab-svg');
  if (!fab) return;
  const active = isActiveMode();
  fab.classList.toggle('mode-active', active);
  if (label) label.textContent = active ? 'Modo activo' : 'Modo pedido';
  if (svg) {
    svg.setAttribute('stroke', active ? '#ede8dc' : '#8b7a52');
    svg.innerHTML = active
      ? '<path d="M20 6L9 17l-5-5"/>'   /* checkmark when active */
      : '<path d="M12 5v14M5 12h14"/>'; /* plus when inactive */
  }
}

/* ── Open / Close panel ── */
function openCarrito() {
  renderPanel();
  updateToggleUI();
  document.getElementById('carrito-panel').classList.add('open');
  document.body.style.overflow = '';
  // Delay listener so the opening click doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('click', outsideCarritoClick);
  }, 200);
}

function outsideCarritoClick(e) {
  const panel = document.getElementById('carrito-panel');
  const fab   = document.getElementById('carrito-fab');
  if (panel?.contains(e.target)) return;
  if (fab?.contains(e.target)) return;
  closeCarrito();
}

function closeCarrito() {
  document.getElementById('carrito-panel').classList.remove('open');
  document.getElementById('carrito-overlay').classList.remove('open');
  document.body.style.overflow = '';
  document.removeEventListener('click', outsideCarritoClick);
}


/* ── Inject + buttons next to every dish name ── */
function injectAddButtons() {
  document.querySelectorAll('.dish-name:not(.no-add)').forEach(el => {
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

  /* ── Desayuno americano picker ── */
  document.querySelectorAll('[data-americano]').forEach(el => {
    if (el.querySelector('.add-btn')) return;
    const btn = makeBtn('Personalizar Desayuno americano');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showAmericanoPicker();
    });
    el.appendChild(btn);
  });

  /* ── Agua fresca picker (data-agua-sabor) ── */
  document.querySelectorAll('[data-agua-sabor]').forEach(el => {
    if (el.querySelector('.add-btn')) return;
    const sabor = el.dataset.aguaSabor;
    const btn = makeBtn('Agregar Agua · ' + sabor);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showGenericPicker({
        title: sabor,
        sub: '¿Con qué agua?',
        options: [
          { label: 'Agua natural',  note: '$79' },
          { label: 'Agua mineral',  note: '$89' },
        ],
        onSelect: (tipo) => addItem('Agua Fresca ' + tipo + ' · ' + sabor),
      });
    });
    el.appendChild(btn);
  });

  /* ── Extra items and price-row (page10) ── */
  document.querySelectorAll('.extra-item, .price-row').forEach(el => {
    if (el.querySelector('.add-btn')) return;
    if (el.dataset.bevItem) return;
    const nameEl = el.querySelector('span') || el.querySelector('strong');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    if (!name || name.length < 3) return;
    const categoria = nameEl.dataset.categoria || '';
    const fullName = categoria ? categoria + ' · ' + name : name;
    const btn = makeBtn('Agregar ' + fullName);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
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
    if (step === 1) { s.tipo = value;     setTimeout(() => render(2), 180); }
    if (step === 2) { s.salsa = value;    setTimeout(() => render(3), 180); }
    if (step === 3) { s.proteina = value; setTimeout(() => window.pastaConfirm(), 180); }
    render(step); // re-render current step to show selection highlight first
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


/* ── Desayuno americano picker ── */
function showAmericanoPicker() {
  const existing = document.getElementById('americano-modal');
  if (existing) existing.remove();

  const state = { ingrediente: null, bebida: null };

  const modal = document.createElement('div');
  modal.id = 'americano-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);animation:lbFadeIn .2s ease';

  function render() {
    const ingredientes = ['Jamón','Tocino','Champiñones','Pimientos','Chorizo','Espinaca'];
    const bebidas      = ['Jugo de naranja','Fruta con granola y yogurt griego'];
    const canConfirm   = state.ingrediente && state.bebida;

    modal.innerHTML = `
      <div class="tisana-picker-box" style="max-width:340px;width:92%">
        <p class="tisana-picker-title">Desayuno americano</p>
        <p class="tisana-picker-sub">Personaliza tu pedido</p>

        <p style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:.82rem;color:var(--gold-dark);margin:0 0 8px">Ingrediente del huevo</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px">
          ${ingredientes.map(i => `
            <button onclick="americanoSelect('ingrediente','${i}')"
              style="padding:8px 6px;border:1px solid rgba(139,122,82,${state.ingrediente===i?'.8':'.25'});
              background:${state.ingrediente===i?'var(--gold-dark)':'transparent'};
              color:${state.ingrediente===i?'var(--footer-text)':'var(--gold-dark)'};
              font-family:'Baskerville','Baskerville Old Face',Georgia,serif;
              font-style:italic;font-size:.85rem;cursor:pointer;transition:all .2s">
              ${i}
            </button>`).join('')}
        </div>

        <p style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:.82rem;color:var(--gold-dark);margin:0 0 8px">Acompañamiento</p>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px">
          ${bebidas.map(b => `
            <button onclick="americanoSelect('bebida','${b.replace(/'/g,"\\'")}')"
              style="padding:9px 12px;border:1px solid rgba(139,122,82,${state.bebida===b?'.8':'.25'});
              background:${state.bebida===b?'var(--gold-dark)':'transparent'};
              color:${state.bebida===b?'var(--footer-text)':'var(--gold-dark)'};
              font-family:'Baskerville','Baskerville Old Face',Georgia,serif;
              font-style:italic;font-size:.85rem;cursor:pointer;text-align:left;transition:all .2s">
              ${b}
            </button>`).join('')}
        </div>

        <div class="pasta-step-nav">
          <button onclick="document.getElementById('americano-modal').remove()">Cancelar</button>
          <button class="primary" onclick="americanoConfirm()" ${canConfirm?'':'disabled'}>Agregar al pedido</button>
        </div>
      </div>`;

    modal._state = state;
  }

  window.americanoSelect = (campo, valor) => {
    const s = document.getElementById('americano-modal')?._state;
    if (!s) return;
    s[campo] = valor;
    render();
  };

  window.americanoConfirm = () => {
    const s = document.getElementById('americano-modal')?._state;
    if (!s || !s.ingrediente || !s.bebida) return;
    const fullName = `Paquete · Desayuno americano con ${s.ingrediente} y ${s.bebida}`;
    addItem(fullName);
    document.getElementById('americano-modal').remove();
  };

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  render();
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

/* ── Tutorial spotlight ── */
/* ── Tutorial — two sequential tooltips ── */
let _tt1Timer = null;
let _tt2Timer = null;

function buildTutorial() {
  if (localStorage.getItem(TUTORIAL_KEY) !== 'seen') {
    setTimeout(() => startTutorial(), 900);
  }
}

function startTutorial() {
  clearTimeout(_tt1Timer);
  clearTimeout(_tt2Timer);
  removeTutorialTooltips();
  showTT1();
}

function removeTutorialTooltips() {
  document.getElementById('tut-tt1')?.remove();
  document.getElementById('tut-tt2')?.remove();
}

function showTT1() {
  removeTutorialTooltips();
  const target = document.getElementById('mode-fab');
  if (!target) { showTT2(); return; }
  const rect = target.getBoundingClientRect();
  const right = window.innerWidth - rect.right + rect.width / 2 - 20;

  const tt = document.createElement('div');
  tt.id = 'tut-tt1';
  tt.style.cssText = `
    position:fixed;
    top:${rect.bottom + 10}px;
    right:${Math.max(right - 80, 8)}px;
    width:210px;
    background:#3a3020;
    border-radius:8px;
    padding:10px 12px;
    z-index:400;
    animation:tutSlideIn .3s ease;
    box-shadow:0 4px 20px rgba(0,0,0,.25);
  `;
  tt.innerHTML = `
    <div style="position:absolute;top:-5px;right:28px;width:9px;height:9px;background:#3a3020;transform:rotate(45deg)"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
      <div>
        <p style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:.85rem;font-weight:600;color:#ede8dc;margin:0 0 4px">Anota tu pedido</p>
        <p style="font-family:'Baskerville','Baskerville Old Face',Georgia,serif;font-size:.78rem;color:#c4ad82;margin:0;line-height:1.5">Activa este botón para agregar platillos a tu lista mientras esperas al mesero.</p>
      </div>
      <button onclick="closeTTAll()" style="background:none;border:none;color:#c4ad82;cursor:pointer;font-size:14px;padding:0;flex-shrink:0;line-height:1">✕</button>
    </div>
    <div style="margin-top:8px;height:2px;border-radius:2px;background:rgba(196,173,130,.2);overflow:hidden">
      <div id="tut-bar1" style="height:100%;width:0%;background:#c4ad82;border-radius:2px"></div>
    </div>
  `;
  document.body.appendChild(tt);
  requestAnimationFrame(() => {
    const bar = document.getElementById('tut-bar1');
    if (bar) { bar.style.transition = 'width 5s linear'; bar.style.width = '100%'; }
  });

  _tt1Timer = setTimeout(() => {
    tt.style.opacity = '0';
    tt.style.transition = 'opacity .3s';
    setTimeout(() => { tt.remove(); showTT2(); }, 320);
  }, 5000);
}

function showTT2() {
  removeTutorialTooltips();
  const target = document.getElementById('carrito-fab');
  if (!target) { closeTTAll(); return; }
  const rect = target.getBoundingClientRect();
  const right = window.innerWidth - rect.right + rect.width / 2 - 22;

  const tt = document.createElement('div');
  tt.id = 'tut-tt2';
  tt.style.cssText = `
    position:fixed;
    top:${rect.bottom + 10}px;
    right:${Math.max(right - 90, 8)}px;
    width:210px;
    background:var(--bg);
    border:1px solid rgba(139,122,82,.3);
    border-radius:8px;
    padding:10px 12px;
    z-index:400;
    animation:tutSlideIn .3s ease;
    box-shadow:0 4px 20px rgba(0,0,0,.15);
  `;
  tt.innerHTML = `
    <div style="position:absolute;top:-6px;right:16px;width:9px;height:9px;background:var(--bg);border-left:1px solid rgba(139,122,82,.3);border-top:1px solid rgba(139,122,82,.3);transform:rotate(45deg)"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
      <div>
        <p style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:.85rem;font-weight:600;color:var(--gold-dark);margin:0 0 4px">Ver y compartir pedido</p>
        <p style="font-family:'Baskerville','Baskerville Old Face',Georgia,serif;font-size:.78rem;color:var(--text-soft);margin:0;line-height:1.5">Revisa tu lista y envíala por WhatsApp para hacer tu pedido en línea.</p>
      </div>
      <button onclick="closeTTAll()" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:14px;padding:0;flex-shrink:0;line-height:1">✕</button>
    </div>
    <div style="margin-top:8px;height:2px;border-radius:2px;background:rgba(139,122,82,.15);overflow:hidden">
      <div id="tut-bar2" style="height:100%;width:0%;background:#8b7a52;border-radius:2px"></div>
    </div>
  `;
  document.body.appendChild(tt);
  requestAnimationFrame(() => {
    const bar = document.getElementById('tut-bar2');
    if (bar) { bar.style.transition = 'width 5s linear'; bar.style.width = '100%'; }
  });

  _tt2Timer = setTimeout(() => {
    tt.style.opacity = '0';
    tt.style.transition = 'opacity .3s';
    setTimeout(() => { tt.remove(); localStorage.setItem(TUTORIAL_KEY, 'seen'); }, 320);
  }, 5000);
}

function closeTTAll() {
  clearTimeout(_tt1Timer);
  clearTimeout(_tt2Timer);
  removeTutorialTooltips();
  localStorage.setItem(TUTORIAL_KEY, 'seen');
}

function showTutorial() { startTutorial(); }


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
      <p>Tu pedido está vacío.<br>Activa el <strong>Modo pedido</strong> y toca <strong>+</strong> junto a cualquier platillo.</p>
    </div>
    <div id="carrito-body" class="carrito-body"></div>
    <div id="carrito-actions" class="carrito-actions" style="display:none">
      <button class="carrito-btn-wa" onclick="event.stopPropagation();shareWhatsApp()">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        Compartir pedido
      </button>
      <button class="carrito-btn-clear" onclick="event.stopPropagation();if(confirm('¿Limpiar todo el pedido?')) clearCart()">
        Limpiar pedido
      </button>
    </div>
  `;
  /* Floating mode toggle button */
  const modeBtn = document.createElement('div');
  modeBtn.id = 'mode-fab';
  modeBtn.setAttribute('role', 'button');
  modeBtn.setAttribute('aria-label', 'Modo pedido');
  modeBtn.innerHTML = `
    <div id="mode-fab-circle">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b7a52" stroke-width="2.5" stroke-linecap="round" id="mode-fab-svg"><path d="M12 5v14M5 12h14"/></svg>
    </div>
    <span id="mode-fab-label">Modo pedido</span>
  `;
  modeBtn.addEventListener('click', toggleMode);
  document.body.appendChild(modeBtn);

  /* Tutorial play button */
  const playBtn = document.createElement('div');
  playBtn.id = 'tutorial-play-btn';
  playBtn.setAttribute('role', 'button');
  playBtn.setAttribute('aria-label', 'Ver tutorial');
  playBtn.title = 'Volver a ver el mini tutorial';
  playBtn.innerHTML = `
    <div id="tutorial-play-circle">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#8b7a52" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
    </div>
    <span id="tutorial-play-label">Tutorial</span>
  `;
  playBtn.addEventListener('click', startTutorial);
  document.body.appendChild(playBtn);

  /* Hide both on index page */
  const onIndex = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
  if (onIndex) {
    modeBtn.style.display = 'none';
    playBtn.style.display = 'none';
  }

  document.body.appendChild(panel);

  /* ── Close carrito when sidebar opens ── */
  document.querySelector('.hamburger')?.addEventListener('click', () => {
    closeCarrito();
  });

  /* ── Floating search pill ── */
  buildBuscadorPill();
}

/* ══════════════════════════════
   BUSCADOR FLOTANTE DRAGGABLE
══════════════════════════════ */
const PILL_POS_KEY    = 'mozzafiato_pill_pos';
const PILL_SEEN_KEY   = 'mozzafiato_pill_seen';

function buildBuscadorPill() {
  /* Skip floating pill on index — it has its own static search bar */
  const onIndex = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
  if (onIndex) return;

  if (typeof MENU_DATA === 'undefined') {
    const s = document.createElement('script');
    s.src = 'menu-data.js';
    document.head.appendChild(s);
  }

  const startX = window.innerWidth - 58; /* right side */
  const startY = window.innerHeight - 192; /* above play button */

  const pill = document.createElement('div');
  pill.id = 'buscador-pill';
  pill.setAttribute('aria-label', 'Abrir buscador');
  pill.style.left = startX + 'px';
  pill.style.top  = startY + 'px';
  pill.innerHTML = `
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b7a52" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;pointer-events:none"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span id="buscador-pill-text">¿Ya sabes qué ordenar? Busca aquí...</span>
  `;
  document.body.appendChild(pill);

  const panel = document.createElement('div');
  panel.id = 'buscador-panel';
  panel.innerHTML = `
    <div id="buscador-input-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="buscador-field" type="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Platillo, bebida, categoría...">
      <button id="buscador-close-btn" aria-label="Cerrar">✕</button>
    </div>
    <div id="buscador-results-list"></div>
    <div class="buscador-hint" id="buscador-hint">Ej: frappe, ensalada, huevos...</div>
  `;
  document.body.appendChild(panel);

  let panelOpen = false;
  let isDragging = false;
  let dragMoved = false;
  let dragStartX, dragStartY, pillStartX, pillStartY;

  function positionPanel() {
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';
    const pr  = pill.getBoundingClientRect();
    const pw  = panel.offsetWidth  || 320;
    const ph  = panel.offsetHeight || 160;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    panel.style.visibility = '';
    panel.style.display = '';

    const spaceAbove = pr.top - 12;
    const spaceBelow = vh - pr.bottom - 12;

    let y, pillNudge = 0;

    if (spaceAbove >= ph) {
      /* Enough space above — panel goes above pill */
      y = pr.top - ph - 8;
    } else if (spaceBelow >= ph) {
      /* Enough space below — panel goes below pill */
      y = pr.bottom + 8;
    } else {
      /* Not enough space either side — nudge pill to top, panel below header */
      pillNudge = 70;
      pill.style.transition = 'top .35s cubic-bezier(.4,0,.2,1)';
      pill.style.top = pillNudge + 'px';
      setTimeout(() => { pill.style.transition = ''; }, 380);
      y = pillNudge + pill.offsetHeight + 8;
    }

    let x = pr.left + pr.width / 2 - pw / 2;
    x = Math.max(8, Math.min(x, vw - pw - 8));
    y = Math.max(8, Math.min(y, vh - ph - 8));
    panel.style.left = x + 'px';
    panel.style.top  = y + 'px';
  }

  function openPanel() {
    panelOpen = true;
    pill.classList.add('open');
    panel.classList.add('open');
    const svg = pill.querySelector('svg');
    if (svg) svg.setAttribute('stroke', '#ede8dc');
    positionPanel();
    setTimeout(() => document.getElementById('buscador-field')?.focus(), 80);
  }

  function closePanel() {
    panelOpen = false;
    pill.classList.remove('open');
    panel.classList.remove('open');
    const svg = pill.querySelector('svg');
    if (svg) svg.setAttribute('stroke', '#8b7a52');
    const field = document.getElementById('buscador-field');
    if (field) { field.value = ''; renderBuscadorResults(''); }
  }

  /* ── Auto-reposition when panel grows (results appear) ── */
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (panelOpen) positionPanel();
    }).observe(panel);
  }

  /* Toggle on tap (not drag) */
  pill.addEventListener('click', () => {
    if (dragMoved) return;
    panelOpen ? closePanel() : openPanel();
  });

  document.getElementById('buscador-close-btn')?.addEventListener('click', closePanel);

  /* Close on outside click */
  document.addEventListener('click', (e) => {
    if (panelOpen && !pill.contains(e.target) && !panel.contains(e.target)) closePanel();
  });

  /* Search input */
  document.getElementById('buscador-field')?.addEventListener('input', (e) => {
    renderBuscadorResults(e.target.value);
  });

  /* ── Drag — mouse ── */
  pill.addEventListener('mousedown', (e) => {
    isDragging = true; dragMoved = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    const rect = pill.getBoundingClientRect();
    pillStartX = rect.left; pillStartY = rect.top;
    pill.style.left   = rect.left + 'px';
    pill.style.top    = rect.top  + 'px';
    pill.style.right  = '';
    pill.style.bottom = '';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
    if (!dragMoved) return;
    const x = Math.max(0, Math.min(pillStartX + dx, window.innerWidth  - pill.offsetWidth));
    const y = Math.max(0, Math.min(pillStartY + dy, window.innerHeight - pill.offsetHeight));
    pill.style.left = x + 'px'; pill.style.top = y + 'px';
    if (panelOpen) positionPanel();
  });
  document.addEventListener('mouseup', () => { isDragging = false; });

  /* ── Drag — touch ── */
  pill.addEventListener('touchstart', (e) => {
    isDragging = true; dragMoved = false;
    const t = e.touches[0];
    dragStartX = t.clientX; dragStartY = t.clientY;
    const rect = pill.getBoundingClientRect();
    pillStartX = rect.left; pillStartY = rect.top;
    pill.style.left   = rect.left + 'px';
    pill.style.top    = rect.top  + 'px';
    pill.style.right  = '';
    pill.style.bottom = '';
  }, { passive: true });
  pill.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartX;
    const dy = t.clientY - dragStartY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragMoved = true;
    if (!dragMoved) return;
    e.preventDefault();
    const x = Math.max(0, Math.min(pillStartX + dx, window.innerWidth  - pill.offsetWidth));
    const y = Math.max(0, Math.min(pillStartY + dy, window.innerHeight - pill.offsetHeight));
    pill.style.left = x + 'px'; pill.style.top = y + 'px';
    if (panelOpen) positionPanel();
  }, { passive: false });
  pill.addEventListener('touchend', () => { isDragging = false; });

  /* Fixed home position — right side above play/tutorial button */
  const HOME_RIGHT  = 11; /* px from right edge */
  const HOME_BOTTOM = 192; /* px from bottom — above play btn at 140px */

  pill.style.position = 'fixed';
  pill.style.right  = HOME_RIGHT + 'px';
  pill.style.bottom = HOME_BOTTOM + 'px';
  pill.style.left   = '';
  pill.style.top    = '';

  /* Always start collapsed on menu pages */
  pill.classList.add('collapsed');
  let isCollapsed = true;
  let scrollTimer = null;

  function collapsePill() {
    if (isCollapsed || panelOpen) return;
    isCollapsed = true;
    pill.classList.add('collapsed');
    /* Animate back to home position */
    pill.style.transition = 'right .4s cubic-bezier(.4,0,.2,1), bottom .4s cubic-bezier(.4,0,.2,1), left .4s cubic-bezier(.4,0,.2,1), top .4s cubic-bezier(.4,0,.2,1), width .3s cubic-bezier(.4,0,.2,1), height .3s cubic-bezier(.4,0,.2,1), border-radius .3s cubic-bezier(.4,0,.2,1), padding .3s cubic-bezier(.4,0,.2,1)';
    pill.style.right  = HOME_RIGHT + 'px';
    pill.style.bottom = HOME_BOTTOM + 'px';
    pill.style.left   = '';
    pill.style.top    = '';
    setTimeout(() => { pill.style.transition = ''; }, 420);
  }

  function expandPill() {
    if (!isCollapsed) return;
    isCollapsed = false;
    pill.classList.remove('collapsed');
  }

  window.addEventListener('scroll', () => {
    if (panelOpen) return;
    collapsePill();
    clearTimeout(scrollTimer);
  }, { passive: true });

  /* Tap to expand when collapsed, open panel when expanded */
  pill.addEventListener('click', () => {
    if (dragMoved) return;
    if (isCollapsed) {
      expandPill();
    } else {
      panelOpen ? closePanel() : openPanel();
    }
  });

  /* Close panel and collapse when clicking outside */
  document.addEventListener('click', (e) => {
    if (!pill.contains(e.target) && !panel.contains(e.target)) {
      if (panelOpen) closePanel();
      if (!isCollapsed) setTimeout(collapsePill, 300);
    }
  });
  if (localStorage.getItem(PILL_SEEN_KEY) !== 'seen') {
    localStorage.setItem(PILL_SEEN_KEY, 'seen');
    setTimeout(() => {
      pill.style.transition = 'transform .15s ease, box-shadow .15s ease';
      let count = 0;
      const bounce = setInterval(() => {
        count++;
        pill.style.transform = count % 2 === 1
          ? 'scale(1.08) translateY(-4px)'
          : 'scale(1) translateY(0)';
        pill.style.boxShadow = count % 2 === 1
          ? '0 8px 28px rgba(94,79,48,.45)'
          : '0 3px 16px rgba(0,0,0,.15)';
        if (count >= 6) {
          clearInterval(bounce);
          pill.style.transform = '';
          pill.style.boxShadow = '';
          setTimeout(() => { pill.style.transition = ''; }, 200);
        }
      }, 220);
    }, 1200);
  }
}

function renderBuscadorResults(query) {
  const list = document.getElementById('buscador-results-list');
  const hint = document.getElementById('buscador-hint');
  if (!list) return;
  if (!query || !query.trim()) {
    list.innerHTML = '';
    if (hint) hint.style.display = 'block';
    return;
  }
  if (hint) hint.style.display = 'none';
  if (typeof MENU_DATA === 'undefined') {
    list.innerHTML = '<div class="buscador-hint">Cargando...</div>';
    return;
  }
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'');
  const results = MENU_DATA.filter(item =>
    [item.name, item.cat].some(s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').includes(q))
  ).slice(0, 5);
  if (!results.length) {
    list.innerHTML = '<div class="buscador-hint">Sin resultados</div>';
    return;
  }
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  list.innerHTML = results.map(item => {
    const isPicker = item.type === 'picker';
    const highlighted = item.name.replace(re, '<mark>$1</mark>');
    return `
      <div class="buscador-row" onclick="buscadorGoTo('${item.page}')">
        <div class="buscador-row-info">
          <span class="buscador-row-name">${highlighted}</span>
          <span class="buscador-row-cat">${item.cat}</span>
        </div>
        <button class="buscador-add-btn" aria-label="Agregar" onclick="event.stopPropagation();buscadorAdd(${JSON.stringify(item).replace(/"/g,'&quot;')},this)">${isPicker ? '⚙' : '+'}</button>
      </div>`;
  }).join('');
}

function buscadorGoTo(page) { window.location.href = page; }

function buscadorAdd(item, btn) {
  if (item.type === 'picker') {
    if (item.picker === 'pasta'  && typeof showPastaModal    === 'function') { showPastaModal(); return; }
    if (item.picker === 'latte'  && typeof showLattePicker   === 'function') { showLattePicker(item.pickerName); return; }
    if (item.picker === 'waffle' && typeof showWafflePicker  === 'function') { showWafflePicker(item.pickerName); return; }
    if (item.picker === 'tisana' && typeof showGenericPicker === 'function') {
      showGenericPicker({ title: item.pickerName, sub: '¿En qué presentación?',
        options: [{ label:'Caliente',note:'$99'},{label:'Fría',note:'$105'},{label:'Smoothie',note:'$115'}],
        onSelect: (t) => addItem('Tisana ' + t + ' · ' + item.pickerName) }); return;
    }
    if (item.picker === 'agua' && typeof showGenericPicker === 'function') {
      showGenericPicker({ title: item.pickerName, sub: '¿Con qué agua?',
        options: [{ label:'Agua natural',note:'$79'},{label:'Agua mineral',note:'$89'}],
        onSelect: (t) => addItem('Agua Fresca ' + t + ' · ' + item.pickerName) }); return;
    }
    window.location.href = item.page; return;
  }
  addItem(item.cartName);
  btn.textContent = '✓'; btn.classList.add('added');
  setTimeout(() => { btn.textContent = '+'; btn.classList.remove('added'); }, 1000);
  if (typeof showAddedFeedback === 'function') showAddedFeedback(item.cartName);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  buildCartDOM();
  injectAddButtons();
  updateBadge();
  buildTutorial();
  updateToggleUI(); // ← fix: restore toggle visual state on every page load

  if (isActiveMode()) {
    document.body.classList.add('carrito-active');
  }
});
