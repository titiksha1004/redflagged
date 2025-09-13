import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:3000/api",
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
          filter: (path: string) => {
            // Don't proxy auth-related requests, let those go directly to Supabase
            return !path.startsWith('/auth/');
          },
        },
      },
      fs: {
        // Explicitly restrict access outside of the project root
        strict: false,
        // Add specific patterns to deny to prevent path traversal attacks
        deny: [
          // Deny all dot files and directories
          '**/.env*', 
          '**/node_modules/.vite/**', 
          '**/dist/**',
          '**/.git/**',
          '**/.DS_Store'
        ],
        // Allow import/raw of files from safe directories
        allow: [
          './**', // Allow all files in the project
          path.resolve(__dirname, "./src/**"),
          path.resolve(__dirname, "./public/**"),
          path.resolve(__dirname, "./node_modules/**")
        ]
      },
    },
    define: {
      // Remove hardcoded credentials - use environment variables instead
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    envPrefix: ["VITE_"],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            pdfjs: ["pdfjs-dist"],
            worker: ["src/workers/pdf.worker.js"],
          },
        },
      },
      // Add security headers for production build
      reportCompressedSize: false,
    },
    worker: {
      format: "es",
    },
  };
});
