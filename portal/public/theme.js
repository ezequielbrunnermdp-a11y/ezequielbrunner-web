// Aplica el tema antes de renderizar (evita destellos). Archivo externo para cumplir la CSP.
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch (e) {}
