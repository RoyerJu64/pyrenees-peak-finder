import * as SQLite from 'expo-sqlite';

/**
 * Reglages propres a l'appareil, dans une base distincte et inscriptible.
 *
 * `peaks.sqlite` arrive depuis les assets et doit rester tel quel : y ecrire
 * melangerait une donnee de terrain a un jeu de donnees regenerable. Deux
 * fichiers, deux durees de vie.
 */
const DATABASE_NAME = 'settings.db';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let connection: Promise<SQLite.SQLiteDatabase> | null = null;

function open(): Promise<SQLite.SQLiteDatabase> {
  connection ??= (async () => {
    const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await database.execAsync(SCHEMA);
    return database;
  })();
  return connection;
}

export async function readSetting(key: string): Promise<string | null> {
  const database = await open();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  const database = await open();
  await database.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    [key, value, value],
  );
}

export async function readNumericSetting(key: string): Promise<number | null> {
  const raw = await readSetting(key);
  if (raw === null) {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export const SETTING_FOCAL_LENGTH_35MM = 'camera.focalLength35mm';
export const SETTING_HEADING_OFFSET = 'compass.headingOffset';
