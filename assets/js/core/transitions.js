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
    let renderedUrl = location.href;

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
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.dataset.pageStyle = '';
            link.onload = () => resolve(link);
            link.onerror = () => {
                link.remove();
                reject(new Error(`Unable to load stylesheet: ${href}`));
            };
            document.head.appendChild(link);
        });
    }

    async function syncPageStyles(dom, assertCurrent) {
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
        assertCurrent();

        currentStyles.forEach((link, absolute) => {
            if (!nextStyleUrls.has(absolute)) {
                link.remove();
            }
        });
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.dataset.pageScript = '';
            script.onload = () => resolve();
            script.onerror = () => {
                script.remove();
                reject(new Error(`Unable to load script: ${src}`));
            };
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

    function reserveExternalWindow(anchor, action) {
        if (!anchor || action?.name !== 'external-link') return null;
        if (anchor.target !== '_blank') return null;

        const popup = window.open('about:blank', '_blank');
        if (!popup) return null;

        try {
            popup.opener = null;
        } catch (_) {}

        return popup;
    }

    async function ensurePageScripts(dom, assertCurrent) {
        const nextScripts = collectPageAssets(dom, PAGE_SCRIPT_SELECTOR, 'src');

        for (const script of nextScripts) {
            if (loadedPageScripts.has(script.absolute)) continue;

            await loadScript(script.value);
            loadedPageScripts.add(script.absolute);
            assertCurrent();
        }
    }

    function sameDocument(currentValue, targetValue) {
        const current = new URL(currentValue, location.href);
        const target = new URL(targetValue, current);
        return current.origin === target.origin
            && current.pathname === target.pathname
            && current.search === target.search;
    }

    function dispatchNavigated(targetUrl, context) {
        window.dispatchEvent(new CustomEvent('terminal:navigated', {
            detail: {
                url: targetUrl,
                preserveShell: context.preserveShell,
                shellPath: context.shellPath
            }
        }));
    }

    function scrollToHash(targetUrl, preserveShell) {
        if (preserveShell) return;
        const target = new URL(targetUrl, location.href);
        if (!target.hash) return;
        const element = document.getElementById(decodeURIComponent(target.hash.slice(1)));
        element?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }

    function assertCurrent(context) {
        if (context.isCurrent()) return;
        const error = new Error('Navigation superseded');
        error.name = 'AbortError';
        throw error;
    }

    const navigationCoordinator = window.terminalNavigationCore?.createNavigationCoordinator({
        getCurrentUrl: () => renderedUrl,
        resolveUrl: (value, base) => new URL(value, base).href,
        isSameDocument: sameDocument,
        loadPage: async (targetUrl, context) => {
            const target = new URL(targetUrl, location.href);
            if (target.origin !== location.origin) throw new Error('Cross-origin soft navigation is not supported');
            const page = await window.terminalNavigationCore.loadNavigationDocument(target.href, context, {
                fetchPage: (value, signal) => fetch(value, {
                    credentials: 'same-origin',
                    signal
                }),
                parseDocument: (html) => new DOMParser().parseFromString(html, 'text/html')
            });
            assertCurrent(context);
            return page;
        },
        commitHash: async (targetUrl, context) => {
            assertCurrent(context);
            if (context.pushHistory && targetUrl !== renderedUrl) history.pushState(null, '', targetUrl);
            renderedUrl = targetUrl;
            scrollToHash(targetUrl, context.preserveShell);
            dispatchNavigated(targetUrl, context);
        },
        commitPage: async ({ dom, newHost }, context) => {
            const updatePage = async () => {
                const curHost = document.querySelector('.content-host');
                if (!curHost) throw new Error('Current page host is missing');

                await syncPageStyles(dom, () => assertCurrent(context));
                await ensurePageScripts(dom, () => assertCurrent(context));
                assertCurrent(context);

                const newTerminal = dom.querySelector('.terminal-box');
                const curTerminal = document.querySelector('.terminal-box');
                curHost._terminalCleanup?.();
                curHost._pageCleanup?.();

                document.title = dom.title || document.title;
                prepareReveal(newHost);
                curHost.replaceWith(newHost);

                if (newTerminal && curTerminal) {
                    curTerminal.setAttribute(
                        'data-terminal',
                        newTerminal.getAttribute('data-terminal') || '/assets/terminal/default.json'
                    );
                } else if (newTerminal && !curTerminal) {
                    newHost.insertAdjacentElement('beforebegin', newTerminal);
                } else if (!newTerminal && curTerminal) {
                    curTerminal.remove();
                }

                if (context.pushHistory) history.pushState(null, '', context.targetUrl);
                renderedUrl = context.targetUrl;

                window.initTerminal?.(document);
                window.initNav?.(document);
                window.initPageScripts?.(document);
                window.closeDrawer?.();
                scrollToHash(context.targetUrl, context.preserveShell);
                startReveal(newHost);
                dispatchNavigated(context.targetUrl, context);
            };

            if (supportsVTA) {
                const transition = document.startViewTransition(updatePage);
                await transition.updateCallbackDone;
            } else {
                await updatePage();
            }
        },
        hardNavigate: (targetUrl, context) => {
            if (context.pushHistory) location.assign(targetUrl);
            else location.replace(targetUrl);
        }
    });

    async function navigate(url, options = {}) {
        if (window.closeDrawer) window.closeDrawer();
        if (!navigationCoordinator) {
            if (options.pushHistory === false) location.replace(url);
            else location.assign(url);
            return;
        }
        await navigationCoordinator.navigate(url, options);
    }

    window.terminalNavigate = navigate;

    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        if (a.dataset.terminalBypass === '1') return;

        const action = window.terminalActions?.resolveAction?.(a, e);
        if (action) {
            e.preventDefault();
            const reservedWindow = reserveExternalWindow(a, action);

            const runAction = async () => {
                if (action.mode === 'native') {
                    if (reservedWindow && action.name === 'external-link') {
                        return;
                    }

                    window.terminalActions?.triggerNativeLink?.(a);
                    return;
                }

                if (window.closeDrawer) window.closeDrawer();
                await navigate(action.href || a.href, { pushHistory: true });
            };

            if (reservedWindow && action.name === 'external-link') {
                try {
                    reservedWindow.location.replace(action.href || a.href);
                } catch (_) {
                    try {
                        reservedWindow.close();
                    } catch (_) {}
                    runAction();
                    return;
                }

                if (window.playTerminalCommand && action.command) {
                    window.playTerminalCommand(action.command, {
                        resumeCycleAfterMs: action.resumeCycleAfterMs || 0
                    });
                    return;
                }

                return;
            }

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
        navigate(location.href, { pushHistory: false });
    });

    if (window.initTerminal) window.initTerminal(document);
    if (window.initNav) window.initNav(document);
    if (window.initPageScripts) window.initPageScripts(document);
    prepareReveal(document.querySelector('.content-host'));
    startReveal(document.querySelector('.content-host'));
})();
