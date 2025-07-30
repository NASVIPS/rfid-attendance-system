// rfid-attendance-system/apps/frontend/src/components/PageHeader.jsx
import React from 'react';

// Logos are no longer needed in PageHeader as main-header-section is removed
// import vipsLogo from '/vips-logo.webp';
// import emblemLogo from '/emblem.webp';

// PageHeader component for consistent top section across dashboards
export default function PageHeader({ dashboardTitle }) {
  return (
    <>
      {/* Top Header Bar (Keep this one) */}
      <div className="top-header-bar">
        <span>{dashboardTitle}</span> {/* Use dashboardTitle prop for flexibility */}
      </div>

      {/* REMOVED: Main Header Section (logos, institute titles) */}
      {/* This entire div block is removed:
      <div className="main-header-section">
        <div className="header-left">
          <img src={vipsLogo} alt="VIPS Logo" className="vips-logo" />
        </div>
        <div className="header-center">
          <h1 className="main-title">Vivekananda Institute of Professional Studies - Technical Campus</h1>
          <p className="accreditation-text">Approved by AICTE, Accredited Grade 'A++' Institution by NAAC, NBA Accredited, Recognized under Section 2(f) by UGC, Affiliated to GGSIP University, Recognized by Bar Council of India, ISO 9001:2015 Certified</p>
          <p className="school-title">Vivekananda School of Information Technology</p>
        </div>
        <div className="header-right">
          <img src={emblemLogo} alt="Emblem Logo" className="emblem-logo" />
        </div>
      </div>
      */}
    </>
  );
}