/**
 * Couche de stockage : IndexedDB.
 *
 * Deux magasins :
 *  - "oeuvres" : les fiches (nom, musée, salle, description, date, id de la photo)
 *  - "photos"  : les images sous forme de Blob, séparées des fiches pour que
 *                lister la collection ne charge pas toutes les images en mémoire.
 */

const DB_NOM = 'musee-collection';
const DB_VERSION = 1;
const STORE_OEUVRES = 'oeuvres';
const STORE_PHOTOS = 'photos';

let connexion = null;

function ouvrir() {
  if (connexion) return Promise.resolve(connexion);

  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(DB_NOM, DB_VERSION);

    requete.onupgradeneeded = (evenement) => {
      const db = requete.result;

      if (!db.objectStoreNames.contains(STORE_OEUVRES)) {
        const oeuvres = db.createObjectStore(STORE_OEUVRES, { keyPath: 'id' });
        oeuvres.createIndex('musee', 'musee', { unique: false });
        oeuvres.createIndex('creeLe', 'creeLe', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
      }

      void evenement;
    };

    requete.onsuccess = () => {
      connexion = requete.result;
      connexion.onversionchange = () => {
        connexion.close();
        connexion = null;
      };
      resolve(connexion);
    };

    requete.onerror = () => reject(requete.error);
  });
}

function transaction(magasins, mode) {
  return ouvrir().then((db) => db.transaction(magasins, mode));
}

/** Enveloppe une IDBRequest dans une promesse. */
function attendre(requete) {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

/** Attend la fin d'une transaction d'écriture (garantit que c'est bien commité). */
function attendreTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
  });
}

export function nouvelIdentifiant() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Liste toutes les fiches, de la plus récente à la plus ancienne.
 * Les images ne sont pas incluses : utiliser lirePhoto(id) à la demande.
 */
export async function listerOeuvres() {
  const tx = await transaction([STORE_OEUVRES], 'readonly');
  const oeuvres = await attendre(tx.objectStore(STORE_OEUVRES).getAll());
  return oeuvres.sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''));
}

export async function lireOeuvre(id) {
  const tx = await transaction([STORE_OEUVRES], 'readonly');
  return attendre(tx.objectStore(STORE_OEUVRES).get(id));
}

/**
 * Crée ou met à jour une fiche.
 * @param {object} oeuvre  La fiche (sans la photo).
 * @param {Blob|null|undefined} photo  Nouvelle image. undefined = ne pas toucher
 *   à la photo existante, null = supprimer la photo.
 */
export async function enregistrerOeuvre(oeuvre, photo) {
  const tx = await transaction([STORE_OEUVRES, STORE_PHOTOS], 'readwrite');
  const magasinOeuvres = tx.objectStore(STORE_OEUVRES);
  const magasinPhotos = tx.objectStore(STORE_PHOTOS);

  const fiche = { ...oeuvre };

  if (photo instanceof Blob) {
    fiche.photoId = fiche.photoId || nouvelIdentifiant();
    magasinPhotos.put({ id: fiche.photoId, blob: photo, type: photo.type });
  } else if (photo === null) {
    if (fiche.photoId) magasinPhotos.delete(fiche.photoId);
    fiche.photoId = null;
  }

  magasinOeuvres.put(fiche);
  await attendreTx(tx);
  return fiche;
}

export async function supprimerOeuvre(id) {
  const tx = await transaction([STORE_OEUVRES, STORE_PHOTOS], 'readwrite');
  const magasinOeuvres = tx.objectStore(STORE_OEUVRES);
  const fiche = await attendre(magasinOeuvres.get(id));

  if (fiche && fiche.photoId) tx.objectStore(STORE_PHOTOS).delete(fiche.photoId);
  magasinOeuvres.delete(id);

  await attendreTx(tx);
}

export async function lirePhoto(photoId) {
  if (!photoId) return null;
  const tx = await transaction([STORE_PHOTOS], 'readonly');
  const entree = await attendre(tx.objectStore(STORE_PHOTOS).get(photoId));
  return entree ? entree.blob : null;
}

/** Sauvegarde complète : fiches + images encodées en base64. */
export async function exporterTout() {
  const oeuvres = await listerOeuvres();
  const fiches = [];

  for (const oeuvre of oeuvres) {
    const blob = await lirePhoto(oeuvre.photoId);
    fiches.push({
      ...oeuvre,
      photo: blob ? { type: blob.type, donnees: await blobVersBase64(blob) } : null,
    });
  }

  return { format: 'musee-collection', version: 1, exporteLe: new Date().toISOString(), oeuvres: fiches };
}

/**
 * Restaure une sauvegarde. Les fiches dont l'id existe déjà sont écrasées.
 * @returns {number} nombre de fiches importées
 */
export async function importerTout(sauvegarde) {
  if (!sauvegarde || !Array.isArray(sauvegarde.oeuvres)) {
    throw new Error('Fichier de sauvegarde illisible.');
  }

  let compte = 0;

  for (const entree of sauvegarde.oeuvres) {
    const { photo, ...fiche } = entree;
    fiche.id = fiche.id || nouvelIdentifiant();
    fiche.creeLe = fiche.creeLe || new Date().toISOString();
    fiche.photoId = null;

    const blob = photo && photo.donnees ? base64VersBlob(photo.donnees, photo.type) : undefined;
    await enregistrerOeuvre(fiche, blob);
    compte += 1;
  }

  return compte;
}

function blobVersBase64(blob) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const resultat = String(lecteur.result);
      resolve(resultat.slice(resultat.indexOf(',') + 1));
    };
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

function base64VersBlob(base64, type) {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: type || 'image/jpeg' });
}
