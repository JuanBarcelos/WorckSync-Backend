// tsup.config.ts
import { defineConfig } from 'tsup';
import packageJson from './package.json';

export default defineConfig({
  entry: ['src/index.ts'], // ou o seu ponto de entrada
  splitting: false,
  sourcemap: true,
  clean: true,
  // Lista todas as dependências de produção como externas
  external: Object.keys(packageJson.dependencies || {}),
});