(() => {
    const OPEN_DOTS_MS = 180;
    const OPEN_ANIMATION_MS = 220;
    const CLOSE_ANIMATION_MS = 180;
    const prefersReducedMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resetGroupContentStyles(content) {
        if (!content) return;
        content.style.height = '';
        content.style.opacity = '';
        content.style.overflow = '';
        content.style.transition = '';
        content.style.willChange = '';
    }

    function stopDots(group) {
        if (group?._dotsInterval) {
            window.clearInterval(group._dotsInterval);
            group._dotsInterval = null;
        }

        if (group?._dotsEl) {
            group._dotsEl.textContent = '';
        }

        if (group?._summaryEl) {
            group._summaryEl.classList.remove('is-pending');
        }
    }

    function stopGroupMotion(group) {
        if (!group) return;

        if (group._openDelay) {
            window.clearTimeout(group._openDelay);
            group._openDelay = null;
        }

        if (group._transitionFallback) {
            window.clearTimeout(group._transitionFallback);
            group._transitionFallback = null;
        }

        stopDots(group);

        if (group._transitionContent && group._onTransitionEnd) {
            group._transitionContent.removeEventListener('transitionend', group._onTransitionEnd);
        }

        resetGroupContentStyles(group._transitionContent);

        group._transitionContent = null;
        group._onTransitionEnd = null;
        delete group.dataset.animating;
    }

    function startDots(summary, group) {
        const dots = summary.querySelector('.group-dots');
        if (!dots) return;

        const frames = [' .', ' ..', ' ...'];
        let frame = 0;

        group._summaryEl = summary;
        group._dotsEl = dots;

        summary.classList.add('is-pending');
        dots.textContent = frames[frame];
        frame += 1;

        group._dotsInterval = window.setInterval(() => {
            dots.textContent = frames[frame % frames.length];
            frame += 1;
        }, 60);
    }

    function animateOpen(group, content, onDone) {
        if (!content || prefersReducedMotion) {
            group.open = true;
            onDone();
            return;
        }

        group.open = true;
        content.style.height = '0px';
        content.style.opacity = '0.72';
        content.style.overflow = 'hidden';
        content.style.willChange = 'height, opacity';
        content.getBoundingClientRect();

        requestAnimationFrame(() => {
            const targetHeight = content.scrollHeight;
            if (!targetHeight) {
                resetGroupContentStyles(content);
                onDone();
                return;
            }

            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;

                if (group._transitionFallback) {
                    window.clearTimeout(group._transitionFallback);
                    group._transitionFallback = null;
                }

                content.removeEventListener('transitionend', onTransitionEnd);
                group._transitionContent = null;
                group._onTransitionEnd = null;
                resetGroupContentStyles(content);
                onDone();
            };

            const onTransitionEnd = (event) => {
                if (event.target !== content || event.propertyName !== 'height') return;
                finish();
            };

            group._transitionContent = content;
            group._onTransitionEnd = onTransitionEnd;
            content.addEventListener('transitionend', onTransitionEnd);
            group._transitionFallback = window.setTimeout(finish, OPEN_ANIMATION_MS + 80);

            content.style.transition = `height ${OPEN_ANIMATION_MS}ms ease, opacity 180ms ease`;
            content.style.height = `${targetHeight}px`;
            content.style.opacity = '1';
        });
    }

    function animateClose(group, content, onDone) {
        if (!content || prefersReducedMotion) {
            group.open = false;
            onDone();
            return;
        }

        const startHeight = content.scrollHeight;
        content.style.height = `${startHeight}px`;
        content.style.opacity = '1';
        content.style.overflow = 'hidden';
        content.style.willChange = 'height, opacity';
        content.getBoundingClientRect();

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;

            if (group._transitionFallback) {
                window.clearTimeout(group._transitionFallback);
                group._transitionFallback = null;
            }

            content.removeEventListener('transitionend', onTransitionEnd);
            group.open = false;
            group._transitionContent = null;
            group._onTransitionEnd = null;
            resetGroupContentStyles(content);
            onDone();
        };

        const onTransitionEnd = (event) => {
            if (event.target !== content || event.propertyName !== 'height') return;
            finish();
        };

        group._transitionContent = content;
        group._onTransitionEnd = onTransitionEnd;
        content.addEventListener('transitionend', onTransitionEnd);
        group._transitionFallback = window.setTimeout(finish, CLOSE_ANIMATION_MS + 80);

        requestAnimationFrame(() => {
            content.style.transition = `height ${CLOSE_ANIMATION_MS}ms ease, opacity 140ms ease`;
            content.style.height = '0px';
            content.style.opacity = '0.55';
        });
    }

    function findOpenGroup(groups) {
        return groups.find((group) => group.open);
    }

    function setActiveGroup(groups, activeGroup) {
        groups.forEach((group) => group.classList.toggle('is-active', group === activeGroup));
    }

    function syncCollectionHash(slug, enabled = true) {
        if (!enabled) return;

        try {
            if (slug) history.replaceState(null, '', `#${slug}`);
            else history.replaceState(null, '', location.pathname);
        } catch (_) {}
    }

    function syncCollectionSuffix(suffix, options, slug, label) {
        if (!suffix) return;
        suffix.innerHTML = slug ? options.formatCrumb(slug, label) : '';
    }

    function createCollectionState(groups, suffix, options) {
        let activeId = null;
        const syncHash = options.syncHash !== false;

        return {
            getActiveId() {
                return activeId;
            },
            apply(group) {
                if (!group) {
                    activeId = null;
                    syncCollectionSuffix(suffix, options, null, null);
                    syncCollectionHash(null, syncHash);
                    setActiveGroup(groups, null);
                    return;
                }

                activeId = group.id;
                syncCollectionSuffix(
                    suffix,
                    options,
                    group.dataset.slug,
                    (group.dataset.group || '').toLowerCase()
                );
                syncCollectionHash(group.dataset.slug, syncHash);
                setActiveGroup(groups, group);
            }
        };
    }

    function openGroupWithMotion(summary, group, content, state) {
        group.dataset.animating = '1';
        state.apply(group);
        startDots(summary, group);
        group._openDelay = window.setTimeout(() => {
            group._openDelay = null;
            animateOpen(group, content, () => {
                stopDots(group);
                delete group.dataset.animating;
            });
        }, prefersReducedMotion ? 0 : OPEN_DOTS_MS);
    }

    function closeGroupWithMotion(group, content, groups, state) {
        group.dataset.animating = '1';
        animateClose(group, content, () => {
            delete group.dataset.animating;
            state.apply(findOpenGroup(groups));
        });
    }

    function initCollectionPage(root, options, cleanups) {
        const suffix = root.querySelector(options.suffixSelector);
        const groups = Array.from(root.querySelectorAll('details.group'));
        if (!groups.length) return;

        const state = createCollectionState(groups, suffix, options);
        const clickHandlers = [];

        root.querySelectorAll('details.group > summary').forEach((summary) => {
            const onClick = (event) => {
                event.preventDefault();

                const wrap = summary.parentElement;
                const content = wrap?.querySelector('.group-items');

                if (!wrap || wrap.dataset.animating === '1') {
                    return;
                }

                stopGroupMotion(wrap);

                if (wrap.open) {
                    closeGroupWithMotion(wrap, content, groups, state);
                    return;
                }

                openGroupWithMotion(summary, wrap, content, state);
            };

            summary.addEventListener('click', onClick);
            clickHandlers.push(() => {
                stopGroupMotion(summary.parentElement);
                summary.removeEventListener('click', onClick);
            });
        });

        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0));

            if (!visible.length) {
                const openGroup = findOpenGroup(groups);
                if (!openGroup) {
                    state.apply(null);
                }
                return;
            }

            const top = (visible.find((entry) => entry.target.open) || visible[0]).target;

            if (top.open && top.id !== state.getActiveId()) {
                state.apply(top);
            }
        }, {
            root: null,
            rootMargin: '-20% 0px -40% 0px',
            threshold: [0.2, 0.4, 0.6, 0.8]
        });

        groups.forEach((group) => observer.observe(group));

        const slug = (location.hash || '').replace(/^#/, '');
        if (!slug) {
            state.apply(null);
        } else {
            const el = root.querySelector(`#group-${slug}`);
            if (el) {
                if (!el.open) el.open = true;
                el.scrollIntoView({ behavior: 'instant', block: 'start' });
                state.apply(el);
            } else {
                state.apply(null);
            }
        }

        cleanups.push(() => {
            clickHandlers.forEach((cleanup) => cleanup());
            observer.disconnect();
            groups.forEach((group) => stopGroupMotion(group));
        });
    }

    window.initCollectionPage = initCollectionPage;
})();
