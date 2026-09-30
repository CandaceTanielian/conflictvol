const variant = process.env.APP_VARIANT ?? 'production';
const isDevelopment = variant === 'development';
const isPreview = variant === 'preview';
const variantSuffix = isDevelopment ? '.dev' : isPreview ? '.preview' : '';
const appName = isDevelopment
  ? 'ConflictVol POC Dev'
  : isPreview
    ? 'ConflictVol POC Preview'
    : 'ConflictVol';

export default {
  expo: {
    name: appName,
    slug: 'conflictvol-poc',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    scheme: isDevelopment ? 'conflictvol-dev' : 'conflictvol',
    ios: {
      supportsTablet: true,
      bundleIdentifier: `com.ctanielian.conflictvol${variantSuffix}`,
    },
    android: {
      package: `com.ctanielian.conflictvol${variantSuffix}`,
    },
    web: {
      bundler: 'metro',
    },
    experiments: {
      baseUrl: '/conflictvol',
    },
    plugins: [
      [
        'expo-dev-client',
        {
          launchMode: 'most-recent',
          addGeneratedScheme: isDevelopment,
        },
      ],
    ],
    extra: {
      appVariant: variant,
      eas: {
        projectId: 'e0fb9de8-641a-4425-8956-2083c8b88369',
      },
    },
  },
};
