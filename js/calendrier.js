/* Filtrage du planning hebdomadaire par discipline.

   Les créneaux sont rendus par js/data.js à partir de api/planning.json :
   on attend donc que les données soient arrivées avant de lire le DOM,
   sinon on filtrerait les anciens éléments, déjà remplacés. */
(function(){
  function init(){
  const filters = Array.from(document.querySelectorAll('.cal-filter'));
  const slots = Array.from(document.querySelectorAll('.cal-slot'));
  const days = Array.from(document.querySelectorAll('.cal-day'));

  if(!filters.length || !slots.length) return;

  function apply(discipline){
    slots.forEach(slot => {
      slot.hidden = discipline !== 'all' && slot.dataset.disc !== discipline;
    });

    // Un jour sans créneau visible est masqué, pour ne pas laisser
    // des colonnes vides en travers de la semaine.
    days.forEach(day => {
      const restants = day.querySelectorAll('.cal-slot:not([hidden])').length;
      day.classList.toggle('is-empty', restants === 0);
    });

    filters.forEach(f => {
      const actif = f.dataset.disc === discipline;
      f.classList.toggle('active', actif);
      f.setAttribute('aria-pressed', actif ? 'true' : 'false');
    });
  }

  filters.forEach(f => {
    f.addEventListener('click', () => apply(f.dataset.disc));
  });

  apply('all');
  }

  (window.rollerbugDataReady || Promise.resolve()).then(init);
})();
