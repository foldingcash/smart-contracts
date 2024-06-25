import { MaxBigInt, MaxBigIntString } from "./constants.js";

export default function encodeBigIntToHexLE(value) {
    if (typeof value != 'bigint' && typeof value != 'number') {
        throw Error('Input value must be of type bigint or number.');
    }
    if (value < 0) {
        throw Error('Input value must be positive.');
    }
    const bigValue = BigInt(value);
    if (bigValue > BigInt(MaxBigInt)) {
        throw Error(`Input value must not be larger than ${MaxBigIntString}.`)
    }
    const hexBe = bigValue.toString(16).padStart(16, '0');
    const hexLe = [];
    for (let i = 0; i < hexBe.length; i = i + 2) {
        hexLe.push(hexBe.slice(i, i + 2));
    }
    return hexLe.reverse().join('');
}