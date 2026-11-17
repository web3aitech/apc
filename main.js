(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ── Smooth scroll (Lenis) ── */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    document.body.classList.remove('menu-open');
    lenis?.start();
    const y = el.getBoundingClientRect().top + scrollY - (id === '#top' ? 0 : 20);
    const dist = Math.abs(y - scrollY);
    const dur = Math.min(2, 0.8 + dist / 3200);
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    if (lenis) { lenis.scrollTo(y, { duration: dur, easing: ease }); return; }
    // fallback (also used when "reduce motion" is on): still glide to the section
    const from = scrollY, t0 = performance.now(), ms = dur * 1000;
    const step = now => { const p = Math.min(1, (now - t0) / ms); scrollTo(0, from + (y - from) * ease(p)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }));

  /* ── Split headline into masked words ── */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = 'w';
            const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
            w.append(s); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });

  /* ── Reveal on view ── */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  /* ── Count-up ── */
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || '';
    if (reduce) return;
    const t0 = performance.now(), dur = 1800;
    const tick = t => {
      const p = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 4)));
      el.textContent = v + suf;
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0' + suf;
    requestAnimationFrame(tick);
  }), { threshold: 0.3 });
  /* ── Loader (~1.5s) → then start page animations ── */
  const begin = () => {
    $$('[data-reveal],[data-split],[data-mask],[data-io]').forEach(el => io.observe(el));
    $$('[data-count]').forEach(el => cio.observe(el));
  };
  const loader = $('#loader');
  if (loader && !reduce) {
    document.documentElement.style.overflow = 'hidden';
    lenis?.stop();
    setTimeout(() => {
      loader.classList.add('out');
      document.documentElement.style.overflow = '';
      lenis?.start();
      begin();
    }, 1100);
    setTimeout(() => loader.remove(), 1700);
  } else {
    loader?.remove();
    begin();
  }

  /* ── Marquees ── */
  $$('[data-marquee]').forEach(m => {
    const track = $('.marquee-track', m);
    for (let i = 0; i < 1; i++) {
      const c = track.cloneNode(true); c.setAttribute('aria-hidden', 'true'); m.append(c);
    }
  });

  /* ── Parallax + path + progress (one rAF scroll loop) ── */
  const par = $$('[data-parallax]');
  const steps = $$('.step');
  const rail = $('#rail'), bar = $('#bar');
  const nav = $('#nav');
  let lastY = scrollY, ticking = false;

  const update = () => {
    ticking = false;
    const vh = innerHeight;
    if (!reduce) par.forEach(img => {
      const box = img.parentElement.getBoundingClientRect();
      if (box.bottom < -100 || box.top > vh + 100) return;
      const p = (box.top + box.height / 2 - vh / 2) / vh;
      const max = box.height * 0.085; // image is 118% tall, offset -9% → safe travel
      const y = Math.max(-max, Math.min(max, -p * box.height * parseFloat(img.dataset.parallax) * 4));
      img.style.transform = `translate3d(0,${y}px,0)`;
    });
    steps.forEach(s => {
      const r = s.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      s.classList.toggle('on', mid > vh * 0.2 && mid < vh * 0.72);
    });
    if (steps.length && !steps.some(s => s.classList.contains('on'))) {
      const first = steps[0].getBoundingClientRect(), last = steps[steps.length - 1].getBoundingClientRect();
      if (first.top > vh * 0.4) steps[0].classList.add('on');
      else if (last.bottom < vh * 0.7) steps[steps.length - 1].classList.add('on');
    }
    const y = scrollY;
    if (y < 400 || y < lastY - 4) nav.classList.remove('hide');
    else if (y > lastY + 4 && !document.body.classList.contains('menu-open')) nav.classList.add('hide');
    lastY = y;
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  update();

  /* ── Hero video (Vidalytics) ── */
  (() => {
    const account = 'IElLp0sW', embed = 'OS5a5uWMs9WD87YW';
    const id = 'vidalytics_embed_' + embed;
    const base = `https://fast.vidalytics.com/embeds/${account}/${embed}/`;
    const s = document.createElement('script');
    s.text = `(function (v, i, d, a, l, y, t, c, s) {
      y='_'+d.toLowerCase();c=d+'L';if(!v[d]){v[d]={};}if(!v[c]){v[c]={};}if(!v[y]){v[y]={};}
      var vl='Loader',vli=v[y][vl],vsl=v[c][vl + 'Script'],vlf=v[c][vl + 'Loaded'],ve='Embed';
      if (!vsl){vsl=function(u,cb){
        if(t){cb();return;}s=i.createElement("script");s.type="text/javascript";s.async=1;s.src=u;
        if(s.readyState){s.onreadystatechange=function(){if(s.readyState==="loaded"||s.readyState=="complete"){s.onreadystatechange=null;vlf=1;cb();}};}else{s.onload=function(){vlf=1;cb();};}
        i.getElementsByTagName("head")[0].appendChild(s);
      };}
      vsl(l+'loader.min.js',function(){if(!vli){var vlc=v[c][vl];vli=new vlc();}vli.loadScript(l+'player.min.js',function(){var vec=v[d][ve];t=new vec();t.run(a);});});
    })(window, document, 'Vidalytics', ${JSON.stringify(id)}, ${JSON.stringify(base)});`;
    document.body.appendChild(s);
  })();

  /* ── Mobile menu ── */
  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    open ? lenis?.stop() : lenis?.start();
  });

  /* ── Tour rail: drag, arrows, progress ── */
  const prev = $('#prev'), next = $('#next');
  const card = () => $('.city').getBoundingClientRect().width + 20;
  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const p = max > 0 ? rail.scrollLeft / max : 0;
    const w = Math.max(14, (rail.clientWidth / rail.scrollWidth) * 100);
    bar.style.width = w + '%';
    bar.style.transform = `translateX(${p * ((100 / w) - 1) * 100}%)`;
    prev.disabled = rail.scrollLeft < 4;
    next.disabled = rail.scrollLeft > max - 4;
  };
  rail.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync); sync();
  prev.addEventListener('click', () => rail.scrollBy({ left: -card(), behavior: 'smooth' }));
  next.addEventListener('click', () => rail.scrollBy({ left: card(), behavior: 'smooth' }));
  // free, inertial mouse-drag (no snapping); touch & trackpad use native momentum
  // The rail eases toward a drag target (soft, slightly floaty), then glides on release.
  let down = false, sx = 0, sl = 0, lx = 0, lt = 0, vx = 0, raf = 0, pos = 0, target = 0;
  const maxScroll = () => rail.scrollWidth - rail.clientWidth;
  const clamp = v => Math.max(0, Math.min(maxScroll(), v));
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const loop = () => {
    pos += (target - pos) * (down ? 0.16 : 0.075); // softer on release → long, gentle settle
    rail.scrollLeft = pos;
    if (down || Math.abs(target - pos) > 0.4) raf = requestAnimationFrame(loop);
    else raf = 0;
  };
  rail.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    stop(); down = true; sx = lx = e.clientX; sl = pos = target = rail.scrollLeft; lt = performance.now(); vx = 0;
    raf = requestAnimationFrame(loop);
  });
  addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 3) rail.classList.add('drag');
    target = clamp(sl - dx);
    const now = performance.now(), dt = Math.max(1, now - lt);
    vx = vx * 0.6 + ((lx - e.clientX) / dt) * 0.4; // px per ms
    lx = e.clientX; lt = now;
  });
  addEventListener('pointerup', () => {
    if (!down) return;
    down = false; rail.classList.remove('drag');
    if (performance.now() - lt > 80) vx = 0;
    target = clamp(target + vx * 320); // throw distance, eased out by the loop
    if (!raf) raf = requestAnimationFrame(loop);
  });
  rail.addEventListener('wheel', stop, { passive: true });
  rail.addEventListener('touchstart', stop, { passive: true });

  /* ── FAQ accordion (single open) ── */
  const items = $$('.acc-item');
  items.forEach(it => $('.acc-q', it).addEventListener('click', () => {
    const open = it.classList.contains('open');
    items.forEach(o => { o.classList.remove('open'); $('.acc-q', o).setAttribute('aria-expanded', 'false'); });
    if (!open) { it.classList.add('open'); $('.acc-q', it).setAttribute('aria-expanded', 'true'); }
  }));
})();
