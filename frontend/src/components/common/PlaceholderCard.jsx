import React from 'react';
import { Sparkles } from 'lucide-react';

export default function PlaceholderCard({
  icon: Icon,
  title,
  description,
  plannedFeatures = [],
  nextStageNote = 'Ready for data model & service binding in subsequent stages.',
}) {
  return (
    <div className="placeholder-container animate-fade-in">
      <div className="stage-notice-banner">
        <div className="stage-notice-left">
          <div className="stage-notice-icon">
            <Sparkles size={20} />
          </div>
          <div className="stage-notice-text">
            <h4>Stage 1: Architecture Foundation</h4>
            <p>{nextStageNote}</p>
          </div>
        </div>
        <span className="badge badge-ai">Component Layout Ready</span>
      </div>

      <div className="blueprint-card">
        {Icon && (
          <div className="blueprint-icon-circle">
            <Icon size={30} strokeWidth={2} />
          </div>
        )}
        <h3 className="blueprint-title">{title}</h3>
        <p className="blueprint-desc">{description}</p>

        {plannedFeatures.length > 0 && (
          <div className="blueprint-slots-grid">
            {plannedFeatures.map((slot, index) => (
              <div key={index} className="slot-item">
                <div className="slot-label">Slot {index + 1}</div>
                <div className="slot-name">{slot.title}</div>
                <p className="slot-desc">{slot.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
