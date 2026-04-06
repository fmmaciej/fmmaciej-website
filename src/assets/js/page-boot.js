(() => {
    function initMixesPage(root, cleanups) {
        const heading = root.querySelector('#mixesBreadcrumb');
        const suffix = root.querySelector('#groupSuffix');
        if (!heading || !suffix) return;

        const groups = Array.from(root.querySelectorAll('details.group'));
        let activeId = null;

        const fmt = (slug, label) =>
            slug ? `<a href="/music/mixes#${slug}">/${label || slug}</a>` : '';

        const setBreadcrumb = (slug, label) => {
            suffix.innerHTML = slug ? fmt(slug, label) : '';
            if (slug) history.replaceState(null, '', '#' + slug);
            else history.replaceState(null, '', location.pathname);
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

    function initGigsPage(root, cleanups) {
        const suffix = root.querySelector('#yearSuffix');
        if (!suffix) return;

        const details = Array.from(root.querySelectorAll('.year-details'));

        const fmt = (group) => {
            if (!group) return '';
            if (group === 'tba') return '<a href="/music/gigs#tba">/to-be-announced</a>';
            return `<a href="/music/gigs#y-${group}">/${group}</a>`;
        };

        const setCrumb = (group) => {
            suffix.innerHTML = group ? fmt(group) : '';
            try {
                if (group === 'tba') history.replaceState(null, '', '#tba');
                else if (group) history.replaceState(null, '', '#y-' + group);
                else history.replaceState(null, '', location.pathname);
            } catch (_) {}
        };

        const topmostOpenYear = () => {
            const open = details.filter((detail) => detail.open);
            if (!open.length) return null;

            open.sort((a, b) => Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top));
            return open[0].dataset.year || null;
        };

        const toggleHandlers = details.map((detail) => {
            const onToggle = () => {
                const year = detail.open ? detail.dataset.year : topmostOpenYear();
                setCrumb(year);
            };

            detail.addEventListener('toggle', onToggle);
            return () => detail.removeEventListener('toggle', onToggle);
        });

        setCrumb(null);

        const hash = location.hash || '';
        const match = hash.match(/^#y-(\d{4})$/);
        const target = hash === '#tba'
            ? root.querySelector('.year-details[data-year="tba"]')
            : (match ? root.querySelector(`.year-details[data-year="${match[1]}"]`) : null);

        if (target && !target.open) {
            target.open = true;
            setCrumb(target.dataset.year);
            const sectionId = target.dataset.year === 'tba' ? 'tba' : 'y-' + target.dataset.year;
            const section = root.querySelector('#' + sectionId);
            if (section) section.scrollIntoView({ behavior: 'instant', block: 'start' });
        }

        cleanups.push(() => {
            toggleHandlers.forEach((cleanup) => cleanup());
        });
    }

    window.initPageScripts = function initPageScripts(root = document) {
        const cleanups = [];

        initMixesPage(root, cleanups);
        initGigsPage(root, cleanups);

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
