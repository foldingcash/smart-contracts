// Ported from ../../util/calculateTransactionFee.js in the CLI tooling.

import { SatoshisPerByteTransactionFee } from './constants.js';

// TODO: Allow configurable fee rate and fixed amount
export function calculateTransactionFee(bytes) {
    return SatoshisPerByteTransactionFee * bytes + 1n;
}
