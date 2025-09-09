(() => {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    // kursor po #typedText (na wszelki wypadek)
    const typed = document.getElementById('typedText');
    const cursorEl = document.getElementById('cursor');
    if (typed && cursorEl && cursorEl.parentElement !== typed.parentElement) {
        typed.after(cursorEl);
    }

    // --footer-height (globalnie na :root)
    const footer = document.querySelector('footer');
    const setFooterVar = () => {
        const h = footer ? footer.getBoundingClientRect().height : 64;
        document.documentElement.style.setProperty('--footer-height', h + 'px');
    };
    setFooterVar();
    addEventListener('resize', setFooterVar);

    // po załadowaniu usuń klasę preload
    window.addEventListener('load', () => {
        document.documentElement.classList.remove('preload');
    });
})();