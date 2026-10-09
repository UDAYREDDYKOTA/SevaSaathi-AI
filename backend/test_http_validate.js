/**
 * Tests live HTTP endpoint /api/reports/validate on http://localhost:5000
 */

async function testHttpEndpoints() {
  console.log('Testing live HTTP POST http://localhost:5000/api/reports/validate ...');

  // Test 1: Valid complaint without photo
  const res1 = await fetch('http://localhost:5000/api/reports/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Severe waterlogging and clogged drain causing danger to school children.',
      address: 'School Road, Abids, Hyderabad',
      latitude: 17.3910,
      longitude: 78.4770,
    }),
  });
  const data1 = await res1.json();
  console.log('Test 1 HTTP status:', res1.status, 'success:', data1.success);
  console.log('Test 1 Decision:', data1.validation?.decision, 'Category:', data1.validation?.category, 'Confidence:', data1.validation?.confidence);

  if (!data1.success || !data1.validation?.decision) {
    throw new Error('Test 1 failed on HTTP endpoint');
  }

  // Test 2: Spam text
  const res2 = await fetch('http://localhost:5000/api/reports/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'asdfghjkl asdfghjkl asdfghjkl',
      address: 'Hyderabad',
    }),
  });
  const data2 = await res2.json();
  console.log('Test 2 HTTP status:', res2.status, 'Decision:', data2.validation?.decision);
  if (data2.validation?.decision !== 'VALIDATION_FAILED') {
    throw new Error('Test 2 spam was not marked VALIDATION_FAILED');
  }

  console.log('All live HTTP tests passed successfully!');
}

testHttpEndpoints().catch((err) => {
  console.error('HTTP endpoint test failed:', err);
  process.exit(1);
});
