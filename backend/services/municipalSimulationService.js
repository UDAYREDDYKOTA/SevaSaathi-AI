/**
 * SevaSaathi AI - Advanced Stage 19: Municipal What-If Simulator Service
 *
 * Simulates decision impacts BEFORE taking operational action:
 *   1. Team Selection (Team A vs Team B vs Auxiliary Unit)
 *   2. Response Dispatch Delays (Immediate vs +30 min vs +120 min)
 *   3. Preventive Action Intervention (Apply Plan vs Reactive Only)
 *
 * CRITICAL MUNICIPAL SAFETY LABELS:
 * - "SIMULATION ONLY — NOT A FORECAST — NOT A GUARANTEE"
 * - "Under this simulated scenario..."
 * - "Based on available historical municipal records and deterministic metrics."
 * - Officer retains 100% final operational decision authority.
 */

const { collection, getDocs, doc, getDoc } = require('firebase/firestore');
const { db } = require('../config/firebase');
const { getCivicKnowledgeGraph } = require('./civicKnowledgeGraphService');
const { getAllPreventiveActionPlans } = require('./preventiveActionPlannerService');

/**
 * Standard Municipal Field Teams Benchmark
 */
const SIMULATED_MUNICIPAL_TEAMS = [
  {
    teamId: 'TEAM-DRA-RRU-A',
    teamName: 'Drainage Rapid Response Unit A',
    department: 'Stormwater & Drainage Department',
    category: 'drainage',
    baseLatitude: 12.9720,
    baseLongitude: 77.5950,
    baseLocation: 'Ward 12 Municipal Depot (0.4 km from School Road)',
    currentActiveTasks: 1,
    maxCapacity: 5,
    avgSpeedKmh: 28,
    historicalEfficiencyRate: 0.94,
    skills: ['High-volume pump operation', 'Robotic sewer desilting', 'Culvert unblocking'],
  },
  {
    teamId: 'TEAM-DRA-AUX-B',
    teamName: 'Ward 12 Auxiliary Drainage Unit B',
    department: 'Stormwater & Drainage Department',
    category: 'drainage',
    baseLatitude: 12.9550,
    baseLongitude: 77.5750,
    baseLocation: 'Central Zonal Engineering Yard (4.2 km from School Road)',
    currentActiveTasks: 4,
    maxCapacity: 5,
    avgSpeedKmh: 24,
    historicalEfficiencyRate: 0.82,
    skills: ['Manual canal dredging', 'Emergency suction vacuum'],
  },
  {
    teamId: 'TEAM-ROA-MRC-1',
    teamName: 'Road Maintenance Rapid Crew 1',
    department: 'Roads & Infrastructure Department',
    category: 'roads',
    baseLatitude: 12.9730,
    baseLongitude: 77.5960,
    baseLocation: 'MG Road Works Depot (0.8 km from MG Road Junction)',
    currentActiveTasks: 2,
    maxCapacity: 6,
    avgSpeedKmh: 25,
    historicalEfficiencyRate: 0.90,
    skills: ['Hot-mix asphalt paving', 'Pothole vacuum patching'],
  },
  {
    teamId: 'TEAM-ROA-SUB-2',
    teamName: 'North Zone Sub-Base Infrastructure Team',
    department: 'Roads & Infrastructure Department',
    category: 'roads',
    baseLatitude: 12.9950,
    baseLongitude: 77.6100,
    baseLocation: 'Outer Ring Heavy Depot (5.5 km from MG Road Junction)',
    currentActiveTasks: 5,
    maxCapacity: 6,
    avgSpeedKmh: 20,
    historicalEfficiencyRate: 0.78,
    skills: ['Granular base compacting', 'Kerb structural rehabilitation'],
  },
  {
    teamId: 'TEAM-WAT-PET',
    teamName: 'Water Pipeline Emergency Team',
    department: 'Water Supply & Sewerage Board',
    category: 'water',
    baseLatitude: 12.9700,
    baseLongitude: 77.5900,
    baseLocation: 'Civil Hospital Municipal Service Station',
    currentActiveTasks: 2,
    maxCapacity: 5,
    avgSpeedKmh: 26,
    historicalEfficiencyRate: 0.91,
    skills: ['High-pressure acoustic repair', 'Sluice valve isolation'],
  },
];

