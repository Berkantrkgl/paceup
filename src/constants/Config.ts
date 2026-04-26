// constants/Config.ts

import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

const PROD_API_BASE = typeof extra.apiBaseUrl === "string" ? extra.apiBaseUrl : null;
const PROD_FASTAPI_BASE =
  typeof extra.fastApiBaseUrl === "string" ? extra.fastApiBaseUrl : null;

// Dev: bilgisayarın local IP'sini Metro bundler'dan oku
const getLocalIP = () => {
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  return debuggerHost?.split(":")[0] ?? "192.168.1.7";
};

const DEV_HOST = getLocalIP();

const BASE_URL = PROD_API_BASE ?? `http://${DEV_HOST}:8000`;
export const FASTAPI_URL = PROD_FASTAPI_BASE ?? `http://${DEV_HOST}:8001`;

export const API_URL = `${BASE_URL}/api`;
