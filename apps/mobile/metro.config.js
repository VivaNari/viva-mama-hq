const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration (monorepo-aware)
 * https://reactnative.dev/docs/metro
 *
 * Watches the workspace root so changes in `packages/*` (e.g. @vivamama/contracts)
 * are picked up, and resolves modules from both the app and the hoisted root
 * `node_modules` (we use pnpm with `node-linker=hoisted`).
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
