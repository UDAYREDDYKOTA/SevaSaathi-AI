/**
 * SevaSaathi AI - Stage 5 Incident Fusion Service
 *
 * Checks whether a newly submitted citizen report describes the same underlying
 * civic incident as existing reports in the Firestore database.
 *
 * Multi-dimensional comparison:
 * 1. Category similarity
 * 2. Location proximity (Haversine distance when GPS is available, or area keyword matching)
 * 3. Time proximity (Hours/days elapsed between timestamps)
 * 4. Text/description semantic similarity
 *
 * Scoring threshold:
 * - 90–100 -> "High confidence related"
 * - 60–89  -> "Officer review"
 * - < 60   -> "Separate incident"
 *
 * Safety guarantees:
 * - Never deletes or silently merges citizen reports.
 * - Every report remains separately stored and tracked.
 */

const { collection, getDocs, query, limit } = require('firebase/firestore');
const { db } = require('../config/firebase');

// Related categories dictionary
const RELATED_CATEGORIES = {
  drainage: ['water', 'roads'],
  water: ['drainage', 'sanitation'],
  roads: ['drainage', 'streetlights'],
  sanitation: ['water', 'drainage'],
  streetlights: ['roads'],
};

// Common civic keywords for text matching
const STOP_WORDS = new Set([
  'the', 'is', 'and', 'in', 'at', 'to', 'of', 'a', 'an', 'on', 'near',
  'it', 'this', 'that', 'for', 'with', 'from', 'by', 'as', 'are', 'was',
  'be', 'has', 'have', 'had', 'there', 'here', 'please', 'help', 'very',
]);

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

  const R = 6371e3; // Earth radius in meters
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
 * Extracts clean keyword tokens from problem description text.
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Calculates Jaccard token similarity (0.0 to 1.0) between two word lists.
 */
function calculateTextSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersectionCount = 0;

  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

/**
 * Extracts timestamp in milliseconds from Firestore Timestamp, string, or number.
 */
