(function initTerminalShellCore(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.terminalShellCore = api;
})(typeof window !== 'undefined' ? window : null, function terminalShellCoreFactory() {
    const COMMANDS = [
        'cat', 'cd', 'clear', 'cmatrix', 'exit', 'help', 'history', 'hostname',
        'ls', 'open', 'pwd', 'uname', 'whoami'
    ];
    const SESSION_VERSION = 1;
    const MAX_HISTORY = 100;
    const MAX_TRANSCRIPT_BLOCKS = 100;
    const MAX_TRANSCRIPT_BYTES = 200 * 1024;
    const OMITTED_OUTPUT = '[large output omitted from restored session]';

    function posixNormalize(value) {
        const absolute = String(value || '/').startsWith('/');
        const parts = String(value || '').split('/');
        const output = [];

        parts.forEach((part) => {
            if (!part || part === '.') return;
            if (part === '..') {
                output.pop();
                return;
            }
            output.push(part);
        });

        const joined = `${absolute ? '/' : ''}${output.join('/')}`;
        return joined || (absolute ? '/' : '.');
    }

    function dirname(value) {
        const normalized = posixNormalize(value);
        if (normalized === '/') return '/';
        const parts = normalized.split('/');
        parts.pop();
        return parts.join('/') || '/';
    }

    function basename(value) {
        const normalized = posixNormalize(value);
        if (normalized === '/') return '/';
        return normalized.split('/').filter(Boolean).pop() || '/';
    }

    function joinPath(base, value, home = '/home/fm') {
        const raw = String(value || '.');
        if (raw === '~') return home;
        if (raw.startsWith('~/')) return posixNormalize(`${home}/${raw.slice(2)}`);
        if (raw.startsWith('/')) return posixNormalize(raw);
        return posixNormalize(`${base || home}/${raw}`);
    }

    function tokenize(line) {
        const input = String(line || '');
        const tokens = [];
        let token = '';
        let quote = null;
        let escaped = false;

        for (let index = 0; index < input.length; index += 1) {
            const char = input[index];

            if (escaped) {
                token += char;
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (quote) {
                if (char === quote) quote = null;
                else token += char;
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }
            if (/\s/.test(char)) {
                if (token) {
                    tokens.push(token);
                    token = '';
                }
                continue;
            }
            if ('|><;'.includes(char) || char === '`' || char === '$' && input[index + 1] === '(') {
                return { error: 'unsupported shell syntax' };
            }
            if (char === '&' && input[index + 1] === '&' || char === '|' && input[index + 1] === '|') {
                return { error: 'unsupported shell syntax' };
            }
            token += char;
        }

        if (escaped) token += '\\';
        if (quote) return { error: 'unterminated quote' };
        if (token) tokens.push(token);
        return { tokens };
    }

    function createFilesystem(manifest) {
        const user = manifest?.user || { name: 'fm', group: 'fm', host: 'void', home: '/home/fm' };
        const entries = new Map((manifest?.entries || []).map((entry) => [entry.path, { ...entry }]));

        function permissionBits(entry) {
            const mode = entry?.mode || '----------';
            if (entry.owner === user.name) return mode.slice(1, 4);
            if (entry.group === user.group) return mode.slice(4, 7);
            return mode.slice(7, 10);
        }

        function canRead(entry) {
            return permissionBits(entry).includes('r');
        }

        function canEnter(entry) {
            return entry?.type === 'directory' && permissionBits(entry).includes('x');
        }

        function resolve(rawPath, cwd = user.home, options = {}) {
            const followFinal = options.followFinal !== false;
            let requested = joinPath(cwd, rawPath, user.home);
            let depth = 0;

            while (depth < 12) {
                const segments = requested.split('/').filter(Boolean);
                let current = '/';
                let changed = false;

                for (let index = 0; index < segments.length; index += 1) {
                    const nextPath = current === '/' ? `/${segments[index]}` : `${current}/${segments[index]}`;
                    const entry = entries.get(nextPath);
                    if (!entry) return { error: 'No such file or directory', path: requested };

                    const isFinal = index === segments.length - 1;
                    if (entry.type === 'symlink' && (followFinal || !isFinal)) {
                        const remainder = segments.slice(index + 1).join('/');
                        const target = joinPath(dirname(nextPath), entry.target, user.home);
                        requested = posixNormalize(remainder ? `${target}/${remainder}` : target);
                        depth += 1;
                        changed = true;
                        break;
                    }

                    if (!isFinal && !canEnter(entry)) {
                        return { error: entry.type === 'directory' ? 'Permission denied' : 'Not a directory', path: nextPath };
                    }
                    current = nextPath;
                }

                if (changed) continue;
                const entry = entries.get(requested);
                if (!entry) return { error: 'No such file or directory', path: requested };
                return { entry, path: requested };
            }

            return { error: 'Too many levels of symbolic links', path: requested };
        }

        function childrenOf(directoryPath) {
            const prefix = directoryPath === '/' ? '/' : `${directoryPath}/`;
            return Array.from(entries.values())
                .filter((entry) => entry.path.startsWith(prefix) && entry.path !== directoryPath)
                .filter((entry) => !entry.path.slice(prefix.length).includes('/'))
                .sort((a, b) => basename(a.path).localeCompare(basename(b.path)));
        }

        function nearestRoute(rawPath, cwd = user.home) {
            let current = joinPath(cwd, rawPath, user.home);
            while (current) {
                const entry = entries.get(current);
                if (entry?.route) return { path: current, route: entry.route };
                if (current === '/') break;
                current = dirname(current);
            }
            return null;
        }

        function pathForRoute(urlValue) {
            let url;
            try {
                url = new URL(urlValue, 'https://fmmaciej.com');
            } catch (_) {
                return user.home;
            }
            const routeEntries = Array.from(entries.values())
                .filter((entry) => entry.route)
                .sort((a, b) => {
                    if (a.type === 'directory' && b.type !== 'directory') return -1;
                    if (a.type !== 'directory' && b.type === 'directory') return 1;
                    return a.path.length - b.path.length;
                });
            const exactHash = url.hash ? routeEntries.find((entry) => {
                const route = new URL(entry.route, 'https://fmmaciej.com');
                return route.pathname === url.pathname && route.hash === url.hash;
            }) : null;
            const exact = exactHash || routeEntries.find((entry) => {
                    const route = new URL(entry.route, 'https://fmmaciej.com');
                    return route.pathname === url.pathname && !route.hash;
                });
            if (exact) return exact.type === 'directory' ? exact.path : dirname(exact.path);

            const pathnameMatch = routeEntries.find(
                (entry) => new URL(entry.route, 'https://fmmaciej.com').pathname === url.pathname
            );
            return pathnameMatch
                ? (pathnameMatch.type === 'directory' ? pathnameMatch.path : dirname(pathnameMatch.path))
                : user.home;
        }

        return {
            manifest,
            user,
            entries,
            canRead,
            canEnter,
            childrenOf,
            nearestRoute,
            pathForRoute,
            resolve,
            normalize: (rawPath, cwd) => joinPath(cwd || user.home, rawPath, user.home)
        };
    }

    function formatDate(value) {
        const date = new Date(value || 0);
        return Number.isNaN(date.valueOf()) ? '1970-01-01' : date.toISOString().slice(0, 10);
    }

    function displayName(entry, nameOverride) {
        const suffix = entry.type === 'directory' ? '/' : entry.type === 'symlink' ? '@' : '';
        return `${nameOverride || basename(entry.path)}${suffix}`;
    }

    function formatLong(entry, nameOverride) {
        const target = entry.type === 'symlink' ? ` -> ${entry.target}` : '';
        return `${entry.mode}  ${entry.owner.padEnd(5)} ${entry.group.padEnd(5)} ${String(entry.size || 0).padStart(7)} ${formatDate(entry.modified)} ${displayName(entry, nameOverride)}${target}`;
    }

    function parseLsArgs(args) {
        let all = false;
        let long = false;
        let optionsDone = false;
        const paths = [];

        for (const arg of args) {
            if (!optionsDone && arg === '--') {
                optionsDone = true;
                continue;
            }
            if (!optionsDone && arg.startsWith('-') && arg !== '-') {
                for (const flag of arg.slice(1)) {
                    if (flag === 'a') all = true;
                    else if (flag === 'l') long = true;
                    else return { error: `invalid option -- '${flag}'` };
                }
                continue;
            }
            paths.push(arg);
        }

        return { all, long, paths: paths.length ? paths : ['.'] };
    }

    function shellPromptPath(cwd, home = '/home/fm') {
        if (cwd === home) return '~';
        if (cwd.startsWith(`${home}/`)) return `~${cwd.slice(home.length)}`;
        return cwd;
    }

    function executeCommand(filesystem, state, line) {
        const parsed = tokenize(line);
        if (parsed.error) return { state, output: `shell: ${parsed.error}` };
        if (!parsed.tokens.length) return { state, output: '' };

        const [command, ...args] = parsed.tokens;
        const nextState = {
            ...state,
            history: [...(state.history || []), line].slice(-MAX_HISTORY)
        };
        const fail = (subject, error) => ({ state: nextState, output: `${command}: ${subject}: ${error}` });

        if (!COMMANDS.includes(command)) {
            return { state: nextState, output: `${command}: command not found` };
        }

        if (command === 'help') {
            return {
                state: nextState,
                output: [
                    'Portfolio shell — read-only',
                    '',
                    'help                 show available commands',
                    'pwd                  print working directory',
                    'ls [-al] [path]       list directory contents',
                    'cd [path]             change directory',
                    'cat <file> [...]      print complete file contents',
                    'cmatrix               run a local Matrix effect',
                    'open <path>           open a page, link, or download',
                    'clear                 clear the transcript',
                    'history               show command history',
                    'whoami | hostname     show session information',
                    'uname [-a]            show virtual system information',
                    'exit                  end and forget this shell session',
                    '',
                    'Tab completes paths. ↑/↓ browse history. Esc returns to idle.'
                ].join('\n')
            };
        }

        if (command === 'pwd') return { state: nextState, output: nextState.cwd };
        if (command === 'whoami') return { state: nextState, output: filesystem.user.name };
        if (command === 'hostname') return { state: nextState, output: filesystem.user.host };
        if (command === 'uname') {
            const output = args.includes('-a')
                ? 'Linux void 6.10.12_1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux'
                : 'Linux';
            return { state: nextState, output };
        }
        if (command === 'history') {
            return {
                state: nextState,
                output: nextState.history.map((item, index) => `${String(index + 1).padStart(4)}  ${item}`).join('\n')
            };
        }
        if (command === 'cmatrix') {
            return {
                state: nextState,
                output: '',
                action: { type: 'effect', name: 'matrix' }
            };
        }
        if (command === 'clear') return { state: nextState, output: '', clear: true };
        if (command === 'exit') return { state: nextState, output: '', exit: true };

        if (command === 'cd') {
            const target = args[0] === '-' ? nextState.previousCwd : (args[0] || filesystem.user.home);
            if (!target) return fail('', 'OLDPWD not set');
            const resolved = filesystem.resolve(target, nextState.cwd);
            if (resolved.error) return fail(target, resolved.error);
            if (resolved.entry.type !== 'directory') return fail(target, 'Not a directory');
            if (!filesystem.canEnter(resolved.entry)) return fail(target, 'Permission denied');
            const oldCwd = nextState.cwd;
            nextState.cwd = resolved.path;
            nextState.previousCwd = oldCwd;
            const route = resolved.entry.route || null;
            return {
                state: nextState,
                output: args[0] === '-' ? nextState.cwd : '',
                action: route ? { type: 'navigate', url: route, preserveShell: true } : null
            };
        }

        if (command === 'ls') {
            const options = parseLsArgs(args);
            if (options.error) return { state: nextState, output: `ls: ${options.error}` };
            const sections = [];
            for (const target of options.paths) {
                const resolved = filesystem.resolve(target, nextState.cwd, { followFinal: false });
                if (resolved.error) {
                    sections.push(`ls: ${target}: ${resolved.error}`);
                    continue;
                }
                let entry = resolved.entry;
                let resolvedPath = resolved.path;
                if (entry.type === 'symlink') {
                    const followed = filesystem.resolve(target, nextState.cwd);
                    if (followed.error) {
                        sections.push(`ls: ${target}: ${followed.error}`);
                        continue;
                    }
                    if (followed.entry.type !== 'directory') {
                        sections.push(options.long ? formatLong(entry) : displayName(entry));
                        continue;
                    }
                    entry = followed.entry;
                    resolvedPath = followed.path;
                }
                if (entry.type !== 'directory') {
                    sections.push(options.long ? formatLong(entry) : displayName(entry));
                    continue;
                }
                if (!filesystem.canEnter(entry)) {
                    sections.push(`ls: ${target}: Permission denied`);
                    continue;
                }
                const children = filesystem.childrenOf(resolvedPath)
                    .filter((child) => options.all || !basename(child.path).startsWith('.'))
                    .map((child) => ({ entry: child, name: null }));
                if (options.all) {
                    const parent = filesystem.resolve('..', resolvedPath).entry || entry;
                    children.unshift({ entry: parent, name: '..' });
                    children.unshift({ entry, name: '.' });
                }
                const output = children.map((item) => options.long
                    ? formatLong(item.entry, item.name)
                    : displayName(item.entry, item.name)
                ).join(options.long ? '\n' : '  ');
                sections.push(options.paths.length > 1 ? `${target}:\n${output}` : output);
            }
            return { state: nextState, output: sections.join('\n\n') };
        }

        if (command === 'cat') {
            if (!args.length) return { state: nextState, output: 'cat: missing operand' };
            const output = [];
            for (const target of args) {
                const resolved = filesystem.resolve(target, nextState.cwd);
                if (resolved.error) {
                    output.push(`cat: ${target}: ${resolved.error}`);
                    continue;
                }
                const entry = resolved.entry;
                if (entry.type === 'directory') output.push(`cat: ${target}: Is a directory`);
                else if (!filesystem.canRead(entry)) output.push(`cat: ${target}: Permission denied`);
                else if (entry.type === 'device' && entry.deviceBehavior === 'null') output.push('');
                else if (entry.type === 'device') output.push(`cat: ${target}: Operation not supported`);
                else output.push(entry.content || '');
            }
            return { state: nextState, output: output.join('\n') };
        }

        if (command === 'open') {
            if (!args.length) return { state: nextState, output: 'open: missing operand' };
            const target = args[0];
            const resolved = filesystem.resolve(target, nextState.cwd);
            if (resolved.error) return fail(target, resolved.error);
            if (!filesystem.canRead(resolved.entry) && resolved.entry.type !== 'directory') return fail(target, 'Permission denied');

            const entry = resolved.entry;
            const url = entry.route || entry.openUrl;
            if (!url) return fail(target, 'No application is associated with this path');
            return {
                state: nextState,
                output: '',
                action: {
                    type: 'open',
                    url,
                    download: !!entry.download,
                    external: /^(https?:|mailto:)/i.test(url)
                }
            };
        }

        return { state: nextState, output: '' };
    }

    function commonPrefix(values) {
        if (!values.length) return '';
        return values.reduce((prefix, value) => {
            let index = 0;
            while (index < prefix.length && prefix[index] === value[index]) index += 1;
            return prefix.slice(0, index);
        });
    }

    function completeInput(filesystem, input, cwd) {
        const value = String(input || '');
        const match = value.match(/(^|\s)([^\s]*)$/);
        if (!match) return { value, candidates: [] };
        const fragment = match[2];
        const start = value.length - fragment.length;
        const before = value.slice(0, start);
        const isCommand = before.trim() === '';

        if (isCommand) {
            const candidates = COMMANDS.filter((command) => command.startsWith(fragment));
            const prefix = commonPrefix(candidates);
            return { value: candidates.length ? `${prefix}${candidates.length === 1 ? ' ' : ''}` : value, candidates };
        }

        const slashIndex = fragment.lastIndexOf('/');
        const directoryPart = slashIndex >= 0 ? fragment.slice(0, slashIndex + 1) : '';
        const namePart = slashIndex >= 0 ? fragment.slice(slashIndex + 1) : fragment;
        const directoryTarget = directoryPart || '.';
        const resolved = filesystem.resolve(directoryTarget, cwd);
        if (resolved.error || resolved.entry.type !== 'directory') return { value, candidates: [] };

        const candidates = filesystem.childrenOf(resolved.path)
            .map((entry) => `${basename(entry.path)}${entry.type === 'directory' ? '/' : ''}`)
            .filter((name) => name.startsWith(namePart));
        const prefix = commonPrefix(candidates);
        if (!candidates.length) return { value, candidates };
        const completed = `${directoryPart}${prefix}${candidates.length === 1 && !prefix.endsWith('/') ? ' ' : ''}`;
        return { value: `${before}${completed}`, candidates: candidates.map((name) => `${directoryPart}${name}`) };
    }

    function byteLength(value) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
        if (typeof Buffer !== 'undefined') return Buffer.byteLength(value, 'utf8');
        return unescape(encodeURIComponent(value)).length;
    }

    function trimTranscript(blocks) {
        const result = [];
        let total = 0;
        (blocks || []).slice(-MAX_TRANSCRIPT_BLOCKS).reverse().forEach((block) => {
            const copy = { command: String(block.command || ''), output: String(block.output || ''), cwd: String(block.cwd || '') };
            let serialized = JSON.stringify(copy);
            let size = byteLength(serialized);
            if (size > MAX_TRANSCRIPT_BYTES) {
                copy.output = OMITTED_OUTPUT;
                serialized = JSON.stringify(copy);
                size = byteLength(serialized);
            }
            if (total + size > MAX_TRANSCRIPT_BYTES) return;
            total += size;
            result.unshift(copy);
        });
        return result;
    }

    function serializeSession(filesystem, state, transcript) {
        return JSON.stringify({
            version: SESSION_VERSION,
            contentId: filesystem.manifest?.contentId || '',
            cwd: state.cwd,
            previousCwd: state.previousCwd || null,
            history: (state.history || []).slice(-MAX_HISTORY),
            transcript: trimTranscript(transcript)
        });
    }

    function restoreSession(filesystem, serialized, fallbackCwd) {
        const fallback = {
            cwd: fallbackCwd || filesystem.user.home,
            previousCwd: null,
            history: [],
            transcript: []
        };
        if (!serialized) return fallback;
        try {
            const parsed = JSON.parse(serialized);
            if (parsed.version !== SESSION_VERSION) return fallback;
            if (parsed.contentId !== (filesystem.manifest?.contentId || '')) return fallback;
            const cwd = filesystem.resolve(parsed.cwd, filesystem.user.home);
            if (cwd.error || cwd.entry.type !== 'directory' || !filesystem.canEnter(cwd.entry)) return fallback;
            return {
                cwd: cwd.path,
                previousCwd: parsed.previousCwd || null,
                history: Array.isArray(parsed.history) ? parsed.history.slice(-MAX_HISTORY).map(String) : [],
                transcript: trimTranscript(Array.isArray(parsed.transcript) ? parsed.transcript : [])
            };
        } catch (_) {
            return fallback;
        }
    }

    return {
        COMMANDS,
        MAX_HISTORY,
        MAX_TRANSCRIPT_BLOCKS,
        MAX_TRANSCRIPT_BYTES,
        OMITTED_OUTPUT,
        basename,
        completeInput,
        createFilesystem,
        dirname,
        executeCommand,
        joinPath,
        posixNormalize,
        restoreSession,
        serializeSession,
        shellPromptPath,
        tokenize,
        trimTranscript
    };
});
