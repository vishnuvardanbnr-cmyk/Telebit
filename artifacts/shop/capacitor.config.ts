import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.televerse.shop",
  appName: "Televerse Shop",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    url: "https://televerse-1.replit.app",
    cleartext: false,
  },
};

export default config;
