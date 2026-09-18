/**
 * Logique de l'application : galerie, fiche, appareil photo, sauvegardes.
 */

import {
  listerOeuvres,
  lireOeuvre,
  enregistrerOeuvre,
  supprimerOeuvre,
  lirePhoto,
  nouvelIdentifiant,
  exporterTout,
  importerTout,
} from './db.js';
import { AppareilPhoto, redimensionner } from './camera.js';

const $ = (selecteur) => document.querySelector(selecteur);

const elements = {
  compteur: $('#compteur'),
  galerie: $('#galerie'),
  vide: $('#vide'),
  aucunResultat: $('#aucun-resultat'),
  recherche: $('#recherche'),
  filtreMusee: $('#filtre-musee'),
  listeMusees: $('#liste-musees'),
  listeSalles: $('#liste-salles'),
  annonce: $('#annonce'),

  btnAjouter: $('#btn-ajouter'),
  btnMenu: $('#btn-menu'),
  menu: $('#menu'),
  btnExporter: $('#btn-exporter'),
  btnImporter: $('#btn-importer'),
  fichierImport: $('#fichier-import'),

  dialogueFiche: $('#dialogue-fiche'),
  formulaire: $('#formulaire'),
  titreFiche: $('#titre-fiche'),
  champNom: $('#champ-nom'),
  champMusee: $('#champ-musee'),
  champSalle: $('#champ-salle'),
  champDescription: $('#champ-description'),
  erreurFiche: $('#erreur-fiche'),
  apercuPhoto: $('#apercu-photo'),
  photoAbsente: $('#photo-absente'),
  btnCamera: $('#btn-camera'),
  btnGalerie: $('#btn-galerie'),
  btnRetirerPhoto: $('#btn-retirer-photo'),
  fichierPhoto: $('#fichier-photo'),
  btnSupprimer: $('#btn-supprimer'),

  dialogueCamera: $('#dialogue-camera'),
  apercuCamera: $('#apercu-camera'),
  erreurCamera: $('#erreur-camera'),
  btnDeclencher: $('#btn-declencher'),
  btnFermerCamera: $('#btn-fermer-camera'),
  btnChangerCamera: $('#btn-changer-camera'),

  dialogueDetail: $('#dialogue-detail'),
  detailNom: $('#detail-nom'),
  detailPhoto: $('#detail-photo'),
  detailMusee: $('#detail-musee'),
  detailSalle: $('#detail-salle'),
  detailDate: $('#detail-date'),
  detailDescription: $('#detail-description'),
  btnModifier: $('#btn-modifier'),
};

const etat = {
  oeuvres: [],
  /** Fiche en cours d'édition, ou null si on crée une nouvelle fiche. */
  edition: null,
  /** Blob choisi dans le formulaire : Blob = nouvelle photo, null = retirée, undefined = inchangée. */
  photoEnCours: undefined,
  detailId: null,
};

/** URL d'objet créées pour l'affichage, à révoquer pour ne pas fuir la mémoire. */
const urlsGalerie = new Map();
let urlApercu = null;
let urlDetail = null;
let appareil = null;

// ============================================================
//  Galerie
// ============================================================

async function chargerGalerie() {
  etat.oeuvres = await listerOeuvres();
  majListesDeroulantes();
  afficherGalerie();
}

function oeuvresFiltrees() {
  const terme = elements.recherche.value.trim().toLowerCase();
  const musee = elements.filtreMusee.value;

  return etat.oeuvres.filter((oeuvre) => {
    if (musee && (oeuvre.musee || '') !== musee) return false;
    if (!terme) return true;

    return [oeuvre.nom, oeuvre.musee, oeuvre.salle, oeuvre.description]
      .some((valeur) => (valeur || '').toLowerCase().includes(terme));
  });
}

function afficherGalerie() {
  const liste = oeuvresFiltrees();

  libererUrlsGalerie();
  elements.galerie.textContent = '';

  const total = etat.oeuvres.length;
  elements.compteur.textContent = total === 0
    ? 'Aucun tableau enregistré'
    : `${total} tableau${total > 1 ? 'x' : ''}${liste.length !== total ? ` · ${liste.length} affiché${liste.length > 1 ? 's' : ''}` : ''}`;

  elements.vide.hidden = total !== 0;
  elements.aucunResultat.hidden = !(total > 0 && liste.length === 0);

  for (const oeuvre of liste) {
    elements.galerie.append(construireCarte(oeuvre));
  }
}

