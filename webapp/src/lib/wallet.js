// Browser adaptation of ../../util/getWallet.js from the CLI tooling.
//
// The CLI reads a WIF private key out of a wallet.json file on disk. In the
// browser there is no disk to read from (and no server to send the key to)
// so instead the WIF comes straight from the person using the app and never
// leaves this module except to build/sign a transaction locally.
//
// IMPORTANT: nothing in this file (or anywhere else in the app) should ever
// persist the WIF/private key to localStorage, sessionStorage, IndexedDB, a
// cookie, or a network request. It should only ever live in React state,
// in memory, for the lifetime of the tab.

import {
    decodePrivateKeyWif,
    secp256k1,
    ripemd160,
    sha256,
    encodeCashAddress,
    binToHex,
} from '@bitauth/libauth';
import { SignatureTemplate } from 'cashscript';

export class InvalidWifError extends Error {}

/**
 * Derive signing material and a CashAddress (with token support) from a WIF
 * private key, for a given network.
 *
 * @param {string} wif
 * @param {'mainnet' | 'chipnet'} network
 */
export function deriveWalletFromWif(wif, network) {
    const trimmed = (wif ?? '').trim();
    if (!trimmed) {
        throw new InvalidWifError('Enter a WIF private key.');
    }

    const decoded = decodePrivateKeyWif(trimmed);
    if (typeof decoded === 'string') {
        throw new InvalidWifError(`That doesn't look like a valid WIF private key (${decoded}).`);
    }

    const { privateKey, type: wifNetworkType } = decoded;

    // SignatureTemplate accepts the WIF string directly and decodes it again
    // internally, exactly like the CLI's getWallet.js does.
    const signatureTemplate = new SignatureTemplate(trimmed);

    const pubKeyBin = secp256k1.derivePublicKeyCompressed(privateKey);
    const pubKeyHex = binToHex(pubKeyBin);
    const pubKeyHash = ripemd160.hash(sha256.hash(pubKeyBin));

    const prefix = network === 'mainnet' ? 'bitcoincash' : 'bchtest';
    const encoded = encodeCashAddress({ prefix, type: 'p2pkhWithTokens', payload: pubKeyHash });
    const address = typeof encoded === 'string' ? encoded : encoded.address;

    // decodePrivateKeyWif only distinguishes 'mainnet' vs 'testnet'; chipnet
    // WIFs are encoded the same way as testnet WIFs.
    const expectedWifType = network === 'mainnet' ? 'mainnet' : 'testnet';
    const networkMismatch = wifNetworkType !== expectedWifType;

    return { signatureTemplate, pubKeyHex, address, wifNetworkType, networkMismatch };
}
