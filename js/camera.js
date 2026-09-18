/**
 * Accès à l'appareil photo (getUserMedia) et préparation des images.
 *
 * Toutes les images, qu'elles viennent de l'appareil photo ou d'un fichier,
 * passent par redimensionner() : on évite de stocker des photos de 12 Mpx
 * dans IndexedDB alors qu'on les affiche sur quelques centaines de pixels.
 */

const COTE_MAX = 1600;
const QUALITE = 0.85;

export class AppareilPhoto {
  constructor(videoElement) {
    this.video = videoElement;
    this.flux = null;
    this.orientation = 'environment'; // caméra arrière par défaut
  }

  static estDisponible() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /** Démarre l'aperçu. Lève une erreur lisible si l'accès est refusé. */
  async demarrer() {
    if (!AppareilPhoto.estDisponible()) {
      throw new Error("Cet appareil ou ce navigateur ne donne pas accès à la caméra.");
    }

    this.arreter();

    try {
      this.flux = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.orientation },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch (erreur) {
      throw new Error(messageErreur(erreur));
    }

    this.video.srcObject = this.flux;
    await this.video.play().catch(() => {
      /* Safari peut rejeter play() si l'onglet passe en arrière-plan : sans effet ici. */
    });
  }

  /** Bascule entre caméra avant et arrière, puis relance l'aperçu. */
  async changerDeCote() {
    this.orientation = this.orientation === 'environment' ? 'user' : 'environment';
    await this.demarrer();
  }

  /** Y a-t-il plus d'une caméra sur l'appareil ? */
  static async plusieursCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return false;
    try {
      const appareils = await navigator.mediaDevices.enumerateDevices();
      return appareils.filter((a) => a.kind === 'videoinput').length > 1;
    } catch {
      return false;
    }
  }

  /** Capture l'image courante de l'aperçu. @returns {Promise<Blob>} JPEG */
  async prendrePhoto() {
    const largeur = this.video.videoWidth;
    const hauteur = this.video.videoHeight;

    if (!largeur || !hauteur) {
      throw new Error("L'aperçu n'est pas encore prêt, réessayez dans un instant.");
    }

    const echelle = Math.min(1, COTE_MAX / Math.max(largeur, hauteur));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(largeur * echelle);
    canvas.height = Math.round(hauteur * echelle);

    const contexte = canvas.getContext('2d');
    // La caméra frontale est affichée en miroir : on capture l'image non miroir,
    // qui correspond à ce que voit réellement l'objectif.
    contexte.drawImage(this.video, 0, 0, canvas.width, canvas.height);

    return versBlob(canvas);
  }

  arreter() {
    if (this.flux) {
      this.flux.getTracks().forEach((piste) => piste.stop());
      this.flux = null;
    }
    this.video.srcObject = null;
  }
}

/** Redimensionne un fichier image choisi dans la galerie. @returns {Promise<Blob>} */
export async function redimensionner(fichier) {
  const image = await chargerImage(fichier);
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));

  if (echelle === 1 && fichier.type === 'image/jpeg') return fichier;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  if (image.close) image.close();
  return versBlob(canvas);
}

function chargerImage(fichier) {
  if (window.createImageBitmap) {
    return createImageBitmap(fichier);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Ce fichier n'est pas une image lisible."));
    };
    image.src = url;
  });
}

function versBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Impossible d'encoder l'image."))),
      'image/jpeg',
      QUALITE,
    );
  });
}

function messageErreur(erreur) {
  switch (erreur && erreur.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, puis réessayez.";
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Aucune caméra utilisable trouvée sur cet appareil.';
    case 'NotReadableError':
      return "La caméra est déjà utilisée par une autre application.";
    default:
      return "Impossible d'ouvrir la caméra : " + ((erreur && erreur.message) || 'erreur inconnue') + '.';
  }
}