function construireCarte(oeuvre) {
  const item = document.createElement('li');

  const carte = document.createElement('button');
  carte.type = 'button';
  carte.className = 'carte';
  carte.addEventListener('click', () => ouvrirDetail(oeuvre.id));

  const cadre = document.createElement('div');
  cadre.className = 'carte__cadre';

  if (oeuvre.photoId) {
    const image = document.createElement('img');
    image.className = 'carte__image';
    image.alt = oeuvre.nom ? `Photo de « ${oeuvre.nom} »` : 'Photo du tableau';
    image.loading = 'lazy';
    cadre.append(image);

    // Chargement asynchrone : la carte s'affiche tout de suite, l'image suit.
    lirePhoto(oeuvre.photoId).then((blob) => {
      if (!blob || !image.isConnected) return;
      const url = URL.createObjectURL(blob);
      urlsGalerie.set(oeuvre.photoId, url);
      image.src = url;
    });
  } else {
    const symbole = document.createElement('span');
    symbole.className = 'carte__sans-image';
    symbole.textContent = '🖼';
    symbole.setAttribute('aria-hidden', 'true');
    cadre.append(symbole);
  }

  const texte = document.createElement('div');
  texte.className = 'carte__texte';

  const nom = document.createElement('p');
  nom.className = 'carte__nom';
  nom.textContent = oeuvre.nom || 'Sans titre';

  const lieu = document.createElement('p');
  lieu.className = 'carte__lieu';
  lieu.textContent = decrireLieu(oeuvre) || '—';

  texte.append(nom, lieu);
  carte.append(cadre, texte);
  item.append(carte);
  return item;
}

function decrireLieu(oeuvre) {
  return [oeuvre.musee, oeuvre.salle].filter(Boolean).join(' · ');
}

function libererUrlsGalerie() {
  urlsGalerie.forEach((url) => URL.revokeObjectURL(url));
  urlsGalerie.clear();
}

/** Alimente le filtre « musée » et les suggestions de saisie. */
function majListesDeroulantes() {
  const musees = valeursUniques(etat.oeuvres.map((o) => o.musee));
  const salles = valeursUniques(etat.oeuvres.map((o) => o.salle));

  const selectionCourante = elements.filtreMusee.value;
  elements.filtreMusee.textContent = '';
  elements.filtreMusee.append(new Option('Tous les musées', ''));
  musees.forEach((musee) => elements.filtreMusee.append(new Option(musee, musee)));
  elements.filtreMusee.value = musees.includes(selectionCourante) ? selectionCourante : '';

  remplirDatalist(elements.listeMusees, musees);
  remplirDatalist(elements.listeSalles, salles);
}

function valeursUniques(valeurs) {
  return [...new Set(valeurs.filter((v) => v && v.trim()))].sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

function remplirDatalist(datalist, valeurs) {
  datalist.textContent = '';
  valeurs.forEach((valeur) => {
    const option = document.createElement('option');
    option.value = valeur;
    datalist.append(option);
  });
}

// ============================================================
//  Fiche (création / modification)
// ============================================================

function ouvrirFiche(oeuvre) {
  etat.edition = oeuvre || null;
  etat.photoEnCours = undefined;

  elements.titreFiche.textContent = oeuvre ? 'Modifier le tableau' : 'Nouveau tableau';
  elements.champNom.value = oeuvre ? oeuvre.nom || '' : '';
  elements.champMusee.value = oeuvre ? oeuvre.musee || '' : '';
  elements.champSalle.value = oeuvre ? oeuvre.salle || '' : '';
  elements.champDescription.value = oeuvre ? oeuvre.description || '' : '';
  elements.btnSupprimer.hidden = !oeuvre;
  elements.erreurFiche.hidden = true;

  if (oeuvre && oeuvre.photoId) {
    lirePhoto(oeuvre.photoId).then((blob) => {
      if (blob && etat.edition === oeuvre) montrerApercu(blob);
    });
  } else {
    montrerApercu(null);
  }

  elements.dialogueFiche.showModal();
  elements.champNom.focus();
}

function montrerApercu(blob) {
  if (urlApercu) {
    URL.revokeObjectURL(urlApercu);
    urlApercu = null;
  }

  if (blob) {
    urlApercu = URL.createObjectURL(blob);
    elements.apercuPhoto.src = urlApercu;
    elements.apercuPhoto.hidden = false;
    elements.photoAbsente.hidden = true;
    elements.btnRetirerPhoto.hidden = false;
    elements.btnCamera.innerHTML = '<span aria-hidden="true">📷</span> Reprendre la photo';
  } else {
    elements.apercuPhoto.removeAttribute('src');
    elements.apercuPhoto.hidden = true;
    elements.photoAbsente.hidden = false;
    elements.btnRetirerPhoto.hidden = true;
    elements.btnCamera.innerHTML = '<span aria-hidden="true">📷</span> Prendre une photo';
  }
}

function fermerFiche() {
  elements.dialogueFiche.close();
}

elements.dialogueFiche.addEventListener('close', () => {
  etat.edition = null;
  etat.photoEnCours = undefined;
  montrerApercu(null);
});

elements.formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();

  const nom = elements.champNom.value.trim();
  if (!nom) {
    elements.erreurFiche.textContent = 'Le nom du tableau est obligatoire.';
    elements.erreurFiche.hidden = false;
    elements.champNom.focus();
    return;
  }

  const existante = etat.edition;
  const fiche = {
    id: existante ? existante.id : nouvelIdentifiant(),
    nom,
    musee: elements.champMusee.value.trim(),
    salle: elements.champSalle.value.trim(),
    description: elements.champDescription.value.trim(),
    photoId: existante ? existante.photoId || null : null,
    creeLe: existante ? existante.creeLe : new Date().toISOString(),
    modifieLe: new Date().toISOString(),
  };

  try {
    await enregistrerOeuvre(fiche, etat.photoEnCours);
  } catch (erreur) {
    elements.erreurFiche.textContent = "Enregistrement impossible : " + erreur.message;
    elements.erreurFiche.hidden = false;
    return;
  }

  fermerFiche();
  await chargerGalerie();
  annoncer(existante ? 'Tableau mis à jour.' : 'Tableau ajouté à votre collection.');
});

