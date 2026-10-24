/* ============================================================================
   Jumeau JavaScript de api/octobre-rose.json et api/octobre-rose-maillots.json.

   FICHIER GENERE - ne pas modifier a la main.

   Il permet au catalogue de fonctionner quand le site est ouvert par
   double-clic : en file://, un <script> s'execute la ou fetch() est bloque.
   En ligne, il n'est qu'un dernier recours apres les routes serveur et les
   fichiers .json.

   Emplacement impose : js/ et non api/, ou Vercel transformerait tout .js en
   fonction serveur.
   ========================================================================== */
window.OR_PARAMETRES = {
  "actif": true,
  "encheresActivees": false,
  "surtitre": "Opération solidaire",
  "titre": "Enchères solidaires — Octobre Rose",
  "sousTitre": "Vingt et un maillots de hockey aux couleurs d'Octobre Rose sont mis aux enchères au profit de la lutte contre le cancer du sein. Chaque maillot a sa page : vous y verrez la meilleure offre du moment et pourrez enchérir, sans créer de compte.",
  "messagePreparation": "Le catalogue des maillots arrive. L'ouverture des enchères sera annoncée ici et sur nos réseaux.",
  "ouverture": "2026-10-25T00:00:00+02:00",
  "cloture": "2026-10-30T00:00:00+01:00",
  "fuseau": "Europe/Paris",
  "miseAPrix": 30,
  "palier": 5,
  "nombreMaillots": 21,
  "beneficiaire": "Roller Bug Saint-Médard — dons reversés à Octobre Rose",
  "visuel": "images/octobre-rose/maillot-exemple.webp",
  "visuelAlt": "Le maillot Octobre Rose du Roller Bug",
  "lienCatalogue": "octobre-rose/index.html",
  "libelleCatalogue": "Découvrir les maillots",
  "lienSecondaire": "#contact",
  "libelleSecondaire": "Nous contacter"
};
window.OR_MAILLOTS = [
  {
    "id": "maillot-88",
    "numero": 88,
    "nom": "BEDNAR",
    "poste": "gardien",
    "posteLibelle": "Gardien",
    "taille": "3XL",
    "description": "Maillot Octobre Rose du Roller Bug, floqué BEDNAR au dos, numéro 88, taille 3XL. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-26",
    "numero": 26,
    "nom": "CHAMON",
    "poste": "gardien",
    "posteLibelle": "Gardien",
    "taille": "3XL",
    "description": "Maillot Octobre Rose du Roller Bug, floqué CHAMON au dos, numéro 26, taille 3XL. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-29",
    "numero": 29,
    "nom": "MOLINA",
    "poste": "gardien",
    "posteLibelle": "Gardien",
    "taille": "3XL",
    "description": "Maillot Octobre Rose du Roller Bug, floqué MOLINA au dos, numéro 29, taille 3XL. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-9",
    "numero": 9,
    "nom": "GRASSET",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué GRASSET au dos, numéro 9, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-10",
    "numero": 10,
    "nom": "PHILIPPO",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué PHILIPPO au dos, numéro 10, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-8",
    "numero": 8,
    "nom": "ROBLIN ZEMPE",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué ROBLIN ZEMPE au dos, numéro 8, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-97",
    "numero": 97,
    "nom": "SABLEAU-FICHTER",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué SABLEAU-FICHTER au dos, numéro 97, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-16",
    "numero": 16,
    "nom": "TRIMOUILLE",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué TRIMOUILLE au dos, numéro 16, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-91",
    "numero": 91,
    "nom": "AUTON",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "XL",
    "description": "Maillot Octobre Rose du Roller Bug, floqué AUTON au dos, numéro 91, taille XL. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-83",
    "numero": 83,
    "nom": "NEAUD",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué NEAUD au dos, numéro 83, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-7",
    "numero": 7,
    "nom": "RODZIEWICZ",
    "poste": "defenseur",
    "posteLibelle": "Défenseur",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué RODZIEWICZ au dos, numéro 7, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-72",
    "numero": 72,
    "nom": "BRUCHE",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué BRUCHE au dos, numéro 72, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-20",
    "numero": 20,
    "nom": "MASSON",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué MASSON au dos, numéro 20, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-24",
    "numero": 24,
    "nom": "DURY",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué DURY au dos, numéro 24, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-14",
    "numero": 14,
    "nom": "LAMBERT",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué LAMBERT au dos, numéro 14, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-22",
    "numero": 22,
    "nom": "GERARDIN",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "L",
    "description": "Maillot Octobre Rose du Roller Bug, floqué GERARDIN au dos, numéro 22, taille L. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-95",
    "numero": 95,
    "nom": "MORENO",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué MORENO au dos, numéro 95, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-32",
    "numero": 32,
    "nom": "FAURITE",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué FAURITE au dos, numéro 32, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-19",
    "numero": 19,
    "nom": "PEROT",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué PEROT au dos, numéro 19, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-56",
    "numero": 56,
    "nom": "KOTZUBA",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué KOTZUBA au dos, numéro 56, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  },
  {
    "id": "maillot-12",
    "numero": 12,
    "nom": "MAHUTEAUX",
    "poste": "attaquant",
    "posteLibelle": "Attaquant",
    "taille": "M",
    "description": "Maillot Octobre Rose du Roller Bug, floqué MAHUTEAUX au dos, numéro 12, taille M. Pièce unique portée par l'équipe.",
    "photos": [
      "images/octobre-rose/maillot-exemple.webp"
    ],
    "photoIllustration": true,
    "visible": true,
    "prixDepart": 30
  }
];
