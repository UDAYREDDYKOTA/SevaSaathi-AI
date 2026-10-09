const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const { collection, getDocs, query, limit } = require('firebase/firestore');
const { db } = require('../config/firebase');
const {
  CANONICAL_CATEGORIES,
  CATEGORY_DEPARTMENT_MAP,
  normalizeCanonicalCategory,
} = require('./geminiService');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Hyderabad & Telangana Geographic Constants
const HYDERABAD_GEO = {
  LAT_MIN: 17.10,
  LAT_MAX: 17.65,
  LNG_MIN: 78.10,
  LNG_MAX: 78.75,
};

// Known localities and rough bounds in Hyderabad
const LOCALITY_HINTS = [
  { name: 'charminar', lat: 17.3616, lng: 78.4747 },
  { name: 'gachibowli', lat: 17.4401, lng: 78.3489 },
  { name: 'hitec', lat: 17.4474, lng: 78.3762 },
  { name: 'madhapur', lat: 17.4483, lng: 78.3915 },
  { name: 'kukatpally', lat: 17.4933, lng: 78.4011 },
  { name: 'secunderabad', lat: 17.4399, lng: 78.4983 },
  { name: 'abids', lat: 17.3910, lng: 78.4770 },
  { name: 'begumpet', lat: 17.4447, lng: 78.4664 },
  { name: 'jubilee hills', lat: 17.4319, lng: 78.4073 },
  { name: 'banjara hills', lat: 17.4156, lng: 78.4350 },
  { name: 'lb nagar', lat: 17.3503, lng: 78.5529 },
  { name: 'uppal', lat: 17.4018, lng: 78.5602 },
  { name: 'dilsukhnagar', lat: 17.3688, lng: 78.5247 },
  { name: 'ameerpet', lat: 17.4375, lng: 78.4482 },
  { name: 'mehdipatnam', lat: 17.3916, lng: 78.4398 },
];

/**
 * Calculates Haversine distance in meters between two GPS coordinates.
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number'
  ) {
    return null;
  }
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Deterministic Description Checks (Spam, repetition, brevity, formatting)
 */
function performDeterministicDescriptionCheck(text = '') {
  const clean = (text || '').trim();
  const words = clean.split(/\s+/).filter(Boolean);

  if (!clean || words.length === 0) {
    return {
      isValid: false,
      isSpam: false,
      status: 'NEEDS_INFO',
      clarity: 'Low',
      missingDetails: ['Problem description is completely empty. Please describe what civic issue you are facing.'],
      explanation: 'No description entered. A brief description of the issue is required.',
    };
  }

  // Check 1: Character repetition (e.g., "aaaaaaaaaaaa", "asdfasdfasdf")
  const charRepeatMatch = /(.)\1{5,}/.test(clean);
  if (charRepeatMatch) {
    return {
      isValid: false,
      isSpam: true,
      status: 'FAILED',
      clarity: 'Low',
      missingDetails: ['Please enter a readable description without repeated characters.'],
      explanation: 'Description contains excessive repetitive characters.',
    };
  }

  // Check 2: Word repetition (e.g. "pothole pothole pothole pothole pothole")
  const wordFreq = {};
  for (const w of words) {
    const lw = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lw) wordFreq[lw] = (wordFreq[lw] || 0) + 1;
  }
  const maxRepeatedCount = Math.max(...Object.values(wordFreq), 0);
  if (words.length >= 4 && maxRepeatedCount / words.length > 0.7) {
    return {
      isValid: false,
      isSpam: true,
      status: 'FAILED',
      clarity: 'Low',
      missingDetails: ['Please provide meaningful context rather than repeating the same word.'],
      explanation: 'Description consists of repetitive text.',
    };
  }

  // Check 3: Gibberish heuristic (too short or keyboard smash)
  if (clean.length < 10 || words.length < 3) {
    return {
      isValid: false,
      isSpam: false,
      status: 'NEEDS_INFO',
      clarity: 'Low',
      missingDetails: [
        'More specific details about what is damaged or obstructed',
        'Approximate extent or severity of the issue',
      ],
      explanation: 'Description is too brief to understand the specific civic issue. Please provide a little more detail.',
    };
  }

  // Check 4: Suspicious keyboard smash (e.g., "asdfghjk qwerty")
  const lowerClean = clean.toLowerCase();
  if (/^[bcdfghjklmnpqrstvwxyz\s]{12,}$/.test(lowerClean)) {
    return {
      isValid: false,
      isSpam: true,
      status: 'FAILED',
      clarity: 'Low',
      missingDetails: ['Please describe a real civic issue using recognizable words.'],
      explanation: 'Description appears to be keyboard mash or unreadable characters.',
    };
  }

  return {
    isValid: true,
    isSpam: false,
    status: 'PASSED',
    clarity: words.length >= 8 ? 'High' : 'Medium',
    missingDetails: [],
    explanation: 'Description meets baseline clarity and length criteria.',
  };
}

