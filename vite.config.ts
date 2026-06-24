import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    // @solana/web3.js + spl-token expect Node globals (Buffer/process) in the browser.
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