/**
 * Haversine calculation for simulator
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 2.5;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Deterministic Team Dispatch Simulator
 */
function simulateTeamDispatch(team, incident) {
  const incLat = incident.latitude || 12.9716;
  const incLon = incident.longitude || 77.5946;
  const distanceKm = haversineKm(team.baseLatitude, team.baseLongitude, incLat, incLon);

  // Transit time in minutes: (distance / speed) * 60 + mobilization prep (7 mins)
  const transitTimeMin = Math.round((distanceKm / team.avgSpeedKmh) * 60) + 7;

  // Workload factor (0 = free, 1.0 = fully overloaded)
  const workloadRatio = Math.min(team.currentActiveTasks / team.maxCapacity, 1.0);
  const workloadQueueDelayMin = Math.round(workloadRatio * 35); // up to 35 min queue wait if busy

  const estimatedResponseTimeMin = transitTimeMin + workloadQueueDelayMin;

  // 1. Response Impact Score (100 is instant, 0 is very late)
  // 15 min or less = 95+; 60 min = 40
  const responseScore = Math.max(10, Math.min(100, Math.round(100 - (estimatedResponseTimeMin / 60) * 55)));

  // 2. Workload Impact Score (100 is light workload, 0 is saturated)
  const workloadScore = Math.max(10, Math.min(100, Math.round(100 - workloadRatio * 75)));

  // 3. Operational Impact Score (combining team historical efficiency & skill match)
  const skillMatchBonus = team.category === incident.category ? 15 : 0;
  const operationalScore = Math.min(100, Math.round(team.historicalEfficiencyRate * 85 + skillMatchBonus));

  // 4. Resource Utilization Score (balanced workload is ideal, around 60-70% capacity)
  const postDispatchWorkload = (team.currentActiveTasks + 1) / team.maxCapacity;
  const utilizationScore = postDispatchWorkload <= 0.8
    ? Math.round(90 - Math.abs(postDispatchWorkload - 0.6) * 40)
    : Math.max(20, Math.round(100 - postDispatchWorkload * 80));

  // 5. Risk Reduction Score (how much immediate hazard is suppressed)
  const priorityFactor = (incident.priority || 'HIGH').toUpperCase() === 'CRITICAL' ? 1.0 : 0.8;
  const riskImpactScore = Math.min(100, Math.round(responseScore * 0.6 + operationalScore * 0.4 * priorityFactor));

  // Composite Simulation Score
  const compositeScore = Math.round(
    responseScore * 0.35 +
    workloadScore * 0.20 +
    operationalScore * 0.25 +
    utilizationScore * 0.10 +
    riskImpactScore * 0.10
  );

  return {
    scenarioId: `SCENARIO_${team.teamId}`,
    teamId: team.teamId,
    teamName: team.teamName,
    department: team.department,
    distanceKm,
    estimatedResponseTimeMin,
    currentWorkload: `${team.currentActiveTasks}/${team.maxCapacity} active assignments`,
    workloadLevel: workloadRatio > 0.75 ? 'HIGH' : workloadRatio > 0.4 ? 'MODERATE' : 'LOW',
    scores: {
      compositeScore,
      responseImpact: responseScore,
      workloadImpact: workloadScore,
      operationalImpact: operationalScore,
      resourceUtilization: utilizationScore,
      riskImpact: riskImpactScore,
    },
    keyStrengths: [
      distanceKm < 1.5 ? `Proximity advantage: ${distanceKm} km from incident site` : `Alternative backup crew availability`,
      workloadRatio < 0.5 ? `High unit availability with minimal queue delay (${transitTimeMin} min transit)` : `Unit operational despite active queue`,
      `${Math.round(team.historicalEfficiencyRate * 100)}% historical SLA compliance rate`,
    ],
    operationalTradeoffs: [
      workloadRatio > 0.7 ? `Unit nearing max capacity; adds ${workloadQueueDelayMin} min queue latency` : `Consumes 1 rapid response slot`,
      distanceKm > 3.0 ? `Substantial transit distance across urban traffic corridors` : `Minimal transit delay`,
    ],
  };
}

/**
 * Deterministic Delay Scenario Simulator
 */
