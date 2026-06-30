const IS_PRODUCTION = process.env.EAS_BUILD_PROFILE === "production";

// USE_PROD_API: lokal dev build ile prod backend'e bağlanmak için.
// Sadece API URL'lerini override eder; aps-environment, entitlements vs. dev kalır.
// Kullanım: USE_PROD_API=1 npx expo start
// Sebep: RC webhook ECS'te olduğu için lokal sandbox testleri prod backend'e
// gitmeli, aksi halde lokal SQLite ve ECS RDS tutarsız olur.
const USE_PROD_API = IS_PRODUCTION || process.env.USE_PROD_API === "1";

const PROD_API_URL =
  process.env.EXPO_PUBLIC_PROD_API_URL || "https://api.your-domain.com";
const PROD_FASTAPI_URL =
  process.env.EXPO_PUBLIC_PROD_FASTAPI_URL || "https://chatbot.your-domain.com";

module.exports = {
  expo: {
    // App Store Connect'teki "Name" ile birebir eşleşmeli (Guideline 2.3.8) —
    // marketplace adı da "PaceUp".
    name: "PaceUp",
    slug: "PaceUp",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./src/assets/images/icon.png",
    scheme: "paceup",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    updates: {
      url:
        process.env.EXPO_PUBLIC_UPDATES_URL ||
        "https://u.expo.dev/your-eas-project-id",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    ios: {
      supportsTablet: false,
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: IS_PRODUCTION
        ? {}
        : {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: true,
            },
          },
      bundleIdentifier:
        process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || "com.example.PaceUp",
      usesAppleSignIn: true,
      entitlements: {
        "aps-environment": IS_PRODUCTION ? "production" : "development",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#0D0D0D",
        foregroundImage: "./src/assets/images/android-icon-foreground.png",
        backgroundImage: "./src/assets/images/android-icon-background.png",
        monochromeImage: "./src/assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./src/assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-localization",
      "expo-apple-authentication",
      [
        "expo-splash-screen",
        {
          image: "./src/assets/images/splash-icon.png",
          imageWidth: 280,
          resizeMode: "contain",
          backgroundColor: "#0D0D0D",
          dark: {
            backgroundColor: "#0D0D0D",
          },
        },
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme:
            process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
            "com.googleusercontent.apps.your-google-ios-client-id",
        },
      ],
      [
        "expo-notifications",
        {
          color: "#FF4501",
          defaultChannel: "default",
          sounds: [],
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId:
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "your-eas-project-id",
      },
      apiBaseUrl: USE_PROD_API ? PROD_API_URL : null,
      fastApiBaseUrl: USE_PROD_API ? PROD_FASTAPI_URL : null,
      // RevenueCat iOS public SDK key — frontend'de bundle edilecek şekilde tasarlandı, secret değil
      revenueCatIosKey:
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "your-revenuecat-ios-key",
    },
    owner: process.env.EXPO_PUBLIC_EXPO_OWNER || "your-expo-owner",
  },
};
