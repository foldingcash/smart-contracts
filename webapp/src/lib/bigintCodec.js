// Ported from ../../util/decodeHexToBigIntLE.js and encodeBigIntToHexLE.js in
// the CLI tooling. These encode/decode the eight-byte little-endian integers
// used in the vault's NFT state commitment, exactly as the contract expects.

import { MaxBigInt, MaxBigIntString } from './constants.js';

export function decodeHexToBigIntLE(value) {
    if (typeof value !== 'string' || !value.startsWith('0x')) {
        throw new Error('Input value must be of type string w/ a preceeding 0x.');
    }
    const hexLe = value.slice(2);
    if (hexLe.length !== 8 * 2) {
        throw new Error('Expected an eight byte hex but one was not provided, ensure to provide an eight byte value or enhance this function.');
    }
    const hexBe = [];
    for (let i = 0; i < hexLe.length; i += 2) {
        hexBe.push(hexLe.slice(i, i + 2));
    }
    const bigValue = BigInt('0x' + hexBe.reverse().join(''));
    if ((bigValue & BigInt('0x8000000000000000')) !== 0n) {
        throw new Error('This function will not properly convert negative numbers, enhance this function or ensure only positive values are provided.');
    }
    return bigValue;
}

export function encodeBigIntToHexLE(value) {
    if (typeof value !== 'bigint' && typeof value !== 'number') {
        throw new Error('Input value must be of type bigint or number.');
    }
    if (value < 0) {
        throw new Error('Input value must be positive.');
    }
    const bigValue = BigInt(value);
    if (bigValue > BigInt(MaxBigInt)) {
        throw new Error(`Input value must not be larger than ${MaxBigIntString}.`);
    }
    const hexBe = bigValue.toString(16).padStart(16, '0');
    const hexLe = [];
    for (let i = 0; i < hexBe.length; i += 2) {
        hexLe.push(hexBe.slice(i, i + 2));
    }
    return hexLe.reverse().join('');
}
