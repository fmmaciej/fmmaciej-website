(function(){
    const loaderTimeout = 100;
    const timeout = setTimeout(() => {
        // loader durign boot
        if (!document.body.classList.contains('booting')) {
            document.body.classList.add("show-loader");
        }
    }, loaderTimeout);

    window.addEventListener("load", () => {
        if (document.body.classList.contains('booting')) return;

        clearTimeout(timeout);
        document.body.classList.remove("show-loader");
    });
})();