/**
 * Deterministic Location Checks (Coordinates range, bounding box, address sanity)
 */
function performDeterministicLocationCheck({ address = '', latitude = null, longitude = null }) {
  const cleanAddr = (address || '').trim();
  const hasLat = typeof latitude === 'number' && !isNaN(latitude);
  const hasLng = typeof longitude === 'number' && !isNaN(longitude);

  if (!cleanAddr && !hasLat && !hasLng) {
    return {
      status: 'INVALID',
      hasCoordinates: false,
      isPlausible: false,
      conflictsWithDescription: false,
      missingDetails: ['Specific street address or map location pin'],
      explanation: 'Neither street address nor map coordinates were provided.',
    };
  }

  if (hasLat || hasLng) {
    if (!hasLat || !hasLng || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return {
        status: 'INVALID',
        hasCoordinates: false,
        isPlausible: false,
        conflictsWithDescription: false,
        missingDetails: ['Valid geographic coordinates'],
        explanation: 'Provided coordinates are outside valid geographic latitude/longitude ranges.',
      };
    }
  }

  // Check if coordinates fall within Telangana / Greater Hyderabad region
  let inHyderabadBounds = false;
  if (hasLat && hasLng) {
    inHyderabadBounds =
      latitude >= HYDERABAD_GEO.LAT_MIN &&
      latitude <= HYDERABAD_GEO.LAT_MAX &&
      longitude >= HYDERABAD_GEO.LNG_MIN &&
      longitude <= HYDERABAD_GEO.LNG_MAX;
  }

  // Check address formatting
  if (!cleanAddr || cleanAddr.length < 4) {
    if (hasLat && hasLng) {
      return {
        status: 'UNVERIFIED',
        hasCoordinates: true,
        isPlausible: inHyderabadBounds,
        conflictsWithDescription: false,
        missingDetails: ['Street name or landmark near the dropped pin'],
        explanation: 'Map pin is placed, but street address description is minimal. Geocoding unverified.',
      };
    }
    return {
      status: 'INVALID',
      hasCoordinates: false,
      isPlausible: false,
      conflictsWithDescription: false,
      missingDetails: ['Specific street address or area name'],
      explanation: 'Street address is too brief to identify a location.',
    };
  }

  // Check locality consistency if known locality name is present in address
  let localityContradiction = false;
  let localityConflictExplanation = '';
  if (hasLat && hasLng) {
    const lowerAddr = cleanAddr.toLowerCase();
    for (const hint of LOCALITY_HINTS) {
      if (lowerAddr.includes(hint.name)) {
        const dist = calculateDistanceMeters(latitude, longitude, hint.lat, hint.lng);
        // If pin is > 30 km away from the named locality within the same city
        if (dist !== null && dist > 30000) {
          localityContradiction = true;
          localityConflictExplanation = `Address mentions "${hint.name}", but the map pin is placed approx ${Math.round(dist / 1000)} km away.`;
          break;
        }
      }
    }
  }

  if (localityContradiction) {
    return {
      status: 'CONTRADICTORY',
      hasCoordinates: true,
      isPlausible: inHyderabadBounds,
      conflictsWithDescription: true,
      missingDetails: ['Please align the map pin with your entered street address'],
      explanation: localityConflictExplanation,
    };
  }

  if (hasLat && hasLng) {
    return {
      status: 'VALID',
      hasCoordinates: true,
      isPlausible: true,
      conflictsWithDescription: false,
      missingDetails: [],
      explanation: inHyderabadBounds
        ? 'Location coordinates and address are consistent with Greater Hyderabad municipal boundaries.'
        : 'Coordinates and address format are geographically valid.',
    };
  }

  // Address only, no GPS pin: unverified, but NOT proof of fraud
  return {
    status: 'UNVERIFIED',
    hasCoordinates: false,
    isPlausible: true,
    conflictsWithDescription: false,
    missingDetails: ['Map pin placement (optional but recommended for faster field dispatch)'],
    explanation: 'Address provided without GPS pin. Unverified coordinates will be confirmed during officer triage.',
  };
}