function getTimestampMillis(ts) {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

/**
 * Compares two reports across category, location, time, and text.
 * Returns match score (0-100) and evidence array.
 */
function compareReports(reportA, reportB) {
  let score = 0;
  const evidence = [];

  const catA = (reportA.category || '').toLowerCase().trim();
  const catB = (reportB.category || '').toLowerCase().trim();

  // 1. Category Similarity (Weight: 25 points)
  if (catA && catB && catA === catB) {
    score += 25;
    evidence.push(`Identical civic category: ${reportA.category || 'Same'}`);
  } else if (
    catA && catB &&
    RELATED_CATEGORIES[catA]?.includes(catB)
  ) {
    score += 15;
    evidence.push(`Related municipal categories: ${catA} & ${catB}`);
  }

  // 2. Location Similarity (Weight: 30 points)
  const dist = calculateDistanceMeters(
    reportA.latitude,
    reportA.longitude,
    reportB.latitude,
    reportB.longitude
  );

  if (dist !== null) {
    if (dist <= 250) {
      score += 30;
      evidence.push(`Geospatial match: within ${Math.round(dist)}m radius`);
    } else if (dist <= 600) {
      score += 24;
      evidence.push(`Geospatial proximity: ${Math.round(dist)}m distance`);
    } else if (dist <= 1500) {
      score += 15;
      evidence.push(`Same neighborhood area (~${(dist / 1000).toFixed(1)}km away)`);
    } else if (dist <= 3000) {
      score += 8;
      evidence.push(`Within 3km municipal ward boundary`);
    }
  } else {
    // Fallback: area text similarity if GPS is unavailable
    const locA = (reportA.locationStatus || '').toLowerCase();
    const locB = (reportB.locationStatus || '').toLowerCase();
    if (locA && locB && locA !== 'location will be detected here' && locA === locB) {
      score += 18;
      evidence.push('Same reported location area');
    }
  }

  // 3. Time Proximity (Weight: 20 points)
  const timeA = getTimestampMillis(reportA.createdAt);
  const timeB = getTimestampMillis(reportB.createdAt);
  const hoursDiff = Math.abs(timeA - timeB) / (1000 * 60 * 60);

  if (hoursDiff <= 6) {
    score += 20;
    evidence.push(`Reported within ${Math.max(1, Math.round(hoursDiff))}h of each other`);
  } else if (hoursDiff <= 24) {
    score += 16;
    evidence.push(`Reported on the same day (~${Math.round(hoursDiff)}h difference)`);
  } else if (hoursDiff <= 72) {
    score += 10;
    evidence.push(`Reported within 3 days (${Math.round(hoursDiff / 24)} days difference)`);
  } else if (hoursDiff <= 168) {
    score += 5;
    evidence.push(`Reported within the same week`);
  }

  // 4. Description & Text Similarity (Weight: 25 points)
  const tokensA = extractKeywords(reportA.description);
  const tokensB = extractKeywords(reportB.description);
  const textSim = calculateTextSimilarity(tokensA, tokensB);

  const sharedTokens = tokensA.filter((t) => tokensB.includes(t));

  if (textSim >= 0.35 || sharedTokens.length >= 3) {
    score += 25;
    evidence.push(
      `High textual overlap on issue descriptors: "${sharedTokens.slice(0, 3).join(', ')}"`
    );
  } else if (textSim >= 0.18 || sharedTokens.length >= 2) {
    score += 18;
    evidence.push(
      `Shared problem indicators: "${sharedTokens.slice(0, 2).join(', ')}"`
    );
  } else if (sharedTokens.length >= 1) {
    score += 10;
    evidence.push(`Common issue keyword: "${sharedTokens[0]}"`);
  }

  return {
    score: Math.min(100, Math.round(score)),
    evidence,
  };
}

/**
 * Runs incident fusion analysis on a newly submitted report against existing reports.
 *
 * @param {Object} currentReport - The report being analyzed (docId, reportId, description, category, latitude, longitude, createdAt)
 * @returns {Promise<Object>} Incident fusion payload conforming to Stage 5 schema
 */
async function performIncidentFusion(currentReport) {
  try {
    // 1. Fetch existing candidate reports from Firestore
    const reportsCol = collection(db, 'reports');
    const snapshot = await getDocs(query(reportsCol, limit(50)));

    const candidateMatches = [];

    snapshot.forEach((docSnap) => {
      const docData = docSnap.data();
      // Skip the report itself and probe tests
      if (
        docSnap.id === currentReport.docId ||
        docData.reportId === currentReport.reportId ||
        docSnap.id.includes('probe') ||
        (docData.reportId && docData.reportId.includes('PROBE'))
      ) {
        return;
      }

      const comparison = compareReports(currentReport, {
        docId: docSnap.id,
        ...docData,
      });

      if (comparison.score >= 50) {
        candidateMatches.push({
          docId: docSnap.id,
          reportId: docData.reportId || `#${docSnap.id.slice(0, 8)}`,
          score: comparison.score,
          evidence: comparison.evidence,
        });
      }
    });

    // Sort candidates by match score descending
    candidateMatches.sort((a, b) => b.score - a.score);

    // If no candidate reached fusion threshold
    if (candidateMatches.length === 0) {
      return {
        relatedReportIds: [],
        fusionConfidence: 0,
        fusionStatus: 'Separate incident',
        evidence: ['No overlapping civic reports detected in this area or timeframe.'],
        clusterId: currentReport.reportId ? `INC-${currentReport.reportId}` : `INC-${currentReport.docId}`,
        analyzedAt: new Date().toISOString(),
      };
    }

    const topMatch = candidateMatches[0];
    const highestScore = topMatch.score;

    // Rules:
    // 90–100 -> "High confidence related"
    // 60–89  -> "Officer review"
    // below 60 -> "Separate incident"
    let fusionStatus = 'Separate incident';
    if (highestScore >= 90) {
      fusionStatus = 'High confidence related';
    } else if (highestScore >= 60) {
      fusionStatus = 'Officer review';
    }

    const relatedReportIds = candidateMatches
      .filter((m) => m.score >= 60)
      .map((m) => m.reportId);

    // Collect consolidated evidence
    const consolidatedEvidence = highestScore >= 60
      ? topMatch.evidence
      : ['No overlapping civic reports detected above relationship threshold.'];

    // Stable cluster ID linking related reports (derived from earliest/top match)
    const clusterId = highestScore >= 60
      ? `INC-${topMatch.reportId.replace(/^SS-/, '')}`
      : (currentReport.reportId ? `INC-${currentReport.reportId}` : `INC-${currentReport.docId}`);

    return {
      relatedReportIds: highestScore >= 60 ? relatedReportIds : [],
      fusionConfidence: highestScore,
      fusionStatus,
      evidence: consolidatedEvidence,
      clusterId,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Incident Fusion] Analysis error:', error.message);
    // Graceful fallback keeping report safe
    return {
      relatedReportIds: [],
      fusionConfidence: 0,
      fusionStatus: 'Separate incident',
      evidence: ['Incident fusion analysis could not be completed at this time.'],
      clusterId: currentReport.reportId ? `INC-${currentReport.reportId}` : `INC-${currentReport.docId}`,
      analyzedAt: new Date().toISOString(),
    };
  }
}

module.exports = {
  performIncidentFusion,
  compareReports,
};
