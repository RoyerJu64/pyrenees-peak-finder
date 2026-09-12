import type { CameraFieldOfView, Viewport } from '@ppf/shared-types';
import { toDegrees, toRadians } from './angles';

/** Diagonale du format 24x36, en millimetres : 43.267. */
const FILM_35MM_DIAGONAL_MM = Math.sqrt(36 * 36 + 24 * 24);

/**
 * Champ de vision deduit d'une focale equivalente 24x36.
 *
 * C'est la voie a privilegier pour connaitre le FOV reel d'un appareil :
 * `expo-camera` ne l'expose pas, mais l'EXIF d'une photo prise par l'appareil
 * porte presque toujours `FocalLengthIn35mmFilm`. Une mesure par appareil, sans
 * table a maintenir.
 *
 * La focale equivalente se rapporte a la diagonale. On reconstitue donc le
 * champ diagonal, puis on le repartit sur les deux axes selon le rapport de
 * forme reellement rendu, par la relation rectilineaire
 * `tan(d/2)^2 = tan(h/2)^2 + tan(v/2)^2`.
 *
 * @param focalLength35mm focale equivalente 24x36, en millimetres
 * @param aspectRatio largeur / hauteur de l'image, **dans l'orientation ou
 *   elle est rendue**. Un capteur 4:3 tenu en portrait vaut 3/4, pas 4/3 :
 *   intervertir les deux comprime le panorama d'un tiers sans rien casser de
 *   visible. `cameraFieldOfView` evite d'avoir a y penser.
 */
export function fieldOfViewFromFocalLength35mm(
  focalLength35mm: number,
  aspectRatio: number,
): CameraFieldOfView {
  if (focalLength35mm <= 0 || aspectRatio <= 0) {
    throw new RangeError('focalLength35mm et aspectRatio doivent etre strictement positifs');
  }

  const halfDiagonal = Math.atan(FILM_35MM_DIAGONAL_MM / (2 * focalLength35mm));
  const halfVertical = Math.atan(
    Math.tan(halfDiagonal) / Math.sqrt(1 + aspectRatio * aspectRatio),
  );
  const halfHorizontal = Math.atan(aspectRatio * Math.tan(halfVertical));

  return {
    horizontal: toDegrees(2 * halfHorizontal),
    vertical: toDegrees(2 * halfVertical),
  };
}

/**
 * Restreint un champ de vision au rapport de forme effectivement affiche.
 *
 * L'apercu camera est presque toujours rogne pour remplir l'ecran : le capteur
 * cadre en 4:3, le telephone affiche en 9:19.5. Projeter avec le champ du
 * capteur etalerait tout le panorama. La dimension conservee est celle qui
 * remplit l'ecran, l'autre est rognee.
 */
export function cropFieldOfView(
  fov: CameraFieldOfView,
  displayedAspectRatio: number,
): CameraFieldOfView {
  const halfHorizontal = Math.tan(toRadians(fov.horizontal / 2));
  const halfVertical = Math.tan(toRadians(fov.vertical / 2));
  const sourceAspectRatio = halfHorizontal / halfVertical;

  if (displayedAspectRatio < sourceAspectRatio) {
    // Affichage plus etroit que la source : la hauteur remplit, la largeur est rognee.
    return {
      horizontal: toDegrees(2 * Math.atan(displayedAspectRatio * halfVertical)),
      vertical: fov.vertical,
    };
  }
  return {
    horizontal: fov.horizontal,
    vertical: toDegrees(2 * Math.atan(halfHorizontal / displayedAspectRatio)),
  };
}

/**
 * Focale equivalente de repli, en millimetres : l'objectif principal de la
 * grande majorite des telephones recents.
 *
 * A n'utiliser que tant que l'EXIF n'a pas repondu. Un FOV faux etale ou
 * comprime tout le panorama sans qu'aucun test ne puisse le detecter : c'est
 * un repli, pas un defaut acceptable.
 */
export const FALLBACK_FOCAL_LENGTH_35MM = 26;

/** Champ de repli en 4:3 paysage. Preferer `cameraFieldOfView`, qui oriente. */
export const FALLBACK_FIELD_OF_VIEW: CameraFieldOfView = fieldOfViewFromFocalLength35mm(
  FALLBACK_FOCAL_LENGTH_35MM,
  4 / 3,
);


/**
 * Champ de vision effectivement rendu a l'ecran, orientation et rognage
 * compris. C'est l'appel que doit faire l'application.
 *
 * Deux erreurs silencieuses sont ainsi evitees : oublier que l'apercu est
 * rogne pour remplir l'ecran, et donner le rapport du capteur dans la mauvaise
 * orientation. Aucune des deux ne casse quoi que ce soit de visible — elles
 * etalent ou compriment seulement tout le panorama.
 *
 * @param focalLength35mm focale equivalente, lue dans l'EXIF d'une photo prise
 *   par l'appareil (`FocalLengthIn35mmFilm`)
 * @param sensorAspectRatio rapport du grand cote au petit cote du capteur,
 *   typiquement 4/3 ou 16/9 — l'orientation est deduite du viewport
 */
export function cameraFieldOfView(
  focalLength35mm: number,
  sensorAspectRatio: number,
  viewport: Viewport,
): CameraFieldOfView {
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError('le viewport doit avoir des dimensions strictement positives');
  }

  const longOverShort = Math.max(sensorAspectRatio, 1 / sensorAspectRatio);
  const displayedAspectRatio = viewport.width / viewport.height;
  const orientedSensorAspectRatio =
    displayedAspectRatio >= 1 ? longOverShort : 1 / longOverShort;

  return cropFieldOfView(
    fieldOfViewFromFocalLength35mm(focalLength35mm, orientedSensorAspectRatio),
    displayedAspectRatio,
  );
}
