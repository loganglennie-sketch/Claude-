// Mobile menu toggle
const btn = document.querySelector('.menu-btn');
const links = document.getElementById('site-links');
if (btn && links) {
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}
