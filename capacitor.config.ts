import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the web app (dist/) as a native Android app.
const config: CapacitorConfig = {
  appId: 'com.talib.magicviolin',
  appName: 'Magic Violin',
  webDir: 'dist',
  backgroundColor: '#2b1055',
};

export default config;
