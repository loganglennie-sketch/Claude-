// Mobile menu toggle
const btn = document.querySelector('.menu-btn');
const links = document.getElementById('site-links');
if (btn && links) {
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// Enquiry form: send in the background and show the result on the page
const form = document.querySelector('[data-enquiry]');
if (form) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    button.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Sending…';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      form.reset();
      status.classList.add('ok');
      status.textContent = "Thanks, we've got your message and will reply by email soon.";
    } catch {
      status.classList.add('err');
      status.textContent = "Sorry, that didn't send. Please try again, or message us on Instagram.";
    } finally {
      button.disabled = false;
    }
  });
}

// Fade sections in as they scroll into view
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const items = document.querySelectorAll('.sec-head, .svc, .step, .checks li, .faq details, .cta-box, .who, .sheet, .contact-card');
  if (items.length) {
    document.documentElement.classList.add('reveal-on');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((n) => {
      // Stagger cards that sit side by side
      const i = [...n.parentElement.children].indexOf(n);
      n.style.transitionDelay = `${Math.min(i, 4) * 80}ms`;
      n.classList.add('rv');
      io.observe(n);
    });
  }
}
