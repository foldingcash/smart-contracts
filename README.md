# smart-contracts

## Token Vault
Token Vault is what I'm calling a contract that enforces a scheduled release of any token. The vault follows an algorithm similar to Bitcoin in that for every block produced then the fund manager will be able to release a specified number of coins. Every `halving length` that occurs will cause the token reward to be halved. This continues until all tokens have been released.

### Minting
While minting doesn't have to go through this contract, to ensure a safe mint then it's recommended to use the minting contract.

The minting contract should enforce the token amount, the number of tokens being locked, and encoding state data for the contract to release.

### Releasing
Releasing the token from the vault is done by calling `yarn release` and answering the prompt for the height you'd like to release your token up to. The contract enforces that the fund manager is unable to release more tokens than Bitcoin has produced in blocks.

## Programming Contract Notes
1. When encoding byte data to be converted to int within the contract
    * use little endian
    * highest bit is the sign flag
1. When encoding byte data to be consumed as byte data
    * the way it's inputed into the commitment is the way it'll be accessed in contract
1. Additional notes
    * block height index starts at zero
    * division is floored like standard int computing
    * pubkey is public key hex
