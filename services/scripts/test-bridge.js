
/**
 * LOCAL SWARM BRIDGE - INTEGRATION TEST
 * 
 * This script verifies the async communication loop:
 * CLI -> Proxy -> React App -> Proxy -> CLI
 * 
 * Usage: node scripts/test-bridge.js
 */

const PROXY_URL = 'http://127.0.0.1:1234';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runIntegrationTest() {
    console.log('\x1b[36m%s\x1b[0m', '=== Starting Async Bridge Integration Test ===');
    
    // 1. Check if Proxy is reachable
    try {
        const health = await fetch(`${PROXY_URL}/bridge/cli/output`); // Simple GET to check server
        if (!health.ok) throw new Error(`Proxy not responding: ${health.status}`);
        console.log('✅ Proxy Server is Online');
    } catch (e) {
        console.error('\x1b[31m%s\x1b[0m', '❌ CRITICAL: Proxy is down. Run "node proxy.js" first.');
        process.exit(1);
    }

    // 2. Send Async Command (/ping)
    const testId = `TEST-${Date.now()}`;
    const payload = { content: `/ping ${testId}` };
    
    console.log(`\n📤 Sending Payload: ${JSON.stringify(payload)}`);
    const startTime = Date.now();

    try {
        const sendRes = await fetch(`${PROXY_URL}/bridge/cli/input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!sendRes.ok) throw new Error('Failed to send message to bridge');
        console.log('✅ Message Queued successfully');
    } catch (e) {
        console.error('❌ Failed to send:', e.message);
        process.exit(1);
    }

    // 3. Async Polling for Response (Wait for App to process and reply)
    console.log('⏳ Polling for Swarm response...');
    let attempts = 0;
    const maxAttempts = 20; // 20 * 500ms = 10 seconds timeout

    while (attempts < maxAttempts) {
        try {
            const res = await fetch(`${PROXY_URL}/bridge/cli/output`);
            const data = await res.json();

            if (data.message) {
                // Check if it matches our test ID
                if (data.message.content.includes(testId) || data.message.content.includes("PONG")) {
                    const latency = Date.now() - startTime;
                    console.log('\x1b[32m%s\x1b[0m', `\n✅ SUCCESS: Response received in ${latency}ms`);
                    console.log(`   Response: "${data.message.content}"`);
                    console.log(`   Agent ID: ${data.message.agentId}`);
                    return;
                } else {
                    console.log(`   (Ignoring unrelated message: ${data.message.content.substring(0, 20)}...)`);
                }
            }
        } catch (e) {
            console.log('   (Polling error, retrying...)');
        }

        await sleep(500);
        process.stdout.write('.');
        attempts++;
    }

    console.error('\x1b[31m%s\x1b[0m', '\n❌ TIMEOUT: App did not respond in time.');
    console.log('Tips:');
    console.log('1. Ensure the React App is open in the browser.');
    console.log('2. Ensure "Auto-Connect" is enabled in the Sidebar.');
}

runIntegrationTest();
