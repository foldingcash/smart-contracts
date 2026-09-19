import Callout from './Callout.jsx';
import { formatInt } from '../lib/format.js';

export default function ReleasePanel({ vault, targetHeight, setTargetHeight, preview }) {
    if (!vault || targetHeight === null) {
        return (
            <section className="panel">
                <h2>3. Choose a release height</h2>
                <p className="muted">Load the vault state above first.</p>
            </section>
        );
    }

    const min = Number(vault.previousReleaseHeight);
    const max = Number(vault.currentHeight);
    const value = Number(targetHeight);

    return (
        <section className="panel">
            <h2>3. Choose a release height</h2>
            <p className="muted">
                You can release up to the current block height ({formatInt(vault.currentHeight)}
                ), but no higher.
            </p>

            <div className="height-control">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => setTargetHeight(event.target.value)}
                    disabled={min >= max}
                />
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => setTargetHeight(event.target.value)}
                    className="mono-input"
                />
            </div>
            <p className="muted small">
                Minimum {formatInt(vault.previousReleaseHeight)} (last release height) &middot;
                maximum {formatInt(vault.currentHeight)} (current tip)
            </p>

            {preview?.error && <Callout tone="error">{preview.error}</Callout>}

            {preview && !preview.error && (
                <div>
                    {preview.halvingTriggered && (
                        <Callout tone="warning">
                            A halving event falls within this range. The release will stop at
                            block {formatInt(preview.nextReleaseHeight)} and the reward will drop
                            to {formatInt(preview.nextReward)} per block. Run a release again
                            afterwards to continue past the halving.
                        </Callout>
                    )}
                    {preview.endOfLife && (
                        <Callout tone="info">
                            This release empties the vault &mdash; all remaining tokens will be
                            sent out and no state/change UTXO will be recreated.
                        </Callout>
                    )}

                    <dl className="kv">
                        <dt>Tokens to release</dt>
                        <dd className="emphasis">{formatInt(preview.releaseTokenAmount)}</dd>

                        <dt>Tokens remaining after</dt>
                        <dd>{formatInt(preview.changeTokenAmount)}</dd>

                        <dt>Next release height (stored in new state)</dt>
                        <dd>{formatInt(preview.nextReleaseHeight)}</dd>

                        <dt>Next reward (stored in new state)</dt>
                        <dd>{formatInt(preview.nextReward)}</dd>
                    </dl>
                </div>
            )}
        </section>
    );
}
