(function(){
    try {
        const LINES = [
            "[    0.000000] Linux version 6.8.7 (x86_64-unknown-linux-gnu) #1 SMP PREEMPT_DYNAMIC",
            "[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz root=UUID=xxxx rw quiet",
            "[    0.004321] x86/fpu: Supporting XSAVE feature 0x001: 'x87 floating point registers'",
            "[    0.012345] BIOS-provided physical RAM map:",
            "[    0.023456] ACPI: Early table checksum verification enabled",
            "[    0.034567] ACPI: SRAT and SLIT disabled by firmware",
            "[    0.045678] smpboot: CPU0: AMD Ryzen 7 7840U (family: 0x19, model: 0x74)",
            "[    0.056789] Spectre v2 : Mitigation: Retpolines, IBPB: conditional, STIBP: disabled",
            "[    0.067890] MTRR default type: write-back",
            "[    0.078901] pci 0000:00:14.0: xhci_hcd USB 3.20 Host Controller",
            "[    0.089012] ahci 0000:00:17.0: version 3.0",
            "[    0.100123] nvme nvme0: pci function 0000:01:00.0",
            "[    0.111234] tsc: Refined TSC clocksource calibration: 3393.601 MHz",
            "[    0.122345] psmouse serio1: synaptics: Touchpad model detected",
            "[    0.133456] i915 0000:00:02.0: [drm] VT-d active for gfx",
            "[    0.144567] fbcon: Taking over console",
            "[    0.155678] ALSA device list: #0: HDA Intel PCH",
            "[    0.166789] random: crng init done",
            "[    0.200000] udevd[123]: starting version 254 (eudev)",
            "[    0.212345] udevd[123]: detected 6 CPUs; generating database...",
            "[    0.234567] udevd[123]: /usr/lib/udev/rules.d/ seatd rule loaded",
            "[    0.250000] runit: stage 1",
            "[    0.260000] mount: mounting /proc on /proc ... done",
            "[    0.270000] mount: mounting /sys on /sys ... done",
            "[    0.280000] runit: entering stage 2",
            "[    0.290000] runsvdir: service directory: /var/service",
            "[    0.300000] runsv: supervising services (log: svlogd)",
            "[  OK  ] sv sshd: started",
            "[  OK  ] sv dhcpcd: started",
            "[  OK  ] sv wpa_supplicant: started",
            "[  OK  ] sv ntpd: started",
            "[  OK  ] sv acpid: started",
            "[  OK  ] sv crond: started",
            "[  OK  ] sv seatd: started",
            "[  OK  ] sv dbus: started",
            "[  OK  ] sv pipewire: started",
            "[  OK  ] sv wireplumber: started",
            "[  OK  ] sv xdg-desktop-portal: started",
            "[  OK  ] sv xdg-desktop-portal-wlr: started",
            "[ WARN ] sv bluetoothd: disabled (no adapter found)",
            "[    1.234567] dhcpcd[521]: wlan0: carrier acquired",
            "[    1.345678] dhcpcd[521]: wlan0: leased 192.168.1.42 for 86400 seconds",
            "[    1.456789] seatd[610]: seat0 created, VT support enabled",
            "[    1.567890] sway-launch: WAYLAND_DISPLAY not set; creating",
            "[  OK  ] sway: wlroots 0.17.0, backend drm+libinput, renderer Vulkan",
            "[  OK  ] sway: outputs: eDP-1 2256x1504@60Hz (scaling 1.25)",
            "[  OK  ] sway: keymap: us(intl) compose: menu",
            "[  OK  ] xdg-desktop-portal-wlr: screencast portal ready",
            "[    2.000000] login: void linux  rolling   tty1"
        ];

        const LINE_MS   = 10;
        const END_PAUSE = 500;
        const LOADER_MS = 500;

        document.body.classList.add('booting');

        // BOOT overlay
        const overlay = document.createElement('div');
        overlay.id = 'bootOverlay';
        overlay.innerHTML = `
            <div class="boot-scroll" id="bootScroll" aria-live="polite" aria-atomic="false"></div>
        `;
        document.body.appendChild(overlay);

        const scroll = overlay.querySelector('#bootScroll');

        let i = 0;
        function step(){
            if (i >= LINES.length) {
                // usuń overlay, pokaż loader na 1s, schowaj loader
                setTimeout(() => {
                    // usuń boot overlay, żeby nie przykrywał loadera
                    overlay.remove();

                    document.body.classList.add('show-loader');
                    setTimeout(() => {
                            document.body.classList.remove('show-loader');
                            document.body.classList.remove('booting');
                        }, LOADER_MS);
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
            scroll.scrollTop = scroll.scrollHeight;

            setTimeout(step, LINE_MS);
        }

        step();

    } catch(e) {
        // awaryjnie
        document.body.classList.remove('booting');
        document.body.classList.remove('show-loader');
        const o = document.getElementById('bootOverlay'); if (o) o.remove();
    }
})();
