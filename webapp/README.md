# Token Vault Release Console

A small React app for releasing tokens from the `TokenVault_Release` contract
(see `../TokenVault/releaseToken.js` for the equivalent CLI script). It runs
entirely in the browser — there is no backend/server component.

## What it does

1. **Wallet** &mdash; paste the WIF private key for the vault's fund
   address. It's kept only in memory for the life of the tab: never written
   to disk, localStorage, sessionStorage, or sent anywhere except to sign
   the transaction you choose to broadcast. Reloading the page clears it.
2. **Vault state** &mdash; reads the contract's UTXOs from a public Electrum
   server and decodes the NFT state commitment to show the last release
   height, current reward, halving length, and when the next halving
   becomes available, alongside the current chain tip.
3. **Release height** &mdash; a slider/number input clamped between the last
   release height and the current block height (you can't release past a
   height Bitcoin Cash hasn't produced yet), with a live preview of how many
   tokens would be released, whether a halving would trigger, and whether
   the vault would reach end-of-life.
4. **Build & send** &mdash; builds the transaction the same way the CLI
   script does (two-pass fee calculation), shows you the fee and outputs,
   and only lets you broadcast after you tick a confirmation checkbox.

## Setup

This was written offline and hasn't had `npm install` run against it yet.
From this directory:

```sh
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static
`dist/` you can host anywhere (it's a fully client-side app, so any static
file host works — it does not need a Node server at runtime).

### Keeping the contract artifact in sync

`src/contracts/TokenVault_Release.artifact.json` is a copy of the compiled
contract artifact from `../TokenVault/TokenVault_Release.artifact.cash` (a
JSON file despite its extension). This app doesn't bundle the CashScript
compiler, so it reads that precompiled artifact directly. If you change
`TokenVault_Release.cash` and regenerate artifacts at the repo root
(`yarn generate`), re-run this to pick up the change:

```sh
npm run sync-artifact
```

### Advanced settings

The halving length and contract address type default to the values in
`../config.json`. They must match whatever the vault was actually
constructed with, or the app will derive the wrong contract address and
find no UTXOs. Only change them if you're pointing this app at a different
deployment (e.g. a test vault on chipnet).

## Why `vite-plugin-node-polyfills` is here

`cashscript`'s `ElectrumNetworkProvider` depends on the `electrum-cash`
package, which has a top-level `import net from 'net'` even though the
transport actually used here is WSS (secure WebSocket, which works fine in
browsers). `cashscript`'s package entry point also re-exports
`BitcoinRpcNetworkProvider` (pulling in a Node-only RPC client) and a
Node `fs` read used only by the CLI compiler tooling. None of that code
path ever runs in this app, but a browser bundler still needs every static
`import` to resolve to *something*. `vite-plugin-node-polyfills` stubs
those Node built-ins so the bundle resolves; see
<https://gitlab.com/electrum-cash/network/-/issues/81> for the upstream
discussion. If a future `cashscript`/`electrum-cash` release ships proper
browser builds, this plugin (and its entry in `vite.config.js`) can likely
be removed.

## Current limitations

Mirrors the same limitation the CLI's `yarn release` script has: this app
only understands the simple case of exactly two UTXOs locked in the vault
contract (one fungible token UTXO plus its NFT state UTXO, from the same
transaction) and exactly one plain BCH UTXO at your wallet address to fund
the transaction fee. If either has accumulated more UTXOs than that,
consolidate them first.

## Security notes

- The WIF you enter must control the vault's fund address (the same key
  used to construct the release contract via `config.json`'s
  `Contract.Release.Constructor.Fund`). Anyone with this key can release
  and redirect the vault's tokens, so treat it with the same care as any
  other private key.
- This app talks directly to public Electrum servers (over WSS) from your
  browser to read chain state and broadcast transactions. No third party
  server sits in between and no data is sent to FoldingCash or anyone else.
- Consider testing on chipnet with a throwaway key before doing anything on
  mainnet.
