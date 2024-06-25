import { ElectrumNetworkProvider, TransactionBuilder } from 'cashscript';

import { prompt, promptBool } from '../util/prompt.js';
import { DustValue } from '../util/constants.js';
import calculateTransactionFee from '../util/calculateTransactionFee.js';
import getWallet from '../util/getWallet.js';
import logger from '../util/logger.js';

import config from '../config.json' assert { type: 'json' };

try {
    const network = config.Network;

    const networkProvider = new ElectrumNetworkProvider(network);
    const height = await networkProvider.getBlockHeight();
    logger.info(`network: ${network} height: ${height}`);

    const { address: fundAddress, signatureTemplate } = await getWallet();
    logger.debug('calculated address: ' + fundAddress);

    const fundUtxos = await networkProvider.getUtxos(fundAddress)
    if (fundUtxos.length == 0) {
        throw Error('No UTXOs found at the fund...ensure a valid UTXO exists');
    }

    const fundInput = fundUtxos[0];

    let toAddress;
    do {
        const response = prompt('Send input to? ');
        if (response) {
            toAddress = response;
        }
    } while (!toAddress);
    logger.debug('Sending to ' + toAddress);

    const buildTransaction = fee => {
        const builder = new TransactionBuilder({ provider: networkProvider });
        return builder
            .addInput(fundInput, signatureTemplate.unlockP2PKH())
            .addOutput({
                to: toAddress,
                amount: fundInput.satoshis - fee,
                token: fundInput.token
            });
    };

    let transaction = buildTransaction(DustValue * 2n);
    const transactionHex = transaction.build();
    const transactionBytes = BigInt(transactionHex.length) / 2n;
    transaction = buildTransaction(calculateTransactionFee(transactionBytes));
    const shouldSend = promptBool('Send transaction (no)? ', 'false');
    if (shouldSend) {
        logger.debug('broadcasting transaction...');
        const response = await transaction.send();
        console.log(response);
    } else {
        logger.info('skipping broadcasting transaction...');
        logger.debug(`transaction hex: ${transaction.build()}`)
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
}