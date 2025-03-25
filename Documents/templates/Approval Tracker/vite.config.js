import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

export default defineConfig({
  base: '/polldetector/',
  plugins: [svelte()],
  build: {
    outDir: 'polldetector',  
    emptyOutDir: true        
  },
  resolve: {
    alias: {
      "$components": path.resolve('./src/components'),
      "$data": path.resolve('./src/data'),
      "$routes": path.resolve('./src/routes'),
    }
  }
})
