module.exports = () => ({
  name: 'Homage', slug: 'homage', owner: 'davidwilliamsclark', scheme: 'homage', version: '1.0.0',
  plugins: ['expo-router', 'expo-font', ['expo-location', { locationWhenInUsePermission: 'Homage uses your location to reveal and activate nearby walking portals.' }]],
  runtimeVersion: { policy: 'sdkVersion' },
  updates: { url: 'https://u.expo.dev/e8dd5376-de0c-45e6-bc68-ee6ddff3fc4d' },
  extra: { BUILD_LABEL: 'downtown-walk-v1', eas: { projectId: 'e8dd5376-de0c-45e6-bc68-ee6ddff3fc4d' } },
  ios: { bundleIdentifier: 'com.davidwilliamsclark.homage' },
  android: { package: 'com.davidwilliamsclark.homage', permissions: ['android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION'] },
});
