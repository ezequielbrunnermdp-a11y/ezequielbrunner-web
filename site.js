/* Shared enhancement only: content and navigation links remain in the HTML. */
(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  function closeMenu(returnFocus = false) {
    if (!menu || !nav) return;
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Abrir navegación');
    if (returnFocus) menu.focus();
  }
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('is-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Cerrar navegación' : 'Abrir navegación');
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });

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

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .06, rootMargin: '0px 0px -12px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(element => { element.classList.add('reveal-ready'); observer.observe(element); });
  }
})();
