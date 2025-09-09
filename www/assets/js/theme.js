// /assets/js/theme.js
(() => {
    const btn  = document.getElementById('themeToggle');
    if (!btn) return;

    const KEY = 'theme';
    const root = document.documentElement;
    const mql  = window.matchMedia('(prefers-color-scheme: dark)');

    function setTheme(t){
        root.setAttribute('data-theme', t);
        localStorage.setItem(KEY, t);
        const icon = btn.querySelector('i');
        if (icon) icon.className = (t === 'light') ? 'fas fa-sun' : 'fas fa-moon';
    }
    function current(){ return root.getAttribute('data-theme') || 'dark'; }

    // spójna ikona (atrybut data-theme ustawiony już inline w <head>)
    setTheme(localStorage.getItem(KEY) || root.getAttribute('data-theme') || (mql.matches?'dark':'light'));

    btn.addEventListener('click', () => setTheme(current() === 'dark' ? 'light' : 'dark'));
    mql.addEventListener('change', e => {
        if (!localStorage.getItem(KEY)) setTheme(e.matches ? 'dark' : 'light');
    });
})();
