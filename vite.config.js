import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'src/dashboard.html'),
      },
      output: {
        entryFileNames: 'dashboard/[name].js',
        chunkFileNames: 'dashboard/chunks/[name]-[hash].js',
        assetFileNames: 'dashboard/assets/[name]-[hash][extname]',
      },
    },
  },
})
