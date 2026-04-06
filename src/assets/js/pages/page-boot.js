(() => {
    function initCollectionPage(root, options, cleanups) {
        const suffix = root.querySelector(options.suffixSelector);
        if (!suffix) return;

        const groups = Array.from(root.querySelectorAll('details.group'));
        if (!groups.length) return;

        let activeId = null;

        const setBreadcrumb = (slug, label) => {
            suffix.innerHTML = slug ? options.formatCrumb(slug, label) : '';
            try {
                if (slug) history.replaceState(null, '', `#${slug}`);
                else history.replaceState(null, '', location.pathname);
            } catch (_) {}
        };

        const setActive = (el) => {
            groups.forEach((group) => group.classList.remove('is-active'));
            if (el) el.classList.add('is-active');
        };

        const clickHandlers = [];
        root.querySelectorAll('details.group > summary').forEach((summary) => {
            const onClick = () => {
                const wrap = summary.parentElement;
                const slug = wrap?.dataset?.slug;
                const label = (wrap?.dataset?.group || '').toLowerCase();

                setTimeout(() => {
                    if (!wrap.open) {
                        setBreadcrumb(null, null);
                        setActive(null);
                        return;
                    }

                    setBreadcrumb(slug, label);
                    setActive(wrap);
                }, 0);
            };

            summary.addEventListener('click', onClick);
            clickHandlers.push(() => summary.removeEventListener('click', onClick));
        });

        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0));

            if (!visible.length) {
                setBreadcrumb(null, null);
                setActive(null);
                activeId = null;
                return;
            }

            const top = visible[0].target;
            const slug = top.dataset.slug;
            const label = (top.dataset.group || '').toLowerCase();

            if (top.open && top.id !== activeId) {
                activeId = top.id;
                setBreadcrumb(slug, label);
                setActive(top);
            }
        }, {
            root: null,
            rootMargin: '-20% 0px -40% 0px',
            threshold: [0.2, 0.4, 0.6, 0.8]
        });

        groups.forEach((group) => observer.observe(group));

        const slug = (location.hash || '').replace(/^#/, '');
        if (!slug) {
            setBreadcrumb(null, null);
        } else {
            const el = root.querySelector('#group-' + slug);
            if (el) {
                if (!el.open) el.open = true;
                el.scrollIntoView({ behavior: 'instant', block: 'start' });
                setBreadcrumb(slug, (el.dataset.group || '').toLowerCase());
                setActive(el);
            } else {
                setBreadcrumb(null, null);
            }
        }

        cleanups.push(() => {
            clickHandlers.forEach((cleanup) => cleanup());
            observer.disconnect();
        });
    }

    function initMixesPage(root, cleanups) {
        initCollectionPage(root, {
            suffixSelector: '#groupSuffix',
            formatCrumb: (slug, label) => `<a href="/music/mixes#${slug}">/${label || slug}</a>`
        }, cleanups);
    }

    function initGigsPage(root, cleanups) {
        initCollectionPage(root, {
            suffixSelector: '#yearSuffix',
            formatCrumb: (slug, label) => {
                if (slug === 'tba') {
                    return '<a href="/music/gigs#tba">/to-be-announced</a>';
                }

                return `<a href="/music/gigs#${slug}">/${label || slug.replace(/^y-/, '')}</a>`;
            }
        }, cleanups);
    }

    function initPhotosPage(root, cleanups) {
        initCollectionPage(root, {
            suffixSelector: '#photosSuffix',
            formatCrumb: (slug, label) => `<a href="/music/photos#${slug}">/${label || slug.replace(/^y-/, '')}</a>`
        }, cleanups);
    }

    window.initPageScripts = function initPageScripts(root = document) {
        const cleanups = [];

        initMixesPage(root, cleanups);
        initGigsPage(root, cleanups);
        initPhotosPage(root, cleanups);

        const host = document.querySelector('.content-host');
        if (host) {
            host._pageCleanup = () => {
                cleanups.forEach((cleanup) => {
                    try {
                        cleanup();
                    } catch (_) {}
                });
                host._pageCleanup = null;
            };
        }
    };
})();
