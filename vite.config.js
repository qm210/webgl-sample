import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import glsl from 'vite-plugin-glsl';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      preact({
          babel: {
              plugins: ["@emotion/babel-plugin"]
          }
      }),
      glsl({
          compress: false
      }),
  ],
})
