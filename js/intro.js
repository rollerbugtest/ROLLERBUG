/* Écran d'accueil joué à l'arrivée sur le site.

   Publie window.rollerbugReady : une promesse résolue quand le rideau est
   levé. animations.js l'attend pour lancer l'apparition du hero, sinon
   celle-ci se jouerait derrière le rideau et serait perdue. */
(function(){
  const root = document.documentElement;
  const intro = document.getElementById('intro');

  // Animations refusées (ou pas de JS) : le rideau n'est même pas affiché.
  if(!root.classList.contains('js') || !intro){
    window.rollerbugReady = Promise.resolve();
    return;
  }

  // sessionStorage peut être interdit (navigation privée, page sandboxée) :
  // en cas de refus on retombe simplement sur l'intro complète.
  function alreadySeen(){
    try{ return sessionStorage.getItem('rb-intro') === '1'; }
    catch(e){ return false; }
  }
  function remember(){
    try{ sessionStorage.setItem('rb-intro', '1'); }
    catch(e){ /* sans importance */ }
  }

  // Intro complète à la première arrivée, version courte ensuite.
  const seen = alreadySeen();
  const MIN_MS = seen ? 260 : 1200;   // temps mini pour que l'animation se voie
  const MAX_MS = seen ? 700 : 2600;   // garde-fou absolu

  if(seen) intro.classList.add('quick');
  root.classList.add('intro-active');

  window.rollerbugReady = new Promise(resolve => {
    const start = performance.now();
    let done = false;

    function finish(){
      if(done) return;
      done = true;
      remember();
      intro.classList.add('done');
      root.classList.remove('intro-active');
      setTimeout(resolve, 220);          // le hero démarre pendant la levée
      setTimeout(() => intro.remove(), 1000);
    }

    function whenReady(){
      const elapsed = performance.now() - start;
      if(elapsed >= MIN_MS) finish();
      else setTimeout(finish, MIN_MS - elapsed);
    }

    if(document.readyState === 'complete') whenReady();
    else window.addEventListener('load', whenReady, { once:true });

    // Quoi qu'il arrive — image lente, ressource bloquée — la page se libère.
    setTimeout(finish, MAX_MS);
  });
})();
