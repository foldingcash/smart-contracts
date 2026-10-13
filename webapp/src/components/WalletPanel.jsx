import { useState } from 'react';
import Callout from './Callout.jsx';

export default function WalletPanel({ wif, setWif, wallet, walletError, onUnlock, onClear, network }) {
    const [revealed, setRevealed] = useState(false);

    return (
        <section className="panel">
            <h2>1. Wallet</h2>
            <p className="muted">
                Paste the WIF private key for the vault's fund address. It is kept only in this
                tab's memory for as long as the page stays open &mdash; never saved to disk,
                localStorage, or sent anywhere except to sign the transaction you choose to
                broadcast. Reloading or closing this tab wipes it immediately.
            </p>

            {!wallet && (
                <div className="field-row">
                    <input
                        type={revealed ? 'text' : 'password'}
                        autoComplete="off"
                        spellCheck="false"
                        placeholder="L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ"
                        value={wif}
                        onChange={(event) => setWif(event.target.value)}
                        className="mono-input"
                    />
                    <button type="button" className="ghost" onClick={() => setRevealed((v) => !v)}>
                        {revealed ? 'Hide' : 'Show'}
                    </button>
                    <button type="button" onClick={onUnlock} disabled={!wif}>
                        Unlock
                    </button>
                </div>
            )}

            {walletError && <Callout tone="error">{walletError}</Callout>}

            {wallet && (
                <div>
                    <dl className="kv">
                        <dt>Fund address</dt>
                        <dd className="mono">{wallet.address}</dd>
                        <dt>Public key</dt>
                        <dd className="mono">{wallet.pubKeyHex}</dd>
                    </dl>
                    {wallet.networkMismatch && (
                        <Callout tone="warning">
                            This WIF was encoded for {wallet.wifNetworkType}, but you're set to{' '}
                            {network}. Double-check you selected the right network before
                            continuing.
                        </Callout>
                    )}
                    <button type="button" className="danger" onClick={onClear}>
                        Clear key from memory
                    </button>
                </div>
            )}
        </section>
    );
}
