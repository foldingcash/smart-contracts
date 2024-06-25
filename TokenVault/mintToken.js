import { ElectrumNetworkProvider, Contract } from 'cashscript';
import { compileFile } from 'cashc';

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

  const { signatureTemplate, pubKeyHex: fundHex, address: fundAddress } = await getWallet();

  const mintingContractJson = compileFile(new URL('TokenVault_Mint.cash', import.meta.url));
  const mintingContract = new Contract(mintingContractJson, [fundHex], { addressType: config.Contract.AddressType, provider: networkProvider });
  const { releaseContract, halvingLength } = await buildReleaseTokenContract({ addressType: config.Contract.AddressType, provider: networkProvider });

  const balance = await mintingContract.getBalance();
  logger.debug('balance: ' + balance);
  if (balance == 0n) {
    throw Error('The contract does not contain a balance...send funds to ' + mintingContract.address);
  }

  const contractUtxos = await mintingContract.getUtxos();
  if (contractUtxos.length == 0) {
    throw Error('No UTXOs found for this contract...ensure a valid UTXO exists');
  }

  const InputMinimumSatoshis = 4000;

  const potentialInputs = [];
  let utxoIndex = 0;
  do {
    const utxo = contractUtxos[utxoIndex];
    if (utxo.satoshis >= InputMinimumSatoshis && utxo.token == undefined) {
      potentialInputs.push(utxo);
    }
    ++utxoIndex;
  } while (utxoIndex < contractUtxos.length);

  const selectInput = () => {
    let selectedInput;
    do {
      if (potentialInputs.length == 1) {
        selectedInput = potentialInputs[0];
      } else if (potentialInputs.length > 1) {
        const response = prompt(`Which input should be used:\n${potentialInputs.map((i, index) => `(${index}) Id: ${i.txid} VOut: ${i.vout} Satoshis: ${i.satoshis}`).join('\n')}`);
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
    throw Error('No satisfactory UTXOs found for this contract...ensure a valid UTXO exists without any tokens');
  }

  const tokenAmount = promptInt('How many tokens to issue (96,934,680,000,000,000)? ', '96934680000000000');
  const lockAmount = promptInt(`How many tokens to lock (76,934,680,000,000,000)? `, ' 76934680000000000');
  const blockHeight = promptInt('Start releasing tokens at block (0)? ', '0');
  const reward = promptInt('Initial reward (250,000,000,000)? ', '250000000000');

  logger.info(`Halving Length: ${halvingLength}\nToken Amount: ${tokenAmount}\nLockAmount: ${lockAmount}\nRelease Block Height: ${blockHeight}\nRelease Reward Amount: ${reward}`);
  const isConfirmed = promptBool('Confirm token and contract data (no)? ', 'no');
  if (!isConfirmed) {
    throw Error('User denied input values and script is aborting.');
  }

  let changeAmount = tokenAmount - lockAmount;
  let changeToken;
  if (changeAmount > 0) {
    changeToken = {
      amount: changeAmount,
      category: input.txid
    };
  }

  const buildTransaction = fee => {
    const changeValue = input.satoshis - (2n * DustValue) - fee;
    if (changeValue < DustValue) {
      throw Error('The UTXO found does not contain enough value, reclaim and then provide a new UTXO with a higher value.')
    }
    return mintingContract.functions.mint(signatureTemplate, tokenAmount, lockAmount, blockHeight, reward)
      .withoutChange()
      .withoutTokenChange()
      .from(input)
      .to(releaseContract.tokenAddress,
        DustValue,
        {
          amount: lockAmount,
          category: input.txid
        })
      .to(releaseContract.tokenAddress,
        DustValue,
        {
          amount: 0n,
          category: input.txid,
          nft: {
            capability: 'none',
            commitment: `${encodeBigIntToHexLE(blockHeight)}${encodeBigIntToHexLE(blockHeight)}${encodeBigIntToHexLE(reward)}`
          }
        })
      .to(fundAddress,
        changeValue,
        changeToken);
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