elements.btnSupprimer.addEventListener('click', async () => {
  const oeuvre = etat.edition;
  if (!oeuvre) return;
  if (!confirm(`Supprimer définitivement « ${oeuvre.nom || 'Sans titre'} » ?`)) return;

  await supprimerOeuvre(oeuvre.id);
  fermerFiche();
  await chargerGalerie();
  annoncer('Tableau supprimé.');
});

elements.btnRetirerPhoto.addEventListener('click', () => {
  etat.photoEnCours = null;
  montrerApercu(null);
});

document.querySelectorAll('[data-fermer-fiche]').forEach((bouton) =>
  bouton.addEventListener('click', fermerFiche));

// ============================================================
//  Photo : fichier existant
// ============================================================

elements.btnGalerie.addEventListener('click', () => elements.fichierPhoto.click());

elements.fichierPhoto.addEventListener('change', async () => {
  const fichier = elements.fichierPhoto.files[0];
  elements.fichierPhoto.value = '';
  if (!fichier) return;

  try {
    const blob = await redimensionner(fichier);
    etat.photoEnCours = blob;
    montrerApercu(blob);
  } catch (erreur) {
    elements.erreurFiche.textContent = erreur.message;
    elements.erreurFiche.hidden = false;
  }
});

// ============================================================
//  Photo : appareil photo
// ============================================================

elements.btnCamera.addEventListener('click', async () => {
  if (!AppareilPhoto.estDisponible()) {
    // Repli : sur les navigateurs sans getUserMedia, l'attribut capture ouvre
    // directement l'appareil photo du téléphone.
    elements.fichierPhoto.setAttribute('capture', 'environment');
    elements.fichierPhoto.click();
    elements.fichierPhoto.removeAttribute('capture');
    return;
  }

  appareil = appareil || new AppareilPhoto(elements.apercuCamera);
  elements.erreurCamera.hidden = true;
  elements.btnDeclencher.disabled = true;
  elements.dialogueCamera.showModal();

  try {
    await appareil.demarrer();
    elements.btnDeclencher.disabled = false;
    elements.btnChangerCamera.hidden = !(await AppareilPhoto.plusieursCameras());
  } catch (erreur) {
    elements.erreurCamera.textContent = erreur.message;
    elements.erreurCamera.hidden = false;
  }
});

elements.btnDeclencher.addEventListener('click', async () => {
  if (!appareil) return;
  elements.btnDeclencher.disabled = true;

  try {
    const blob = await appareil.prendrePhoto();
    etat.photoEnCours = blob;
    montrerApercu(blob);
    elements.dialogueCamera.close();
    annoncer('Photo prise.');
  } catch (erreur) {
    elements.erreurCamera.textContent = erreur.message;
    elements.erreurCamera.hidden = false;
  } finally {
    elements.btnDeclencher.disabled = false;
  }
});

elements.btnChangerCamera.addEventListener('click', async () => {
  if (!appareil) return;
  try {
    await appareil.changerDeCote();
  } catch (erreur) {
    elements.erreurCamera.textContent = erreur.message;
    elements.erreurCamera.hidden = false;
  }
});

elements.btnFermerCamera.addEventListener('click', () => elements.dialogueCamera.close());

// La caméra doit être libérée dans tous les cas : bouton, Échap, ou onglet masqué.
elements.dialogueCamera.addEventListener('close', () => {
  if (appareil) appareil.arreter();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && elements.dialogueCamera.open) elements.dialogueCamera.close();
});

// ============================================================
//  Détail
// ============================================================

