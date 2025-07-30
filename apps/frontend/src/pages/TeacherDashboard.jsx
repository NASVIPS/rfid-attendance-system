// src/pages/TeacherDashboard.jsx
import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import './teacherDashboard.css';


// Helper for DayOfWeek enum order (from backend for consistency, though not strictly needed here)
const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];


function TeacherDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null); // To track if a session is active
  const [activeSessionDetails, setActiveSessionDetails] = useState(null); // To store full details of active session

  // NEW: Use ref to track if active session toast has been shown for current active session
  const activeSessionToastShownRef = useRef(null);


  // State for attendance retrieval filters (these are for the separate report section, not directly related to session start)
  const [reportFilters, setReportFilters] = useState({
    subjectId: '',
    sectionId: '',
    date: new Date().toISOString().slice(0, 10), // Default to today's date (YYYY-MM-DD)
  });
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // All subjects, sections (for dropdowns, fetched only once or as needed)
  const [allSubjects, setAllSubjects] = useState([]);
  const [allSections, setAllSections] = useState([]);


  // Function to fetch teacher's classes and determine active session
  const fetchTeacherClasses = async () => {
    if (!user || !user.facultyId) {
      setLoading(false);
      toast.error("User is not associated with a faculty profile.");
      return;
    }
    try {
      // Fetch subject instances assigned to this teacher, including scheduled classes for today
      const response = await api.get(`/api/session/teacher-instances?facultyId=${user.facultyId}`);
      const classes = response.data;
      setTeacherClasses(classes);

      // Find if any of these classes has an active session for *this* teacher
      // The backend's getTeacherSubjectInstances now includes classSessions for each SubjectInstance
      const currentTeacherActiveSession = classes.reduce((foundSession, cls) => {
        if (foundSession) return foundSession;
        const activeSessionForThisClass = cls.classSessions.find(s => !s.isClosed && s.teacherId === user.facultyId);
        return activeSessionForThisClass;
      }, null);


      if (currentTeacherActiveSession) {
        // NEW: Only show toast if a NEW active session is detected, or if it wasn't shown for this session
        if (activeSessionToastShownRef.current !== currentTeacherActiveSession.id) {
            toast.success(`You have an active session for ${currentTeacherActiveSession.subjectInst?.subject?.name || 'your class'}!`);
            activeSessionToastShownRef.current = currentTeacherActiveSession.id;
        }
        setActiveSessionId(currentTeacherActiveSession.id);
        setActiveSessionDetails(currentTeacherActiveSession); // Store full details
      } else {
        setActiveSessionId(null);
        setActiveSessionDetails(null);
        activeSessionToastShownRef.current = null; // Reset ref if no active session
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching teacher classes:', error);
      toast.error(error.response?.data?.message || 'Failed to load teacher classes.');
      setLoading(false);
    }
  };

  // Function to fetch all subjects and sections for the report dropdowns
  const fetchDropdownData = async () => {
    try {
      const [subjectsRes, sectionsRes] = await Promise.all([
        api.get('/api/scheduled-classes/helpers/subjects'),
        api.get('/api/scheduled-classes/helpers/sections'),
      ]);
      setAllSubjects(subjectsRes.data);
      setAllSections(sectionsRes.data);
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      toast.error('Failed to load subject and section lists.');
    }
  };


  useEffect(() => {
    fetchTeacherClasses(); // Initial fetch of classes
    fetchDropdownData(); // Fetch data for report dropdowns

    // Set up WebSocket for real-time session updates
    const ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

    ws.onopen = () => console.log('WebSocket connected for Teacher Dashboard');
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'SESSION_STATUS_UPDATE') {
            // Check if the update is for a session relevant to this teacher
            if (message.session && message.session.teacherId === user.facultyId) {
                if (message.session.isClosed) {
                    setActiveSessionId(null);
                    setActiveSessionDetails(null);
                    activeSessionToastShownRef.current = null; // Reset ref
                    toast.success(`Session for ${message.session.subjectInst?.subject?.name || 'a class'} closed.`);
                } else {
                    setActiveSessionId(message.session.id);
                    setActiveSessionDetails(message.session);
                    if (activeSessionToastShownRef.current !== message.session.id) {
                        toast.success(`Session for ${message.session.subjectInst?.subject?.name || 'your class'} started!`);
                        activeSessionToastShownRef.current = message.session.id;
                    }
                }
                fetchTeacherClasses(); // Re-fetch all classes to update UI states
            }
        }
    };
    ws.onclose = () => console.log('WebSocket disconnected for Teacher Dashboard');
    ws.onerror = (err) => console.error('WebSocket error:', err);

    return () => {
        ws.close(); // Clean up WebSocket on component unmount
    };

  }, [user]); // Re-fetch if user (and thus facultyId) changes


  // Corrected handleStartSession to accept scheduledClassId
  const handleStartSession = async (scheduledClassId) => {
    if (activeSessionId) {
        toast.error("You already have an active session. Please close it before starting a new one.");
        return;
    }
    try {
      const response = await api.post('/api/session/start', {
        facultyId: user.facultyId, // Ensure facultyId is sent
        scheduledClassId: scheduledClassId // Pass the specific scheduledClassId from the button
      });
      const newSessionId = response.data.session.id;
      setActiveSessionId(newSessionId);
      setActiveSessionDetails(response.data.session); // Store details of the new active session
      activeSessionToastShownRef.current = newSessionId; // Mark toast as shown for this new session
      toast.success('Session started successfully! Redirecting to attendance board...');
      navigate(`/attendance-board/${newSessionId}`);
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error(error.response?.data?.message || 'Failed to start session.');
    }
  };

  const handleCloseSession = async () => {
    if (!activeSessionId) {
      toast.error("No active session to close.");
      return;
    }
    try {
      await api.post(`/api/session/close/${activeSessionId}`);
      setActiveSessionId(null);
      setActiveSessionDetails(null);
      activeSessionToastShownRef.current = null; // Reset ref as session is closed
      toast.success('Session closed successfully!');
      fetchTeacherClasses(); // Re-fetch classes to update button states etc.
    } catch (error) {
      console.error('Error closing session:', error);
      toast.error(error.response?.data?.message || 'Failed to close session.');
    }
  };

  const handleReportFilterChange = (e) => {
    const { name, value } = e.target;
    setReportFilters(prev => ({
      ...prev,
      [name]: name.includes('Id') ? (value ? parseInt(value) : '') : value,
    }));
    setAttendanceRecords([]);
  };

  const handleFetchAttendance = async (e) => {
    e.preventDefault();
    setReportLoading(true);
    try {
      const { subjectId, sectionId, date } = reportFilters;
      if (!subjectId || !sectionId || !date) {
        toast.error('Please select Subject, Section, and Date for the report.');
        setReportLoading(false);
        return;
      }

      const response = await api.get('/api/attendance/teacher-report', {
        params: { subjectId, sectionId, date },
      });
      setAttendanceRecords(response.data);
      if (response.data.length === 0) {
        toast('No attendance records found for selected criteria.', { icon: '🤔' });
      } else {
        toast.success('Attendance records fetched successfully!');
      }
    } catch (error) {
      console.error('Error fetching attendance report:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch attendance report.');
    } finally {
      setReportLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="teacher-dashboard-page">
        <PageHeader dashboardTitle="TEACHER DASHBOARD" />
        <div className="teacher-dashboard-container">
          <div className="text-center p-8">Loading Teacher Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard-page">
      <PageHeader dashboardTitle="TEACHER DASHBOARD" />

      <div className="teacher-dashboard-container">
        <div className="dashboard-header-row">
          <h1 className="dashboard-title">Teacher Dashboard</h1>
          <div className="user-info-logout-group">
            <span className="user-info">Logged in as: <span className="font-semibold">{user?.email} ({user?.role})</span></span>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>

        {activeSessionDetails ? (
          <div className="active-session-banner active">
            <p>Active session for: {activeSessionDetails.subjectInst?.subject?.name} ({activeSessionDetails.subjectInst?.section?.name})</p>
            <p>Started at: {new Date(activeSessionDetails.startAt).toLocaleTimeString()}</p>
            <div className="active-session-buttons">
              <Link to={`/attendance-board/${activeSessionDetails.id}`} className="link-button">
                Go to Live Attendance
              </Link>
              <button onClick={handleCloseSession} className="action-button">
                Close Active Session
              </button>
            </div>
          </div>
        ) : (
          <div className="active-session-banner inactive" style={{ backgroundColor: '#E8F5E9', borderColor: '#81C784' }}>
            <p style={{ color: '#2E7D32' }}>No active session. Select a class to start recording.</p>
          </div>
        )}


        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Assigned Classes</h2>
        {teacherClasses.length === 0 ? (
          <p className="text-gray-700">No classes assigned to you. Please contact administration.</p>
        ) : (
          <div className="assigned-classes-grid">
            {teacherClasses.map((cls) => ( // cls is a SubjectInstance
              <div key={cls.id} className="class-card">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{cls.subject.name} ({cls.subject.code})</h3>
                <p className="text-gray-700 mb-1">Section: {cls.section.name}</p>

                {/* Display scheduled classes for today and their start buttons */}
                {cls.scheduledClassesToday && cls.scheduledClassesToday.length > 0 ? (
                    <div className="scheduled-times">
                        <h5>Scheduled for Today:</h5>
                        {cls.scheduledClassesToday.map((sc) => ( // sc is a ScheduledClass
                            <div key={sc.id} className="scheduled-time-item">
                                <p>{sc.startTime} - {sc.endTime}</p>
                                <button
                                    onClick={() => handleStartSession(sc.id)} // Pass the specific scheduledClass.id
                                    disabled={activeSessionId !== null} // Disable if any session is active
                                    className="record-button"
                                >
                                    {activeSessionId ? 'Session Active' : 'Start Recording'}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-schedule-today">No schedule for this class today.</p>
                )}

                {/* Always visible Retrieve/View Report button */}
                <button
  onClick={() => navigate(`/teacher/report/${cls.subject.id}/${cls.section.id}`)}
  className="retrieve-button mt-2"
>
  View Report
</button>

                {cls.classSessions.length > 0 && !activeSessionId && (
                  <Link to={`/attendance-board/${cls.classSessions.find(s => !s.isClosed)?.id}`} className="view-last-session-link">
                    View Last Active Session for this class
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Attendance Retrieval Section (REMOVED FROM HERE - now a separate page) */}
      </div>
    </div>
  );
}

export default TeacherDashboard;
