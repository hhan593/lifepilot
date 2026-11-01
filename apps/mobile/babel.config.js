module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // NativeWind 5 / react-native-css：CSS 处理在 Metro 层（见 metro.config.js），无需 babel 插件
  };
};
