# Ma collection de tableaux

Une petite application pour ranger vos photos de tableaux avec, pour chacun :
le **nom** de l'œuvre, le **musée**, la **salle** et une **description**.
L'appareil photo est intégré : vous photographiez le tableau directement depuis
l'application, devant l'œuvre.

Tout est stocké **sur votre appareil** (base locale du navigateur). Aucun compte,
aucun serveur, aucune photo envoyée sur internet.

## Ce que vous pouvez faire

- **Prendre une photo** avec l'appareil photo du téléphone ou l'importer depuis vos fichiers
- **Basculer** entre caméra avant et arrière
- **Remplir la fiche** : nom, musée, salle, description
- **Rechercher** dans toute la collection (nom, musée, salle, description)
- **Filtrer par musée** ; les musées et salles déjà saisis sont proposés en autocomplétion
- **Modifier ou supprimer** une fiche
- **Exporter / importer** votre collection dans un fichier `.json` (sauvegarde, ou transfert vers un autre téléphone)
- **Utiliser l'application hors ligne**, une fois la page ouverte une première fois — pratique dans les musées où le réseau passe mal

## Utilisation

### Sur votre téléphone

Ouvrez l'adresse de l'application dans le navigateur, puis ajoutez-la à
l'écran d'accueil :

- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil »
- **Android (Chrome)** : menu ⋮ → « Installer l'application »

Elle se lance ensuite comme une application normale, en plein écran.

> ⚠️ L'accès à l'appareil photo n'est autorisé par les navigateurs que sur une
> adresse **https://** (ou sur `localhost`). Sur une adresse `http://`, le bouton
> « Prendre une photo » bascule automatiquement sur l'appareil photo natif du
> téléphone via le sélecteur de fichiers.

### En local, sur votre ordinateur

Il n'y a rien à installer ni à compiler. Il suffit de servir le dossier :

```bash
npx http-server -p 8080 .
# puis ouvrir http://localhost:8080
```

Ouvrir `index.html` par un double-clic ne fonctionne pas : les modules
JavaScript et la base locale exigent une vraie adresse `http://` ou `https://`.

### Mise en ligne

L'application est entièrement statique : n'importe quel hébergement de fichiers
convient (GitHub Pages, Netlify, Cloudflare Pages…). Pour GitHub Pages :
*Settings → Pages → Source : la branche, dossier `/ (root)`*.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page et des trois boîtes de dialogue (fiche, appareil photo, détail) |
| `css/styles.css` | Mise en forme, thème clair et sombre automatique |
| `js/app.js` | Galerie, formulaire, recherche, sauvegardes — l'enchaînement général |
| `js/db.js` | Stockage IndexedDB : fiches d'un côté, images de l'autre |
| `js/camera.js` | Accès caméra et redimensionnement des images |
| `service-worker.js` | Mise en cache pour le fonctionnement hors ligne |

Aucune dépendance, aucune étape de build : du HTML, du CSS et du JavaScript.

## Bon à savoir

- Les photos sont redimensionnées à 1600 px maximum et enregistrées en JPEG :
  une collection de plusieurs centaines de tableaux reste légère.
- Les données vivent dans le navigateur de votre appareil. Si vous effacez les
  données de navigation ou désinstallez l'application, la collection disparaît —
  d'où le bouton **Exporter** : pensez à faire une sauvegarde de temps en temps.
- En navigation privée, le stockage peut être bloqué par le navigateur.
