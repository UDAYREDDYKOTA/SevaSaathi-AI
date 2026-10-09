import React from 'react';
import { MapPin } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function NearbyPage() {
  return (
    <div className="citizen-page">
      <div className="module-header">
        <div className="module-title-wrap">
          <div className="module-pretitle">
            <MapPin size={16} />
            <span>Community Map & Ward Feed</span>
          </div>
          <h1 className="module-title">Nearby Civic Issues</h1>
          <p className="module-description">
            Discover ongoing infrastructure improvements, community-reported issues,
            and municipal initiatives in your immediate neighborhood.
          </p>
        </div>
      </div>

      <PlaceholderCard
        icon={MapPin}
        title="Geospatial Community Explorer"
        description="Layout placeholder for the civic map and community feed showing nearby reported issues to avoid duplicate submissions."
        nextStageNote="Integration with map visualization and geospatial bounding queries scheduled for upcoming stages."
        plannedFeatures={[
          {
            title: 'Civic GIS Map Viewport Slot',
            description: 'Interactive map container showing pins for active work orders, road repairs, and open tickets.',
          },
          {
            title: 'Proximity Radius Filter',
            description: 'Distance selector (500m, 1km, 5km) to view hyper-local neighborhood civic events.',
          },
          {
            title: 'Community Verification & Upvote Slot',
            description: 'Allow nearby citizens to endorse existing reports to increase administrative priority.',
          },
          {
            title: 'Ward Project Notice Board',
            description: 'Status updates on scheduled municipal projects like pipeline maintenance and resurfacing.',
          },
        ]}
      />
    </div>
  );
}
