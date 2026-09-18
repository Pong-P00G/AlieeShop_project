import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Conditionally import devtools — only in development mode
let vueDevToolsPlugin = null;
if (process.env.NODE_ENV !== 'production') {
  const { default: vueDevTools } = await import('vite-plugin-vue-devtools');
  vueDevToolsPlugin = vueDevTools();
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevToolsPlugin,
    tailwindcss()
  ].filter(Boolean),
  server: {
    port: Number(process.env.VITE_PORT) || 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-vue-next')) {
              return 'lucide-vue-next';
            }
            if (id.includes('@vue')) {
              return 'vue';
            }
            return 'vendor';
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setupTests.js', // ← add this line
  },
})
