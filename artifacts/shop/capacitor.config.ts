import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.telebit.shop",
  appName: "Telebit Shop",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    url: "https://telebittest.replit.app",
    cleartext: false,
  },
};

export default config;
