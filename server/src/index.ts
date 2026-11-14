/**
 * Server entry point. `npm run dev` (with Vite proxying /api) or `npm start` after
 * `npm run build` (serves the built app + API on one port, handy for the demo laptop).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.PORT) || 8787;
const dataFile = process.env.DATA_FILE || path.join(root, 'server/data/scans.json');

const app = createApp({ dataFile, staticDir: path.join(root, 'client/dist') });
app.listen(port, () => console.log(`BinSight server on http://localhost:${port}`));