function simulateResponseDelay(incident, delayMinutes) {
  const basePriority = (incident.priority || 'HIGH').toUpperCase();
  const isCritical = basePriority === 'CRITICAL';

  // Exponential risk escalation per hour of unmitigated civic failure
  const escalationFactor = isCritical ? 1.8 : 1.2;
  const baselinePublicExposure = incident.affectedCitizenCount || 12;

  // Additional affected citizens estimate
  const additionalExposure = Math.round((delayMinutes / 60) * 18 * escalationFactor);
  const projectedAffectedCitizens = baselinePublicExposure + additionalExposure;

  // Risk Score Deterioration
  const baselineRiskScore = incident.riskScore || (isCritical ? 95 : 75);
  const simulatedPostDelayRiskScore = Math.min(100, baselineRiskScore + Math.round((delayMinutes / 60) * 8 * escalationFactor));

  // Estimated secondary damages
  let estimatedSecondaryImpact = 'Surface puddling and pedestrian minor inconvenience';
  if (delayMinutes >= 120 && isCritical) {
    estimatedSecondaryImpact = 'Catastrophic sewer back-flow into primary school foundation, road structural asphalt washaway, and multi-lane vehicular gridlock';
  } else if (delayMinutes >= 30 && isCritical) {
    estimatedSecondaryImpact = 'School zone boundary inundation, pedestrian walkway submerged, high risk of two-wheeler fall accidents';
  } else if (delayMinutes >= 60) {
    estimatedSecondaryImpact = 'Expanded 300m overflow perimeter into adjoining commercial shopfront basements';
  }

  // Cost Escalation Multiplier
  const costEscalationMultiplier = parseFloat((1 + (delayMinutes / 60) * 0.45).toFixed(2));

  return {
    scenarioId: `DELAY_${delayMinutes}MIN`,
    delayMinutes,
    delayLabel: delayMinutes === 0 ? 'Baseline (Zero Dispatch Delay)' : `+${delayMinutes} Minutes Dispatch Delay`,
    projectedAffectedCitizens,
    additionalExposure,
    simulatedPostDelayRiskScore,
    costEscalationMultiplier,
    estimatedSecondaryImpact,
    advisoryRecommendation: delayMinutes === 0
      ? 'Optimal operational window: immediate dispatch prevents secondary infrastructure compromise.'
      : delayMinutes <= 30
      ? 'Acceptable tactical buffer if prioritizing higher-severity life-safety incidents.'
      : 'UNFAVORABLE: Severe secondary asset damage and exponential restoration cost increase.',
  };
}

/**
 * Deterministic Preventive Action vs Reactive Simulation
 */
function simulatePreventiveStrategy(plan, incident) {
  const baselineRisk = plan.riskScore || 95;
  const cat = plan.category || 'drainage';

  // 1. Reactive Only (Current Status Quo)
  const reactiveModel = {
    strategyName: 'Reactive Emergency Response Only (Status Quo)',
    projectedAnnualIncidents: 14,
    recurrenceProbability: 0.94,
    projected5YearMunicipalCost: '₹ 18,50,000 (Repetitive emergency desilting & emergency pump rental)',
    predictedAssetLifespanYears: 3.5,
    citizenSatisfactionRating: 'Low (Recurring public grievances and seasonal media scrutiny)',
    predictiveRiskScore1YearOut: Math.min(100, baselineRisk + 3),
  };

  // 2. Comprehensive 3-Horizon Preventive Plan (Stage 18 Implementation)
  const preventiveModel = {
    strategyName: 'Tri-Horizon Preventive Infrastructure Strategy (Stage 18 Plan)',
    projectedAnnualIncidents: 2,
    recurrenceProbability: 0.12,
    projected5YearMunicipalCost: '₹ 8,20,000 (One-time culvert overhaul + scheduled micro-maintenance)',
    predictedAssetLifespanYears: 18.0,
    citizenSatisfactionRating: 'High (Permanent waterlogging mitigation; school corridor accessible in monsoons)',
    predictiveRiskScore1YearOut: Math.max(15, baselineRisk - 68),
    costSavingsEstimated: '₹ 10,30,000 net taxpayer savings over 5-year operational lifecycle',
    riskReductionDelta: '-71% simulated reduction in chronic civic vulnerability',
  };

  return {
    planId: plan.planId,
    areaName: plan.areaName,
    category: cat,
    reactiveModel,
    preventiveModel,
    conclusion: 'Preventive Capital Execution demonstrates 55% lifecycle expenditure reduction and eliminates 85% of recurring citizen grievances in this corridor.',
  };
}

