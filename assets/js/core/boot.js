(function initPortfolioBoot(){
    document.documentElement?.classList.remove('preload');
    if (window.portfolioBootController) return;

    const timers = new Set();
    const frames = new Set();
    let overlay = null;
    let disposed = false;

    function schedule(callback, delay) {
        const timer = window.setTimeout(() => {
            timers.delete(timer);
            if (!disposed) callback();
        }, delay);
        timers.add(timer);
        return timer;
    }

    function nextFrame(callback) {
        const frame = window.requestAnimationFrame(() => {
            frames.delete(frame);
            if (!disposed) callback();
        });
        frames.add(frame);
    }

    function cleanup() {
        disposed = true;
        timers.forEach((timer) => window.clearTimeout(timer));
        frames.forEach((frame) => window.cancelAnimationFrame(frame));
        timers.clear();
        frames.clear();
        overlay?.remove();
        overlay = null;
        document.body.classList.remove('booting', 'show-loader');
    }

    window.portfolioBootController = { cleanup };

    try {
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reducedMotion) {
            cleanup();
            return;
        }

        const LINES = [
            "Linux version 2.2.6 (root@zap) (gcc version egcs-2.91.66) #20 Tue Apr 27 15:23:25 CDT 1999",
            "Detected 300684 kHz processor.",
            "Console: colour VGA+ 80x25",
            "Calibrating delay loop... 599.65 BogoMIPS",
            "Memory: 63148k/65536k available (996k kernel code, 412k reserved, 912k data)",
            "Checking if this processor honours the WP bit even in supervisor mode... Ok.",
            "CPU: Intel Pentium II (Deschutes) stepping 02",
            "PCI: PCI BIOS revision 2.10 entry at 0xfb4b0",
            "Linux NET4.0 for Linux 2.2",
            "Serial driver version 4.27 with MANY_PORTS MULTIPORT SHARE_IRQ enabled",
            "hda: QUANTUM FIREBALL ST4.3A, ATA DISK drive",
            "hda: 8418816 sectors (4310 MB) w/81KiB Cache, CHS=524/255/63",
            "Partition check:",
            " hda: hda1 hda2",
            "VFS: Mounted root (ext2 filesystem) readonly.",
            "Freeing unused kernel memory: 60k freed",
            "INIT: version 2.76 booting",
            "Running /etc/rc.d/rc.S:  System initialization.",
            "Checking root filesystem:",
            "/dev/hda1: clean, 18421/131072 files, 79143/262144 blocks",
            "Remounting root device with read-write enabled.",
            "Mounting local filesystems:",
            "Starting system logger:  /usr/sbin/syslogd",
            "Starting kernel logger:  /usr/sbin/klogd",
            "Setting system time from the hardware clock.",
            "Going multiuser...",
            "Starting Internet super-server daemon:  /usr/sbin/inetd",
            "Starting OpenSSH daemon:  /usr/sbin/sshd",
            "Starting local services:  /etc/rc.d/rc.local",
            "",
            "Welcome to Linux 2.2.6 (tty1)",
            "",
            "void login: guest"
        ];

        const LINE_MS_MIN = 7;
        const LINE_MS_MAX = 16;
        const END_PAUSE = 280;
        const OVERLAY_OUT_MS = 320;
        const LOADER_MS = 420;
        document.body.classList.add('booting');

        document.getElementById('bootOverlay')?.remove();
        overlay = document.createElement('div');
        overlay.id = 'bootOverlay';
        overlay.innerHTML = `
            <div class="boot-scroll" id="bootScroll" aria-live="polite" aria-atomic="false"></div>
        `;
        document.body.appendChild(overlay);

        const scroll = overlay.querySelector('#bootScroll');
        let i = 0;

        function nextDelay(index) {
            const base = LINE_MS_MIN + Math.floor(Math.random() * (LINE_MS_MAX - LINE_MS_MIN + 1));
            if (index === 0 || index % 8 === 0) return base + 16;
            return base;
        }

        function step(){
            if (i >= LINES.length) {
                schedule(() => {
                    overlay.classList.add('is-complete');

                    schedule(() => {
                        overlay.remove();
                        overlay = null;
                        document.body.classList.add('show-loader');

                        schedule(cleanup, LOADER_MS);
                    }, OVERLAY_OUT_MS);
                }, END_PAUSE);

                return;
            }

            const txt = LINES[i++];
            const ln  = document.createElement('div');
            ln.className = 'boot-line';

            if (txt.includes(" OK "))      ln.classList.add('ok');
            else if (txt.includes("WARN")) ln.classList.add('warn');
            else if (txt.includes("DEPEN")) ln.classList.add('warn');
            else if (txt.includes("ERR"))  ln.classList.add('err');

            ln.textContent = txt;

            scroll.appendChild(ln);
            nextFrame(() => ln.classList.add('is-visible'));
            scroll.scrollTop = scroll.scrollHeight;

            schedule(step, nextDelay(i));
        }

        step();

    } catch(e) {
        cleanup();
        console.warn('[boot] initialization failed', e);
    }
})();
