import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  plugins: [
    // Allow .js files in src/ to contain JSX (CRA compatibility)
    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        if (!id.match(/\/src\/.*\.js$/)) return null;
        return transformWithEsbuild(code, id, { loader: "jsx" });
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
});
