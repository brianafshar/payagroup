// Adds Pushe's manifest token (pushe.co console → app → manifest content) to the Android manifest at
// build time: PUSHE_MANIFEST_TOKEN=... eas build / npx expo prebuild. Without it nothing is added.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withPushe(config) {
  const token = process.env.PUSHE_MANIFEST_TOKEN;
  if (!token) return config;
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'pushe_token', token);
    return c;
  });
};
