(() => {
    window.initPageScripts = function initPageScripts(root = document) {
        const cleanups = [];
        const collectionRoot = root.querySelector('main[data-collection-page]');

        if (collectionRoot) {
            window.initCollectionPage?.(collectionRoot, {
                suffix: root.querySelector('#terminalPathSuffix'),
                basePath: collectionRoot.dataset.collectionBasePath || '',
                syncHash: collectionRoot.dataset.collectionSyncHash === 'true',
                showTerminalCrumb: collectionRoot.dataset.collectionTerminalCrumb === 'true'
            }, cleanups);
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
