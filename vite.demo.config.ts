import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/vue-chm-reader/' : '/',
  plugins: [vue()],
  build: {
    sourcemap: true,
  },
})
