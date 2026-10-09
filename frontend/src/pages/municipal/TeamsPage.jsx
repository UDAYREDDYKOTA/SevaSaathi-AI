import React from 'react';
import { Users2 } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function TeamsPage() {
  return (
    <div className="municipal-page">
      <div className="module-header">
        <div className="module-title-wrap">
          <div className="module-pretitle">
            <Users2 size={16} />
            <span>Field Workforce</span>
          </div>
          <h1 className="module-title">Teams Management</h1>
          <p className="module-description">
            Organize field crews, municipal engineering divisions, and contractor squads. Monitor task allocations and track active on-ground deployment.
          </p>
        </div>
      </div>

      <PlaceholderCard
        icon={Users2}
        title="Municipal Workforce & Field Squad Directory"
        description="Layout placeholder for departmental roster management, crew task assignments, and real-time field status."
        nextStageNote="Personnel directory, crew assignment dispatch, and role permissions will be activated in upcoming stages."
        plannedFeatures={[
          {
            title: 'Department Crew Roster Slot',
            description: 'Listing of field units across Sanitation, Roads, Electricity, Water & Sewerage, and Greenery.',
          },
          {
            title: 'Crew Availability & Shift Status',
            description: 'Real-time duty availability and assigned task load for each operational squad.',
          },
          {
            title: 'Vehicle & Equipment Inventory Slot',
            description: 'Tracking allocation of municipal repair vehicles, machinery, and replacement parts.',
          },
          {
            title: 'Field Resolution Audit Logs',
            description: 'Historical performance records, resolution turnarounds, and safety compliance logs.',
          },
        ]}
      />
    </div>
  );
}