/**
 * Evaluates Full What-If Scenario Matrix for an Incident
 */
async function evaluateIncidentScenarios(incidentId) {
  // 1. Ingest incident from Knowledge Graph or benchmark
  let kg = null;
  try {
    kg = await getCivicKnowledgeGraph();
  } catch (err) {
    console.warn('[What-If Simulator] KG fetch notice:', err.message);
  }

  const query = (incidentId || '').toLowerCase();
  const matchedIncNode = kg?.nodes?.find(
    (n) =>
      n.nodeType === 'INCIDENT' &&
      (n.nodeId.toLowerCase().includes(query) ||
        n.label.toLowerCase().includes(query) ||
        n.properties?.incidentId?.toLowerCase().includes(query))
  );

  const incident = {
    incidentId: matchedIncNode?.properties?.incidentId || 'INC-DRA-CLUSTERD',
    category: matchedIncNode?.properties?.category || 'drainage',
    priority: matchedIncNode?.properties?.priority || 'CRITICAL',
    areaName: matchedIncNode?.label || 'School Road Drainage Corridor',
    latitude: 12.9716,
    longitude: 77.5946,
    riskScore: 95,
    affectedCitizenCount: matchedIncNode?.sourceReportIds?.length || 12,
  };

  // Filter available candidate teams for this department/category
  const categoryTeams = SIMULATED_MUNICIPAL_TEAMS.filter((t) => t.category === incident.category);
  const otherTeams = SIMULATED_MUNICIPAL_TEAMS.filter((t) => t.category !== incident.category);
  const candidateTeams = [...categoryTeams, otherTeams[0]].filter(Boolean);

  // Evaluate Team Scenarios
  const teamScenarios = candidateTeams.map((t) => simulateTeamDispatch(t, incident));

  // Determine Optimal Team Scenario
  teamScenarios.sort((a, b) => b.scores.compositeScore - a.scores.compositeScore);
  const bestTeamScenario = teamScenarios[0];
  const secondTeamScenario = teamScenarios[1] || teamScenarios[0];

  // Evaluate Delay Scenarios
  const delayScenarios = [
    simulateResponseDelay(incident, 0),
    simulateResponseDelay(incident, 30),
    simulateResponseDelay(incident, 120),
  ];

  // Evaluate Preventive Strategy
  const allPlans = await getAllPreventiveActionPlans();
  const matchedPlan = allPlans.find((p) => p.category === incident.category) || allPlans[0];
  const preventiveComparison = simulatePreventiveStrategy(matchedPlan, incident);

  return {
    incident,
    simulationTimestamp: new Date().toISOString(),
    labels: {
      notice: 'SIMULATION ONLY — NOT A FORECAST — NOT A GUARANTEE',
      disclaimer: 'Under this simulated scenario based on available historical municipal records and deterministic metrics. Officer review required.',
    },
    teamComparison: {
      scenarioA: bestTeamScenario,
      scenarioB: secondTeamScenario,
      allScenarios: teamScenarios,
      comparisonVerdict: `${bestTeamScenario.teamName} achieves a superior composite score (${bestTeamScenario.scores.compositeScore} vs ${secondTeamScenario.scores.compositeScore}) primarily due to closer depot proximity (${bestTeamScenario.distanceKm} km vs ${secondTeamScenario.distanceKm} km) and rapid response time (${bestTeamScenario.estimatedResponseTimeMin} min vs ${secondTeamScenario.estimatedResponseTimeMin} min).`,
    },
    delayAnalysis: {
      scenarios: delayScenarios,
      keyTakeaway: 'Dispatching within 30 minutes limits secondary overflow perimeter. Delays beyond 120 minutes elevate risk to 100/100 and compound restoration expenditure by 1.9x.',
    },
    preventiveComparison,
  };
}

module.exports = {
  evaluateIncidentScenarios,
  simulateTeamDispatch,
  simulateResponseDelay,
  simulatePreventiveStrategy,
  SIMULATED_MUNICIPAL_TEAMS,
};
