  const header = document.querySelector('header');
  const nav = document.getElementById('mainNav');
  const navToggle = document.getElementById('navToggle');
  const brandHome = document.getElementById('brandHome');

  /* Clic sur le logo : on recharge la page depuis le début.
     On oublie au passage que l'intro a déjà été vue, pour que l'écran
     d'accueil se rejoue en entier — sinon le clic donnerait la version
     courte et n'aurait presque rien de visible. */
  if(brandHome){
    brandHome.addEventListener('click', e => {
      e.preventDefault();
      try{ sessionStorage.removeItem('rb-intro'); }catch(err){ /* stockage refusé */ }
      window.scrollTo(0, 0);
      // On repart de l'URL sans ancre, sinon le navigateur ramène à la section
      location.replace(location.href.split('#')[0]);
    });
  }

  function setHeaderHeight(){
    document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  }
  window.addEventListener('resize', setHeaderHeight);
  setHeaderHeight();

  function closeNav(){
    nav.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));

  document.addEventListener('click', (e) => {
    if(nav.classList.contains('open') && !nav.contains(e.target) && !navToggle.contains(e.target)){
      closeNav();
    }
  });

  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeNav();
  });
