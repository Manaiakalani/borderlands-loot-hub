import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Base path for GitHub Pages deployment
  // Repository name: borderlands-loot-hub
  base: "/borderlands-loot-hub/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('@radix-ui/react-tooltip') || id.includes('@radix-ui/react-toast')) {
            return 'ui-vendor';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
        },
      },
    },
    // Enable source maps for production debugging (optional)
    sourcemap: false,
    // Minification options
    minify: 'oxc',
    // Target modern browsers for smaller bundle
    target: 'esnext',
    // Skip CSS code splitting - inline for faster first paint
    cssCodeSplit: true,
  },
}));
