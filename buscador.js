/* ============================================================
   MOZZAFIATO — Buscador del menú
   Requiere: menu-data.js, carrito.js
   ============================================================ */

const STORAGE_KEY_SEARCH = 'mozzafiato_pedido';

function getCartSearch() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SEARCH)) || []; }
  catch { return []; }
}
function saveCartSearch(cart) {
  localStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify(cart));
}
function addToCartFromSearch(name) {
  const cart = getCartSearch();
  const existing = cart.find(i => i.name === name);
  if (existing) { existing.qty++; }
  else { cart.push({ name, qty: 1 }); }
  saveCartSearch(cart);
  // Update badge if carrito.js is loaded
  if (typeof updateBadge === 'function') updateBadge();
}

/* ── Normalise string for fuzzy match ── */
function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '');
}

/* ── Filter items ── */
function searchItems(query) {
  if (!query || query.trim().length < 1) return [];
  const q = normalize(query.trim());
  return MENU_DATA.filter(item =>
    normalize(item.name).includes(q) ||
    normalize(item.cat).includes(q)
  ).slice(0, 5);
}

/* ── Build search UI ── */
function buildBuscador() {
  const container = document.getElementById('buscador-container');
  if (!container) return;

  container.innerHTML = `
    <div class="buscador-wrap">
      <div class="buscador-input-row">
        <svg class="buscador-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          id="buscador-input"
          type="search"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          placeholder="¿Ya sabes qué ordenar? Busca aquí..."
          aria-label="Buscar platillo"
        >
        <button id="buscador-clear" aria-label="Limpiar">✕</button>
      </div>
      <div id="buscador-results" role="listbox" aria-label="Sugerencias"></div>
    </div>
  `;

  const input   = document.getElementById('buscador-input');
  const results = document.getElementById('buscador-results');
  const clearBtn= document.getElementById('buscador-clear');

  clearBtn.style.display = 'none';

  input.addEventListener('input', () => {
    const q = input.value;
    clearBtn.style.display = q.length ? 'flex' : 'none';
    renderResults(searchItems(q));
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    renderResults([]);
    input.focus();
  });

  // Close results on outside click
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) renderResults([]);
  });

  function renderResults(items) {
    results.innerHTML = '';
    if (!items.length) { results.style.display = 'none'; return; }

    results.style.display = 'block';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'buscador-row';
      row.setAttribute('role', 'option');

      const isPicker = item.type === 'picker';
      const icon = isPicker ? '⚙' : '+';
      const hint = isPicker ? 'personalizar' : 'agregar';

      row.innerHTML = `
        <div class="buscador-row-info">
          <span class="buscador-row-name">${highlightMatch(item.name, input.value)}</span>
          <span class="buscador-row-cat">${item.cat}</span>
        </div>
        <button class="buscador-add-btn" data-hint="${hint}" aria-label="${hint} ${item.name}">
          ${icon}
        </button>
      `;

      // Click on row → go to page
      row.addEventListener('click', (e) => {
        if (e.target.closest('.buscador-add-btn')) return;
        window.location.href = item.page;
      });

      // Click on + button → add to cart or open picker
      row.querySelector('.buscador-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleSearchAdd(item, row.querySelector('.buscador-add-btn'));
      });

      results.appendChild(row);
    });
  }
}

function highlightMatch(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

function handleSearchAdd(item, btn) {
  if (item.type === 'picker') {
    handlePickerFromSearch(item, btn);
    return;
  }
  addToCartFromSearch(item.cartName);
  // Visual feedback
  btn.textContent = '✓';
  btn.classList.add('added');
  setTimeout(() => {
    btn.textContent = '+';
    btn.classList.remove('added');
  }, 1000);
  // Toast
  if (typeof showAddedFeedback === 'function') showAddedFeedback(item.cartName);
}

function handlePickerFromSearch(item, btn) {
  if (item.picker === 'pasta') {
    if (typeof showPastaModal === 'function') showPastaModal();
    else window.location.href = item.page;
    return;
  }
  if (item.picker === 'tisana') {
    if (typeof showGenericPicker === 'function') {
      showGenericPicker({
        title: item.pickerName,
        sub: '¿En qué presentación?',
        options: [
          { label: 'Caliente', note: '$99'  },
          { label: 'Fría',     note: '$105' },
          { label: 'Smoothie', note: '$115' },
        ],
        onSelect: (tipo) => addToCartFromSearch('Tisana ' + tipo + ' · ' + item.pickerName),
      });
    } else window.location.href = item.page;
    return;
  }
  if (item.picker === 'latte') {
    if (typeof showLattePicker === 'function') showLattePicker(item.pickerName);
    else window.location.href = item.page;
    return;
  }
  if (item.picker === 'agua') {
    if (typeof showGenericPicker === 'function') {
      showGenericPicker({
        title: item.pickerName,
        sub: '¿Con qué agua?',
        options: [
          { label: 'Agua natural',  note: '$79' },
          { label: 'Agua mineral',  note: '$89' },
        ],
        onSelect: (tipo) => addToCartFromSearch('Agua Fresca ' + tipo + ' · ' + item.pickerName),
      });
    } else window.location.href = item.page;
    return;
  }
  if (item.picker === 'waffle') {
    if (typeof showWafflePicker === 'function') showWafflePicker(item.pickerName);
    else window.location.href = item.page;
    return;
  }
  window.location.href = item.page;
}

document.addEventListener('DOMContentLoaded', buildBuscador);
