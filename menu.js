/* Mozzafiato — shared interactions */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Sidebar hamburger ── */
  const hamburger = document.querySelector('.hamburger');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.querySelector('.sidebar-overlay');

  /* Inject close button inside sidebar logo area */
  const logoArea = sidebar?.querySelector('.sidebar-logo');
  if (logoArea && !logoArea.querySelector('.sidebar-close')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close';
    closeBtn.setAttribute('aria-label', 'Cerrar menú');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closeSidebar);
    logoArea.appendChild(closeBtn);
  }

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('open');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('open');
  }

  hamburger?.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  /* Close on overlay click or outside click */
  overlay?.addEventListener('click', closeSidebar);
  document.addEventListener('click', (e) => {
    if (sidebar?.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !hamburger?.contains(e.target)) {
      closeSidebar();
    }
  });

  /* Mark active nav link */
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    if (a.getAttribute('href') === currentPage) a.classList.add('active');
  });

  /* ── Lightbox ── */
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');

  document.querySelectorAll('.food-img-wrap').forEach(wrap => {
    const illustrationSrc = wrap.querySelector('img').src;
    const match = illustrationSrc.match(/images\/(\d+)\.(png|jpg|jpeg)$/i);
    if (!match) return;
    const num = match[1];

    function tryLoad(ext, fallbackExt) {
      const src = 'images/foto_' + num + '.' + ext;
      const testImg = new Image();
      testImg.onload = () => {
        wrap.dataset.realPhoto = src;
        if (!wrap.querySelector('.foto-real-label')) {
          const label = document.createElement('div');
          label.className = 'foto-real-label';
          label.textContent = 'ver foto real';
          wrap.appendChild(label);
        }
      };
      testImg.onerror = () => { if (fallbackExt) tryLoad(fallbackExt, null); };
      testImg.src = src;
    }
    tryLoad('jpg', 'png');

    wrap.addEventListener('click', () => {
      if (!wrap.dataset.realPhoto) return;
      lbImg.src = wrap.dataset.realPhoto;
      lb.classList.add('open');
    });
  });

  lb?.addEventListener('click', () => { lb.classList.remove('open'); lbImg.src = ''; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb?.classList.remove('open'); });
});
