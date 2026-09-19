import { useVaultRelease } from './hooks/useVaultRelease.js';
import NetworkSettings from './components/NetworkSettings.jsx';
import WalletPanel from './components/WalletPanel.jsx';
import VaultStatePanel from './components/VaultStatePanel.jsx';
import ReleasePanel from './components/ReleasePanel.jsx';
import TransactionPanel from './components/TransactionPanel.jsx';

export default function App() {
    const vaultRelease = useVaultRelease();

    return (
        <div className="app">
            <header className="app-header">
                <h1>FoldingCash Token Vault &mdash; Release Console</h1>
                <p className="muted">
                    Release scheduled tokens from the TokenVault_Release contract. This app runs
                    entirely in your browser: nothing you enter here is sent to any server other
                    than the public Electrum servers used to read chain data and broadcast your
                    signed transaction.
                </p>
            </header>

            <NetworkSettings
                network={vaultRelease.network}
                setNetwork={vaultRelease.setNetwork}
                addressType={vaultRelease.addressType}
                setAddressType={vaultRelease.setAddressType}
                halvingLengthInput={vaultRelease.halvingLengthInput}
                setHalvingLengthInput={vaultRelease.setHalvingLengthInput}
                disabled={Boolean(vaultRelease.wallet)}
            />

            <WalletPanel
                wif={vaultRelease.wif}
                setWif={vaultRelease.setWif}
                wallet={vaultRelease.wallet}
                walletError={vaultRelease.walletError}
                onUnlock={vaultRelease.unlockWallet}
                onClear={vaultRelease.clearWallet}
                network={vaultRelease.network}
            />

            <VaultStatePanel
                wallet={vaultRelease.wallet}
                vault={vaultRelease.vault}
                vaultLoading={vaultRelease.vaultLoading}
                vaultError={vaultRelease.vaultError}
                onLoad={vaultRelease.loadVault}
                onRefreshHeight={vaultRelease.refreshHeight}
                nextHalvingEligibleHeight={vaultRelease.nextHalvingEligibleHeight}
            />

            <ReleasePanel
                vault={vaultRelease.vault}
                targetHeight={vaultRelease.targetHeight}
                setTargetHeight={vaultRelease.setTargetHeight}
                preview={vaultRelease.preview}
            />

            <TransactionPanel
                network={vaultRelease.network}
                vault={vaultRelease.vault}
                preview={vaultRelease.preview}
                txResult={vaultRelease.txResult}
                txLoading={vaultRelease.txLoading}
                txError={vaultRelease.txError}
                onBuild={vaultRelease.buildTransaction}
                sendResult={vaultRelease.sendResult}
                sendLoading={vaultRelease.sendLoading}
                sendError={vaultRelease.sendError}
                onSend={vaultRelease.sendTransaction}
            />

            <footer className="app-footer muted">
                This app only supports the simple two-UTXO vault layout (a fungible token UTXO
                plus its NFT state UTXO) and a single funding UTXO at your wallet address, the
                same limitation as the <code>yarn release</code> CLI script. Consolidate UTXOs
                first if either has grown beyond that.
            </footer>
        </div>
    );
}
