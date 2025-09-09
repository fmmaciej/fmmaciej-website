(() => {
    const supportsVTA = !!document.startViewTransition;

    function isInternalNav(a, evt) {
        if (!a || a.target === '_blank' || evt.metaKey || evt.ctrlKey || evt.shiftKey) return false;
        const url = new URL(a.href, location.href);

        return url.origin === location.origin;
    }

    async function navigate(url) {
        if (window.closeDrawer) window.closeDrawer();

        if (!supportsVTA) { location.href = url; return; }

        document.startViewTransition(async () => {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) {
                location.href = url;
                return;
            }

            const html = await res.text();
            const dom  = new DOMParser().parseFromString(html, 'text/html');

            const newHost = dom.querySelector('.content-host');
            const curHost = document.querySelector('.content-host');
            if (!newHost || !curHost) {
                location.href = url;
                return;
            }

            curHost._terminalCleanup?.();

            document.title = dom.title || document.title;
            curHost.replaceWith(newHost);
            history.pushState(null, '', url);

            if (window.initTerminal) window.initTerminal(document);
            if (window.initNav)        window.initNav(document);
            if (window.initPageScripts) window.initPageScripts(newHost);
            if (window.closeDrawer) window.closeDrawer();
        });
    }

    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');

        if (!isInternalNav(a, e)) return;
        if (a.getAttribute('href').startsWith('#')) return;

        e.preventDefault();
        
        if (window.closeDrawer) window.closeDrawer();
        navigate(a.href);
    });

    window.addEventListener('popstate', () => {
        if (window.closeDrawer) window.closeDrawer();
        navigate(location.href);
    });

    if (window.initTerminal) window.initTerminal(document);
    if (window.initNav) window.initNav(document);
})();
