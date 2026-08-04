(() => {
    const MANIFEST_URL = '/assets/terminal/filesystem.json';
    const STORAGE_KEY = 'terminalShell:v1';
    let runtime = null;
    let currentBinding = null;

    function loadManifest() {
        return fetch(MANIFEST_URL, { cache: 'no-cache' }).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        });
    }

    function readStoredSession() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (_) {
            return null;
        }
    }

    function writeStoredSession(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch (_) {}
    }

    function removeStoredSession() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
    }

    function isExternalUrl(value) {
        try {
            return new URL(value, location.href).origin !== location.origin;
        } catch (_) {
            return false;
        }
    }

    class TerminalShellController {
        constructor(manifest, onStateChange) {
            this.core = window.terminalShellCore;
            this.filesystem = this.core.createFilesystem(manifest);
            const fallbackCwd = this.filesystem.pathForRoute(location.href);
            const restored = this.core.restoreSession(this.filesystem, readStoredSession(), fallbackCwd);
            this.state = {
                cwd: restored.cwd,
                previousCwd: restored.previousCwd,
                history: restored.history
            };
            this.transcript = restored.transcript;
            this.active = false;
            this.historyIndex = this.state.history.length;
            this.historyDraft = '';
            this.lastCompletionKey = '';
            this.bindingCleanup = [];
            this.options = null;
            this.onStateChange = onStateChange;
            this.effect = null;
        }

        bind(options) {
            this.unbind();
            this.options = options;
            this.termBox = options.termBox;
            this.activator = this.termBox.querySelector('#terminalActivator');
            this.panel = this.termBox.querySelector('#terminalShellPanel');
            this.transcriptEl = this.termBox.querySelector('#terminalShellTranscript');
            this.form = this.termBox.querySelector('#terminalShellForm');
            this.input = this.termBox.querySelector('#terminalShellInput');
            this.prompt = this.termBox.querySelector('#terminalShellPrompt');
            this.pathEl = this.termBox.querySelector('#terminalPath');
            this.effectStatus = this.termBox.querySelector('#terminalShellEffectStatus');

            if (!this.activator || !this.panel || !this.form || !this.input) return;

            const listen = (target, event, handler, eventOptions) => {
                target.addEventListener(event, handler, eventOptions);
                this.bindingCleanup.push(() => target.removeEventListener(event, handler, eventOptions));
            };

            listen(this.form, 'submit', (event) => {
                event.preventDefault();
                this.runInput();
            });
            listen(this.input, 'keydown', (event) => this.onInputKeydown(event));
            listen(document, 'pointerdown', (event) => {
                if (!this.active || this.termBox.contains(event.target)) return;
                this.collapse({ restoreFocus: false });
            });
            listen(window, 'terminal:navigated', (event) => this.onNavigated(event));

            this.renderTranscript();
            this.renderPrompt();
            if (this.active) {
                this.termBox.classList.add('is-shell-active');
                this.panel.hidden = false;
                this.activator.setAttribute('aria-expanded', 'true');
                this.options.stopIdle?.();
                this.renderShellPath();
            } else {
                this.termBox.classList.remove('is-shell-active');
                this.panel.hidden = true;
                this.activator.setAttribute('aria-expanded', 'false');
            }
        }

        unbind() {
            this.cancelEffect('dispose');
            this.bindingCleanup.splice(0).forEach((cleanup) => {
                try { cleanup(); } catch (_) {}
            });
        }

        activate() {
            if (this.active) return true;
            if (!this.termBox?.isConnected) return false;
            this.active = true;
            this.termBox.classList.add('is-shell-active');
            this.panel.hidden = false;
            this.activator.setAttribute('aria-expanded', 'true');
            this.options?.stopIdle?.();
            this.renderTranscript();
            this.renderPrompt();
            this.renderShellPath();
            requestAnimationFrame(() => {
                this.input.focus({ preventScroll: true });
                this.scrollTranscript();
            });
            return true;
        }

        collapse(options = {}) {
            if (!this.active) return;
            this.cancelEffect('collapse');
            this.active = false;
            this.termBox.classList.remove('is-shell-active');
            this.panel.hidden = true;
            this.activator.setAttribute('aria-expanded', 'false');
            this.input.value = '';
            this.options?.renderPagePath?.();
            this.options?.resumeIdle?.(1200);
            this.onStateChange?.('idle');
            if (options.restoreFocus !== false) this.activator.focus({ preventScroll: true });
        }

        renderShellPath() {
            if (!this.pathEl) return;
            this.pathEl.textContent = this.state.cwd;
        }

        renderPrompt() {
            if (!this.prompt) return;
            const path = this.core.shellPromptPath(this.state.cwd, this.filesystem.user.home);
            this.prompt.textContent = `[${this.filesystem.user.name}@${this.filesystem.user.host}] ${path} >`;
        }

        renderTranscript() {
            if (!this.transcriptEl) return;
            const fragment = document.createDocumentFragment();
            this.transcript.forEach((block) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'terminal-shell-block';
                if (block.command) {
                    const command = document.createElement('pre');
                    command.className = 'terminal-shell-command';
                    const promptPath = this.core.shellPromptPath(block.cwd, this.filesystem.user.home);
                    command.textContent = `[fm@void] ${promptPath} > ${block.command}`;
                    wrapper.append(command);
                }
                if (block.output) {
                    const output = document.createElement('pre');
                    output.className = 'terminal-shell-output';
                    output.textContent = block.output;
                    wrapper.append(output);
                }
                fragment.append(wrapper);
            });
            this.transcriptEl.replaceChildren(fragment);
            this.scrollTranscript();
        }

        scrollTranscript() {
            if (!this.transcriptEl) return;
            requestAnimationFrame(() => {
                this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
            });
        }

        persist() {
            writeStoredSession(this.core.serializeSession(this.filesystem, this.state, this.transcript));
        }

        appendBlock(command, output, cwd = this.state.cwd) {
            this.transcript.push({ command, output: output || '', cwd });
            this.renderTranscript();
        }

        async runInput() {
            const line = this.input.value.trim();
            this.input.value = '';
            this.lastCompletionKey = '';
            if (!line) return;

            const cwd = this.state.cwd;
            const result = this.core.executeCommand(this.filesystem, this.state, line);
            this.state = result.state;
            this.historyIndex = this.state.history.length;
            this.historyDraft = '';

            if (result.clear) {
                this.transcript = [];
                this.renderTranscript();
            } else if (!result.exit) {
                this.appendBlock(line, result.output, cwd);
            }

            if (result.exit) {
                removeStoredSession();
                this.transcript = [];
                const fallback = this.filesystem.pathForRoute(location.href);
                this.state = { cwd: fallback, previousCwd: null, history: [] };
                this.historyIndex = 0;
                this.renderTranscript();
                this.renderPrompt();
                this.collapse();
                return;
            }

            this.renderPrompt();
            this.renderShellPath();
            this.persist();

            if (result.action?.type === 'navigate') {
                await this.navigate(result.action.url, {
                    pushHistory: true,
                    preserveShell: true,
                    shellPath: this.state.cwd
                });
                this.input.focus({ preventScroll: true });
            } else if (result.action?.type === 'open') {
                await this.openAction(result.action);
            } else if (result.action?.type === 'effect' && result.action.name === 'matrix') {
                await this.runMatrixEffect();
            }
        }

        async runMatrixEffect() {
            const matrix = window.terminalMatrix;
            const panel = this.panel;
            const input = this.input;
            const status = this.effectStatus;
            if (!panel || !input || this.effect) return;

            const transcriptIndex = this.transcript.length - 1;
            const fail = (error) => {
                console.warn('[terminal] matrix effect failed', error);
                if (this.transcript[transcriptIndex]) {
                    this.transcript[transcriptIndex].output = 'cmatrix: effect unavailable';
                    this.renderTranscript();
                    this.persist();
                }
            };
            if (!matrix) {
                fail(new Error('Matrix runtime unavailable'));
                return;
            }

            input.readOnly = true;
            panel.setAttribute('aria-busy', 'true');
            if (status) status.textContent = 'cmatrix running; press Control+C to stop';

            let handle;
            try {
                handle = matrix.start({ mount: panel });
            } catch (error) {
                input.readOnly = false;
                panel.removeAttribute('aria-busy');
                if (status) status.textContent = '';
                fail(error);
                return;
            }
            const effect = { handle, input, panel, status, transcriptIndex };
            this.effect = effect;
            let outcome;
            try {
                outcome = await handle.finished;
            } catch (error) {
                outcome = { reason: 'error' };
                fail(error);
            }
            if (this.effect !== effect) return;
            this.effect = null;

            input.readOnly = false;
            panel.removeAttribute('aria-busy');
            if (status) status.textContent = '';
            if (outcome?.reason === 'interrupt' && this.transcript[transcriptIndex]) {
                this.transcript[transcriptIndex].output = '^C';
                this.renderTranscript();
                this.persist();
            }
            if (this.active && this.input === input) input.focus({ preventScroll: true });
        }

        cancelEffect(reason = 'cancel') {
            this.effect?.handle.cancel(reason);
        }

        async navigate(url, options) {
            if (window.terminalNavigate) {
                await window.terminalNavigate(url, options);
                return;
            }
            location.href = url;
        }

        async openAction(action) {
            const external = action.external || isExternalUrl(action.url);
            if (external || action.download || action.url.startsWith('mailto:')) {
                const link = document.createElement('a');
                link.href = action.url;
                link.dataset.terminalBypass = '1';
                if (action.download) link.download = '';
                if (!action.download && !action.url.startsWith('mailto:')) {
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                }
                document.body.append(link);
                link.click();
                link.remove();
                this.collapse({ restoreFocus: false });
                return;
            }

            await this.navigate(action.url, { pushHistory: true, preserveShell: false });
            this.collapse({ restoreFocus: false });
        }

        onInputKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.collapse();
                return;
            }
            if (this.effect) {
                event.preventDefault();
                if (event.ctrlKey && event.key.toLowerCase() === 'c') {
                    this.cancelEffect('interrupt');
                }
                return;
            }
            if (event.ctrlKey && event.key.toLowerCase() === 'l') {
                event.preventDefault();
                this.transcript = [];
                this.persist();
                this.renderTranscript();
                return;
            }
            if (event.ctrlKey && event.key.toLowerCase() === 'c') {
                event.preventDefault();
                this.input.value = '';
                this.lastCompletionKey = '';
                return;
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                this.navigateHistory(event.key === 'ArrowUp' ? -1 : 1);
                return;
            }
            if (event.key === 'Tab') {
                event.preventDefault();
                this.completeInput();
            }
        }

        navigateHistory(direction) {
            const history = this.state.history || [];
            if (!history.length) return;
            if (this.historyIndex === history.length) this.historyDraft = this.input.value;
            this.historyIndex = Math.max(0, Math.min(history.length, this.historyIndex + direction));
            this.input.value = this.historyIndex === history.length
                ? this.historyDraft
                : history[this.historyIndex];
            this.input.setSelectionRange(this.input.value.length, this.input.value.length);
        }

        completeInput() {
            const before = this.input.value;
            const completion = this.core.completeInput(this.filesystem, before, this.state.cwd);
            const completionKey = `${before}\u0000${completion.candidates.join('\u0000')}`;
            if (this.lastCompletionKey === completionKey && completion.candidates.length > 1) {
                this.appendBlock('', completion.candidates.join('  '), this.state.cwd);
            } else {
                this.input.value = completion.value;
                this.input.setSelectionRange(this.input.value.length, this.input.value.length);
            }
            this.lastCompletionKey = completionKey;
        }

        onNavigated(event) {
            const shellPath = event.detail?.shellPath;
            if (shellPath) {
                this.state.cwd = shellPath;
            } else {
                this.state.cwd = this.filesystem.pathForRoute(location.href);
                this.state.previousCwd = null;
            }
            this.renderPrompt();
            if (this.active) this.renderShellPath();
            this.persist();
        }
    }

    function ensureRuntime() {
        if (runtime) return runtime;
        const coordinatorCore = window.terminalShellCoordinatorCore;
        if (!window.terminalShellCore || !coordinatorCore) return null;

        runtime = coordinatorCore.createTerminalShellCoordinator({
            loadManifest,
            createController: (manifest) => {
                const controller = new TerminalShellController(manifest, (state) => runtime.setState(state));
                if (currentBinding) controller.bind(currentBinding.options);
                return controller;
            }
        });
        window.isTerminalShellActive = () => runtime.getState() === 'active';
        window.isTerminalShellBusy = () => runtime.getState() !== 'idle';
        return runtime;
    }

    function renderRuntimeState(binding, state) {
        if (currentBinding !== binding || !binding.termBox.isConnected) return;
        const { termBox, activator, panel, status, options } = binding;
        const waiting = state === 'loading' || state === 'error';

        termBox.classList.toggle('is-shell-loading', state === 'loading');
        termBox.classList.toggle('is-shell-error', state === 'error');
        if (state === 'loading') termBox.setAttribute('aria-busy', 'true');
        else termBox.removeAttribute('aria-busy');

        if (status) {
            status.hidden = !waiting;
            status.textContent = state === 'loading'
                ? 'loading filesystem…'
                : state === 'error'
                    ? 'shell: filesystem unavailable — activate to retry'
                    : '';
        }

        if (waiting) {
            options.stopIdle?.();
            termBox.classList.remove('is-shell-active');
            if (panel) panel.hidden = true;
            activator?.setAttribute('aria-expanded', 'false');
        }
    }

    window.initTerminalShell = function initTerminalShell(options) {
        const shellRuntime = ensureRuntime();
        if (!shellRuntime || !options?.termBox) return { dispose() {} };

        currentBinding?.dispose();
        const termBox = options.termBox;
        const binding = {
            options,
            termBox,
            activator: termBox.querySelector('#terminalActivator'),
            panel: termBox.querySelector('#terminalShellPanel'),
            status: termBox.querySelector('#terminalShellStatus'),
            cleanups: []
        };
        currentBinding = binding;

        const activate = () => {
            shellRuntime.activate().catch((error) => {
                console.warn('[terminal] shell initialization failed', error);
            });
        };
        binding.cleanups.push(window.terminalShellCoordinatorCore.bindTerminalActivation({
            activator: binding.activator,
            termBox,
            activate,
            getState: () => shellRuntime.getState()
        }));

        const controller = shellRuntime.getController();
        if (controller) controller.bind(options);
        binding.cleanups.push(shellRuntime.subscribe((state) => renderRuntimeState(binding, state)));

        binding.dispose = () => {
            binding.cleanups.splice(0).forEach((cleanup) => {
                try { cleanup(); } catch (_) {}
            });
            if (currentBinding !== binding) return;
            shellRuntime.getController()?.unbind();
            currentBinding = null;
        };

        return binding;
    };
})();
