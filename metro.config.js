// Custom Metro config to support the iOS share extension bundle
const { getDefaultConfig } = require("expo/metro-config");
const { withShareExtension } = require("expo-share-extension/metro");

const config = getDefaultConfig(__dirname);

module.exports = withShareExtension(config, {
  isCSSEnabled: true,
});

