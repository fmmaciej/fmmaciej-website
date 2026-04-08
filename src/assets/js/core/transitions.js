(() => {
    const supportsVTA = !!document.startViewTransition;
    const prefersReducedMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PAGE_STYLE_SELECTOR = 'link[data-page-style]';
    const PAGE_SCRIPT_SELECTOR = 'script[data-page-script]';
    const REVEAL_SELECTOR = [
        '.music-intro',
        '.music-outro',
        '.page-intro',
        '.page-outro',
        'main > .md',
        'main > p.booking',
        'main > p.presskit',
        '.blog-archive > .group',
        '.music-list > li',
        '.blog-list > li',
        '.proj-list > .proj-item',
        'main > .group',
        '.music-event-grid > *'
    ].join(', ');
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

    function cleanupReveal(root) {
        if (!root) return;

        if (root._revealTimer) {
            window.clearTimeout(root._revealTimer);
            root._revealTimer = null;
        }

        root.classList.remove('is-reveal-enter', 'is-reveal-active');
        root.querySelectorAll('[data-reveal]').forEach((element) => {
            element.style.removeProperty('--reveal-index');
            element.removeAttribute('data-reveal');
        });
    }

    function prepareReveal(root) {
        if (!root || prefersReducedMotion) return;

        cleanupReveal(root);

        const targets = Array.from(root.querySelectorAll(REVEAL_SELECTOR));
        if (!targets.length) return;

        root.classList.add('is-reveal-enter');
        targets.forEach((element, index) => {
            element.dataset.reveal = '';
            element.style.setProperty('--reveal-index', String(index));
        });
    }

    function startReveal(root) {
        if (!root || prefersReducedMotion || !root.classList.contains('is-reveal-enter')) return;

        requestAnimationFrame(() => {
            root.classList.add('is-reveal-active');
            root._revealTimer = window.setTimeout(() => cleanupReveal(root), 520);
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
            prepareReveal(newHost);
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
            startReveal(newHost);
        });
    }

    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        if (a.dataset.terminalBypass === '1') return;

        const action = window.terminalActions?.resolveAction?.(a, e);
        if (action) {
            e.preventDefault();

            const runAction = async () => {
                if (action.mode === 'native') {
                    window.terminalActions?.triggerNativeLink?.(a);
                    return;
                }

                if (window.closeDrawer) window.closeDrawer();
                await navigate(action.href || a.href);
            };

            if (window.playTerminalCommand && action.command) {
                window.playTerminalCommand(action.command, {
                    resumeCycleAfterMs: action.resumeCycleAfterMs || 0
                }).then(runAction);
                return;
            }

            runAction();
            return;
        };

        const href = a.getAttribute('href') || '';
        if (href.startsWith('#')) return;
    });

    window.addEventListener('popstate', () => {
        if (window.closeDrawer) window.closeDrawer();
        navigate(location.href);
    });

    if (window.initTerminal) window.initTerminal(document);
    if (window.initNav) window.initNav(document);
    if (window.initPageScripts) window.initPageScripts(document);
    prepareReveal(document.querySelector('.content-host'));
    startReveal(document.querySelector('.content-host'));
})();
