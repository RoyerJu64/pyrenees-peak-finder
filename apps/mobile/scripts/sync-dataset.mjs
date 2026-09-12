// Recopie la base de sommets depuis data/processed vers les assets de l'app.
//
// Le fichier n'est versionne qu'a un seul endroit, data/processed/peaks.sqlite ;
// sa copie dans assets/ est un artefact de build, regenere avant chaque
// demarrage. Deux copies suivies par git divergeraient tot ou tard.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, '../../data/processed/peaks.sqlite');
const destination = resolve(projectRoot, 'assets/peaks.sqlite');

try {
  statSync(source);
} catch {
  console.error(
    `peaks.sqlite introuvable a ${source}\n` +
      'Lancer data/scripts/build_sqlite.py pour le construire.',
  );
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`peaks.sqlite synchronise (${(statSync(destination).size / 1024).toFixed(0)} Kio)`);
