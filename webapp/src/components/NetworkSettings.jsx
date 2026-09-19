import { useState } from 'react';
import { NETWORK_OPTIONS } from '../config.js';

export default function NetworkSettings({
    network,
    setNetwork,
    addressType,
    setAddressType,
    halvingLengthInput,
    setHalvingLengthInput,
    disabled,
}) {
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
        <section className="panel">
            <div className="network-row">
                <h2>Network</h2>
                <div className="segmented">
                    {NETWORK_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={network === option.value ? 'segment active' : 'segment'}
                            onClick={() => setNetwork(option.value)}
                            disabled={disabled}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <span className={network === 'mainnet' ? 'badge badge-mainnet' : 'badge badge-testnet'}>
                    {network === 'mainnet' ? 'Real funds' : 'Test network'}
                </span>
            </div>

            <button type="button" className="link" onClick={() => setAdvancedOpen((v) => !v)}>
                {advancedOpen ? 'Hide' : 'Show'} advanced settings
            </button>

            {advancedOpen && (
                <div className="advanced">
                    <p className="muted">
                        These must match the values used when the vault contract was created
                        (see config.json at the repo root). Only change them if you're pointing
                        this app at a different deployment.
                    </p>
                    <label>
                        Halving length (blocks)
                        <input
                            type="text"
                            inputMode="numeric"
                            value={halvingLengthInput}
                            onChange={(event) => setHalvingLengthInput(event.target.value)}
                            disabled={disabled}
                            className="mono-input"
                        />
                    </label>
                    <label>
                        Contract address type
                        <select
                            value={addressType}
                            onChange={(event) => setAddressType(event.target.value)}
                            disabled={disabled}
                        >
                            <option value="p2sh32">p2sh32</option>
                            <option value="p2sh20">p2sh20</option>
                        </select>
                    </label>
                </div>
            )}
        </section>
    );
}
