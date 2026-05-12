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
    const illustrationSrc = wrap.querySelector('img').src;

    /* Extract image number from filename e.g. images/6.png → foto_6.jpg */
    const match = illustrationSrc.match(/\/(\d+)\.(png|jpg)$/i);
    const realPhotoSrc = match ? illustrationSrc.replace(/\/(\d+)\.(png|jpg)$/i, '/foto_$1.jpg') : null;

    /* Add "ver foto real" label only if a real photo exists for this illustration */
    if (realPhotoSrc) {
      const label = document.createElement('div');
      label.className = 'foto-real-label';
      label.textContent = 'ver foto real';
      wrap.appendChild(label);

      /* Test if real photo actually exists before using it */
      const testImg = new Image();
      testImg.onload = () => { wrap.dataset.realPhoto = realPhotoSrc; };
      testImg.onerror = () => { label.remove(); };
      testImg.src = realPhotoSrc;
    }

    wrap.addEventListener('click', () => {
      const src = wrap.dataset.realPhoto || illustrationSrc;
      lbImg.src = src;
      lb.classList.add('open');
    });
  });

  lb?.addEventListener('click', () => {
    lb.classList.remove('open');
    lbImg.src = '';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') lb?.classList.remove('open');
  });
});
