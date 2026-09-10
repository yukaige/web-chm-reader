import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts({ tsconfigPath: './tsconfig.build.json', insertTypesEntry: false })],
  build: {
    lib: {
      entry: {
        element: 'src/element.ts',
        index: 'src/index.ts',
        react: 'src/react.ts',
        vue: 'src/vue.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'vue', 'chmlib-ts', 'dompurify'],
      output: {
        assetFileNames: (asset) => asset.names?.some((name) => name.endsWith('.css')) ? 'style.css' : 'assets/[name][extname]',
      },
    },
    sourcemap: true,
  },
})
