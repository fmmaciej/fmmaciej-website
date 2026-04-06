(() => {
    const supportsVTA = !!document.startViewTransition;
    const PAGE_STYLE_SELECTOR = 'link[data-page-style]';
    const PAGE_SCRIPT_SELECTOR = 'script[data-page-script]';
    const loadedPageScripts = new Set(
        Array.from(document.querySelectorAll(PAGE_SCRIPT_SELECTOR), (script) => new URL(script.src, location.href).href)
    );

    function toAbsoluteUrl(value) {
        return new URL(value, location.href).href;
    }

    function collectPageAssets(root, selector, attr) {
        return Array.from(root.querySelectorAll(selector))
            .map((element) => {
                const value = element.getAttribute(attr);
                if (!value) return null;

                return {
                    value,
                    absolute: toAbsoluteUrl(value)
                };
            })
            .filter(Boolean);
    }

    function loadStyle(href) {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.dataset.pageStyle = '';
            link.onload = () => resolve();
            link.onerror = () => resolve();
            document.head.appendChild(link);
        });
    }

    async function syncPageStyles(dom) {
        const currentStyles = new Map(
            Array.from(document.querySelectorAll(PAGE_STYLE_SELECTOR), (link) => [toAbsoluteUrl(link.href), link])
        );
        const nextStyles = collectPageAssets(dom, PAGE_STYLE_SELECTOR, 'href');
        const nextStyleUrls = new Set(nextStyles.map((style) => style.absolute));

        await Promise.all(
            nextStyles
                .filter((style) => !currentStyles.has(style.absolute))
                .map((style) => loadStyle(style.value))
        );

        currentStyles.forEach((link, absolute) => {
            if (!nextStyleUrls.has(absolute)) {
                link.remove();
            }
        });
    }

    function loadScript(src) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.dataset.pageScript = '';
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.body.appendChild(script);
        });
    }

    async function ensurePageScripts(dom) {
        const nextScripts = collectPageAssets(dom, PAGE_SCRIPT_SELECTOR, 'src');

        for (const script of nextScripts) {
            if (loadedPageScripts.has(script.absolute)) continue;

            await loadScript(script.value);
            loadedPageScripts.add(script.absolute);
        }
    }

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

            const newTerminal = dom.querySelector('.terminal-box');
            const curTerminal = document.querySelector('.terminal-box');

            curHost._terminalCleanup?.();
            curHost._pageCleanup?.();

            await syncPageStyles(dom);
            await ensurePageScripts(dom);

            document.title = dom.title || document.title;
            curHost.replaceWith(newHost);

            if (newTerminal && curTerminal) {
                curTerminal.replaceWith(newTerminal);
            } else if (newTerminal && !curTerminal) {
                newHost.insertAdjacentElement('beforebegin', newTerminal);
            } else if (!newTerminal && curTerminal) {
                curTerminal.remove();
            }

            history.pushState(null, '', url);

            if (window.initTerminal) window.initTerminal(document);
            if (window.initNav) window.initNav(document);
            if (window.initPageScripts) window.initPageScripts(document);
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
    if (window.initPageScripts) window.initPageScripts(document);
})();
