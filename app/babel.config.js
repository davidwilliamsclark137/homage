// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // ❌ remove "react-native-worklets/plugin"
      "react-native-reanimated/plugin", // keep this, and it must be last
    ],
  };
};

