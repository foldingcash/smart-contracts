import { SatoshisPerByteTransactionFee } from "./constants.js";

// TODO: Allow configurable fee rate and fixed amount
export default function calculateTransactionFee(bytes) {
    return (SatoshisPerByteTransactionFee * bytes) + 1n;
}