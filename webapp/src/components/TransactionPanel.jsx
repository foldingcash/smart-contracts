import { useEffect, useState } from 'react';
import Callout from './Callout.jsx';
import { formatInt, shortenHex } from '../lib/format.js';

const EXPLORERS = {
    mainnet: (txid) => `https://blockchair.com/bitcoin-cash/transaction/${txid}`,
    chipnet: (txid) => `https://chipnet.bch.ninja/tx/${txid}`,
};

export default function TransactionPanel({
    network,
    vault,
    preview,
    txResult,
    txLoading,
    txError,
    onBuild,
    sendResult,
    sendLoading,
    sendError,
    onSend,
}) {
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        setConfirmed(false);
    }, [txResult]);

    if (!vault || !preview || preview.error) {
        return (
            <section className="panel">
                <h2>4. Build &amp; send</h2>
                <p className="muted">Pick a valid release height above first.</p>
            </section>
        );
    }

    const explorerUrl = sendResult ? EXPLORERS[network]?.(sendResult.txid) : null;

    return (
        <section className="panel">
            <h2>4. Build &amp; send</h2>

            <div className="field-row">
                <button type="button" onClick={onBuild} disabled={txLoading}>
                    {txLoading ? 'Building…' : 'Build transaction'}
                </button>
            </div>

            {txError && <Callout tone="error">{txError}</Callout>}

            {txResult && (
                <div>
                    <dl className="kv">
                        <dt>Fee</dt>
                        <dd>{formatInt(txResult.fee)} sats</dd>
                        <dt>Raw transaction</dt>
                        <dd className="mono wrap">{shortenHex(txResult.hex, 24)}</dd>
                    </dl>

                    {network === 'mainnet' ? (
                        <Callout tone="warning">
                            You're on mainnet. Sending broadcasts a real transaction moving real
                            funds and tokens. This cannot be undone.
                        </Callout>
                    ) : (
                        <Callout tone="info">You're on chipnet (test network).</Callout>
                    )}

                    <label className="confirm-row">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                        />
                        I've reviewed the release amount and outputs above and want to broadcast
                        this transaction.
                    </label>

                    <button
                        type="button"
                        className="danger"
                        onClick={onSend}
                        disabled={!confirmed || sendLoading}
                    >
                        {sendLoading ? 'Sending…' : 'Send transaction'}
                    </button>

                    {sendError && <Callout tone="error">{sendError}</Callout>}

                    {sendResult && (
                        <Callout tone="success">
                            Broadcast! Transaction ID: <span className="mono">{sendResult.txid}</span>
                            {explorerUrl && (
                                <>
                                    {' '}
                                    &mdash;{' '}
                                    <a href={explorerUrl} target="_blank" rel="noreferrer">
                                        view on explorer
                                    </a>
                                </>
                            )}
                            <br />
                            Reload the vault state above once this confirms to see the updated
                            balance.
                        </Callout>
                    )}
                </div>
            )}
        </section>
    );
}
