import { ElectrumNetworkProvider, Contract } from 'cashscript';

import { DustValue } from '../util/constants.js';
import { prompt, promptInt, promptBool } from '../util/prompt.js';
import encodeBigIntToHexLE from '../util/encodeBigIntToHexLE.js';
import calculateTransactionFee from '../util/calculateTransactionFee.js';
import getWallet from '../util/getWallet.js';
import logger from '../util/logger.js';

import buildReleaseTokenContract from './buildReleaseTokenContract.js';

import config from '../config.json' assert { type: 'json' };

try {
  const network = config.Network;
  const networkProvider = new ElectrumNetworkProvider(network);
  const networkHeight = await networkProvider.getBlockHeight();
  logger.info(`network: ${network} height: ${networkHeight}`);

  const { signatureTemplate, address: fundAddress } = await getWallet();

  const { releaseContract, halvingLength } = await buildReleaseTokenContract({ addressType: config.Contract.AddressType, provider: networkProvider });

  const fundUtxos = await networkProvider.getUtxos(fundAddress);
  logger.debug('fund UTXOs', fundUtxos);

  const InputMinimumSatoshis = 10000;

  const potentialInputs = [];
  let utxoIndex = 0;
  do {
    const utxo = fundUtxos[utxoIndex];
    if (utxo.satoshis >= InputMinimumSatoshis && utxo.token !== undefined && utxo.token.amount > 0 && utxo.token.nft === undefined) {
      potentialInputs.push(utxo);
    }
    ++utxoIndex;
  } while (utxoIndex < fundUtxos.length);

  const selectInput = () => {
    let selectedInput;
    do {
      if (potentialInputs.length == 1) {
        selectedInput = potentialInputs[0];
      } else if (potentialInputs.length > 1) {
        const response = prompt(`Which input should be used:\n${potentialInputs.map((i, index) => `(${index}) Id: ${i.txid} VOut: ${i.vout} Satoshis: ${i.satoshis} Token: ${i.token}`).join('\n')}`);
        const index = Number.parseInt(response);
        if (index != NaN) {
          selectedInput = matches[0];
        }
      }
    } while (!selectedInput);
    return selectedInput;
  };

  const input = selectInput();

  if (!input) {
    throw Error('No satisfactory UTXOs found for this contract...ensure a valid UTXO exists with some tokens');
  }

  const tokenAmount = input.token.amount;
  const blockHeight = promptInt('Start releasing tokens at block (0)? ', '0');
  const reward = promptInt('Initial reward (250,000,000,000)? ', '250000000000');

  logger.info(`Halving Length: ${halvingLength}\nToken Amount: ${tokenAmount}\nLockAmount: ${lockAmount}\nRelease Block Height: ${blockHeight}\nRelease Reward Amount: ${reward}`);
  const isConfirmed = promptBool('Confirm token and contract data (no)? ', 'no');
  if (!isConfirmed) {
    throw Error('User denied input values and script is aborting.');
  }

  const buildTransaction = fee => {
    const changeValue = input.satoshis - (2n * DustValue) - fee;
    if (changeValue < DustValue) {
      throw Error('The UTXO found does not contain enough value, reclaim and then provide a new UTXO with a higher value.')
    }
    const builder = new TransactionBuilder({ provider: networkProvider });

    return builder.withoutChange()
      .withoutTokenChange()
      .addInput(input, signatureTemplate.unlockP2PKH())
      .addOutput(releaseContract.tokenAddress,
        DustValue,
        {
          amount: tokenAmount,
          category: input.token.category
        })
      .addOutput(releaseContract.tokenAddress,
        DustValue,
        {
          amount: 0n,
          category: input.txid,
          nft: {
            capability: 'none',
            commitment: `${encodeBigIntToHexLE(blockHeight)}${encodeBigIntToHexLE(blockHeight)}${encodeBigIntToHexLE(reward)}`
          }
        })
      .addOutput(fundAddress, changeValue);
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
  }
} catch (e) {
  logger.error('error: ' + e.toString());
}