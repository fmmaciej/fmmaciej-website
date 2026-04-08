(() => {
    function initMixesPage(root, cleanups) {
        window.initCollectionPage?.(root, {
            suffixSelector: '#terminalPathSuffix',
            formatCrumb: (slug, label) => `<a href="/music/mixes#${slug}">/${label || slug}</a>`
        }, cleanups);
    }

    function initGigsPage(root, cleanups) {
        window.initCollectionPage?.(root, {
            suffixSelector: '#terminalPathSuffix',
            formatCrumb: (slug, label) => {
                if (slug === 'tba') {
                    return '<a href="/music/gigs#tba">/to-be-announced</a>';
                }

                return `<a href="/music/gigs#${slug}">/${label || slug.replace(/^y-/, '')}</a>`;
            }
        }, cleanups);
    }

    function initPhotosPage(root, cleanups) {
        window.initCollectionPage?.(root, {
            suffixSelector: '#terminalPathSuffix',
            formatCrumb: (slug, label) => `<a href="/music/photos#${slug}">/${label || slug.replace(/^y-/, '')}</a>`
        }, cleanups);
    }

    function initBlogPage(root, cleanups) {
        window.initCollectionPage?.(root, {
            suffixSelector: '#terminalPathSuffix',
            formatCrumb: () => '',
            syncHash: false
        }, cleanups);
    }

    window.initPageScripts = function initPageScripts(root = document) {
        const cleanups = [];
        const path = window.location.pathname;

        if (path.startsWith('/music/mixes')) {
            initMixesPage(root, cleanups);
        } else if (path.startsWith('/music/gigs')) {
            initGigsPage(root, cleanups);
        } else if (path.startsWith('/music/photos')) {
            initPhotosPage(root, cleanups);
        } else if (path.startsWith('/blog')) {
            initBlogPage(root, cleanups);
        }

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
