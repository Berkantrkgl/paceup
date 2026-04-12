// constants/Config.ts

import Constants from "expo-constants";

// true → fiziksel cihazda test (Expo Go), bilgisayarın local IP'sini kullanır
// false → simülatörde test, 127.0.0.1 kullanır
const USE_PHYSICAL_DEVICE = true;

const getLocalIP = () => {
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  return debuggerHost?.split(":")[0] ?? "192.168.1.7";
};

const HOST = USE_PHYSICAL_DEVICE ? getLocalIP() : "127.0.0.1";

export const FASTAPI_URL = `http://${HOST}:8001`;
const BASE_URL = `http://${HOST}:8000`;

export const API_URL = `${BASE_URL}/api`;
