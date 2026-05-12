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

  /* Real photos map: illustration number → real photo extension */
  const realPhotoExt = {
    '1':'png','2':'png','3':'png','4':'png',
    '5':'jpg','6':'jpg',
    '12':'png','13':'png','16':'png',
    '29':'jpg'
  };

  document.querySelectorAll('.food-img-wrap').forEach(wrap => {
    const illustrationSrc = wrap.querySelector('img').src;

    /* Extract illustration number e.g. .../images/6.png → 6 */
    const match = illustrationSrc.match(/images\/(\d+)\.(png|jpg|jpeg)$/i);
    if (!match) return;

    const num = match[1];
    const ext = realPhotoExt[num];
    if (!ext) return; /* no real photo for this illustration */

    const realPhotoSrc = 'images/foto_' + num + '.' + ext;

    /* Verify the file exists before adding the label */
    const testImg = new Image();
    testImg.onload = () => {
      wrap.dataset.realPhoto = realPhotoSrc;
      const label = document.createElement('div');
      label.className = 'foto-real-label';
      label.textContent = 'ver foto real';
      wrap.appendChild(label);
    };
    testImg.src = realPhotoSrc;

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
