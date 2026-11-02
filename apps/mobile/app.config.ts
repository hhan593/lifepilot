import appJson from "./app.json";

/**
 * app.json 的 TS 包装：支持用 EXPO_PUBLIC_BASE_URL 注入 GitHub Pages 子路径。
 * 本地/自托管根路径部署时不设该变量即可（默认空 = 根路径）。
 */
export default {
  ...appJson.expo,
  experiments: {
    ...appJson.expo.experiments,
    baseUrl: process.env.EXPO_PUBLIC_BASE_URL ?? "",
  },
};
