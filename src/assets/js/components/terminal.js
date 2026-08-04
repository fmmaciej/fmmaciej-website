window.initTerminal = function initTerminal(root = document){
    const termBox = root.querySelector('.terminal-box');
    if (!termBox) return;

    const typed = termBox.querySelector('#typedText');
    if (!typed) return;

    const cursorEl = termBox.querySelector('#cursor');
    const pathEl = termBox.querySelector('#terminalPath');
    const clockEl = termBox.querySelector('#terminalClock');
    const locationEl = termBox.querySelector('.terminal-location');
    const host = root.querySelector('.content-host') || document.body;
    if (!host) return;

    host._terminalCleanup?.();
    host._terminalCleanup = null;
    host.querySelectorAll('.terminal-overlay').forEach((node) => node.remove());

    const cfgPath = termBox.getAttribute('data-terminal') || '/assets/terminal/default.json';
    const defaultsUrl = '/assets/terminal/config.json';
    const idleCore = window.terminalIdleCore;
    const matrix = window.terminalMatrix;
    const initController = new AbortController();
    let disposed = false;

    const overlay = document.createElement('div');
    overlay.className = 'terminal-overlay';
    const layer = document.createElement('pre');
    layer.className = 'layer';
    overlay.appendChild(layer);
    host.insertAdjacentElement('afterbegin', overlay);

    function positionOverlayBelowTerminal(){
        const hostRect = host.getBoundingClientRect();
        const termRect = termBox.getBoundingClientRect();
        const baseTop = Math.max(0, termRect.bottom - hostRect.top);
        host.style.setProperty('--overlay-start', `${baseTop}px`);
    }

    function setFooterVar(){
        const footer = document.querySelector('footer');
        const height = footer ? footer.getBoundingClientRect().height : 64;
        host.style.setProperty('--footer-height', `${height}px`);
    }

    const buildTerminalPath = window.terminalActions?.buildTerminalPath
        || ((pathname) => [{ href: pathname || '/', label: pathname || '/home/fm' }]);
    const buildShellPathFromLabels = window.terminalActions?.buildShellPathFromLabels
        || ((labels = []) => labels);

    function getCustomPathSource() {
        return root.querySelector('.terminal-path-source');
    }

    function annotateTerminalPathLinks() {
        if (!locationEl) return;
        const links = Array.from(locationEl.querySelectorAll('a'));
        const labels = links.map((link) => (link.textContent || '').trim()).filter(Boolean);
        const shellPaths = buildShellPathFromLabels(labels);
        links.forEach((link, index) => {
            link.dataset.terminalCd = link.dataset.shellPath || shellPaths[index] || '';
        });
    }

    function normalizeHomeLink(link) {
        if (!link) return;
        const text = (link.textContent || '').trim();
        const shellPath = link.dataset.shellPath || '';
        if (text !== '/home/fm' && shellPath !== '/home/fm') return;
        if (window.location.pathname === '/') return;
        link.textContent = '~';
        link.title = 'Jump to: /home/fm';
        link.dataset.shellPath = '/home/fm';
    }

    function renderTerminalPath() {
        if (!pathEl) return;
        const customPathSource = getCustomPathSource();
        if (customPathSource) {
            pathEl.innerHTML = customPathSource.innerHTML;
            normalizeHomeLink(pathEl.querySelector('a, span'));
            annotateTerminalPathLinks();
            return;
        }

        const parts = buildTerminalPath(window.location.pathname);
        pathEl.innerHTML = parts
            .map((part) => `<a href="${part.href}" title="Jump to: ${part.title || part.label.replace(/^\//, '')}" data-shell-path="${part.shellPath || ''}">${part.label}</a>`)
            .join('');
        annotateTerminalPathLinks();
    }

    function formatClock() {
        return `[${new Intl.DateTimeFormat(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(new Date())}]`;
    }

    function updateClock() {
        if (clockEl) clockEl.textContent = formatClock();
    }

    positionOverlayBelowTerminal();
    setFooterVar();
    requestAnimationFrame(positionOverlayBelowTerminal);
    renderTerminalPath();
    updateClock();

    const onResize = () => {
        positionOverlayBelowTerminal();
        setFooterVar();
    };
    window.addEventListener('resize', onResize);

    const joinOutput = (output) => Array.isArray(output) ? output.join('\n') : (output || '');
    const isReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
    const abortableDelay = idleCore?.delay || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    let idleScheduler = null;
    let restartCycle = null;
    let manualController = null;
    let shellBinding = null;
    let pathObserver = null;
    const clockHandle = window.setInterval(updateClock, 30000);

    function throwIfAborted(signal) {
        if (!signal?.aborted) return;
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
    }

    async function typeCommand(command, typingDelayMs, signal){
        typed.textContent = '';
        if (cursorEl && cursorEl.parentElement !== typed.parentElement) typed.after(cursorEl);
        if (isReducedMotion() || typingDelayMs <= 0) {
            typed.textContent = command;
            return;
        }

        for (let index = 0; index < command.length; index += 1) {
            throwIfAborted(signal);
            const expected = command.slice(0, index);
            if (!typed.textContent.startsWith(expected)) typed.textContent = expected;
            typed.textContent += command.charAt(index);
            await abortableDelay(typingDelayMs, signal);
        }
    }

    async function typeOverlay(textOrLines, timing, signal) {
        const text = joinOutput(textOrLines);
        layer.textContent = '';
        if (isReducedMotion() || timing.charDelayMs <= 0) {
            layer.textContent = text;
            return;
        }

        let index = 0;
        while (index < text.length) {
            throwIfAborted(signal);
            const batchSize = timing.charDelayMs <= 10 ? 3 : 1;
            let batch = batchSize;
            let newline = false;
            while (batch-- > 0 && index < text.length) {
                const character = text[index++];
                layer.textContent += character;
                if (character === '\n') {
                    newline = true;
                    break;
                }
            }
            await abortableDelay(newline ? timing.linePauseMs : timing.charDelayMs, signal);
        }
    }

    async function playEntry(entry, signal, profiles, unknownProfiles) {
        const timing = idleCore.resolveTiming(profiles, entry, (profileName) => {
            if (unknownProfiles.has(profileName)) return;
            unknownProfiles.add(profileName);
            console.warn(`[terminal] unknown timing profile: ${profileName}`);
        });
        const reduced = isReducedMotion();
        const effective = reduced
            ? { ...timing, typingDelayMs: 0, preDelayMs: 0, charDelayMs: 0, linePauseMs: 0 }
            : timing;

        layer.textContent = '';
        await typeCommand(entry?.cmd || '', effective.typingDelayMs, signal);
        await abortableDelay(effective.preDelayMs, signal);
        throwIfAborted(signal);

        if (entry?.type === 'matrix' && matrix) {
            const effect = matrix.start({
                mount: overlay,
                durationMs: reduced ? 1200 : effective.durationMs,
                frameDelayMs: effective.frameDelayMs,
                reducedDurationMs: 1200,
                reducedMotion: reduced,
                signal
            });
            await effect.finished;
            throwIfAborted(signal);
        } else {
            await typeOverlay(entry?.output || '', effective, signal);
        }

        await abortableDelay(effective.holdMs, signal);
    }

    async function fetchJSON(url) {
        try {
            const response = await fetch(url, { cache: 'no-cache', signal: initController.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            if (error?.name !== 'AbortError') console.warn(`[terminal] unable to load ${url}`, error);
            return null;
        }
    }

    function stopTerminalCycle() {
        idleScheduler?.stop();
        manualController?.abort();
        manualController = null;
    }

    async function playTerminalCommand(command, options = {}) {
        if (!command) return;
        stopTerminalCycle();
        const controller = new AbortController();
        manualController = controller;

        try {
            await typeCommand(command, options.typingMs ?? 10, controller.signal);
            await abortableDelay(isReducedMotion() ? 0 : options.pauseMs ?? 120, controller.signal);
        } catch (error) {
            if (error?.name !== 'AbortError') console.warn('[terminal] command preview failed', error);
            return;
        } finally {
            if (manualController === controller) manualController = null;
        }

        if (!controller.signal.aborted && options.resumeCycleAfterMs > 0) {
            restartCycle?.(options.resumeCycleAfterMs);
        }
    }

    window.playTerminalCommand = playTerminalCommand;

    shellBinding = window.initTerminalShell?.({
        termBox,
        host,
        stopIdle: stopTerminalCycle,
        resumeIdle: (delayMs) => restartCycle?.(delayMs),
        renderPagePath: renderTerminalPath
    });

    (async function initCycle(){
        if (!idleCore) {
            console.warn('[terminal] idle runtime unavailable');
            return;
        }

        const [loadedGlobal, loadedPage] = await Promise.all([
            fetchJSON(defaultsUrl),
            fetchJSON(cfgPath)
        ]);
        if (disposed || initController.signal.aborted) return;

        const globalConfig = loadedGlobal?.schemaVersion === 2 ? loadedGlobal : {};
        const pageConfig = loadedPage?.schemaVersion === 2 ? loadedPage : {};
        if (loadedGlobal && loadedGlobal.schemaVersion !== 2) {
            console.warn('[terminal] unsupported global idle configuration');
        }
        if (loadedPage && loadedPage.schemaVersion !== 2) {
            console.warn('[terminal] unsupported contextual idle configuration');
        }

        const selection = globalConfig.selection || {};
        const selector = idleCore.createCommandSelector({
            contextual: pageConfig.contextual,
            common: globalConfig.pools?.common,
            matrix: globalConfig.pools?.matrix,
            contextualPerCommon: selection.contextualPerCommon,
            easterEggEvery: selection.easterEggEvery
        });
        const profiles = globalConfig.timingProfiles || {};
        const unknownProfiles = new Set();

        idleScheduler = idleCore.createSequentialScheduler({
            select: () => selector.next(),
            play: (entry, signal) => playEntry(entry, signal, profiles, unknownProfiles),
            onError: (error) => console.warn('[terminal] idle sequence failed', error)
        });
        restartCycle = (delayMs = 1200) => {
            if (disposed) return;
            manualController?.abort();
            manualController = null;
            idleScheduler.start(delayMs);
        };

        if (!window.isTerminalShellBusy?.()) idleScheduler.start();
    })();

    if (locationEl) {
        pathObserver = new MutationObserver(() => annotateTerminalPathLinks());
        pathObserver.observe(locationEl, { childList: true, subtree: true, characterData: true });
    }

    host._terminalCleanup = () => {
        disposed = true;
        initController.abort();
        stopTerminalCycle();
        window.clearInterval(clockHandle);
        shellBinding?.dispose?.();
        shellBinding = null;
        pathObserver?.disconnect();
        window.removeEventListener('resize', onResize);
        overlay.remove();
        if (window.playTerminalCommand === playTerminalCommand) delete window.playTerminalCommand;
    };
};
