/**
 * Simple test script untuk API
 * 
 * Usage:
 *   node test-api.js
 * 
 * Pastikan server sudah running di localhost:3000
 */

const API_BASE = 'http://localhost:3000/api';

async function testAPI() {
  console.log('🧪 Testing Smart Car IoT API\n');

  try {
    // Test 1: Get Settings
    console.log('1️⃣  Testing GET /api/settings');
    const getSettingsRes = await fetch(`${API_BASE}/settings`);
    const getSettings = await getSettingsRes.json();
    console.log('   ✅ Response:', JSON.stringify(getSettings, null, 2));
    console.log('');

    // Test 2: Update Settings
    console.log('2️⃣  Testing PUT /api/settings');
    const newMaxWeight = 600.00;
    const updateSettingsRes = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ max_weight: newMaxWeight })
    });
    const updateSettings = await updateSettingsRes.json();
    console.log('   ✅ Response:', JSON.stringify(updateSettings, null, 2));
    console.log('');

    // Test 3: Get Status
    console.log('3️⃣  Testing GET /api/status');
    const getStatusRes = await fetch(`${API_BASE}/status?device_id=test_device`);
    const getStatus = await getStatusRes.json();
    console.log('   ✅ Response:', JSON.stringify(getStatus, null, 2));
    console.log('');

    // Test 4: Get Logs
    console.log('4️⃣  Testing GET /api/logs');
    const getLogsRes = await fetch(`${API_BASE}/logs?limit=10`);
    const getLogs = await getLogsRes.json();
    console.log('   ✅ Response:', JSON.stringify(getLogs, null, 2));
    console.log('');

    // Test 5: Reset max weight back to 500
    console.log('5️⃣  Resetting max_weight to 500');
    const resetRes = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ max_weight: 500.00 })
    });
    const reset = await resetRes.json();
    console.log('   ✅ Response:', JSON.stringify(reset, null, 2));
    console.log('');

    console.log('✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Make sure the server is running on http://localhost:3000');
  }
}

// Run tests
testAPI();

