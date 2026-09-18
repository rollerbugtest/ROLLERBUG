(function(){
  const root = document.documentElement;

  // Sans .js (JavaScript coupé), la page est déjà entièrement visible.
  if(!root.classList.contains('js')) return;

  // .motion-full = le visiteur accepte le mouvement. Les fondus d'apparition
  // tournent dans les deux cas ; seuls les effets qui déplacent des éléments
  // (parallaxe, inclinaison, aimantation, compteurs) sont réservés à ce mode.
  const fullMotion = root.classList.contains('motion-full');

  /* ---------- Apparition au scroll ----------
     ⚠ Liste dupliquée dans css/style.css (bloc « Apparition au scroll »).
     Les deux doivent rester identiques. */
  const REVEAL = [
    '.section-tag', '.section-title', '.section-lead', '.about-text',
    '.stat', '.infra-card', '.disc-card', '.event-card', '.news-item', '.insta-embed',
    '.cal-filters', '.cal-day', '.cal-note',
    '.team-block-title', '.team-row', '.coach', '.insc-card',
    '.bureau-card', '.value-card', '.legal-block', '.contact-info', '.signup-form',
    '.cta-row', '.hero-stats', '.eyebrow', '.title', '.tagline',
    '.scroll-cue', '.hero-logo'
  ].join(',');

  // js/data.js remplace le contenu de plusieurs sections : on ne collecte
  // les cibles qu'une fois les données rendues, sinon on observerait des
  // éléments qui ne sont plus dans la page.
  const dataReady = window.rollerbugDataReady || Promise.resolve();

  const targets = Array.from(document.querySelectorAll(REVEAL));

  // Cascade : les éléments d'un même conteneur apparaissent l'un après l'autre.
  // Le délai est plafonné pour que les longues listes ne traînent pas.
  const groups = new Map();
  targets.forEach(el => {
    const parent = el.parentElement;
    if(!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });
  groups.forEach(list => {
    list.forEach((el, i) => el.style.setProperty('--rd', Math.min(i, 8) * 70 + 'ms'));
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(!entry.isIntersecting) return;
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target); // une seule fois
    });
  }, { threshold:0.12, rootMargin:'0px 0px -8% 0px' });

  // On attend la levée du rideau d'accueil : sinon l'apparition du hero se
  // jouerait derrière lui et le visiteur ne verrait rien.
  // Si intro.js est absent, la promesse de repli démarre immédiatement.
  const ready = Promise.all([window.rollerbugReady || Promise.resolve(), dataReady]);
  ready.then(() => {
    // Re-collecte après rendu des données, puis mise en cascade.
    const finalTargets = Array.from(document.querySelectorAll(REVEAL));
    const finalGroups = new Map();
    finalTargets.forEach(el => {
      const parent = el.parentElement;
      if(!finalGroups.has(parent)) finalGroups.set(parent, []);
      finalGroups.get(parent).push(el);
    });
    finalGroups.forEach(list => {
      list.forEach((el, i) => el.style.setProperty('--rd', Math.min(i, 8) * 70 + 'ms'));
    });
    finalTargets.forEach(el => revealObserver.observe(el));
  });

  /* ---------- Compteurs chiffrés ---------- */
  const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

  function runCounter(el){
    const to = parseFloat(el.dataset.count);
    const from = parseFloat(el.dataset.from || 0);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1700;
    const start = performance.now();

    function frame(now){
      const p = Math.min(1, (now - start) / duration);
      const value = Math.round(from + (to - from) * easeOutExpo(p));
      el.textContent = prefix + value + suffix; // pas de séparateur : 1997 doit rester une année
      if(p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(!entry.isIntersecting) return;
      runCounter(entry.target);
      counterObserver.unobserve(entry.target);
    });
  }, { threshold:0.5 });

  // Un chiffre qui défile est une animation à part entière : mouvement complet only.
  if(fullMotion){
    ready.then(() => {
      document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));
    });
  }

  /* ---------- Parallaxe du filigrane + header compact ---------- */
  const header = document.querySelector('header');
  const logoBg = document.querySelector('.logo-bg');
  let ticking = false;

  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if(logoBg && fullMotion) logoBg.style.setProperty('--py', (y * 0.05) + 'px');
      if(header) header.classList.toggle('scrolled', y > 40);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  /* ---------- Effets au survol ----------
     Réservés au mouvement complet et à une souris fine : inutiles au doigt. */
  if(!fullMotion) return;
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;

  // Légère inclinaison 3D des cartes
  dataReady.then(() => {
  const tiltCards = document.querySelectorAll(
    '.disc-card, .event-card, .insc-card, .bureau-card, .value-card, .coach, .news-item, .stat'
  );
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
      card.style.transform =
        `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  // Boutons légèrement aimantés par le curseur
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const mx = (e.clientX - r.left - r.width / 2) * 0.25;
      const my = (e.clientY - r.top - r.height / 2) * 0.25;
      btn.style.transform = `translate(${mx.toFixed(1)}px, ${(my - 3).toFixed(1)}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
  });
})();
