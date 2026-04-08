(() => {
    function normalizePathname(pathname) {
        if (!pathname || pathname === '/') return '/';

        return pathname.endsWith('/') ? pathname : `${pathname}/`;
    }

    function buildTerminalPath(pathname) {
        const normalized = normalizePathname(pathname);
        const rawSegments = normalized.split('/').filter(Boolean);
        const isHomePage = normalized === '/';
        const parts = [
            {
                href: '/',
                label: isHomePage ? '/home/fm' : '~',
                title: '/home/fm',
                shellPath: '/home/fm'
            }
        ];

        let currentPath = '';
        let currentShellPath = '/home/fm';
        rawSegments.forEach((segment) => {
            currentPath += `/${segment}`;
            currentShellPath += `/${segment}`;
            parts.push({
                href: `${currentPath}/`,
                label: `/${segment}`,
                title: currentShellPath,
                shellPath: currentShellPath
            });
        });

        return parts;
    }

    function toShellPath(pathname) {
        return buildTerminalPath(pathname)
            .map((part) => part.label)
            .join('');
    }

    function buildShellPathFromLabels(labels = []) {
        let currentShellPath = '';

        return labels.map((label, index) => {
            const normalizedLabel = index === 0 && label === '~' ? '/home/fm' : label;
            currentShellPath = index === 0 ? normalizedLabel : `${currentShellPath}${normalizedLabel}`;
            return currentShellPath;
        });
    }

    function isInternalNav(anchor, event) {
        if (!anchor || anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey) return false;
        const url = new URL(anchor.href, location.href);

        return url.origin === location.origin;
    }

    function isBlogPostPath(pathname) {
        const normalized = normalizePathname(pathname);
        const segments = normalized.split('/').filter(Boolean);

        return segments.length === 2 && segments[0] === 'blog';
    }

    function isMailLink(anchor, event) {
        if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey) return false;
        if (anchor.dataset.terminalBypass === '1') return false;

        return (anchor.getAttribute('href') || '').startsWith('mailto:');
    }

    function isDownloadLink(anchor, event) {
        if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey) return false;
        if (anchor.dataset.terminalBypass === '1') return false;
        if (anchor.hasAttribute('download')) return true;

        try {
            const url = new URL(anchor.href, location.href);
            return /\.(zip|pdf|dmg|pkg|tar|tgz|gz|bz2|xz|7z)$/i.test(url.pathname);
        } catch (_) {
            return false;
        }
    }

    function isOpenableWebLink(anchor, event) {
        if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey) return false;
        if (anchor.dataset.terminalBypass === '1') return false;

        const href = anchor.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) return false;

        try {
            const url = new URL(anchor.href, location.href);
            return url.origin !== location.origin || anchor.target === '_blank';
        } catch (_) {
            return false;
        }
    }

    function getMailAddress(anchor) {
        const href = anchor?.href || '';
        if (!href.startsWith('mailto:')) return 'mailbox';

        try {
            const url = new URL(href);
            return decodeURIComponent(url.pathname || 'mailbox');
        } catch (_) {
            return href.replace(/^mailto:/, '') || 'mailbox';
        }
    }

    function getDownloadDisplayPath(anchor) {
        const href = anchor?.href;
        if (!href) return '/home/fm/assets/download';

        try {
            const url = new URL(href, location.href);
            const fileName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'download');
            return `/home/fm/assets/${fileName}`;
        } catch (_) {
            return '/home/fm/assets/download';
        }
    }

    function resolveInternalShellPath(anchor) {
        if (anchor?.dataset?.terminalCd) {
            return anchor.dataset.terminalCd;
        }

        return toShellPath(new URL(anchor.href, location.href).pathname);
    }

    function toBlogSourcePath(anchor) {
        const url = new URL(anchor.href, location.href);
        const segments = normalizePathname(url.pathname).split('/').filter(Boolean);
        const slug = segments[1] || 'post';

        return `/home/fm/blog/${slug}.md`;
    }

    window.terminalActionUtils = {
        normalizePathname,
        buildTerminalPath,
        toShellPath,
        buildShellPathFromLabels,
        isInternalNav,
        isBlogPostPath,
        isMailLink,
        isDownloadLink,
        isOpenableWebLink,
        getMailAddress,
        getDownloadDisplayPath,
        resolveInternalShellPath,
        toBlogSourcePath
    };
})();
