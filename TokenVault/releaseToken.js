import { ElectrumNetworkProvider } from 'cashscript';

import { promptInt, promptBool } from '../util/prompt.js';
import encodeBigIntToHexLE from '../util/encodeBigIntToHexLE.js';
import { DustValue } from '../util/constants.js';
import calculateTransactionFee from '../util/calculateTransactionFee.js';
import getWallet from '../util/getWallet.js';
import logger from '../util/logger.js';
import decodeHexToBigIntLE from '../util/decodeHexToBigIntLE.js';

import buildReleaseTokenContract from './buildReleaseTokenContract.js';

import config from '../config.json' assert { type: 'json' };

try {
    const network = config.Network;

    const networkProvider = new ElectrumNetworkProvider(network);
    const height = await networkProvider.getBlockHeight();
    logger.info(`network: ${network} height: ${height}`);

    const { signatureTemplate, address: fundAddress } = await getWallet();
    logger.debug('calculated address: ' + fundAddress);

    const { releaseContract, halvingLength } = await buildReleaseTokenContract({ addressType: config.Contract.AddressType, provider: networkProvider });
    logger.debug('halvingLength: ' + halvingLength);

    const contractUtxos = await releaseContract.getUtxos();
    if (contractUtxos.length == 0) {
        throw Error('No UTXOs found for this contract...ensure a valid UTXO exists');
    }

    const fundUtxos = await networkProvider.getUtxos(fundAddress)
    if (fundUtxos.length == 0) {
        throw Error('No UTXOs found at the fund...ensure a valid UTXO exists');
    }

    const selectInputs = () => {
        if (contractUtxos.length == 2 && contractUtxos[0].txid == contractUtxos[1].txid && fundUtxos.length == 1) {
            const fundInput = fundUtxos[0];
            if (fundInput.token) {
                throw Error('The fund input has a token associated w/ the UTXO...gotta do the dev work, right now the contract enforces no token details on the input UTXO.');
            }
            return { tokenInput: contractUtxos[0], stateInput: contractUtxos[1], fundInput }
        }
        throw Error('Unhandled scenario, gotta do the dev work to select from multiple UTXOs');
    };

    const { tokenInput, stateInput, fundInput } = selectInputs();

    const { amount: lockedTokenAmount, category: tokenCategory } = tokenInput.token;
    const { commitment: previousState } = stateInput.token.nft;

    if (previousState.length != ((8 * 2) * 3)) {
        throw Error('Commitment was an expected length...not sure what to do.');
    }

    const previousReleaseHeight = decodeHexToBigIntLE('0x' + previousState.slice(0, 16));
    const previousHalvingHeight = decodeHexToBigIntLE('0x' + previousState.slice(16, 32));
    const previousReward = decodeHexToBigIntLE('0x' + previousState.slice(32));

    const blockHeight = promptInt(`Blockheight to release up to (${height})? `, height.toString());

    if (blockHeight > height) {
        throw Error('Unable to release beyond the current block height.');
    }

    let nextReleaseHeight = blockHeight;
    let nextHalvingHeight = previousHalvingHeight;
    let nextReward = previousReward;

    let minedBlocksSinceLastRelease = blockHeight - previousReleaseHeight + 1n;
    let releaseTokenAmount = minedBlocksSinceLastRelease * previousReward;
    const minedBlocksSinceHalving = blockHeight - previousHalvingHeight + 1n;

    if (minedBlocksSinceHalving >= halvingLength) {
        nextReleaseHeight = previousHalvingHeight + halvingLength;
        nextHalvingHeight = nextReleaseHeight;
        nextReward = previousReward / 2n;
        const minimumReward = 1n;
        if (nextReward < minimumReward) {
            nextReward = minimumReward;
        }

        minedBlocksSinceLastRelease = nextReleaseHeight - previousReleaseHeight;
        releaseTokenAmount = minedBlocksSinceLastRelease * previousReward;
        logger.warn(`A halving event was found! Stopping the release at height ${nextReleaseHeight}. To continue releasing, run this function again.`);
    }

    const changeTokenAmount = lockedTokenAmount - releaseTokenAmount;
    const endOfLife = changeTokenAmount <= 0;
    if (endOfLife) {
        releaseTokenAmount = lockedTokenAmount;
    }

    logger.debug(`previous state data found: ${previousReleaseHeight} ${previousHalvingHeight} ${previousReward}`);
    logger.debug(`next state data calculated: ${nextReleaseHeight} ${nextHalvingHeight} ${nextReward}`);
    logger.debug(`end of life: ${endOfLife} token change: ${changeTokenAmount}`);
    logger.debug(`encoded state data: ${encodeBigIntToHexLE(nextReleaseHeight)}${encodeBigIntToHexLE(nextHalvingHeight)}${encodeBigIntToHexLE(nextReward)}`);
    console.log('tokenInput', tokenInput);
    console.log('stateInput', stateInput);
    console.log('fundInput', fundInput);

    const buildTransaction = fee => {
        let changeValue;
        if (endOfLife) {
            changeValue = fundInput.satoshis + (2n * DustValue) - fee;
        } else {
            changeValue = fundInput.satoshis - (2n * DustValue) - fee;
        }
        if (changeValue < DustValue) {
            throw Error('The UTXO found does not contain enough value, provide a new UTXO with a higher value.')
        }
        let transaction = releaseContract.functions.release(signatureTemplate, blockHeight)
            .withoutChange()
            .withoutTokenChange()
            .from(tokenInput)
            .from(stateInput)
            .fromP2PKH(fundInput, signatureTemplate)
            .to(fundAddress,
                changeValue,
                {
                    amount: releaseTokenAmount,
                    category: tokenCategory,
                });

        if (!endOfLife) {
            transaction = transaction
                .to(releaseContract.tokenAddress,
                    DustValue,
                    {
                        amount: changeTokenAmount,
                        category: tokenCategory
                    })
                .to(releaseContract.tokenAddress,
                    DustValue,
                    {
                        amount: 0n,
                        category: fundInput.txid,
                        nft: {
                            capability: 'none',
                            commitment: `${encodeBigIntToHexLE(nextReleaseHeight)}${encodeBigIntToHexLE(nextHalvingHeight)}${encodeBigIntToHexLE(nextReward)}`
                        }
                    });
        }

        return transaction;
    };

    let transaction = buildTransaction(DustValue * 2n);
    const transactionHex = await transaction.build();
    const transactionBytes = BigInt(transactionHex.length) / 2n;
    transaction = buildTransaction(calculateTransactionFee(transactionBytes));
    const shouldSend = promptBool('Send transaction (no)? ', 'false');
    if (shouldSend) {
        logger.debug('broadcasting transaction...');
        const response = await transaction.send();
        console.log(response);
    } else {
        logger.info('skipping broadcasting transaction...');
        logger.debug(`transaction hex: ${await transaction.build()}`)
        console.log('transaction', transaction);
        transaction.inputs.forEach(input => {
            console.log('token input', input.token)
        });
        transaction.outputs.forEach(output => {
            console.log('token output', output.token)
        });
    }
} catch (e) {
    logger.error(e.toString());
    console.log('unhandled error', e);
}