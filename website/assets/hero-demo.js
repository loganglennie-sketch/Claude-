// Home page hero: an example enquiry arrives, gets a fast reply, and is passed to the owner. Loops.
const demo = document.querySelector('[data-demo]');
if (demo) {
  const chat = demo.querySelector('.demo-chat');
  const recent = demo.querySelector('.demo-recent');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const jobs = [
    {
      job: 'Full rewire, 2-bed flat', src: 'Meta', area: 'Electrician · AB10', secs: 51,
      msg: "Hi, roughly how much for a rewire on a 2-bed flat? We get the keys next month.",
      reply: "Hi, thanks for getting in touch! It depends on the layout, so we'd like to pop round for a free survey. When do you get the keys?",
    },
    {
      job: 'Roof leak repair', src: 'Instagram', area: 'Roofing · AB25', secs: 29,
      msg: "We've got water coming through the ceiling after last night's rain. Can anyone come out this week?",
      reply: "Sorry to hear that! We can help. Could you send a photo of the ceiling and the roof if you can? We'll get someone booked in.",
    },
    {
      job: 'Boiler replacement quote', src: 'Meta', area: 'Plumbing & heating · AB15', secs: 38,
      msg: "Hi, we need a new boiler for a 3-bed semi. Could someone come out to quote next week?",
      reply: "Hi, thanks for your message! We can help with that. Is it a combi you have now, and which days suit you for a free quote visit?",
    },
    {
      job: 'Driveway + patio, ~60 m²', src: 'Instagram', area: 'Landscaping · AB32', secs: 42,
      msg: "Looking for a price on a block-paved driveway and a small patio. Around 60 m² in total.",
      reply: "Thanks for getting in touch! Could you send a couple of photos of the area? We'll book in a free quote visit.",
    },
  ];

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const clock = (s) => `0:${String(s).padStart(2, '0')}`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function render(j, stage, secs) {
    // stage: 1 enquiry in, 2 replying, 3 replied, 4 sent to owner
    chat.replaceChildren();
    const head = el('div', 'demo-top', `<b>New enquiry <span class="src">${j.src}</span></b><small>${esc(j.area)}</small>`);
    chat.append(head, el('div', 'bubble in', esc(j.msg)));
    if (stage === 2) {
      chat.append(el('div', 'demo-timer', `<span class="dots"><i></i><i></i><i></i></span>Replying · <span class="tick">${clock(secs)}</span>`));
    }
    if (stage >= 3) {
      chat.append(el('div', 'bubble out', esc(j.reply)));
      chat.append(el('div', 'demo-stamp', `✓ Replied in ${clock(j.secs)}`));
    }
    if (stage >= 4) {
      chat.append(el('div', 'demo-owner', `<span class="ic">→</span>Lead details sent to you: ${esc(j.job)}`));
    }
  }

  function addRecent(j) {
    [...recent.children].forEach((r) => { if (r.dataset.job === j.job) r.remove(); });
    const row = el('div', 'lead fresh',
      `<b>${esc(j.job)} <span class="src">${j.src}</span></b><span class="t">replied ${clock(j.secs)}</span><small>${esc(j.area)}</small>`);
    row.dataset.job = j.job;
    recent.prepend(row);
    while (recent.children.length > 2) recent.lastElementChild.remove();
  }

  async function play(j) {
    render(j, 1);
    chat.querySelector('.demo-top').classList.add('rise');
    chat.querySelector('.bubble.in').classList.add('rise');
    await wait(1600);
    // Count up to the reply time, sped up so it takes about two seconds.
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      render(j, 2, Math.round((j.secs * i) / steps));
      if (i === 0) chat.querySelector('.demo-timer').classList.add('rise');
      await wait(110);
    }
    render(j, 3);
    chat.querySelector('.bubble.out').classList.add('rise');
    await wait(1500);
    render(j, 4);
    chat.querySelector('.demo-owner').classList.add('rise');
    await wait(3500);
    addRecent(j);
  }

  if (reduce) {
    render(jobs[0], 4);
  } else {
    (async () => {
      for (let n = 0; ; n = (n + 1) % jobs.length) await play(jobs[n]);
    })();
  }
}
