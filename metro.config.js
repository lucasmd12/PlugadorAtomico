const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

module.exports = mergeConfig(getDefaultConfig(__dirname), {
  transformer: {
    babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
  },
});
