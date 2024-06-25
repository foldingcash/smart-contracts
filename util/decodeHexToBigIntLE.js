export default function decodeHexToBigIntLE(value) {
    if (typeof value != 'string' || !value.startsWith('0x')) {
        throw Error('Input value must be of type string w/ a preceeding 0x.');
    }
    const hexLe = value.slice(2);
    if (hexLe.length != (8 * 2)) {
        throw Error('Expected an eight byte hex but one was not provided, ensure to provide an eight byte value or enhance this function.');
    }
    const hexBe = [];
    for (let i = 0; i < hexLe.length; i = i + 2) {
        hexBe.push(hexLe.slice(i, i + 2));
    }
    const bigValue = BigInt('0x' + hexBe.reverse().join(''));
    if ((bigValue & BigInt('0x8000000000000000')) != 0n) {
        throw Error('This function will not properly convert negative numbers, enhance this function or ensure only positive values are provided.')
    }
    return bigValue;
}