/**
 * Duplicate and Abuse Detection against recent Firestore complaints
 */
async function checkDuplicateAndAbuse({ description = '', category = '', latitude = null, longitude = null }) {
  try {
    if (!db) {
      return { status: 'CLEAN', isDuplicate: false, duplicateReportId: null, isSpam: false, explanation: 'Local spam heuristics passed.' };
    }

    const reportsCol = collection(db, 'reports');
    const q = query(reportsCol, limit(40));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { status: 'CLEAN', isDuplicate: false, duplicateReportId: null, isSpam: false, explanation: 'No prior reports found in database.' };
    }

    const cleanDesc = description.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const inputTokens = new Set(cleanDesc.split(/\s+/).filter((w) => w.length > 3));

    let bestMatch = null;
    let highestSim = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const existingDesc = (data.description || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const existingTokens = new Set(existingDesc.split(/\s+/).filter((w) => w.length > 3));

      if (inputTokens.size === 0 || existingTokens.size === 0) continue;

      let overlap = 0;
      for (const t of inputTokens) {
        if (existingTokens.has(t)) overlap++;
      }
      const similarity = overlap / Math.max(inputTokens.size, existingTokens.size);

      // Distance check if both have coordinates
      let distanceMeters = null;
      if (
        typeof latitude === 'number' && typeof longitude === 'number' &&
        typeof data.latitude === 'number' && typeof data.longitude === 'number'
      ) {
        distanceMeters = calculateDistanceMeters(latitude, longitude, data.latitude, data.longitude);
      }

      // Check if same or related category
      const sameCategory =
        category && data.category &&
        normalizeCanonicalCategory(category) === normalizeCanonicalCategory(data.category);

      // Duplicate condition: very high text similarity (> 0.75) OR (similarity > 0.5 and distance < 75 meters)
      const isClose = distanceMeters !== null && distanceMeters < 75;
      if ((similarity > 0.8 && sameCategory) || (similarity > 0.55 && isClose && sameCategory)) {
        if (similarity > highestSim) {
          highestSim = similarity;
          bestMatch = {
            reportId: data.reportId || docSnap.id,
            category: data.category,
            distanceMeters,
            similarity: Math.round(similarity * 100),
          };
        }
      }
    }

    if (bestMatch) {
      const distMsg = bestMatch.distanceMeters !== null ? ` located ${Math.round(bestMatch.distanceMeters)}m away` : '';
      return {
        status: 'POSSIBLE_DUPLICATE',
        isDuplicate: true,
        duplicateReportId: bestMatch.reportId,
        isSpam: false,
        explanation: `A similar complaint (${bestMatch.reportId}${distMsg}) with matching details has recently been logged in this sector.`,
      };
    }

    return {
      status: 'CLEAN',
      isDuplicate: false,
      duplicateReportId: null,
      isSpam: false,
      explanation: 'No duplicate complaints detected for this location and issue.',
    };
  } catch (err) {
    console.warn('[Duplicate Check] Warning querying Firestore reports:', err.message);
    return {
      status: 'CLEAN',
      isDuplicate: false,
      duplicateReportId: null,
      isSpam: false,
      explanation: 'Duplicate check skipped due to database lookup timeout.',
    };
  }
}

/**
 * Complete Multi-Layer Civic Complaint Verification Pipeline
 */
