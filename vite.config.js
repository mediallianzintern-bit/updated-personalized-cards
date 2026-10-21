import { defineConfig } from 'vite';
export default defineConfig({ server: { fs: { deny: ['**/.env*', '**/.git/**', '**/data/**', '**/research/**', '**/server/**', '**/tests/**'] } }, build: { outDir: 'dist' } });
