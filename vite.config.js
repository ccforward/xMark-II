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
        options: resolve(__dirname, 'src/options.html'),
      },
      output: {
        entryFileNames: 'options/[name].js',
        chunkFileNames: 'options/chunks/[name]-[hash].js',
        assetFileNames: 'options/assets/[name]-[hash][extname]',
      },
    },
  },
})
