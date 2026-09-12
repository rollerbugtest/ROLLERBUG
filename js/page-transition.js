/* Rideau de transition au changement de section.

   Le site tient en une page : « changer de page » = sauter d'une section à
   l'autre. Le rideau monte, le saut se fait caché, le rideau repart.

   Publie window.rollerbugGoTo(id) — utilisé aussi par la barre de suivi. */
(function(){
  const root = document.documentElement;
  const wipe = document.getElementById('pageWipe');
  const animated = root.classList.contains('js') && !!wipe;

  // Attend la fin d'une transition, avec un filet de sécurité au cas où
  // l'évènement ne partirait pas (onglet en arrière-plan, transition coupée).
  function afterTransition(el, fallbackMs, fn){
    let called = false;
    const run = () => { if(called) return; called = true; el.removeEventListener('transitionend', run); fn(); };
    el.addEventListener('transitionend', run);
    setTimeout(run, fallbackMs);
  }

  function jumpTo(target, id){
    root.classList.add('no-smooth');       // saut instantané, rideau baissé
    target.scrollIntoView({ block:'start' });
    try{ history.replaceState(null, '', '#' + id); }catch(e){ /* file:// */ }
    requestAnimationFrame(() => root.classList.remove('no-smooth'));
  }

  function goTo(id){
    const target = document.getElementById(id);
    if(!target) return;

    // Sans animation : on garde le défilement fluide natif.
    if(!animated){
      target.scrollIntoView({ behavior:'smooth' });
      return;
    }
    if(wipe.dataset.busy === '1') return;  // une transition à la fois
    wipe.dataset.busy = '1';

    wipe.classList.add('in');

    afterTransition(wipe, 520, () => {
      jumpTo(target, id);
      wipe.classList.remove('in');
      wipe.classList.add('out');

      afterTransition(wipe, 580, () => {
        // Sans classe, la règle de base remet le rideau en bas, sans transition
        wipe.classList.remove('out');
        wipe.dataset.busy = '0';
      });
    });
  }

  // Tous les liens internes de la page passent par le rideau
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if(!link) return;

    const id = link.getAttribute('href').slice(1);
    if(!id || !document.getElementById(id)) return;

    e.preventDefault();
    goTo(id);
  });

  window.rollerbugGoTo = goTo;
})();
