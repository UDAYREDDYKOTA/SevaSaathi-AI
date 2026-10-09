export const ROLES = {
  CITIZEN: 'citizen',
  OFFICER: 'officer',
  FIELD_WORKER: 'field_worker',
  ADMIN: 'admin',
};

export const ROLE_DETAILS = {
  [ROLES.CITIZEN]: {
    id: ROLES.CITIZEN,
    name: 'Citizen',
    user: 'demo-citizen',
    label: 'Public Citizen',
    permissions: ['Create own reports', 'Read own reports', 'View nearby issues'],
    color: '#2563eb',
  },
  [ROLES.OFFICER]: {
    id: ROLES.OFFICER,
    name: 'Municipal Officer',
    user: 'demo-officer',
    label: 'Command Center Officer',
    permissions: ['Triage priority', 'Approve/reject resources', 'Confirm resolution', 'Review AI analysis'],
    color: '#0e7490',
  },
  [ROLES.FIELD_WORKER]: {
    id: ROLES.FIELD_WORKER,
    name: 'Field Operative',
    user: 'Ramesh Kumar (Unit A)',
    label: 'Field Response Worker',
    permissions: ['Accept assigned jobs', 'Log repair start', 'Submit before/after evidence', 'Mark resolved'],
    color: '#d97706',
  },
  [ROLES.ADMIN]: {
    id: ROLES.ADMIN,
    name: 'Municipal Admin',
    user: 'admin-console',
    label: 'System Administrator',
    permissions: ['Manage teams', 'Audit system trails', 'System settings', 'Access civic memory'],
    color: '#7c3aed',
  },
};
