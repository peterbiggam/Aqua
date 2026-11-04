const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const walletPath = path.join(__dirname, '..', 'aqua_wallet_v3_4_application.html');
const html = fs.readFileSync(walletPath, 'utf8');
const appScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

if (!appScript) {
    throw new Error('Could not find the wallet application script');
}

const TEST_WALLET_ADDRESS = 'rTestWalletFixture111111111111111';

function createBrowserHarness(fetchImpl) {
    const elements = new Map();
    const storage = new Map();

    function createElement(id = '') {
        const classes = new Set();
        return {
            id,
            className: '',
            textContent: '',
            innerHTML: '',
            value: '',
            disabled: false,
            style: {},
            children: [],
            classList: {
                add(name) { classes.add(name); },
                remove(name) { classes.delete(name); },
                contains(name) { return classes.has(name); },
                toggle(name, force) {
                    const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
                    if (shouldAdd) classes.add(name);
                    else classes.delete(name);
                    return shouldAdd;
                }
            },
            appendChild(child) { this.children.push(child); },
            remove() {},
            focus() {},
            select() {}
        };
    }

    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement(id));
            return elements.get(id);
        },
        createElement() {
            return createElement();
        },
        body: {
            appendChild() {},
            removeChild() {}
        },
        execCommand() { return true; }
    };

    const sandbox = {
        console,
        document,
        window: { addEventListener() {} },
        localStorage: {
            getItem(key) { return storage.has(key) ? storage.get(key) : null; },
            setItem(key, value) { storage.set(key, String(value)); },
            removeItem(key) { storage.delete(key); }
        },
        fetch: fetchImpl,
        setTimeout() { return 0; },
        clearTimeout() {},
        xrpl: {
            dropsToXrp(drops) { return (Number(drops) / 1_000_000).toString(); },
            isValidClassicAddress(address) { return typeof address === 'string' && address.startsWith('r'); }
        }
    };

    const testAccess = `
        updateConnectionIndicators();
        globalThis.__walletTest = {
            getState: () => ({
                simulation: isLocalSimulationMode,
                connectionStatus,
                accountXrpBalance,
                accountSpendableXrp
            }),
            setWallet: (address) => { activeWallet = { classicAddress: address, seed: 'TEST_ONLY_FIXTURE' }; },
            getStorageKey: () => STORAGE_KEY_SIM_LEDGER,
            getStorage: (key) => localStorage.getItem(key),
            getElement: (id) => document.getElementById(id),
            getLocalSimulationMode: () => isLocalSimulationMode
        };
    `;

    vm.runInNewContext(`${appScript}\n${testAccess}`, sandbox, {
        filename: 'aqua_wallet_v3_4_application.html'
    });

    return { sandbox, storage, elements };
}

function jsonResponse(body, options = {}) {
    return {
        ok: options.ok ?? true,
        status: options.status ?? 200,
        async json() { return body; }
    };
}

function validatedAccountResponse(balance = '12345678') {
    return jsonResponse({
        result: {
            status: 'success',
            ledger_index: 100,
            validated: true,
            account_data: {
                Account: TEST_WALLET_ADDRESS,
                Balance: balance,
                OwnerCount: 0,
                Sequence: 1
            }
        }
    });
}

test('network rejection leaves XRPL balance unavailable and never enables simulation', async () => {
    let fetchCalls = 0;
    const harness = createBrowserHarness(async () => {
        fetchCalls++;
        throw new TypeError('mock network rejection');
    });
    harness.sandbox.__walletTest.setWallet(TEST_WALLET_ADDRESS);

    await assert.rejects(
        harness.sandbox.xrplRpcRequest('account_info', { account: TEST_WALLET_ADDRESS }),
        /mock network rejection/
    );
    await harness.sandbox.refreshAccountTelemetry();

    assert.equal(harness.sandbox.__walletTest.getState().simulation, false);
    assert.equal(harness.sandbox.__walletTest.getState().connectionStatus, 'offline');
    assert.equal(harness.sandbox.__walletTest.getElement('xrpTotalBalance').textContent, '—');
    assert.equal(harness.sandbox.__walletTest.getElement('xrpSpendableText').textContent, 'Spendable: unavailable');
    assert.equal(harness.sandbox.__walletTest.getElement('balanceSourceLabel').textContent, 'XRPL BALANCE UNAVAILABLE');
    assert.equal(fetchCalls, 2);
});

