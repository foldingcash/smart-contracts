import { Contract } from 'cashscript';
import { compileFile } from 'cashc';

import getWallet from '../util/getWallet.js';

import config from '../config.json' assert { type: 'json' };

export default async function buildContract({ addressType, provider }) {
    const releaseContractJson = compileFile(new URL('TokenVault_Release.cash', import.meta.url));
    const halvingLength = BigInt(config.Contract.Release.Constructor.HalvingLength.Value);
    const { pubKeyHex: fundHex } = await getWallet();
    const releaseContract = new Contract(releaseContractJson, [fundHex, halvingLength], { addressType, provider });
    return { releaseContract, halvingLength };
}