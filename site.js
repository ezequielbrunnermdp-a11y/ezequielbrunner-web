/* Shared enhancement only: content and navigation links remain in the HTML. */
(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const header = document.querySelector('.site-header');
  const dropdowns = [...document.querySelectorAll('[data-nav-dropdown]')];
  const desktop = window.matchMedia('(min-width: 820px)');
  function closeDropdowns(except) {
    dropdowns.forEach(dropdown => {
      if (dropdown !== except) dropdown.open = false;
    });
  }
  function closeMenu(returnFocus = false) {
    if (!menu || !nav) return;
    closeDropdowns();
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Abrir menú de secciones');
    if (returnFocus) menu.focus();
  }
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    closeDropdowns();
    nav.classList.toggle('is-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Cerrar menú de secciones' : 'Abrir menú de secciones');
  });
  dropdowns.forEach(dropdown => dropdown.addEventListener('toggle', () => {
    if (dropdown.open) closeDropdowns(dropdown);
  }));
  const pagePath = path => path.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  function markCurrentLocation() {
    nav?.querySelectorAll('.nav-panel a').forEach(link => {
      const target = new URL(link.href);
      const samePage = pagePath(target.pathname) === pagePath(window.location.pathname);
      link.removeAttribute('aria-current');
      if (samePage && target.hash === window.location.hash) {
        link.setAttribute('aria-current', target.hash ? 'location' : 'page');
      }
    });
  }
  markCurrentLocation();
  window.addEventListener('hashchange', markCurrentLocation);
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    closeMenu();
    const target = new URL(link.href);
    if (target.hash && pagePath(target.pathname) === pagePath(window.location.pathname)) {
      const section = document.getElementById(decodeURIComponent(target.hash.slice(1)));
      if (section) {
        section.setAttribute('tabindex', '-1');
        requestAnimationFrame(() => section.focus({ preventScroll: true }));
      }
    }
  }));
  document.addEventListener('click', event => {
    if (header && !header.contains(event.target)) closeMenu();
  });
  document.addEventListener('focusin', event => {
    if (header && !header.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const openDropdown = dropdowns.find(dropdown => dropdown.open);
    if (openDropdown) {
      event.preventDefault();
      openDropdown.open = false;
      openDropdown.querySelector('summary').focus();
    } else if (menu?.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closeMenu(true);
    }
  });
  desktop.addEventListener('change', () => closeMenu());

  // Drafts contain explicit placeholders. They are absent from the normal public view.
  if (new URLSearchParams(window.location.search).get('edicion') === '1') {
    document.querySelectorAll('[data-draft]').forEach(block => { block.hidden = false; });
    const robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
  }

  // Retain old shared section links, without diverting the new home contact section.
  if (document.body.dataset.page === 'home') {
    const hash = window.location.hash;
    if (['#gastronomia', '#trabaja-conmigo'].includes(hash)) window.location.replace('gastronomia.html' + hash);
    if (['#sobre-mi', '#publicaciones', '#dossier', '#medios', '#novedades'].includes(hash)) window.location.replace('inteligencia-artificial.html' + hash);
  }

  document.querySelectorAll('[data-contact-form]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const area = data.get('area');
      const body = [
        'Hola, Ezequiel. Quisiera conversar sobre un proyecto.', '',
        `Nombre: ${data.get('name')}`,
        `Email de contacto: ${data.get('email')}`,
        `Empresa o emprendimiento: ${data.get('company') || 'A definir'}`,
        `Me interesa: ${area}`, '', data.get('message')
      ].join('\n');
      form.querySelector('[data-form-status]').textContent = 'Consulta preparada. Revisala y enviala desde tu aplicación de correo. Si no se abre, podés escribir al email que figura en esta sección.';
      window.location.href = 'mailto:contacto@ezequielbrunner.com?subject=' + encodeURIComponent('Consulta · ' + area) + '&body=' + encodeURIComponent(body);
    });
  });

  const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const latest = document.querySelector('#latest-news-list');
  const archive = document.querySelector('#archive-news-list');
  if (latest && archive && Array.isArray(window.newsItems)) {
    const entries = [...window.newsItems].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
    const format = date => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date + 'T12:00:00'));
    const render = item => `<article class="news-card">${item.image ? `<img class="news-card-image" src="${escapeText(item.image)}" alt="${escapeText(item.title)}" loading="lazy" decoding="async">` : ''}<div class="news-card-body"><p class="card-meta">${escapeText(item.category)}</p>${item.date ? `<p class="news-card-date">${escapeText(item.displayDate || format(item.date))}</p>` : ''}<h3>${escapeText(item.title)}</h3><p class="news-card-author">${escapeText(item.author)}</p><p class="news-card-tagline">${escapeText(item.tagline)}</p><p>${escapeText(item.summary)}</p></div><a class="news-card-link" href="articulo.html?slug=${encodeURIComponent(item.slug)}">Leer artículo completo</a></article>`;
    latest.innerHTML = entries.slice(0,3).map(render).join('');
    archive.innerHTML = entries.slice(3).map(render).join('') || '<p class="news-empty">Todavía no hay notas anteriores publicadas.</p>';
  }

  // Efectos visuales compartidos con la página de inicio.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // Título de portada: cada palabra sube desde abajo.
  const heroTitle = document.querySelector('.page-hero h1');
  if (heroTitle && !reduce) {
    let index = 0;
    const wrap = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const outer = document.createElement('span'), inner = document.createElement('span');
            outer.className = 'wd'; inner.textContent = part;
            inner.style.animationDelay = (index++ * 0.07) + 's';
            outer.append(inner); frag.append(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') wrap(child);
      });
    };
    wrap(heroTitle);
  }

  // Luz suave que sigue al cursor y textura de fondo.
  const grain = document.createElement('div'); grain.className = 'grain'; grain.setAttribute('aria-hidden', 'true');
  document.body.prepend(grain);
  if (fine && !reduce) {
    const glow = document.createElement('div'); glow.className = 'cursor-glow'; glow.setAttribute('aria-hidden', 'true');
    document.body.prepend(glow);
    window.addEventListener('pointermove', event => {
      glow.style.setProperty('--cx', event.clientX + 'px');
      glow.style.setProperty('--cy', event.clientY + 'px');
    }, { passive: true });
    $$('.button').forEach(button => {
      button.addEventListener('pointermove', event => {
        const box = button.getBoundingClientRect();
        button.style.transform = `translate(${(event.clientX - box.left - box.width / 2) * .16}px, ${(event.clientY - box.top - box.height / 2) * .26}px)`;
      });
      button.addEventListener('pointerleave', () => {
        button.style.transition = 'transform .5s cubic-bezier(.2,.75,.2,1)';
        button.style.transform = '';
        setTimeout(() => { button.style.transition = ''; }, 500);
      });
    });
  }

  // Tarjetas con luz e inclinación (también las que se crean después, como las novedades).
  const cardSelector = '.service-card, .usecase-card, .panel, .publication-card, .media-card, .news-card';
  if (fine && !reduce) {
    document.addEventListener('pointermove', event => {
      const card = event.target.closest && event.target.closest(cardSelector);
      if (!card) return;
      const box = card.getBoundingClientRect();
      const px = (event.clientX - box.left) / box.width - .5, py = (event.clientY - box.top) / box.height - .5;
      card.style.setProperty('--x', (px + .5) * 100 + '%');
      card.style.setProperty('--y', (py + .5) * 100 + '%');
      card.style.setProperty('--rx', (-py * 4) + 'deg');
      card.style.setProperty('--ry', (px * 4) + 'deg');
    });
    document.addEventListener('pointerout', event => {
      const card = event.target.closest && event.target.closest(cardSelector);
      if (!card || card.contains(event.relatedTarget)) return;
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  }

  // Aparición gradual al bajar. Lo que ya está a la vista al cargar no se oculta.
  if ('IntersectionObserver' in window && !reduce) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -6% 0px' });
    const targets = '[data-reveal], .section-heading, .split-section .prose, .service-card, .usecase-card, .step, .faq-item, .panel, .publication-card, .media-card, .news-card, .career-list li, .principle-strip, .contact-section, .bridge, .recruitment, .process-diagram, .archive-details, .subsection-heading, .article-card';
    $$(targets).forEach(element => {
      if (element.classList.contains('reveal-ready') || element.closest('.page-hero')) return;
      if (element.getBoundingClientRect().top < window.innerHeight * .92) return;
      const siblings = element.parentElement ? [...element.parentElement.children] : [element];
      element.style.setProperty('--i', Math.min(siblings.indexOf(element), 4));
      element.classList.add('reveal-ready');
      observer.observe(element);
    });
  }

  // Barra de progreso en el encabezado y movimiento suave de la imagen de portada.
  const hero = document.querySelector('.page-hero-media');
  let ticking = false;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (header) header.style.setProperty('--sp', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
    if (hero && !reduce) {
      const box = hero.getBoundingClientRect();
      if (box.bottom > 0 && box.top < window.innerHeight) hero.style.setProperty('--pv', Math.min(1, Math.max(0, 1 - box.top / window.innerHeight)).toFixed(3));
    }
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
