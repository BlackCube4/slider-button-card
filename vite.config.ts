import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/slider-button-card.ts',
      name: 'SliderButtonCard',
      formats: ['es'],
      fileName: () => 'slider-button-card.js',
    },
    outDir: 'dist',
  },
});