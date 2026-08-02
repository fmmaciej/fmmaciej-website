(function initNavigationCoordinator(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.terminalNavigationCore = api;
})(typeof window !== 'undefined' ? window : null, function navigationCoordinatorFactory() {
    async function loadNavigationDocument(targetUrl, context, adapters = {}) {
        const response = await adapters.fetchPage(targetUrl, context.signal);
        if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);

        const html = await response.text();
        const dom = adapters.parseDocument(html);
        const newHost = dom?.querySelector?.('.content-host');
        if (!dom?.documentElement || !newHost) throw new Error('Invalid page document');
        return { dom, newHost };
    }

    function createNavigationCoordinator(options = {}) {
        const AbortControllerClass = options.AbortControllerClass
            || (typeof AbortController !== 'undefined' ? AbortController : null);
        let generation = 0;
        let active = null;

        function isAbortError(error) {
            return error?.name === 'AbortError';
        }

        function isCurrent(id) {
            return active?.id === id && !active.controller?.signal?.aborted;
        }

        function abortActive() {
            active?.controller?.abort?.();
        }

        async function navigate(url, navigationOptions = {}) {
            abortActive();

            const id = ++generation;
            const controller = AbortControllerClass ? new AbortControllerClass() : null;
            active = { id, controller };

            const context = {
                id,
                pushHistory: navigationOptions.pushHistory !== false,
                preserveShell: !!navigationOptions.preserveShell,
                shellPath: navigationOptions.shellPath || null,
                signal: controller?.signal,
                isCurrent: () => isCurrent(id)
            };

            try {
                const currentUrl = options.getCurrentUrl();
                const targetUrl = options.resolveUrl(url, currentUrl);
                context.currentUrl = currentUrl;
                context.targetUrl = targetUrl;

                if (options.isSameDocument(currentUrl, targetUrl)) {
                    if (!isCurrent(id)) return { status: 'superseded' };
                    await options.commitHash(targetUrl, context);
                    return isCurrent(id) ? { status: 'committed' } : { status: 'superseded' };
                }

                const page = await options.loadPage(targetUrl, context);
                if (!isCurrent(id)) return { status: 'superseded' };
                await options.commitPage(page, context);
                return isCurrent(id) ? { status: 'committed' } : { status: 'superseded' };
            } catch (error) {
                if (!isCurrent(id) || isAbortError(error)) return { status: 'superseded' };
                options.hardNavigate(context.targetUrl || url, context);
                return { status: 'fallback', error };
            } finally {
                if (active?.id === id) active = null;
            }
        }

        return {
            abort: abortActive,
            navigate
        };
    }

    return { createNavigationCoordinator, loadNavigationDocument };
});
