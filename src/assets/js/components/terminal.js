window.initTerminal = function initTerminal(root = document){
    const termBox  = root.querySelector('.terminal-box');
    if (!termBox) return;

    const typed    = termBox.querySelector('#typedText');
    if (!typed) return;

    const cursorEl   = termBox.querySelector('#cursor');
    const pathEl     = termBox.querySelector('#terminalPath');
    const clockEl    = termBox.querySelector('#terminalClock');
    const locationEl = termBox.querySelector('.terminal-location');

    const host = root.querySelector('.content-host') || document.body;
    if (!host) return;

    host.querySelectorAll('.terminal-overlay').forEach(n => n.remove());

    const cfgPath       = termBox.getAttribute('data-terminal') || '/assets/terminal/default.json';
    const DEFAULTS_URL  = '/assets/terminal/config.json';

    const overlay = document.createElement('div');
    overlay.className = 'terminal-overlay';

    const layer = document.createElement('pre');
    layer.className = 'layer';

    overlay.appendChild(layer);
    host.insertAdjacentElement('afterbegin', overlay);

    function positionOverlayBelowTerminal(){
        const hostRect = host.getBoundingClientRect();
        const termRect = termBox.getBoundingClientRect();
        const baseTop  = Math.max(0, termRect.bottom - hostRect.top);

        host.style.setProperty('--overlay-start', baseTop + 'px');
    }

    function setFooterVar(){
        const footer = document.querySelector('footer'); // footer jest poza hostem
        const h = footer ? footer.getBoundingClientRect().height : 64;

        host.style.setProperty('--footer-height', h + 'px');
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
            link.dataset.terminalCd = shellPaths[index] || '';
        });
    }

    function renderTerminalPath() {
        if (!pathEl) return;

        const customPathSource = getCustomPathSource();
        if (customPathSource) {
            pathEl.innerHTML = customPathSource.innerHTML;
            annotateTerminalPathLinks();
            return;
        }

        const parts = buildTerminalPath(window.location.pathname);
        pathEl.innerHTML = parts
            .map((part) => `<a href="${part.href}" title="Jump to: ${part.label.replace(/^\//, '')}">${part.label}</a>`)
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
        if (!clockEl) return;
        clockEl.textContent = formatClock();
    }

    positionOverlayBelowTerminal();
    setFooterVar();
    requestAnimationFrame(positionOverlayBelowTerminal);
    renderTerminalPath();
    updateClock();

    const onResize = () => { positionOverlayBelowTerminal(); setFooterVar(); };
    window.addEventListener('resize', onResize);

    const joinOutput = (out) => Array.isArray(out) ? out.join('\n') : (out || '');
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let runId = 0;
    let cleanup = null;

    const renderText = (text) => { layer.textContent = joinOutput(text); };
    const renderHex  = (text) => { layer.textContent = joinOutput(text); };

    function renderMatrix(durationMs = 2000){
        const rect  = host.getBoundingClientRect();
        const charW = 8;    // przy 14px mono ~8px/znak
        const charH = 18;   // ~line-height
        const cols  = Math.max(40, Math.floor(rect.width  / charW));
        const rows  = Math.max(12, Math.floor(rect.height / charH));
        const charset = '01';

        let stop = false, rafId = 0;
        const draw = () => {
            if (stop) return;
            let out = '';
            for (let r = 0; r < rows; r++){

                let line = '';
                for (let c = 0; c < cols; c++){
                    line += Math.random() < 0.5 ? ' ' : charset[(Math.random()*charset.length)|0];
                }

                out += (r ? '\n' : '') + line;
            }
            layer.textContent = out;
            rafId = requestAnimationFrame(draw);
        };

        // dopnij warstwę do wysokości hosta (żeby dociągało do prawej i do dołu)
        layer.style.height = rect.height + 'px';

        rafId = requestAnimationFrame(draw);
        const timer = setTimeout(() => { stop = true; cancelAnimationFrame(rafId); }, durationMs);

        return () => { stop = true; cancelAnimationFrame(rafId); clearTimeout(timer); };
    }

    // --- robust typing with sabotage-guard ---
    async function typeCommand(cmd, typingDelayMs, token){
        typed.textContent = '';
        // ustaw kursor tuż za typed
        if (cursorEl && cursorEl.parentElement !== typed.parentElement) typed.after(cursorEl);

        let i = 0;
        while (i < cmd.length) {
        if (token !== runId) return false;
        // jeśli ktoś nam „z przodu” wkleił całą komendę, przywróć właściwy prefiks
        const expected = cmd.slice(0, i);
        if (!typed.textContent.startsWith(expected)) {
            typed.textContent = expected;
        }
        // dopisz kolejny znak
        typed.textContent += cmd.charAt(i++);
        await sleep(typingDelayMs);
        }
        return token === runId;
    }

    function typeOverlay(targetEl, textOrLines, opts = {}) {
        const reduced  = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const text     = Array.isArray(textOrLines) ? textOrLines.join('\n') : (textOrLines || '');
        const charDelay = Math.max(1, opts.charDelayMs ?? (reduced ? 0 : 12));
        const linePause = Math.max(0, opts.linePauseMs ?? (reduced ? 0 : 120));
        const token = opts.token;

        let i = 0, cancelled = false;
        targetEl.textContent = '';

        if (reduced || charDelay === 0) {
            targetEl.textContent = text;

            return () => { cancelled = true; };
        }

        const tick = () => {
            if (cancelled || token !== runId) return;

            const batch = charDelay <= 10 ? 3 : 1;
            let count = batch;
            while (count-- && i < text.length && !cancelled) {
                const ch = text[i++];
                targetEl.textContent += ch;

                if (ch === '\n' && linePause > 0) { 
                    setTimeout(tick, linePause);
                    return;
                }
            }
            if (i < text.length) setTimeout(tick, charDelay);
        };

        setTimeout(tick, charDelay);

        return () => { cancelled = true; };
    }

    async function fetchJSON(url){
        try {
            const r = await fetch(url, { cache: 'no-cache' });
            if (!r.ok) throw new Error('HTTP '+r.status);

            return await r.json();
        } catch { 
            return null;
        }
    }

    let intervalHandle = null;
    let clockHandle = window.setInterval(updateClock, 30000);
    let pathObserver = null;
    let restartCycle = null;

    function stopTerminalCycle() {
        runId += 1;
        if (intervalHandle) {
            clearInterval(intervalHandle);
            intervalHandle = null;
        }
    }

    async function playTerminalCommand(command, options = {}) {
        if (!command) return;
        stopTerminalCycle();
        if (cleanup) {
            cleanup();
            cleanup = null;
        }

        const typingMs = options.typingMs ?? 10;
        const pauseMs = options.pauseMs ?? 120;
        const resumeCycleAfterMs = options.resumeCycleAfterMs ?? 0;
        const token = runId;
        await typeCommand(command, typingMs, token);
        await sleep(pauseMs);

        if (token === runId && resumeCycleAfterMs > 0) {
            restartCycle?.(resumeCycleAfterMs);
        }
    }

    (async function init(){
        const globalDefaults = await fetchJSON(DEFAULTS_URL) || {};
        const pageCfg = await fetchJSON(cfgPath) || {};
        const builtins = { 
            random:true, 
            intervalMs:10000, 
            typingDelayMs:25, 
            preDelayMs:250, 
            charDelayMs:12, 
            linePauseMs:120, 
            fadeMs:0 
        };

        const base = { ...builtins, ...globalDefaults, ...pageCfg };
        const commands = Array.isArray(pageCfg.commands) ? pageCfg.commands : [];
        const cfg = { ...base, commands };

        const cmds       = cfg.commands;
        const random     = !!cfg.random;

        const valNum = v => Number.isFinite(+v) ? +v : undefined;
        const clamp  = (x,min,max) => Math.min(max, Math.max(min, x));

        const intervalMs = clamp(valNum(cfg.intervalMs) ?? 10000, 3000, 60000);
        const typingMs   = clamp(valNum(cfg.typingDelayMs) ?? 25, 5, 200);
        const preDelayMs = clamp(valNum(cfg.preDelayMs) ?? 250, 0, 5000);
        const fadeMs     = clamp(valNum(cfg.fadeMs) ?? 0, 0, 5000);

        if (!cmds.length) return;

        let idx = 0;

        const runOne = async () => {
            const token = ++runId;
            if (cleanup) { cleanup(); cleanup = null; }

            const item = random ? cmds[(Math.random()*cmds.length)|0] : cmds[idx++ % cmds.length];

            const typedOk = await typeCommand(item?.cmd || '', typingMs, token);
            if (!typedOk) return;
            await sleep(preDelayMs);
            if (token !== runId) return;

            const charD = item?.charDelayMs ?? cfg.charDelayMs;
            const lineP = item?.linePauseMs ?? cfg.linePauseMs;

            switch (item?.type) {
                case 'matrix':
                    cleanup = renderMatrix(item.durationMs || 2000);
                    break;
                case 'hex':
                case 'text':
                default:
                    cleanup = typeOverlay(layer, item.output || '', { charDelayMs: charD, linePauseMs: lineP, token });
                    break;
            }

            if (fadeMs > 0) {
                overlay.classList.add('fade');
                setTimeout(() => overlay.classList.remove('fade'), fadeMs);
            }
        };

        restartCycle = (delayMs = 1200) => {
            if (intervalHandle) {
                clearInterval(intervalHandle);
            }

            window.setTimeout(() => {
                if (!termBox.isConnected) return;
                runOne();
                intervalHandle = setInterval(runOne, intervalMs);
            }, delayMs);
        };

        await runOne();
        intervalHandle = setInterval(runOne, intervalMs);

        console.log("[terminal] cfg", { intervalMs, typingMs, preDelayMs, fadeMs });
    })();

    if (locationEl) {
        pathObserver = new MutationObserver(() => annotateTerminalPathLinks());
        pathObserver.observe(locationEl, { childList: true, subtree: true, characterData: true });
    }

    window.playTerminalCommand = playTerminalCommand;

    host._terminalCleanup?.();
    host._terminalCleanup = () => {
        try {
            intervalHandle && clearInterval(intervalHandle);
        } catch {}

        try {
            clockHandle && clearInterval(clockHandle);
        } catch {}

        runId += 1;
        restartCycle = null;
        pathObserver?.disconnect();
        window.removeEventListener('resize', onResize);
        host.querySelectorAll('.terminal-overlay').forEach(n => n.remove());
    };
}
