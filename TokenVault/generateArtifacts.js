import { compileFile } from 'cashc';
import { writeFile } from 'fs';

import logger from '../util/logger.js';

const throwError = error => {
  if (error) {
    throw error;
  }
}

try {
  const mintingArtifact = compileFile(new URL('TokenVault_Mint.cash', import.meta.url));
  const releaseArtifact = compileFile(new URL('TokenVault_Release.cash', import.meta.url));
  writeFile('TokenVault/TokenVault_Mint.artifact.cash', JSON.stringify(mintingArtifact), throwError);
  writeFile('TokenVault/TokenVault_Release.artifact.cash', JSON.stringify(releaseArtifact), throwError);
  logger.info('Artifacts created and saved to file.');
} catch (e) {
  logger.error('error: ' + e.toString());
}