async function verifyComplaintPipeline({
  description = '',
  address = '',
  locationStatus = '',
  latitude = null,
  longitude = null,
  photoDataUrl = null,
  imageUrl = null,
  category = '', // optional hint
}) {
  const cleanDescription = (description || '').trim();
  const cleanAddress = (address || '').trim();
  const effectiveLocationStatus = locationStatus || cleanAddress || 'Hyderabad, Telangana';

  // 1. LAYER 1: DETERMINISTIC DESCRIPTION CHECK
  const descDetCheck = performDeterministicDescriptionCheck(cleanDescription);

  // 2. LAYER 3: DETERMINISTIC LOCATION CHECK
  const locDetCheck = performDeterministicLocationCheck({
    address: cleanAddress,
    latitude,
    longitude,
  });

  // 3. LAYER 6: DUPLICATE & ABUSE CHECK
  const duplicateCheck = await checkDuplicateAndAbuse({
    description: cleanDescription,
    category,
    latitude,
    longitude,
  });

  // Extract inline image data if provided
  const rawPhoto = photoDataUrl || imageUrl;
  let inlineImagePart = null;
  const isImageProvided = Boolean(rawPhoto && typeof rawPhoto === 'string' && rawPhoto.length > 50);

  if (isImageProvided && rawPhoto.startsWith('data:image/')) {
    const match = rawPhoto.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (match) {
      inlineImagePart = {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      };
    }
  }

  // 4. SEMANTIC / MULTIMODAL GEMINI VERIFICATION (Layers 1, 2, 4, 5)
  const apiKey = process.env.GEMINI_API_KEY;
  let geminiSemantic = null;

  if (apiKey && apiKey.trim() && !apiKey.includes('your_gemini_api_key')) {
    const prompt = `You are the Civic Integrity Engine of SevaSaathi AI, verifying an Indian municipal complaint.
Perform rigorous multi-layer verification of this citizen report.

CITIZEN INPUTS:
- Problem Description: "${cleanDescription || 'None'}"
- Location: "${cleanAddress}" (${effectiveLocationStatus})
- Attached Photo: ${inlineImagePart ? 'YES (Image attached)' : 'NO (Optional photo omitted)'}
- Optional Category Hint: "${category || 'None'}"

VERIFICATION CRITERIA:
Layer 1 - DESCRIPTION:
- Clarity: Is the described problem understandable? ("High" | "Medium" | "Low")
- Civic Relevance: Is this a genuine civic/public infrastructure issue? (true | false)
- Internal Contradictions: Are there contradictory statements in the text? (true | false)
- Missing Details: List any critical missing facts needed to act (or empty array [] if sufficient).

Layer 2 - IMAGE:
- If NO image: set status = "OPTIONAL_OMITTED", isRelevant = null, supportsClaim = null, isUnclear = false, textImageContradiction = false. Remember: missing photos must NOT invalidate the report.
- If image IS attached:
  * isRelevant: Is the image relevant to civic infrastructure? (true | false)
  * supportsClaim: Does the image visibly show or support the claimed civic issue? (true | false)
  * isUnclear: Is the image too dark, blurry, or low quality to evaluate? (true | false)
  * textImageContradiction: Does the image directly contradict the text description (e.g. text says "flooded street" but image shows a bedroom or food)? (true | false)
  * Never claim an image proves something it cannot show.

Layer 3 - LOCATION PLAUSIBILITY:
- Does the location conflict with the description (e.g. description says "lake" or "metro station" impossible for the area)? (true | false)

Layer 4 - CROSS-VALIDATION:
- Check all evidence together (description, image, address). Identify exact contradictions.
- List contradiction flags (or empty array []).

Layer 5 - CLASSIFICATION:
- detectedProblem: Specific problem title (e.g., "Severe Road Pothole", "Blocked Stormwater Drain", "Drinking Water Pipeline Leak")
- category: Assign to EXACTLY ONE of: "Roads", "Drainage", "Water Supply", "Sanitation", "Streetlights", "Electrical", "Parks", "Other"
- department: EXACTLY ONE of: "Roads & Infrastructure", "Stormwater & Drainage", "Water Supply & Sewerage", "Solid Waste Management", "Electrical & Street Lighting", "Horticulture & Parks", "Municipal Administration"
- severity: "Critical" | "High" | "Medium" | "Low"
- safetyRisk: "High" | "Medium" | "Low"
- suggestedPriority: "High" | "Medium" | "Low"

Respond ONLY with a valid JSON object matching this schema:
{
  "layer1_description": {
    "clarity": "High" | "Medium" | "Low",
    "civicRelevance": true | false,
    "internalContradiction": true | false,
    "missingDetails": ["detail1", "detail2"],
    "explanation": "concise explanation"
  },
  "layer2_image": {
    "status": "PASSED" | "UNCLEAR" | "CONTRADICTORY" | "IRRELEVANT" | "OPTIONAL_OMITTED",
    "isRelevant": true | false | null,
    "supportsClaim": true | false | null,
    "isUnclear": true | false,
    "textImageContradiction": true | false,
    "explanation": "concise explanation"
  },
  "layer3_location": {
    "locationConflictsWithDescription": true | false,
    "explanation": "concise explanation"
  },
  "layer4_crossValidation": {
    "consistent": true | false,
    "contradictionFlags": ["exact contradiction explanation if any"],
    "explanation": "concise explanation"
  },
  "layer5_classification": {
    "detectedProblem": "Specific Problem Title",
    "category": "Roads" | "Drainage" | "Water Supply" | "Sanitation" | "Streetlights" | "Electrical" | "Parks" | "Other",
    "department": "Roads & Infrastructure" | "Stormwater & Drainage" | "Water Supply & Sewerage" | "Solid Waste Management" | "Electrical & Street Lighting" | "Horticulture & Parks" | "Municipal Administration",
    "severity": "Critical" | "High" | "Medium" | "Low",
    "safetyRisk": "High" | "Medium" | "Low",
    "suggestedPriority": "High" | "Medium" | "Low"
  }
}`;

    const candidateModels = [
      GEMINI_MODEL,
      'gemini-3.6-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
    ];
    const modelsToTry = [...new Set(candidateModels)];

    for (const currentModel of modelsToTry) {
      try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const contents = inlineImagePart
          ? [inlineImagePart, { text: prompt }]
          : [{ text: prompt }];

        const response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text || '';
        if (responseText) {
          const cleanedJson = responseText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
          geminiSemantic = JSON.parse(cleanedJson);
          break;
        }
      } catch (geminiErr) {
        console.warn(`[Pipeline] Model ${currentModel} error: ${geminiErr.message?.slice(0, 80)}. Trying fallback...`);
      }
    }
  }

  // 5. SYNTHESIZE ALL 7 LAYERS WITH ROBUST FAIL-SAFES

  // Layer 1: Description Synthesis
  const l1Clarity = geminiSemantic?.layer1_description?.clarity || descDetCheck.clarity;
  const l1CivicRelevance = geminiSemantic?.layer1_description?.civicRelevance ?? true;
  const l1InternalContradiction = Boolean(geminiSemantic?.layer1_description?.internalContradiction);
  const l1Missing = [
    ...(descDetCheck.missingDetails || []),
    ...(Array.isArray(geminiSemantic?.layer1_description?.missingDetails)
      ? geminiSemantic.layer1_description.missingDetails
      : []),
  ];
  // Deduplicate missing details
  const uniqueMissing = [...new Set(l1Missing)].filter(Boolean);

  let l1Status = descDetCheck.status;
  if (descDetCheck.status === 'PASSED') {
    if (!l1CivicRelevance) {
      l1Status = 'FAILED';
    } else if (l1InternalContradiction) {
      l1Status = 'FAILED';
    } else if (uniqueMissing.length > 0 && l1Clarity === 'Low') {
      l1Status = 'NEEDS_INFO';
    }
  }

  const layer1Result = {
    status: l1Status,
    clarity: l1Clarity,
    civicRelevance: l1CivicRelevance,
    isSpam: descDetCheck.isSpam,
    internalContradiction: l1InternalContradiction,
    missingDetails: uniqueMissing,
    explanation:
      geminiSemantic?.layer1_description?.explanation ||
      descDetCheck.explanation ||
      'Description reviewed for civic clarity and completeness.',
  };

  // Layer 2: Image Synthesis
  let layer2Result = {
    status: 'OPTIONAL_OMITTED',
    isProvided: false,
    isRelevant: null,
    supportsClaim: null,
    isUnclear: false,
    contradictsDescription: false,
    explanation: 'No photograph provided (optional). Complaint evaluated on text and location evidence.',
  };

  if (isImageProvided) {
    const rawImgStatus = (geminiSemantic?.layer2_image?.status || '').toUpperCase();
    const isRel = geminiSemantic?.layer2_image?.isRelevant ?? true;
    const supports = geminiSemantic?.layer2_image?.supportsClaim ?? true;
    const isUnclear = Boolean(geminiSemantic?.layer2_image?.isUnclear);
    const contradicts = Boolean(geminiSemantic?.layer2_image?.textImageContradiction);

    let imgStatus = 'PASSED';
    if (contradicts || rawImgStatus === 'CONTRADICTORY') {
      imgStatus = 'CONTRADICTORY';
    } else if (!isRel || rawImgStatus === 'IRRELEVANT') {
      imgStatus = 'IRRELEVANT';
    } else if (isUnclear || rawImgStatus === 'UNCLEAR') {
      imgStatus = 'UNCLEAR';
    }

    layer2Result = {
      status: imgStatus,
      isProvided: true,
      isRelevant: isRel,
      supportsClaim: supports,
      isUnclear,
      contradictsDescription: contradicts,
      explanation:
        geminiSemantic?.layer2_image?.explanation ||
        (contradicts
          ? 'The attached photograph does not match the problem described in the complaint.'
          : !isRel
          ? 'The attached image is not recognizable as civic infrastructure.'
          : isUnclear
          ? 'Photograph is blurry or difficult to verify clearly.'
          : 'Attached photograph supports the reported civic issue.'),
    };
  }

  // Layer 3: Location Synthesis
  const locConflictWithDesc = Boolean(geminiSemantic?.layer3_location?.locationConflictsWithDescription);
  let l3Status = locDetCheck.status;
  if (locConflictWithDesc && l3Status !== 'INVALID') {
    l3Status = 'CONTRADICTORY';
  }

  const layer3Result = {
    status: l3Status,
    hasCoordinates: locDetCheck.hasCoordinates,
    isPlausible: locDetCheck.isPlausible,
    conflictsWithDescription: locConflictWithDesc || locDetCheck.conflictsWithDescription,
    missingDetails: locDetCheck.missingDetails || [],
    explanation:
      geminiSemantic?.layer3_location?.explanation ||
      locDetCheck.explanation ||
      'Location checked for coordinates validity and geographic plausibility.',
  };

  // Layer 4: Cross-Validation Synthesis
  const crossFlags = [];
  if (layer2Result.contradictsDescription) {
    crossFlags.push('The attached photograph directly contradicts the problem description.');
  }
  if (layer2Result.status === 'IRRELEVANT') {
    crossFlags.push('The attached photograph is unrelated to the reported civic complaint.');
  }
  if (layer3Result.conflictsWithDescription) {
    crossFlags.push(layer3Result.explanation || 'The specified address/coordinates conflict with the complaint description.');
  }
  if (Array.isArray(geminiSemantic?.layer4_crossValidation?.contradictionFlags)) {
    for (const flag of geminiSemantic.layer4_crossValidation.contradictionFlags) {
      if (flag && !crossFlags.includes(flag)) crossFlags.push(flag);
    }
  }

  const layer4Result = {
    status: crossFlags.length > 0 ? 'CONTRADICTION_FOUND' : 'CONSISTENT',
    contradictionFlags: crossFlags,
    explanation:
      geminiSemantic?.layer4_crossValidation?.explanation ||
      (crossFlags.length > 0
        ? `Cross-validation identified ${crossFlags.length} evidence conflict(s).`
        : 'All available evidence (description, location, and optional photo) is mutually consistent.'),
  };

  // Layer 5: Classification Synthesis
  const fallbackCat = normalizeCanonicalCategory(
    geminiSemantic?.layer5_classification?.category || category || cleanDescription || 'Other'
  );
  const fallbackDept =
    geminiSemantic?.layer5_classification?.department ||
    CATEGORY_DEPARTMENT_MAP[fallbackCat] ||
    'Municipal Administration';
  const detectedProblem =
    (geminiSemantic?.layer5_classification?.detectedProblem &&
      String(geminiSemantic.layer5_classification.detectedProblem).trim()) ||
    `${fallbackCat} Issue`;

  const validSeverities = ['Critical', 'High', 'Medium', 'Low'];
  let severity = (geminiSemantic?.layer5_classification?.severity || 'Medium').toString().trim();
  severity = validSeverities.find((s) => s.toLowerCase() === severity.toLowerCase()) || 'Medium';

  let safetyRisk = (geminiSemantic?.layer5_classification?.safetyRisk || 'Medium').toString().trim();
  safetyRisk = ['High', 'Medium', 'Low'].find((r) => r.toLowerCase() === safetyRisk.toLowerCase()) || 'Medium';

  let suggestedPriority = (
    geminiSemantic?.layer5_classification?.suggestedPriority ||
    (severity === 'Critical' || severity === 'High' ? 'High' : 'Medium')
  ).toString().trim();
  suggestedPriority = ['High', 'Medium', 'Low'].find((p) => p.toLowerCase() === suggestedPriority.toLowerCase()) || 'Medium';

  const layer5Result = {
    detectedProblem,
    category: fallbackCat,
    department: fallbackDept,
    severity,
    safetyRisk,
    suggestedPriority,
    explanation: `Classified as ${detectedProblem} under ${fallbackCat} (${fallbackDept}).`,
  };

  // Layer 6: Duplicate and Abuse Result
  const layer6Result = duplicateCheck;

  // 6. LAYER 7: OVERALL DECISION, CONFIDENCE & NEXT ACTION
  let decision = 'VALIDATION_PASSED';
  const issues = [];
  const allMissingInfo = [
    ...(layer1Result.missingDetails || []),
    ...(layer3Result.missingDetails || []),
  ];

  // Failure Conditions:
  // - Spam or gibberish description
  // - Non-civic issue
  // - Contradiction between image and text
  // - Contradictory image (irrelevant)
  // - Invalid coordinates or gibberish address
  if (layer1Result.isSpam) {
    decision = 'VALIDATION_FAILED';
    issues.push('Description contains repetitive or unreadable text.');
  } else if (!layer1Result.civicRelevance) {
    decision = 'VALIDATION_FAILED';
    issues.push('The reported issue does not appear to fall under municipal civic infrastructure.');
  } else if (layer2Result.contradictsDescription || layer2Result.status === 'CONTRADICTORY') {
    decision = 'VALIDATION_FAILED';
    issues.push('The attached photograph contradicts the problem described.');
  } else if (layer2Result.status === 'IRRELEVANT') {
    decision = 'VALIDATION_FAILED';
    issues.push('The attached image is unrelated to public civic infrastructure.');
  } else if (layer3Result.status === 'INVALID') {
    decision = 'VALIDATION_FAILED';
    issues.push('The location provided is invalid or coordinates are out of bounds.');
  } else if (crossFlags.length > 0) {
    decision = 'VALIDATION_FAILED';
    issues.push(...crossFlags);
  }

  // Needs More Information Conditions (if not already failed)
  if (decision !== 'VALIDATION_FAILED') {
    if (layer1Result.status === 'NEEDS_INFO' || allMissingInfo.length > 0 && cleanDescription.length < 15) {
      decision = 'NEEDS_MORE_INFORMATION';
      issues.push('Key complaint details are missing.');
    }
  }

  // Flagged for Review Conditions (if not failed or needing info)
  if (decision !== 'VALIDATION_FAILED' && decision !== 'NEEDS_MORE_INFORMATION') {
    if (layer6Result.isDuplicate) {
      decision = 'FLAGGED_FOR_REVIEW';
      issues.push(`Possible duplicate complaint (${layer6Result.duplicateReportId}) detected nearby.`);
    } else if (layer2Result.status === 'UNCLEAR') {
      decision = 'FLAGGED_FOR_REVIEW';
      issues.push('Attached photograph is unclear or difficult to inspect.');
    } else if (layer3Result.status === 'UNVERIFIED') {
      // Unverified location is flagged for officer review, NOT rejected
      decision = 'FLAGGED_FOR_REVIEW';
      issues.push('Location address requires manual municipal officer verification.');
    }
  }

  // Compute Evidence-Based Confidence (Never fabricate certainty)
  let baseConfidence = 90;
  if (!layer2Result.isProvided) {
    // Missing photo is optional, max baseline confidence without photo is 82%
    baseConfidence = Math.min(baseConfidence, 82);
  }
  if (layer3Result.status === 'UNVERIFIED') {
    baseConfidence -= 10;
  }
  if (layer1Result.clarity === 'Medium') {
    baseConfidence -= 8;
  } else if (layer1Result.clarity === 'Low') {
    baseConfidence -= 25;
  }
  if (layer2Result.status === 'UNCLEAR') {
    baseConfidence -= 15;
  }
  if (decision === 'FLAGGED_FOR_REVIEW') {
    baseConfidence = Math.min(baseConfidence, 72);
  }
  if (decision === 'NEEDS_MORE_INFORMATION') {
    baseConfidence = Math.min(baseConfidence, 50);
  }
  if (decision === 'VALIDATION_FAILED') {
    baseConfidence = Math.min(baseConfidence, 35);
  }
  const confidence = Math.max(15, Math.min(95, baseConfidence));

  // Determine Citizen Recommended Next Action
  let recommendedNextAction = 'Proceed with complaint submission.';
  let canSubmit = true;
  let requiresOfficerReview = false;

  if (decision === 'VALIDATION_PASSED') {
    recommendedNextAction = 'All verification checks passed. Proceed to submit your complaint.';
    canSubmit = true;
    requiresOfficerReview = false;
  } else if (decision === 'NEEDS_MORE_INFORMATION') {
    recommendedNextAction = 'Please provide the missing details listed above before submitting.';
    canSubmit = false;
    requiresOfficerReview = false;
  } else if (decision === 'FLAGGED_FOR_REVIEW') {
    recommendedNextAction = 'Your complaint will be forwarded for direct Municipal Officer review.';
    canSubmit = true;
    requiresOfficerReview = true;
  } else if (decision === 'VALIDATION_FAILED') {
    recommendedNextAction = 'Please correct the highlighted issues or request manual human officer review.';
    canSubmit = false;
    requiresOfficerReview = true;
  }

  // Build Summary Sentence
  let summary = '';
  if (decision === 'VALIDATION_PASSED') {
    summary = `Verified ${layer5Result.detectedProblem} in ${layer5Result.category}. Evidence is consistent and ready for municipal review.`;
  } else if (decision === 'NEEDS_MORE_INFORMATION') {
    summary = 'Complaint requires additional specific details to proceed.';
  } else if (decision === 'FLAGGED_FOR_REVIEW') {
    summary = `Complaint flagged for manual officer triage: ${issues.join('; ')}`;
  } else {
    summary = `Validation blocked due to: ${issues.join('; ')}`;
  }

  return {
    decision,
    status: decision, // legacy compatibility
    confidence,
    summary,
    detectedProblem: layer5Result.detectedProblem,
    category: layer5Result.category,
    department: layer5Result.department,
    severity: layer5Result.severity,
    safetyRisk: layer5Result.safetyRisk,
    priority: layer5Result.suggestedPriority,
    suggestedPriority: layer5Result.suggestedPriority,
    layers: {
      description: layer1Result,
      image: layer2Result,
      location: layer3Result,
      crossValidation: layer4Result,
      classification: layer5Result,
      duplicatesAndAbuse: layer6Result,
    },
    missingInfo: allMissingInfo,
    issues,
    contradictionFlags: crossFlags,
    recommendedNextAction,
    canSubmit,
    requiresOfficerReview,
    validatedAt: new Date().toISOString(),
    isAiAssessment: true,
  };
}

module.exports = {
  verifyComplaintPipeline,
  performDeterministicDescriptionCheck,
  performDeterministicLocationCheck,
  checkDuplicateAndAbuse,
};
