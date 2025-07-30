// rfid-attendance-system/apps/frontend/src/App.jsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login.jsx';
import AttendanceBoard from './pages/AttendanceBoard.jsx';
import PCoordinatorDashboard from './pages/PCoordinatorDashboard.jsx';
// Placeholder Dashboard Components (as defined before)
const AdminDashboard = () => <div className="text-center p-4"><h2>Admin Dashboard - Welcome!</h2><p>You are logged in as an ADMIN.</p><button className="mt-4 px-4 py-2 bg-red-500 text-white rounded" onClick={useAuth().logout}>Logout</button></div>;
const ProgramCoordinatorDashboard = () => <div className="text-center p-4"><h2>Program Coordinator Dashboard - Welcome!</h2><p>You are logged in as a PROGRAM COORDINATOR.</p><button className="mt-4 px-4 py-2 bg-red-500 text-white rounded" onClick={useAuth().logout}>Logout</button></div>;
const ForbiddenPage = () => <div className="text-center p-4 text-red-600"><h2>Access Denied</h2><p>You do not have the necessary permissions to view this page.</p><button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded" onClick={useAuth().logout}>Logout</button></div>;
const NotFoundPage = () => <div className="text-center p-4"><h2>404 - Page Not Found</h2><p>The page you are looking for does not exist.</p><Link to="/" className="text-blue-600 hover:underline mt-4 block">Go Home</Link></div>;

// NEW: Import AttendanceBoard
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import TeacherReportPage from './pages/TeacherReportPage.jsx';
import FacultyStudentsPage from './pages/FacultyStudentsPage.jsx';
import CoursesSubjectsPage from './pages/CoursesSubjectsPage.jsx';
import AttendanceReportsPage from './pages/AttendanceReportsPage.jsx';
import TimetableSchedulesPage from './pages/TimetableSchedulesPage.jsx';
function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/test-backend" element={<TestBackend />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* Protected Routes (using ProtectedRoute component) */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'TEACHER', 'PCOORD']} />}>
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
           <Route path="/program-coordinator-dashboard" element={<PCoordinatorDashboard />} />
          {/* NEW: Route for AttendanceBoard */}
          <Route path="/attendance-board/:sessionId" element={<AttendanceBoard />} />
<Route path="/teacher/report/:subjectId/:sectionId" element={<TeacherReportPage />} />
                    <Route path="/pc/faculty-students" element={<FacultyStudentsPage />} />
          <Route path="/pc/courses-subjects" element={<CoursesSubjectsPage />} />
           <Route path="/pc/attendance-reports" element={<AttendanceReportsPage />} />
            <Route path="/pc/timetable-schedules" element={<TimetableSchedulesPage />} />
          

        </Route>

        {/* Catch-all for undefined routes */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

// Home and TestBackend components remain as defined before
function Home() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="text-center">
      <h2 className="text-2xl font-semibold mb-4">Welcome to RFID Attendance System!</h2>
      {!isAuthenticated ? (
        <p className="text-gray-700">Please <Link to="/login" className="text-blue-600 hover:underline">login</Link> to access dashboards.</p>
      ) : (
        <div className="mt-4">
          <p className="text-lg text-gray-800">Hello, {user?.email} ({user?.role})!</p>
          <nav className="mt-4">
            <ul className="flex justify-center space-x-4">
              {user?.role === 'ADMIN' && <li><Link to="/admin-dashboard" className="text-blue-600 hover:underline">Admin Dashboard</Link></li>}
              {user?.role === 'TEACHER' && <li><Link to="/teacher-dashboard" className="text-blue-600 hover:underline">Teacher Dashboard</Link></li>}
              {user?.role === 'PCOORD' && <li><Link to="/program-coordinator-dashboard" className="text-blue-600 hover:underline">Program Coordinator Dashboard</Link></li>}
              {/* Optional: Link to a test session for attendance board */}
              <li><Link to="/attendance-board/1" className="text-blue-600 hover:underline">Test Session 1 Board</Link></li>
              <li><button onClick={logout} className="text-red-600 hover:underline">Logout</button></li>
            </ul>
          </nav>
        </div>
      )}
      <div className="mt-6">
        <Link to="/test-backend" className="text-blue-600 hover:underline">Test Backend Connectivity</Link>
      </div>
    </div>
  );
}

import axios from 'axios';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

function TestBackend() {
  const [backendStatus, setBackendStatus] = useState('Checking...');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/health`);
        setBackendStatus(response.data.status);
        toast.success('Backend connected successfully!');
      } catch (error) {
        console.error('Error connecting to backend:', error);
        setBackendStatus('Disconnected');
        toast.error(`Backend connection failed: ${error.message}`);
      }
    };
    checkBackend();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Backend Connectivity Test</h2>
      <p className="text-gray-700">Status: <span className={`font-bold ${backendStatus === 'Backend is healthy' ? 'text-green-600' : 'text-red-600'}`}>{backendStatus}</span></p>
      <p className="text-sm text-gray-500 mt-2">Checking if your frontend can reach the backend health endpoint.</p>
      <Link to="/" className="text-blue-600 hover:underline mt-4 block">Go Home</Link>
    </div>
  );
}

export default App;