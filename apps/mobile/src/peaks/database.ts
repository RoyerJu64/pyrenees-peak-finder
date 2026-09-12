import type { Peak } from '@ppf/shared-types';
import { boundingBoxAround, type BoundingBox } from '@ppf/peak-geometry';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Nom du fichier une fois recopie dans le repertoire SQLite de l'application. */
export const DATABASE_NAME = 'peaks.sqlite';

/** Ligne telle que stockee, avant conversion vers le type partage. */
interface PeakRow {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number;
  readonly prominence: number | null;
  readonly wikidata_id: string | null;
  readonly description: string | null;
  readonly wikipedia_url: string | null;
}

const toPeak = (row: PeakRow): Peak => ({
  id: row.id,
  name: row.name,
  latitude: row.latitude,
  longitude: row.longitude,
  altitude: row.altitude,
  prominence: row.prominence,
  wikidataId: row.wikidata_id,
  description: row.description,
  wikipediaUrl: row.wikipedia_url,
});

const SELECT_COLUMNS =
  'id, name, latitude, longitude, altitude, prominence, wikidata_id, description, wikipedia_url';

/**
 * Charge les sommets du rectangle englobant le rayon demande.
 *
 * Le rectangle vient de `boundingBoxAround` et tombe sur l'index
 * `idx_peaks_lat_lon` : SQLite restreint sur la latitude puis filtre la
 * longitude, sans parcourir la table. Le filtrage exact a la distance se fait
 * ensuite, cote geometrie, sur ce petit ensemble.
 */
export async function loadPeaksAround(
  database: SQLiteDatabase,
  center: { latitude: number; longitude: number },
  radiusMeters: number,
): Promise<Peak[]> {
  const box = boundingBoxAround(center, radiusMeters);
  const rows = await database.getAllAsync<PeakRow>(buildQuery(box), buildParameters(box));
  return rows.map(toPeak);
}

function buildQuery(box: BoundingBox): string {
  // Une boite a cheval sur l'antimeridien se coupe en deux intervalles. Le cas
  // ne se presente pas dans les Pyrenees, mais la requete suit la boite plutot
  // que de supposer ou l'utilisateur se trouve.
  const longitudeClause = box.crossesAntimeridian
    ? '(longitude >= ? OR longitude <= ?)'
    : 'longitude BETWEEN ? AND ?';
  return (
    `SELECT ${SELECT_COLUMNS} FROM peaks ` +
    `WHERE latitude BETWEEN ? AND ? AND ${longitudeClause}`
  );
}

const buildParameters = (box: BoundingBox): number[] => [
  box.minLatitude,
  box.maxLatitude,
  box.minLongitude,
  box.maxLongitude,
];

/** Metadonnees du jeu de donnees embarque, pour l'ecran d'attributions. */
export async function loadDatasetMetadata(
  database: SQLiteDatabase,
): Promise<Record<string, string>> {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM dataset_metadata',
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
