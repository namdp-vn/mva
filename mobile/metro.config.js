const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  watcher: {
    watchman: false,
  },
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'onnx', 'txt'],
  },
});
