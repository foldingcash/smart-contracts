import { useCallback, useMemo, useState } from 'react';

import { DEFAULT_CONFIG } from '../config.js';
import { deriveWalletFromWif } from '../lib/wallet.js';
import {
    createProvider,
    loadReleaseContract,
    decodeVaultState,
    selectVaultInputs,
    makeReleaseTransactionBuilder,
} from '../lib/vaultContract.js';
import { calculateRelease, halvingEligibleHeight } from '../lib/releaseCalculator.js';
import { DustValue } from '../lib/constants.js';
import { calculateTransactionFee } from '../lib/fee.js';

function messageOf(error) {
    return error && error.message ? error.message : String(error);
}

/**
 * All state and actions for the release console, kept in one hook so the
 * components under src/components stay presentational. Nothing here ever
 * writes the WIF or derived private-key material anywhere but React state:
 * no localStorage, no sessionStorage, no network calls carry it except the
 * signature itself inside a transaction the user chose to broadcast.
 */
export function useVaultRelease() {
    const [network, setNetworkState] = useState(DEFAULT_CONFIG.network);
    const [addressType, setAddressType] = useState(DEFAULT_CONFIG.addressType);
    const [halvingLengthInput, setHalvingLengthInput] = useState(DEFAULT_CONFIG.halvingLength);

    const [wif, setWif] = useState('');
    const [wallet, setWallet] = useState(null);
    const [walletError, setWalletError] = useState(null);

    const [vault, setVault] = useState(null);
    const [vaultLoading, setVaultLoading] = useState(false);
    const [vaultError, setVaultError] = useState(null);

    const [targetHeight, setTargetHeightState] = useState(null);

    const [txResult, setTxResult] = useState(null);
    const [txLoading, setTxLoading] = useState(false);
    const [txError, setTxError] = useState(null);

    const [sendResult, setSendResult] = useState(null);
    const [sendLoading, setSendLoading] = useState(false);
    const [sendError, setSendError] = useState(null);

    const resetDownstream = useCallback(() => {
        vault?.provider?.disconnect && vault.provider.disconnect();
        setVault(null);
        setVaultError(null);
        setTargetHeightState(null);
        setTxResult(null);
        setTxError(null);
        setSendResult(null);
        setSendError(null);
    }, [vault?.provider]);

    const setNetwork = useCallback(
        (value) => {
            setNetworkState(value);
            setWallet(null);
            setWalletError(null);
            resetDownstream();
        },
        [resetDownstream],
    );

    const unlockWallet = useCallback(() => {
        setWalletError(null);
        try {
            const derived = deriveWalletFromWif(wif, network);
            setWallet(derived);
        } catch (error) {
            setWallet(null);
            setWalletError(messageOf(error));
        }
    }, [wif, network]);

    const clearWallet = useCallback(() => {
        setWif('');
        setWallet(null);
        setWalletError(null);
        resetDownstream();
    }, [resetDownstream]);

    const loadVault = useCallback(async () => {
        if (!wallet) {
            setVaultError('Unlock your wallet first.');
            return;
        }
        setVaultLoading(true);
        setVaultError(null);
        setTxResult(null);
        setTxError(null);
        setSendResult(null);
        setSendError(null);
        try {
            const halvingLength = BigInt(halvingLengthInput);
            const provider = createProvider(network, { manualConnectionManagement: true });
            const releaseContract = loadReleaseContract({
                fundPubKeyHex: wallet.pubKeyHex,
                halvingLength,
                addressType,
                provider,
            });

            await provider.connect();
            const [currentHeight, contractUtxos, fundUtxos] = await Promise.all([
                provider.getBlockHeight(),
                releaseContract.getUtxos(),
                provider.getUtxos(wallet.address),
            ]);

            const { tokenInput, stateInput, fundInput } = selectVaultInputs({ contractUtxos, fundUtxos });
            const { previousReleaseHeight, previousHalvingHeight, previousReward } = decodeVaultState(
                stateInput.token.nft.commitment,
            );

            const currentHeightBig = BigInt(currentHeight);

            setVault({
                provider,
                releaseContract,
                halvingLength,
                contractAddress: releaseContract.address,
                tokenCategory: tokenInput.token.category,
                lockedTokenAmount: tokenInput.token.amount,
                tokenInput,
                stateInput,
                fundInput,
                fundAddress: wallet.address,
                currentHeight: currentHeightBig,
                previousReleaseHeight,
                previousHalvingHeight,
                previousReward,
            });

            const clampedDefault =
                currentHeightBig < previousReleaseHeight ? previousReleaseHeight : currentHeightBig;
            setTargetHeightState(clampedDefault);
        } catch (error) {
            setVault(null);
            setVaultError(messageOf(error));
        } finally {
            setVaultLoading(false);
        }
    }, [wallet, network, addressType, halvingLengthInput]);

    const refreshHeight = useCallback(async () => {
        if (!vault) return;
        try {
            const currentHeight = await vault.provider.getBlockHeight();
            setVault((prev) => (prev ? { ...prev, currentHeight: BigInt(currentHeight) } : prev));
        } catch (error) {
            setVaultError(messageOf(error));
        }
    }, [vault]);

    const setTargetHeight = useCallback(
        (value) => {
            if (!vault) return;
            let big;
            try {
                big = typeof value === 'bigint' ? value : BigInt(Math.trunc(Number(value)));
            } catch {
                return;
            }
            if (Number.isNaN(Number(big))) return;
            if (big < vault.previousReleaseHeight) big = vault.previousReleaseHeight;
            if (big > vault.currentHeight) big = vault.currentHeight;
            setTargetHeightState(big);
            setTxResult(null);
            setTxError(null);
            setSendResult(null);
            setSendError(null);
        },
        [vault],
    );

    const preview = useMemo(() => {
        if (!vault || targetHeight === null) return null;
        try {
            return calculateRelease({
                blockHeight: targetHeight,
                previousReleaseHeight: vault.previousReleaseHeight,
                previousHalvingHeight: vault.previousHalvingHeight,
                previousReward: vault.previousReward,
                halvingLength: vault.halvingLength,
                lockedTokenAmount: vault.lockedTokenAmount,
            });
        } catch (error) {
            return { error: messageOf(error) };
        }
    }, [vault, targetHeight]);

    const nextHalvingEligibleHeight = useMemo(() => {
        if (!vault) return null;
        return halvingEligibleHeight(vault.previousHalvingHeight, vault.halvingLength);
    }, [vault]);

    const buildTransaction = useCallback(async () => {
        if (!vault || !wallet || !preview || preview.error || targetHeight === null) return;
        setTxLoading(true);
        setTxError(null);
        setSendResult(null);
        setSendError(null);
        try {
            const build = makeReleaseTransactionBuilder({
                provider: vault.provider,
                releaseContract: vault.releaseContract,
                signatureTemplate: wallet.signatureTemplate,
                fundAddress: vault.fundAddress,
                tokenInput: vault.tokenInput,
                stateInput: vault.stateInput,
                fundInput: vault.fundInput,
                blockHeight: targetHeight,
                tokenCategory: vault.tokenCategory,
                releaseTokenAmount: preview.releaseTokenAmount,
                changeTokenAmount: preview.changeTokenAmount,
                endOfLife: preview.endOfLife,
                nextReleaseHeight: preview.nextReleaseHeight,
                nextHalvingHeight: preview.nextHalvingHeight,
                nextReward: preview.nextReward,
            });

            // getTransactionSize skips the fee checks, so the placeholder fee
            // doesn't matter; value fields are fixed-width so the size holds.
            const bytes = build(DustValue * 2n).getTransactionSize();
            const fee = calculateTransactionFee(bytes);
            const transaction = build(fee);
            const hex = transaction.build();

            setTxResult({ transaction, hex, fee });
        } catch (error) {
            setTxResult(null);
            setTxError(messageOf(error));
        } finally {
            setTxLoading(false);
        }
    }, [vault, wallet, preview, targetHeight]);

    const sendTransaction = useCallback(async () => {
        if (!txResult) return;
        setSendLoading(true);
        setSendError(null);
        try {
            // Broadcast the raw hex rather than calling transaction.send():
            // send() first runs cashscript's local debug evaluation, which
            // falsely fails with NULLFAIL for this pre-0.11 cashc artifact even
            // though the transaction is valid. The node still fully validates
            // the transaction on broadcast.
            const txid = await vault.provider.sendRawTransaction(txResult.hex);
            setSendResult({ txid });
        } catch (error) {
            setSendError(messageOf(error));
        } finally {
            setSendLoading(false);
        }
    }, [txResult, vault]);

    return {
        network,
        setNetwork,
        addressType,
        setAddressType,
        halvingLengthInput,
        setHalvingLengthInput,

        wif,
        setWif,
        wallet,
        walletError,
        unlockWallet,
        clearWallet,

        vault,
        vaultLoading,
        vaultError,
        loadVault,
        refreshHeight,

        targetHeight,
        setTargetHeight,
        preview,
        nextHalvingEligibleHeight,

        txResult,
        txLoading,
        txError,
        buildTransaction,

        sendResult,
        sendLoading,
        sendError,
        sendTransaction,
    };
}
