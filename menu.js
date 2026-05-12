/* Mozzafiato — shared interactions */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Sidebar hamburger ── */
  const hamburger = document.querySelector('.hamburger');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.querySelector('.sidebar-overlay');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger?.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  overlay?.addEventListener('click', closeSidebar);

  /* Mark active nav link */
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    if (a.getAttribute('href') === currentPage) a.classList.add('active');
  });

  /* ── Lightbox ── */
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');

  document.querySelectorAll('.food-img-wrap').forEach(wrap => {
    wrap.addEventListener('click', () => {
      const src = wrap.querySelector('img').src;
      lbImg.src = src;
      lb.classList.add('open');
    });
  });

  lb?.addEventListener('click', () => lb.classList.remove('open'));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') lb?.classList.remove('open');
  });
});
