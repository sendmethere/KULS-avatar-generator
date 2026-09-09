import { access } from 'node:fs/promises';
try {
  await access(new URL('../dist/index.html', import.meta.url));
} catch {
  console.error('Build not found. Run npm run setup first.');
  process.exit(1);
}
process.env.NODE_ENV = 'production';
await import('../server.mjs');
