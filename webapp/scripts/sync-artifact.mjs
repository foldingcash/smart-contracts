// Keeps src/contracts/TokenVault_Release.artifact.json in sync with the
// compiled contract artifact in ../TokenVault. Run this (from webapp/) any
// time the .cash contract source changes and you've regenerated artifacts
// with `yarn generate` at the repo root.
//
// Usage: node scripts/sync-artifact.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '..', '..', 'TokenVault', 'TokenVault_Release.artifact.cash');
const destination = path.resolve(here, '..', 'src', 'contracts', 'TokenVault_Release.artifact.json');

const raw = readFileSync(source, 'utf-8');

// Sanity check: make sure it actually parses as the artifact JSON before we
// overwrite the copy the app ships with.
const parsed = JSON.parse(raw);
if (parsed.contractName !== 'TokenVault_Release') {
    throw new Error(`Unexpected contract artifact: ${parsed.contractName}`);
}

writeFileSync(destination, raw);
console.log(`Synced ${destination} from ${source}`);
