import {
  instantiateSecp256k1,
  instantiateRipemd160,
  instantiateSha256,
  decodePrivateKeyWif,
  binToHex,
  encodeCashAddress,
} from '@bitauth/libauth';
import { SignatureTemplate } from 'cashscript';

import config from '../config.json' assert { type: 'json' };
import wallet from '../wallet.json' assert { type: 'json' };

export default async function getWallet() {
  const secp256k1 = await instantiateSecp256k1();
  const ripemd160 = await instantiateRipemd160();
  const sha256 = await instantiateSha256();

  const privateKey = wallet.PrivateKey;
  const signatureTemplate = new SignatureTemplate(privateKey);

  const decodedWif = decodePrivateKeyWif(wallet.PrivateKey);
  const pubKeyBin = secp256k1.derivePublicKeyCompressed(decodedWif.privateKey);
  const pubKeyHex = binToHex(pubKeyBin);
  const pubKeyHash = ripemd160.hash(sha256.hash(pubKeyBin));
  const address = encodeCashAddress(config.Network === 'mainnet' ? 'bitcoincash' : 'bchtest', 'p2pkhWithTokens', pubKeyHash);
  return { privateKey, signatureTemplate, pubKeyBin, pubKeyHex, pubKeyHash, address };
}