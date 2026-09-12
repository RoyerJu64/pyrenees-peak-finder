// Configuration Metro pour un monorepo : sans elle, l'application ne trouve pas
// @ppf/peak-geometry, qui vit hors de son propre repertoire.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Surveiller la racine du monorepo : une modification dans peak-geometry doit
// declencher un rechargement a chaud.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// `.sqlite` n'est pas un type d'asset connu de Metro : sans cette ligne, le
// `require('../assets/peaks.sqlite')` du layout racine echoue a la resolution.
config.resolver.assetExts.push('sqlite');

module.exports = config;
