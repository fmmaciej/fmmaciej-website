(function initTerminalShellCoordinator(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.terminalShellCoordinatorCore = api;
})(typeof window !== 'undefined' ? window : null, function terminalShellCoordinatorFactory() {
    const VALID_STATES = new Set(['idle', 'loading', 'active', 'error']);

    function bindTerminalActivation(options = {}) {
        const cleanups = [];
        const listen = (target, event, handler) => {
            if (!target) return;
            target.addEventListener(event, handler);
            cleanups.push(() => target.removeEventListener(event, handler));
        };

        listen(options.activator, 'click', options.activate);
        listen(options.activator, 'keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            options.activate();
        });
        listen(options.termBox, 'click', (event) => {
            if (options.getState() === 'active') return;
            if (event.target?.closest?.('#terminalActivator, a, button, input, form')) return;
            options.activate();
        });

        return () => cleanups.splice(0).forEach((cleanup) => cleanup());
    }

    function createTerminalShellCoordinator(options = {}) {
        let state = 'idle';
        let controller = null;
        let controllerPromise = null;
        let activationPromise = null;
        const subscribers = new Set();

        function notify() {
            subscribers.forEach((subscriber) => subscriber(state));
        }

        function setState(nextState) {
            if (!VALID_STATES.has(nextState) || state === nextState) return;
            state = nextState;
            notify();
        }

        function subscribe(subscriber) {
            subscribers.add(subscriber);
            subscriber(state);
            return () => subscribers.delete(subscriber);
        }

        function ensureController() {
            if (controller) return Promise.resolve(controller);
            if (controllerPromise) return controllerPromise;

            controllerPromise = Promise.resolve()
                .then(() => options.loadManifest())
                .then((manifest) => {
                    if (!controller) controller = options.createController(manifest);
                    return controller;
                })
                .catch((error) => {
                    controllerPromise = null;
                    throw error;
                });

            return controllerPromise;
        }

        function activate() {
            if (state === 'active' && controller) return Promise.resolve(controller);
            if (activationPromise) return activationPromise;

            setState('loading');
            activationPromise = ensureController()
                .then(async (shellController) => {
                    const activated = await shellController.activate();
                    setState(activated === false ? 'idle' : 'active');
                    return shellController;
                })
                .catch((error) => {
                    setState('error');
                    throw error;
                })
                .finally(() => {
                    activationPromise = null;
                });

            return activationPromise;
        }

        return {
            activate,
            getController: () => controller,
            getState: () => state,
            setState,
            subscribe
        };
    }

    return { bindTerminalActivation, createTerminalShellCoordinator };
});
