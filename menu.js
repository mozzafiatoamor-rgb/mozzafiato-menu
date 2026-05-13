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

    /* Extract illustration number e.g. .../images/6.png → 6 */
    const match = illustrationSrc.match(/images\/(\d+)\.(png|jpg|jpeg)$/i);
    if (!match) return;

    const num = match[1];

    /* Try JPG first, then PNG — add label only when one loads */
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
      testImg.onerror = () => {
        if (fallbackExt) tryLoad(fallbackExt, null);
      };
      testImg.src = src;
    }

    tryLoad('jpg', 'png');

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
