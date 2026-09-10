import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts({ tsconfigPath: './tsconfig.build.json', insertTypesEntry: false })],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        vue: 'src/vue.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'chmlib-ts', 'dompurify'],
      output: {
        assetFileNames: (asset) => asset.names?.some((name) => name.endsWith('.css')) ? 'style.css' : 'assets/[name][extname]',
      },
    },
    sourcemap: true,
  },
})
