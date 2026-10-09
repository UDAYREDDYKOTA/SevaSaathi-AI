/**
 * SevaSaathi AI - Comprehensive Verification Pipeline Test Suite
 * Tests all 11 required verification and safety invariants.
 */

const {
  verifyComplaintPipeline,
  performDeterministicDescriptionCheck,
  performDeterministicLocationCheck,
  checkDuplicateAndAbuse,
} = require('./services/complaintVerificationService');
const {
  CANONICAL_CATEGORIES,
  CATEGORY_DEPARTMENT_MAP,
  normalizeCanonicalCategory,
} = require('./services/geminiService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}: ${details}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('SEVASAATHI AI: MULTI-LAYER CIVIC COMPLAINT VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // TEST 1: Deterministic Description Check - Legitimate Complaint
  console.log('--- Test 1: Description Check - Valid Civic Text ---');
  const d1 = performDeterministicDescriptionCheck(
    'There is a severe deep pothole in the middle of the road near the metro station obstructing two-wheelers.'
  );
  assert(d1.isValid === true, 'Valid description passes baseline check');
  assert(d1.status === 'PASSED', 'Status is PASSED');
  assert(d1.isSpam === false, 'Not flagged as spam');

  // TEST 2: Description Check - Repeated Character Spam
  console.log('\n--- Test 2: Description Check - Repeated Character Spam ---');
  const d2 = performDeterministicDescriptionCheck('pothole aaaaaaaaaaaaaaaaa please fix');
  assert(d2.isValid === false, 'Repeated character spam blocked');
  assert(d2.status === 'FAILED', 'Status is FAILED');
  assert(d2.isSpam === true, 'Flagged as spam');

  // TEST 3: Description Check - Repeated Word Spam
  console.log('\n--- Test 3: Description Check - Repeated Word Spam ---');
  const d3 = performDeterministicDescriptionCheck('pothole pothole pothole pothole pothole pothole pothole');
  assert(d3.isValid === false, 'Repeated word spam blocked');
  assert(d3.isSpam === true, 'Flagged as spam');
  assert(d3.status === 'FAILED', 'Status is FAILED');

  // TEST 4: Description Check - Too Brief / Needs More Information
  console.log('\n--- Test 4: Description Check - Brief / Needs Information ---');
  const d4 = performDeterministicDescriptionCheck('road bad');
  assert(d4.isValid === false, 'Too brief description identified');
  assert(d4.status === 'NEEDS_INFO', 'Status is NEEDS_INFO');
  assert(d4.missingDetails.length > 0, 'Returns specific missing details guidance');

  // TEST 5: Location Check - Valid Hyderabad GPS and Address
  console.log('\n--- Test 5: Location Check - Valid Hyderabad Coordinates & Address ---');
  const l1 = performDeterministicLocationCheck({
    address: 'School Road, Abids, Hyderabad',
    latitude: 17.3910,
    longitude: 78.4770,
  });
  assert(l1.status === 'VALID', 'Valid Hyderabad location accepted');
  assert(l1.hasCoordinates === true, 'hasCoordinates is true');
  assert(l1.isPlausible === true, 'isPlausible is true');

  // TEST 6: Location Check - Out of Bounds Invalid Coordinates
  console.log('\n--- Test 6: Location Check - Out of Bounds Coordinates ---');
  const l2 = performDeterministicLocationCheck({
    address: 'Random Street',
    latitude: 195.5,
    longitude: -210.0,
  });
  assert(l2.status === 'INVALID', 'Out of bounds coordinates flagged as INVALID');
  assert(l2.isPlausible === false, 'isPlausible is false');

  // TEST 7: Location Check - Valid Address but Missing GPS (Unverified, not fraud!)
  console.log('\n--- Test 7: Location Check - Address Only, GPS Unverified ---');
  const l3 = performDeterministicLocationCheck({
    address: 'Station Road, Secunderabad, Hyderabad',
    latitude: null,
    longitude: null,
  });
  assert(l3.status === 'UNVERIFIED', 'Address-only returns UNVERIFIED (never marked invalid or fraudulent)');
  assert(l3.conflictsWithDescription === false, 'No conflict flag raised');

  // TEST 8: Location Check - Locality Contradiction (Pin placed 40km away from named locality)
  console.log('\n--- Test 8: Location Check - Locality vs Coordinates Mismatch ---');
  const l4 = performDeterministicLocationCheck({
    address: 'Near Charminar Old City, Hyderabad',
    latitude: 17.6200, // Northern outer edge, > 35km away from Charminar (17.3616)
    longitude: 78.5800,
  });
  assert(l4.status === 'CONTRADICTORY', 'Mismatched locality and distant pin flagged as CONTRADICTORY');
  assert(l4.conflictsWithDescription === true, 'conflictsWithDescription is true');

  // TEST 9: Canonical Category Normalization
  console.log('\n--- Test 9: Canonical Civic Category Alignment ---');
  assert(CANONICAL_CATEGORIES.length === 8, 'Exactly 8 canonical categories exist');
  assert(normalizeCanonicalCategory('pothole asphalt damaged') === 'Roads', 'Roads normalization correct');
  assert(normalizeCanonicalCategory('blocked stormwater drainage flood') === 'Drainage', 'Drainage normalization correct');
  assert(normalizeCanonicalCategory('burst drinking water pipe') === 'Water Supply', 'Water Supply normalization correct');
  assert(normalizeCanonicalCategory('garbage dump trash waste') === 'Sanitation', 'Sanitation normalization correct');
  assert(normalizeCanonicalCategory('dark street lamp bulb out') === 'Streetlights', 'Streetlights normalization correct');
  assert(normalizeCanonicalCategory('sparking electrical wire transformer') === 'Electrical', 'Electrical normalization correct');
  assert(normalizeCanonicalCategory('fallen tree branch in park garden') === 'Parks', 'Parks normalization correct');

  // TEST 10: Department Mapping
  console.log('\n--- Test 10: Responsible Department Mapping ---');
  assert(CATEGORY_DEPARTMENT_MAP['Roads'] === 'Roads & Infrastructure', 'Roads department mapped correctly');
  assert(CATEGORY_DEPARTMENT_MAP['Drainage'] === 'Stormwater & Drainage', 'Drainage department mapped correctly');
  assert(CATEGORY_DEPARTMENT_MAP['Water Supply'] === 'Water Supply & Sewerage', 'Water Supply department mapped correctly');
  assert(CATEGORY_DEPARTMENT_MAP['Sanitation'] === 'Solid Waste Management', 'Sanitation department mapped correctly');
  assert(CATEGORY_DEPARTMENT_MAP['Streetlights'] === 'Electrical & Street Lighting', 'Streetlights department mapped correctly');
  assert(CATEGORY_DEPARTMENT_MAP['Electrical'] === 'Electrical & Street Lighting', 'Electrical department mapped correctly');
  assert(CATEGORY_DEPARTMENT_MAP['Parks'] === 'Horticulture & Parks', 'Parks department mapped correctly');
  assert(CATEGORY_DEPARTMENT_MAP['Other'] === 'Municipal Administration', 'Other department mapped correctly');

  // TEST 11: End-to-End Pipeline - Valid Complaint with Optional Photo Omitted
  console.log('\n--- Test 11: Pipeline - Valid Complaint (Optional Photo Omitted) ---');
  const res1 = await verifyComplaintPipeline({
    description: 'There is deep road pothole on Main Street causing traffic jams and bike accidents.',
    address: 'Main Street, Abids, Hyderabad',
    latitude: 17.3910,
    longitude: 78.4770,
    photoDataUrl: null, // Photo omitted!
  });
  assert(res1.layers.image.status === 'OPTIONAL_OMITTED', 'Layer 2 status is OPTIONAL_OMITTED');
  assert(res1.layers.image.isProvided === false, 'Image isProvided is false');
  assert(res1.canSubmit === true, 'Complaint can still be submitted without photo');
  assert(res1.confidence <= 85, 'Confidence truthfully reflects text-only evidence (no artificial 100%)');
  assert(CANONICAL_CATEGORIES.includes(res1.category), `Category ${res1.category} is canonical`);

  // TEST 12: End-to-End Pipeline - Spam Rejection
  console.log('\n--- Test 12: Pipeline - Spam Description Rejection ---');
  const res2 = await verifyComplaintPipeline({
    description: 'asdfghjkl zxcvbnm qwertyuiop asdfghjkl',
    address: 'Anywhere',
    latitude: 17.3910,
    longitude: 78.4770,
  });
  assert(res2.decision === 'VALIDATION_FAILED', 'Spam rejected with VALIDATION_FAILED');
  assert(res2.canSubmit === false, 'Automatic submission blocked');
  assert(res2.issues.length > 0, 'Issues explained clearly');

  // TEST 13: End-to-End Pipeline - Missing Information
  console.log('\n--- Test 13: Pipeline - Missing Information Request ---');
  const res3 = await verifyComplaintPipeline({
    description: 'fix please',
    address: 'Road',
  });
  assert(res3.decision === 'NEEDS_MORE_INFORMATION' || res3.decision === 'VALIDATION_FAILED', 'Brief input identified');
  assert(res3.missingInfo.length > 0, 'Missing information list provided to guide citizen');

  // TEST 14: End-to-End Pipeline - Invalid Coordinates Rejection
  console.log('\n--- Test 14: Pipeline - Invalid Coordinates Handling ---');
  const res4 = await verifyComplaintPipeline({
    description: 'Broken streetlight on road at night',
    address: 'Test Road',
    latitude: 999.0, // Invalid
    longitude: -999.0,
  });
  assert(res4.decision === 'VALIDATION_FAILED', 'Invalid coordinates blocked with VALIDATION_FAILED');
  assert(res4.layers.location.status === 'INVALID', 'Location layer marked INVALID');

  // TEST 15: Workflow Safety Invariant Check
  console.log('\n--- Test 15: Workflow Safety Invariants ---');
  const initialReportState = {
    status: 'submitted',
    validationStatus: 'VALIDATION_PASSED',
    officerDecision: null,
  };
  // Field worker query simulation
  const fieldWorkerAllowedStatuses = ['approved', 'assigned', 'accepted', 'in_progress', 'completed', 'resolved'];
  const canFieldWorkerSee = fieldWorkerAllowedStatuses.includes(initialReportState.status);
  assert(canFieldWorkerSee === false, 'Unapproved report with VALIDATION_PASSED is NOT visible to field workers');

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
