  const fill = document.getElementById('progressFill');
  const dots = Array.from(document.querySelectorAll('.progress-dot'));

  // On garde dot + section + lien de menu appairés pour que les index restent alignés
  const steps = dots
    .map(dot => ({
      dot,
      sec: document.getElementById(dot.dataset.target),
      link: document.querySelector('nav a[href="#' + dot.dataset.target + '"]')
    }))
    .filter(step => step.sec);

  function update(){
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    fill.style.height = Math.min(100, Math.max(0, pct)) + '%';

    // Section active = la dernière dont le haut est passé au-dessus du tiers de l'écran
    const marker = window.scrollY + window.innerHeight * 0.35;
    let activeIdx = -1;
    steps.forEach((step, i) => {
      if(step.sec.getBoundingClientRect().top + window.scrollY <= marker) activeIdx = i;
    });
    steps.forEach((step, i) => {
      const isActive = i === activeIdx;
      step.dot.classList.toggle('active', isActive);
      step.dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      if(step.link) step.link.classList.toggle('active', isActive);
    });
  }

  steps.forEach(step => {
    step.dot.addEventListener('click', () => {
      // Même rideau que les liens du menu, s'il est disponible
      if(window.rollerbugGoTo) window.rollerbugGoTo(step.dot.dataset.target);
      else step.sec.scrollIntoView({ behavior:'smooth' });
    });
  });

  window.addEventListener('scroll', update, { passive:true });
  window.addEventListener('resize', update);
  update();
