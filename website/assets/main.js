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