test('missing, unvalidated, and malformed XRPL data cannot be presented as a balance', async (t) => {
    const rejectedResponses = [
        ['missing result', jsonResponse({})],
        ['unvalidated ledger', jsonResponse({
            result: { status: 'success', ledger_index: 100, validated: false }
        })]
    ];

    for (const [name, response] of rejectedResponses) {
        await t.test(name, async () => {
            const harness = createBrowserHarness(async () => response);
            await assert.rejects(
                harness.sandbox.xrplRpcRequest('account_info', { account: TEST_WALLET_ADDRESS })
            );
            assert.equal(harness.sandbox.__walletTest.getState().connectionStatus, 'offline');
            assert.equal(harness.sandbox.__walletTest.getState().simulation, false);
        });
    }

    await t.test('malformed account balance', async () => {
        const harness = createBrowserHarness(async () => validatedAccountResponse('not-drops'));
        harness.sandbox.__walletTest.setWallet(TEST_WALLET_ADDRESS);

        await harness.sandbox.refreshAccountTelemetry();

        assert.equal(harness.sandbox.__walletTest.getElement('xrpTotalBalance').textContent, '—');
        assert.equal(harness.sandbox.__walletTest.getElement('xrpSpendableText').textContent, 'Spendable: unavailable');
        assert.equal(harness.sandbox.__walletTest.getElement('balanceSourceLabel').textContent, 'XRPL BALANCE UNAVAILABLE');
        assert.equal(harness.sandbox.__walletTest.getState().accountXrpBalance, 0);
    });
});

test('validated XRPL response is the only network response that displays an account balance', async () => {
    const harness = createBrowserHarness(async () => validatedAccountResponse());
    harness.sandbox.__walletTest.setWallet(TEST_WALLET_ADDRESS);

    await harness.sandbox.refreshAccountTelemetry();

    assert.equal(harness.sandbox.__walletTest.getState().connectionStatus, 'verified');
    assert.equal(harness.sandbox.__walletTest.getState().accountXrpBalance, 12.345678);
    assert.equal(harness.sandbox.__walletTest.getElement('xrpTotalBalance').textContent, '12.3457');
    assert.equal(harness.sandbox.__walletTest.getElement('balanceSourceLabel').textContent, 'XRPL TESTNET • VALIDATED LEDGER');
});

test('local simulation starts off and requires explicit opt-in', async () => {
    let fetchCalls = 0;
    const harness = createBrowserHarness(async () => {
        fetchCalls++;
        throw new TypeError('mock network rejection');
    });
    harness.sandbox.__walletTest.setWallet(TEST_WALLET_ADDRESS);

    assert.equal(harness.sandbox.__walletTest.getLocalSimulationMode(), false);
    assert.equal(harness.sandbox.__walletTest.getElement('balanceSourceLabel').textContent, 'Balance source: not verified');

    await assert.rejects(
        harness.sandbox.xrplRpcRequest('account_info', { account: TEST_WALLET_ADDRESS }),
        /mock network rejection/
    );
    assert.equal(harness.sandbox.__walletTest.getLocalSimulationMode(), false);

    await harness.sandbox.enableLocalSimulation();
    assert.equal(harness.sandbox.__walletTest.getLocalSimulationMode(), true);
    assert.equal(harness.sandbox.__walletTest.getElement('balanceSourceLabel').textContent, 'SIMULATED BALANCE • NOT ON XRPL');
    assert.equal(fetchCalls, 1);
});

test('simulated actions do not change local state or call XRPL while in XRPL mode', async () => {
    let fetchCalls = 0;
    const harness = createBrowserHarness(async () => {
        fetchCalls++;
        return validatedAccountResponse();
    });
    harness.sandbox.__walletTest.setWallet(TEST_WALLET_ADDRESS);
    const simLedgerKey = harness.sandbox.__walletTest.getStorageKey();

    await harness.sandbox.addSimulatedFunding();
    await harness.sandbox.executeAtomicSwap();
    await harness.sandbox.createPaymentStream();
    await harness.sandbox.publishDidCredential();
    await harness.sandbox.recordSimulatedPayment();

    assert.equal(harness.sandbox.__walletTest.getLocalSimulationMode(), false);
    assert.equal(harness.sandbox.__walletTest.getStorage(simLedgerKey), null);
    assert.equal(fetchCalls, 0);
});
