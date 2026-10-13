import Callout from './Callout.jsx';
import { formatInt, shortenHex } from '../lib/format.js';

export default function VaultStatePanel({
    wallet,
    vault,
    vaultLoading,
    vaultError,
    onLoad,
    onRefreshHeight,
    nextHalvingEligibleHeight,
}) {
    return (
        <section className="panel">
            <h2>2. Vault state</h2>

            {!wallet && <p className="muted">Unlock your wallet above to inspect the vault.</p>}

            {wallet && (
                <div className="field-row">
                    <button type="button" onClick={onLoad} disabled={vaultLoading}>
                        {vaultLoading ? 'Loading…' : vault ? 'Reload vault state' : 'Load vault state'}
                    </button>
                    {vault && (
                        <button type="button" className="ghost" onClick={onRefreshHeight}>
                            Refresh block height
                        </button>
                    )}
                </div>
            )}

            {vaultError && <Callout tone="error">{vaultError}</Callout>}

            {vault && (
                <div>
                    {vault.lockedTokenAmount <= 0n && (
                        <Callout tone="warning">
                            The vault has no tokens left to release &mdash; it has reached end of
                            life.
                        </Callout>
                    )}

                    <dl className="kv">
                        <dt>Contract address</dt>
                        <dd className="mono" title={vault.contractAddress}>
                            {shortenHex(vault.contractAddress, 14)}
                        </dd>

                        <dt>Token category</dt>
                        <dd className="mono" title={vault.tokenCategory}>
                            {shortenHex(vault.tokenCategory, 10)}
                        </dd>

                        <dt>Tokens remaining in vault</dt>
                        <dd>{formatInt(vault.lockedTokenAmount)}</dd>

                        <dt>Current block height</dt>
                        <dd>{formatInt(vault.currentHeight)}</dd>

                        <dt>Last release height</dt>
                        <dd>{formatInt(vault.previousReleaseHeight)}</dd>

                        <dt>Current reward (per block)</dt>
                        <dd>{formatInt(vault.previousReward)}</dd>

                        <dt>Halving length</dt>
                        <dd>{formatInt(vault.halvingLength)} blocks</dd>

                        <dt>Halving becomes available at</dt>
                        <dd>
                            block {formatInt(nextHalvingEligibleHeight)}
                            {nextHalvingEligibleHeight !== null &&
                                vault.currentHeight >= nextHalvingEligibleHeight && (
                                    <span className="tag tag-warning">reached</span>
                                )}
                        </dd>
                    </dl>
                </div>
            )}
        </section>
    );
}
