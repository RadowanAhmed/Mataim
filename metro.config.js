const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ONLY block server.js from bundling - don't mess with watchFolders
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /backend\/server\.js$/,
  /backend\/\.env/,
];

module.exports = config;

