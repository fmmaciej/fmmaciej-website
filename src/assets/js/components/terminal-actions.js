(() => {
    function normalizePathname(pathname) {
        if (!pathname || pathname === '/') return '/';

        return pathname.endsWith('/') ? pathname : `${pathname}/`;
    }

    function buildTerminalPath(pathname) {
        const normalized = normalizePathname(pathname);
        const rawSegments = normalized.split('/').filter(Boolean);
        const parts = [
            { href: '/', label: '/home/fm' }
        ];

        let currentPath = '';
        rawSegments.forEach((segment) => {
            currentPath += `/${segment}`;
            parts.push({
                href: `${currentPath}/`,
                label: `/${segment}`
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
            currentShellPath = index === 0 ? label : `${currentShellPath}${label}`;
            return currentShellPath;
        });
    }

    function isInternalNav(anchor, event) {
        if (!anchor || anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey) return false;
        const url = new URL(anchor.href, location.href);

        return url.origin === location.origin;
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

    const actions = [
        {
            name: 'mail',
            match: isMailLink,
            buildCommand: (anchor) => `mail ${getMailAddress(anchor)}`,
            mode: 'native',
            resumeCycleAfterMs: 1200
        },
        {
            name: 'download',
            match: isDownloadLink,
            buildCommand: (anchor) => `wget "${getDownloadDisplayPath(anchor)}"`,
            mode: 'native',
            resumeCycleAfterMs: 1200
        },
        {
            name: 'external-link',
            match: isOpenableWebLink,
            buildCommand: (anchor) => `open "${anchor.href}"`,
            mode: 'native',
            resumeCycleAfterMs: 1200
        },
        {
            name: 'internal-navigation',
            match: (anchor, event) => {
                if ((anchor.getAttribute('href') || '').startsWith('#')) return false;
                return isInternalNav(anchor, event);
            },
            buildCommand: (anchor) => `cd ${resolveInternalShellPath(anchor)}`,
            mode: 'transition',
            href: (anchor) => anchor.href
        }
    ];

    function resolveAction(anchor, event) {
        if (!anchor || anchor.dataset.terminalBypass === '1') return null;

        const action = actions.find((entry) => entry.match(anchor, event));
        if (!action) return null;

        return {
            name: action.name,
            command: action.buildCommand(anchor, event),
            mode: action.mode,
            href: action.href ? action.href(anchor, event) : anchor.href,
            resumeCycleAfterMs: action.resumeCycleAfterMs || 0
        };
    }

    function triggerNativeLink(anchor) {
        const link = document.createElement('a');
        link.href = anchor.href;
        link.dataset.terminalBypass = '1';

        if (anchor.hasAttribute('download')) {
            link.setAttribute('download', anchor.getAttribute('download') || '');
        }

        if (anchor.target) link.target = anchor.target;
        if (anchor.rel) link.rel = anchor.rel;

        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    const commands = {
        theme: (value) => `theme ${value}`
    };

    window.terminalActions = {
        actions,
        buildTerminalPath,
        buildShellPathFromLabels,
        resolveAction,
        triggerNativeLink,
        commands
    };
})();
