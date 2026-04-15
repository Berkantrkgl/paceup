const IS_PRODUCTION = process.env.EAS_BUILD_PROFILE === "production";

const PROD_API_URL = "https://api.your-domain.com";
const PROD_FASTAPI_URL = "https://chatbot.your-domain.com";

module.exports = {
  expo: {
    name: "PaceUp",
    slug: "PaceUp",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./src/assets/images/icon.png",
    scheme: "paceup",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
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
      bundleIdentifier: "com.example.PaceUp",
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
        projectId: "your-eas-project-id",
      },
      apiBaseUrl: IS_PRODUCTION ? PROD_API_URL : null,
      fastApiBaseUrl: IS_PRODUCTION ? PROD_FASTAPI_URL : null,
    },
    owner: "your-expo-owner",
  },
};
