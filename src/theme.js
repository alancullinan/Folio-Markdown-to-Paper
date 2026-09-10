export function setupTheme() {
  const root = document.documentElement;
  const button = document.getElementById('theme');
  const system = matchMedia('(prefers-color-scheme: dark)');
  let choice = null;
  try { const saved=localStorage.getItem('folio-theme');if(['dark','light'].includes(saved))choice=saved; } catch {}
  function apply() {
    const dark = choice ? choice==='dark' : system.matches;
    root.dataset.theme = dark ? 'dark' : 'light';
    button.setAttribute('aria-pressed',String(dark));
    button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }
  button.addEventListener('click',()=>{
    choice=root.dataset.theme==='dark'?'light':'dark';
    try {localStorage.setItem('folio-theme',choice)} catch {}
    apply();
  });
  system.addEventListener('change',()=>{if(!choice)apply()});
  apply();
}
