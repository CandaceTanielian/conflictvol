const variant = process.env.APP_VARIANT ?? 'production';
const isDevelopment = variant === 'development';
const isPreview = variant === 'preview';
const variantSuffix = isDevelopment ? '.dev' : isPreview ? '.preview' : '';
const appName = isDevelopment ? 'ConflictVol Dev' : isPreview ? 'ConflictVol Preview' : 'ConflictVol';

// GitHub Pages serves the site from /conflictvol. Local builds can override with EXPO_BASE_URL="".
const baseUrl = process.env.EXPO_BASE_URL ?? '/conflictvol';

export default {
  expo: {
    name: appName,
    slug: 'conflictvol-poc',
    version: '2.0.0',
    orientation: 'default',
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
      favicon: './public/conflictvol-logo.png',
    },
    experiments: {
      baseUrl,
    },
    plugins: [
      ['expo-dev-client', { launchMode: 'most-recent', addGeneratedScheme: isDevelopment }],
    ],
    extra: {
      appVariant: variant,
      eas: {
        projectId: 'e0fb9de8-641a-4425-8956-2083c8b88369',
      },
    },
  },
};
