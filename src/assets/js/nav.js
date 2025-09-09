// /assets/js/nav.js
window.initNav = function initNav(root = document){
    const body     = document.body;
    const $        = (id) => root.getElementById?.(id) || document.getElementById(id);
    const hamburger= $('hamburger');
    const drawer   = $('mobileDrawer');
    const backdrop = $('backdrop');
    const closeBtn = $('closeDrawer');

    if(!hamburger || !drawer || !backdrop || !closeBtn) return;

    function openDrawer(){
        body.classList.add('drawer-open');
        drawer.setAttribute('aria-hidden','false');
        backdrop.hidden = false;
        hamburger.setAttribute('aria-expanded','true');
    }
    function closeDrawer(){
        body.classList.remove('drawer-open');
        drawer.setAttribute('aria-hidden','true');
        backdrop.hidden = true;
        hamburger.setAttribute('aria-expanded','false');
    }
    window.closeDrawer = closeDrawer;

    hamburger.onclick = openDrawer;
    closeBtn.onclick  = closeDrawer;
    backdrop.onclick  = closeDrawer;

    drawer.querySelectorAll('a[href]').forEach(a=>{
        a.addEventListener('click', () => closeDrawer());
    });
};
// auto-init przy pierwszym załadowaniu
window.initNav(document);