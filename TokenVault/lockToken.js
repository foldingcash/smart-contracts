import { ElectrumNetworkProvider, TransactionBuilder } from 'cashscript';

import { DustValue } from '../util/constants.js';
import { promptInt, promptBool } from '../util/prompt.js';
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

  if (fundUtxos.length === 0) {
    throw Error('No available UTXOs, send the token and a separate well funded UTXO to', fundAddress);
  }

  if (fundUtxos.length === 1) {
    throw Error('Only one UTXO found...expected two UTXOs one token UTXO and another to fund the transaction');
  }

  if (fundUtxos.length > 2) {
    throw Error('More UTXOs than expected, need to enhance the script');
  }

  const InputMinimumSatoshis = 4000;

  let tokenInput;
  let fundInput;

  for (let index = 0; index < fundUtxos.length; index++) {
    const utxo = fundUtxos[index];

    if (utxo.token) {
      tokenInput = utxo;
    } else if (utxo.satoshis >= InputMinimumSatoshis && !utxo.token) {
      fundInput = utxo;
    }
  }

  if (!tokenInput || !fundInput) {
    throw Error('The available UTXOs did not satisfy the requirements to send');
  }

  const tokenAmount = tokenInput.token.amount;
  const blockHeight = promptInt('Start releasing tokens at block (857132)? ', '857132');
  const reward = promptInt('Initial reward (250,000,000,000)? ', '250000000000');

  logger.info(`Halving Length: ${halvingLength}\nLocking Token Amount: ${tokenAmount}\nRelease Block Height: ${blockHeight}\nRelease Reward Amount: ${reward}`);
  const isConfirmed = promptBool('Confirm token and contract data (no)? ', 'no');
  if (!isConfirmed) {
    throw Error('User denied input values and script is aborting.');
  }

  console.log('testing', releaseContract.tokenAddress);
  console.log('token input', tokenInput);
  console.log('fund input', fundInput);

  const buildTransaction = fee => {
    const changeValue = tokenInput.satoshis + fundInput.satoshis - (2n * DustValue) - fee;
    if (changeValue < DustValue) {
      throw Error('The UTXO found does not contain enough value, reclaim and then provide a new UTXO with a higher value.')
    }

    const builder = new TransactionBuilder({ provider: networkProvider });
    return builder
      .addInput(tokenInput, signatureTemplate.unlockP2PKH())
      .addInput(fundInput, signatureTemplate.unlockP2PKH())
      .addOutput({
        to: releaseContract.tokenAddress,
        amount: DustValue,
        token: tokenInput.token,
      })
      .addOutput({
        to: releaseContract.tokenAddress,
        amount: DustValue,
        token: {
          amount: 0n,
          category: fundInput.txid,
          nft: {
            capability: 'none',
            commitment: `${encodeBigIntToHexLE(blockHeight)}${encodeBigIntToHexLE(blockHeight)}${encodeBigIntToHexLE(reward)}`
          }
        }
      })
      .addOutput({
        to: fundAddress,
        amount: changeValue
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
  }
} catch (e) {
  logger.error('error: ' + e.toString());
  console.log(e);
}