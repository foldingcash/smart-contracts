import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// cashscript's ElectrumNetworkProvider pulls in the `electrum-cash` package,
// which has a static `import net from 'net'` at the top of its bundle even
// though the browser-friendly transport we actually use is WSS (WebSocket).
// cashscript's own barrel export also drags in `bitcoin-rpc-promise-retry`
// (for BitcoinRpcNetworkProvider, which we never use) and a Node `fs` read
// in @cashscript/utils' artifact helpers. None of that code ever runs in
// this app, but a browser bundler still needs every static import to
// resolve to *something*, so we polyfill/stub Node's core modules.
// See: https://gitlab.com/electrum-cash/network/-/issues/81
export default defineConfig({
    plugins: [
        nodePolyfills({
            protocolImports: true,
        }),
        react(),
    ],
    server: {
        fs: {
            // Allow importing the compiled contract artifact copy that lives
            // under src/contracts, plus anything else in the repo, from the
            // dev server.
            allow: ['..'],
        },
    },
    // @bitauth/libauth uses top-level await to instantiate its WASM crypto
    // implementations, which needs a fairly modern target both in dev
    // (esbuild-transformed deps) and in the production build.
    esbuild: {
        target: 'es2022',
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'es2022',
        },
    },
    build: {
        target: 'es2022',
    },
});
