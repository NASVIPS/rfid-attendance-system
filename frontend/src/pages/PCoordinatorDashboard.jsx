// rfid-attendance-system/apps/frontend/src/pages/PCoordinatorDashboard.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader.jsx';
import { useNavigate } from 'react-router-dom';
import './pCoordinatorDashboard.css'; // Import dedicated CSS

// Main PCoordinatorDashboard component - This is the high-level navigation hub
function PCoordinatorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="pcoord-dashboard-page-container">
      <PageHeader dashboardTitle="PROGRAM COORDINATOR DASHBOARD" />

      <div className="pcoord-dashboard-main-content">
        <div className="dashboard-header-row">
          <h1 className="dashboard-title">Program Coordinator Dashboard</h1>
          <div className="user-info-logout-group">
            <span className="text-gray-700">Logged in as: <span className="font-semibold">{user?.email} ({user?.role})</span></span>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>

        {/* Main Navigation Cards/Buttons */}
        <div className="main-nav-cards-grid">
            <button className="main-nav-card" onClick={() => navigate('/pc/faculty-students')}>
                <h2 className="card-title">Faculty & Students</h2>
                <p className="card-description">Manage faculty members and student records.</p>
            </button>

            <button className="main-nav-card" onClick={() => navigate('/pc/courses-subjects')}>
                <h2 className="card-title">Courses & Subjects</h2>
                <p className="card-description">Define and manage academic courses and subjects.</p>
            </button>

            <button className="main-nav-card" onClick={() => navigate('/pc/attendance-reports')}>
                <h2 className="card-title">Attendance Reports</h2>
                <p className="card-description">View and download comprehensive attendance records.</p>
            </button>

            <button className="main-nav-card" onClick={() => navigate('/pc/timetable-schedules')}>
                <h2 className="card-title">Timetable & Schedules</h2>
                <p className="card-description">Manage class timetables and faculty allotments.</p>
            </button>
        </div>

      </div>
    </div>
  );
}

export default PCoordinatorDashboard;