async function ouvrirDetail(id) {
  const oeuvre = await lireOeuvre(id);
  if (!oeuvre) return;

  etat.detailId = id;
  elements.detailNom.textContent = oeuvre.nom || 'Sans titre';
  elements.detailMusee.textContent = oeuvre.musee || 'Non renseigné';
  elements.detailSalle.textContent = oeuvre.salle || 'Non renseignée';
  elements.detailDate.textContent = formaterDate(oeuvre.creeLe);
  elements.detailDescription.textContent = oeuvre.description || 'Aucune description.';

  libererUrlDetail();

  if (oeuvre.photoId) {
    const blob = await lirePhoto(oeuvre.photoId);
    if (blob && etat.detailId === id) {
      urlDetail = URL.createObjectURL(blob);
      elements.detailPhoto.src = urlDetail;
      elements.detailPhoto.alt = `Photo de « ${oeuvre.nom || 'Sans titre'} »`;
      elements.detailPhoto.hidden = false;
    }
  } else {
    elements.detailPhoto.hidden = true;
  }

  elements.dialogueDetail.showModal();
}

function libererUrlDetail() {
  if (urlDetail) {
    URL.revokeObjectURL(urlDetail);
    urlDetail = null;
  }
  elements.detailPhoto.removeAttribute('src');
  elements.detailPhoto.hidden = true;
}

elements.dialogueDetail.addEventListener('close', () => {
  libererUrlDetail();
  etat.detailId = null;
});

elements.btnModifier.addEventListener('click', async () => {
  const id = etat.detailId;
  elements.dialogueDetail.close();
  const oeuvre = await lireOeuvre(id);
  if (oeuvre) ouvrirFiche(oeuvre);
});

document.querySelectorAll('[data-fermer-detail]').forEach((bouton) =>
  bouton.addEventListener('click', () => elements.dialogueDetail.close()));

function formaterDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ============================================================
//  Menu, sauvegarde, restauration
// ============================================================

function basculerMenu(ouvrir) {
  const doitOuvrir = ouvrir === undefined ? elements.menu.hidden : ouvrir;
  elements.menu.hidden = !doitOuvrir;
  elements.btnMenu.setAttribute('aria-expanded', String(doitOuvrir));
}

elements.btnMenu.addEventListener('click', (evenement) => {
  evenement.stopPropagation();
  basculerMenu();
});

document.addEventListener('click', (evenement) => {
  if (!elements.menu.hidden && !elements.menu.contains(evenement.target)) basculerMenu(false);
});

document.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Escape' && !elements.menu.hidden) basculerMenu(false);
});

elements.btnExporter.addEventListener('click', async () => {
  basculerMenu(false);

  const sauvegarde = await exporterTout();
  const blob = new Blob([JSON.stringify(sauvegarde, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');

  lien.href = url;
  lien.download = `collection-tableaux-${new Date().toISOString().slice(0, 10)}.json`;
  lien.click();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
  annoncer(accorder(sauvegarde.oeuvres.length, 'exporté'));
});

elements.btnImporter.addEventListener('click', () => {
  basculerMenu(false);
  elements.fichierImport.click();
});

elements.fichierImport.addEventListener('change', async () => {
  const fichier = elements.fichierImport.files[0];
  elements.fichierImport.value = '';
  if (!fichier) return;

  try {
    const compte = await importerTout(JSON.parse(await fichier.text()));
    await chargerGalerie();
    annoncer(accorder(compte, 'importé'));
  } catch (erreur) {
    annoncer('Import impossible : ' + erreur.message);
  }
});

// ============================================================
//  Divers
// ============================================================

/** « 1 tableau exporté. » / « 3 tableaux exportés. » */
function accorder(nombre, participe) {
  const s = nombre > 1 ? 's' : '';
  return `${nombre} tableau${nombre > 1 ? 'x' : ''} ${participe}${s}.`;
}

let minuteurAnnonce = null;

function annoncer(message) {
  elements.annonce.textContent = message;
  elements.annonce.hidden = false;
  clearTimeout(minuteurAnnonce);
  minuteurAnnonce = setTimeout(() => {
    elements.annonce.hidden = true;
  }, 3500);
}

elements.btnAjouter.addEventListener('click', () => ouvrirFiche(null));
elements.recherche.addEventListener('input', afficherGalerie);
elements.filtreMusee.addEventListener('change', afficherGalerie);

window.addEventListener('pagehide', () => {
  libererUrlsGalerie();
  if (appareil) appareil.arreter();
});

chargerGalerie().catch((erreur) => {
  elements.compteur.textContent = 'Erreur de chargement';
  elements.vide.hidden = false;
  elements.vide.textContent =
    "Impossible d'ouvrir la base locale : " + erreur.message +
    ' (la navigation privée peut bloquer le stockage).';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      /* L'application fonctionne sans le mode hors ligne. */
    });
  });
}
