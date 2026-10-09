import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

const CURRENT_YEAR = 2026;

export default function Footer() {
  return (
    <footer className="global-footer">
      <div className="footer-inner">
        <div className="footer-copy">
          &copy; {CURRENT_YEAR} <strong>SevaSaathi AI</strong> — AI-Powered Municipal Civic Intelligence Platform.
        </div>
        <div className="footer-links">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} color="#0891b2" /> Stage 1: Core Architecture
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#2563eb" /> Verified Civic Standard
          </span>
        </div>
      </div>
    </footer>
  );
}
