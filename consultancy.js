// Interactive examples explain the service; no business data is collected or stored.
document.querySelectorAll('[data-tabs]').forEach((group) => {
  const tabs = [...group.querySelectorAll('[role="tab"]')];
  const panels = [...group.querySelectorAll('[role="tabpanel"]')];
  function selectTab(tab, moveFocus = false) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); });
    if (moveFocus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  });
  if (tabs.length) selectTab(tabs[0]);
});

document.querySelectorAll('[data-inquiry-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const area = fields.get('area');
    const body = [
      'Hola, Ezequiel. Quisiera conversar sobre un proyecto.', '',
      `Nombre: ${fields.get('name')}`,
      `Email de contacto: ${fields.get('email')}`,
      `Empresa o emprendimiento: ${fields.get('company') || 'A definir'}`,
      `Me interesa: ${area}`, '',
      fields.get('message')
    ].join('\n');
    const link = 'mailto:contacto@ezequielbrunner.com?subject=' + encodeURIComponent(`Consulta · ${area}`) + '&body=' + encodeURIComponent(body);
    form.querySelector('[data-form-status]').textContent = 'Consulta preparada. Tu aplicación de correo se abrirá para que puedas revisarla y enviarla. Si no se abre, escribime al email que figura en esta sección.';
    window.location.href = link;
  });
});

const consultancyMenu = document.querySelector('.menu-toggle');
const consultancyNav = document.querySelector('.site-nav');
if (consultancyMenu && consultancyNav) {
  const updateMenuLabel = () => consultancyMenu.setAttribute('aria-label', consultancyMenu.getAttribute('aria-expanded') === 'true' ? 'Cerrar navegación' : 'Abrir navegación');
  consultancyMenu.addEventListener('click', updateMenuLabel);
  consultancyNav.addEventListener('click', updateMenuLabel);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || consultancyMenu.getAttribute('aria-expanded') !== 'true') return;
    consultancyNav.classList.remove('is-open');
    consultancyMenu.classList.remove('is-open');
    consultancyMenu.setAttribute('aria-expanded', 'false');
    updateMenuLabel();
    consultancyMenu.focus();
  });
}
