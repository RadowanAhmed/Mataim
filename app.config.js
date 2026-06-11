// app.config.js
const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "";

export default {
  expo: {
    // All values that were previously in app.json go here:
    name: "Mataim",
    slug: "MataimApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icons/ic_launcher.png",
    scheme: "mataim",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ["audio", "remote-notification"],
        NSUserNotificationAlertStyle: "banner",
        NSUserNotificationActivationMode: "alert",
        ITSAppUsesNonExemptEncryption: false,
      },
      bundleIdentifier: "com.radowanahmed.MataimApp",
      associatedDomains: ["applinks:yourapp.com"],
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/icons/ic_launcher_foreground.png",
        backgroundImage: "./assets/icons/ic_launcher_background.png",
        monochromeImage: "./assets/icons/ic_launcher_monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.WAKE_LOCK",
      ],
      package: "com.radowanahmed.MataimApp",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey, // Dynamically set the key
        },
      },
      allowBackup: true,
      softwareKeyboardLayoutMode: "resize",
    },
    web: {
      output: "static",
      favicon: "./assets/icons/favicon.png",
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      "expo-font",
      "./plugins/withStripeAndroid.js",
      [
        "expo-notifications",
        {
          icon: "./assets/icons/notification-icon.png",
          color: "#FF6B35",
          sounds: [
            "./assets/sounds/notification.wav",
            "./assets/sounds/orderready.wav",
            "./assets/sounds/neworder.wav",
            "./assets/sounds/delivery.wav",
          ],
          defaultChannel: "orders",
          mode: "production",
          androidNotification: {
            defaultSound: true,
            defaultVibratePattern: [0, 250, 250, 250],
            lightColor: "#FF6B35",
          },
          iosNotification: {
            defaultSound: true,
            enableCriticalAlerts: false,
          },
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "This app needs access to your location to show nearby restaurants.",
        },
      ],
      "expo-web-browser",
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraMavenRepos: [
              "../../node_modules/@notifee/react-native/android/libs",
            ],
            enableMinifyInReleaseBuilds: false,
            proguardRules: "-dontwarn com.stripe.android.pushProvisioning.**",
          },
          ios: {
            useFrameworks: "static",
          },
        },
      ],
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.radowanahmed.MataimApp",
          enableGooglePay: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
      tsconfigPaths: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: "d13607af-e10e-4d66-acac-2fbe9088b3ac",
      },
    },
    owner: "radowan-ahmed",
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/d13607af-e10e-4d66-acac-2fbe9088b3ac",
      fallbackToCacheTimeout: 0,
      checkAutomatically: "ON_LOAD",
    },
  },
};
