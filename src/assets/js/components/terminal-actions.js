(() => {
    const utils = window.terminalActionUtils || {};
    const {
        buildTerminalPath,
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
    } = utils;

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
            name: 'blog-post',
            match: (anchor, event) => isInternalNav(anchor, event) && isBlogPostPath(new URL(anchor.href, location.href).pathname),
            buildCommand: (anchor) => `cat ${toBlogSourcePath(anchor)}`,
            mode: 'transition',
            href: (anchor) => anchor.href
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
        buildTerminalPath: buildTerminalPath || ((pathname) => [{ href: pathname || '/', label: pathname || '/home/fm' }]),
        buildShellPathFromLabels: buildShellPathFromLabels || ((labels = []) => labels),
        resolveAction,
        triggerNativeLink,
        commands
    };
})();
