// Defaults mirroring ../config.json at the repo root. These describe how
// the deployed vault contract was constructed; the halving length and
// address type here MUST match the values used when the vault was created,
// or the derived contract address (and therefore its UTXOs) won't be found.
// They're editable in the app's "Advanced settings" as an escape hatch for
// running against a different vault, e.g. one deployed on chipnet for
// testing.

export const DEFAULT_CONFIG = {
    network: 'mainnet', // 'mainnet' | 'chipnet'
    addressType: 'p2sh32',
    halvingLength: '157500',
};

export const NETWORK_OPTIONS = [
    { value: 'mainnet', label: 'Mainnet' },
    { value: 'chipnet', label: 'Chipnet (test network)' },
];
