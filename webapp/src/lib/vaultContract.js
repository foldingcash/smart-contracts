// Browser adaptation of TokenVault/buildReleaseTokenContract.js and the UTXO
// handling in TokenVault/releaseToken.js from the CLI tooling.
//
// The CLI compiles the .cash contract source with cashc at runtime. Doing
// that in a browser bundle would drag in the whole CashScript compiler
// toolchain, so instead this imports the already-compiled artifact JSON
// (kept in sync with the contract source via scripts/sync-artifact.mjs) and
// hands it straight to cashscript's Contract class, which is all that's
// needed to interact with an already-deployed contract.

import { Contract, ElectrumNetworkProvider, TransactionBuilder } from 'cashscript';

import releaseArtifact from '../contracts/TokenVault_Release.artifact.json';
import { decodeHexToBigIntLE, encodeBigIntToHexLE } from './bigintCodec.js';
import { DustValue } from './constants.js';

/** @param {'mainnet' | 'chipnet'} network */
/** @param { { manualConnectionManagement: bool } } options */
export function createProvider(network, options) {
    return new ElectrumNetworkProvider(network, options);
}

export function loadReleaseContract({ fundPubKeyHex, halvingLength, addressType, provider }) {
    const contract = new Contract(releaseArtifact, [fundPubKeyHex, BigInt(halvingLength)], {
        addressType,
        provider,
    });
    return contract;
}

/**
 * Decode the vault's NFT state commitment into the three packed fields the
 * contract tracks. Ported from the decode logic inline in releaseToken.js.
 */
export function decodeVaultState(commitmentHex) {
    if (typeof commitmentHex !== 'string' || commitmentHex.length !== 8 * 2 * 3) {
        throw new Error(
            'Unexpected state commitment length; this does not look like a Token Vault release-state UTXO.',
        );
    }
    const previousReleaseHeight = decodeHexToBigIntLE('0x' + commitmentHex.slice(0, 16));
    const previousHalvingHeight = decodeHexToBigIntLE('0x' + commitmentHex.slice(16, 32));
    const previousReward = decodeHexToBigIntLE('0x' + commitmentHex.slice(32));
    return { previousReleaseHeight, previousHalvingHeight, previousReward };
}

/**
 * Pick out the token UTXO, the NFT state UTXO, and the fee-funding UTXO from
 * what's available. This app only supports the simple case the CLI script
 * also assumes: exactly two UTXOs locked in the contract (from the same
 * transaction) and exactly one plain funding UTXO at the wallet address. If
 * your vault or wallet has accumulated more UTXOs than that, consolidate
 * them first (e.g. with the CLI's `yarn send`/wallet tooling) before using
 * this app.
 */
export function selectVaultInputs({ contractUtxos, fundUtxos }) {
    if (contractUtxos.length !== 2) {
        throw new Error(
            `Expected exactly 2 UTXOs locked in the vault contract, found ${contractUtxos.length}. This app only supports the simple two-UTXO vault layout (one fungible token UTXO plus its NFT state UTXO).`,
        );
    }
    if (contractUtxos[0].txid !== contractUtxos[1].txid) {
        throw new Error(
            'The two vault UTXOs are expected to come from the same transaction (one holding the tokens, one holding the release state).',
        );
    }
    if (fundUtxos.length !== 1) {
        throw new Error(
            `Expected exactly 1 funding UTXO at your wallet address, found ${fundUtxos.length}. This app only supports a single funding UTXO.`,
        );
    }

    const fundInput = fundUtxos[0];
    if (fundInput.token) {
        throw new Error(
            'The funding UTXO has a token attached to it. Send a plain BCH UTXO (no tokens) to your wallet address to pay the transaction fee.',
        );
    }
    if (fundInput.vout !== 0) {
        throw new Error('The funding UTXO must have output index (vout) 0.');
    }

    const [a, b] = contractUtxos;
    const stateInput = a.token?.nft ? a : b.token?.nft ? b : null;
    const tokenInput = stateInput === a ? b : stateInput === b ? a : null;

    if (!stateInput || !tokenInput) {
        throw new Error(
            'Could not tell which vault UTXO holds the release-state NFT; expected exactly one of the two to carry an NFT commitment.',
        );
    }
    if (!tokenInput.token || tokenInput.token.nft) {
        throw new Error('The vault token UTXO did not look like a plain fungible-token UTXO.');
    }

    return { tokenInput, stateInput, fundInput };
}

/**
 * Returns a function that builds the release transaction for a given fee, so
 * callers can build once to measure the size, then rebuild with the correct
 * fee -- exactly the two-pass approach releaseToken.js uses.
 */
export function makeReleaseTransactionBuilder({
    provider,
    releaseContract,
    signatureTemplate,
    fundAddress,
    tokenInput,
    stateInput,
    fundInput,
    blockHeight,
    tokenCategory,
    releaseTokenAmount,
    changeTokenAmount,
    endOfLife,
    nextReleaseHeight,
    nextHalvingHeight,
    nextReward,
}) {
    return function buildWithFee(fee) {
        let changeValue;
        if (endOfLife) {
            changeValue = fundInput.satoshis + 2n * DustValue - fee;
        } else {
            changeValue = fundInput.satoshis - 2n * DustValue - fee;
        }
        if (changeValue < DustValue) {
            throw new Error(
                'The funding UTXO does not have enough value to cover the transaction fee and dust outputs. Fund your wallet address with a larger UTXO.',
            );
        }

        // Both vault UTXOs are unlocked by the contract's release function;
        // the fee UTXO is a plain P2PKH spend from the fund wallet.
        const contractUnlocker = releaseContract.unlock.release(signatureTemplate, blockHeight);

        const transaction = new TransactionBuilder({ provider })
            .addInput(tokenInput, contractUnlocker)
            .addInput(stateInput, contractUnlocker)
            .addInput(fundInput, signatureTemplate.unlockP2PKH())
            // The contract requires tx.time (nLockTime) >= blockHeight. The
            // legacy contract.functions API defaulted the locktime to the
            // current block height; TransactionBuilder defaults it to 0.
            .setLocktime(Number(blockHeight))
            .addOutput({
                to: fundAddress,
                amount: changeValue,
                token: {
                    amount: releaseTokenAmount,
                    category: tokenCategory,
                },
            });

        if (!endOfLife) {
            transaction
                .addOutput({
                    to: releaseContract.tokenAddress,
                    amount: DustValue,
                    token: {
                        amount: changeTokenAmount,
                        category: tokenCategory,
                    },
                })
                .addOutput({
                    to: releaseContract.tokenAddress,
                    amount: DustValue,
                    token: {
                        amount: 0n,
                        category: fundInput.txid,
                        nft: {
                            capability: 'none',
                            commitment: `${encodeBigIntToHexLE(nextReleaseHeight)}${encodeBigIntToHexLE(nextHalvingHeight)}${encodeBigIntToHexLE(nextReward)}`,
                        },
                    },
                });
        }

        return transaction;
    };
}
