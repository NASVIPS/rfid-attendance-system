// src/pages/AttendanceBoard.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext'; // Correct way to import and use the hook
import './attendanceBoard.css'; // Import the CSS file

function AttendanceBoard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // Call the useAuth hook to get user context

  const [sessionDetails, setSessionDetails] = useState(null);
  const [presentStudents, setPresentStudents] = useState([]); // State for present students
  const [absentStudents, setAbsentStudents] = useState([]);   // State for absent students
  const [totalStudents, setTotalStudents] = useState(0);      // State for total students
  const [presentCount, setPresentCount] = useState(0);        // State for present count
  const [absentCount, setAbsentCount] = useState(0);          // State for absent count
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null); // Ref to hold the WebSocket instance
  const reconnectTimeoutRef = useRef(null); // Ref for reconnect timeout

  // State for device authentication status
  const [deviceAuthStatus, setDeviceAuthStatus] = useState({
      isAuth: false,
      authenticatedBy: 'N/A',
      deviceMacAddress: 'N/A',
      message: 'Device not authenticated.'
  });

  // Refs to control toast frequency
  const wsDisconnectedToastId = useRef(null); // To dismiss previous disconnected toasts
  const wsErrorToastId = useRef(null);        // To dismiss previous error toasts
  const attendanceUpdateToastId = useRef(null); // To manage attendance update toasts

  // Function to fetch initial session details and attendance snapshot
  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const sessionRes = await api.get(`/api/session/${sessionId}`);
      setSessionDetails(sessionRes.data);
      
      const snapshotRes = await api.get(`/api/attendance/snapshot/${sessionId}`);
      setPresentStudents(snapshotRes.data.presentStudents);
      setAbsentStudents(snapshotRes.data.absentStudents);
      setTotalStudents(snapshotRes.data.totalStudentsInSessionSection);
      setPresentCount(snapshotRes.data.presentCount);
      setAbsentCount(snapshotRes.data.absentCount);

    } catch (err) {
      console.error('Error fetching session data:', err);
      setError(err.response?.data?.message || 'Failed to load session data.');
      toast.error('Failed to load attendance board.'); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setError('Session ID is missing.');
      setLoading(false);
      return;
    }

    fetchSessionData(); // Fetch initial data when component mounts

    // --- WebSocket Setup ---
    const wsUrl = import.meta.env.VITE_WEBSOCKET_URL;
    if (!wsUrl) {
        console.error('VITE_WEBSOCKET_URL is not defined in your environment variables.');
        toast.error('WebSocket URL is missing. Real-time updates disabled.'); 
        return;
    }

    const connectWs = () => {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return; // Already connecting or open
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current); // Clear any pending reconnects
        }

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
            console.log('WebSocket connected to backend.');
            if (wsDisconnectedToastId.current) { 
                toast.dismiss(wsDisconnectedToastId.current);
                wsDisconnectedToastId.current = null;
            }
            if (wsErrorToastId.current) { 
                toast.dismiss(wsErrorToastId.current);
                wsErrorToastId.current = null;
            }
        };

        wsRef.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);

            if (message.type === 'ATTENDANCE_SNAPSHOT_UPDATE' && message.sessionId === parseInt(sessionId)) {
                // Update states with the new snapshot data
                setPresentStudents(prevPresent => {
                    if (prevPresent.length !== message.data.presentStudents.length) {
                        if (attendanceUpdateToastId.current) {
                            toast.dismiss(attendanceUpdateToastId.current);
                        }
                        attendanceUpdateToastId.current = toast.success('Attendance updated!');
                    }
                    return message.data.presentStudents;
                });
                setAbsentStudents(message.data.absentStudents);
                setTotalStudents(message.data.totalStudentsInSessionSection);
                setPresentCount(message.data.presentCount);
                setAbsentCount(message.data.absentCount);
            } else if (message.type === 'DEVICE_AUTH_STATUS_UPDATE') {
                setDeviceAuthStatus(prevStatus => {
                    if (prevStatus.isAuth !== message.isAuth || (message.isAuth && prevStatus.authenticatedBy !== message.authenticatedBy)) {
                        toast.success(`Device authenticated by ${message.authenticatedBy}!`); 
                    }
                    return {
                        isAuth: message.isAuth,
                        authenticatedBy: message.authenticatedBy,
                        deviceMacAddress: message.deviceMacAddress,
                        message: message.message
                    };
                });
            }
        };

        wsRef.current.onclose = () => {
            console.log('WebSocket disconnected. Attempting reconnect...');
            if (!wsErrorToastId.current) {
                wsDisconnectedToastId.current = toast('Real-time updates disconnected. Attempting reconnect...', { icon: '⚠️', duration: 5000 }); 
            }
            reconnectTimeoutRef.current = setTimeout(connectWs, 3000); 
        };

        wsRef.current.onerror = (err) => {
            console.error('WebSocket error:', err);
            if (wsDisconnectedToastId.current) {
                toast.dismiss(wsDisconnectedToastId.current);
                wsDisconnectedToastId.current = null;
            }
            if (!wsErrorToastId.current) {
                wsErrorToastId.current = toast.error('WebSocket error. Real-time updates may be interrupted.', { duration: 5000 }); 
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close(); 
            }
        };
    };

    connectWs(); 

    return () => {
        if (wsRef.current) {
            wsRef.current.close(); 
            wsRef.current = null; 
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current); 
        }
        toast.dismiss(wsDisconnectedToastId.current);
        toast.dismiss(wsErrorToastId.current);
        toast.dismiss(attendanceUpdateToastId.current);
    };
  }, [sessionId]); 

  const handleCloseSession = async () => {
    if (!sessionDetails) return;
    try {
      await api.post(`/api/session/close/${sessionId}`);
      toast.success('Session closed successfully!'); 
      navigate('/teacher-dashboard'); 
    } catch (err) {
      console.error('Error closing session:', err);
      toast.error(err.response?.data?.message || 'Failed to close session.'); 
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const url = `/api/attendance/export-session/${sessionId}/excel`;
      const resp = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(
        new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      );
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `attendance_session_report_${sessionId}.xlsx`; // Changed filename
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success('Excel downloaded!'); 
    } catch {
      toast.error('Could not download session Excel.'); 
    }
  };


  if (loading) {
    return (
      <div className="attendance-board-page-container">
        <PageHeader dashboardTitle="ATTENDANCE BOARD" />
        <div className="attendance-board-main-content text-center p-8">
          <div className="loading-state">Loading attendance board...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="attendance-board-page-container">
        <PageHeader dashboardTitle="ATTENDANCE BOARD" />
        <div className="attendance-board-main-content text-center p-8">
          <div className="error-state">Error: {error}</div>
        </div>
      </div>
    );
  }

  // Combine present and absent students for display, sorted by name
  const allStudentsDisplay = [...presentStudents, ...absentStudents].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="attendance-board-page-container">
      <PageHeader dashboardTitle="ATTENDANCE BOARD" />
      <div className="attendance-board-main-content">
        <div className="actions-row">
          <button onClick={handleDownloadExcel} className="download-excel-button">Download Excel</button>
          <button onClick={() => navigate(-1)} className="back-button">Back</button>
          <button onClick={handleCloseSession} className="close-session-button">
            Close Session
          </button>
        </div>

        <div className="session-info-card">
          <h2>Live Attendance for:</h2>
          <h3>{sessionDetails?.subjectInst?.subject?.name} ({sessionDetails?.subjectInst?.subject?.code})</h3>
          <p>Section: {sessionDetails?.subjectInst?.section?.name}</p>
          <p>Teacher: {sessionDetails?.subjectInst?.faculty?.name}</p>
        </div>

        {/* Teacher Authenticated Status Display */}
        <div className={`device-auth-status-banner ${deviceAuthStatus.isAuth ? 'authenticated' : 'unauthenticated'}`}>
            <h4>Teacher Authenticated Status:</h4>
            <p>Status: {deviceAuthStatus.isAuth ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}</p>
            {deviceAuthStatus.isAuth && (
                <>
                    <p>Authenticated By: {deviceAuthStatus.authenticatedBy}</p>
                    <p>Device MAC: {deviceAuthStatus.deviceMacAddress}</p>
                </>
            )}
            <p className="status-message">{deviceAuthStatus.message}</p>
        </div>

        <div className="attendance-summary-section">
          <h3>Attendance Summary</h3>
          <p>Total Students in Section: {totalStudents}</p>
          <p>Students Present: {presentCount}</p>
          <p>Students Absent: {absentCount}</p>
        </div>

        <div className="attendance-list-section">
          <h2 className="students-present-heading">All Students ({totalStudents})</h2>
          {allStudentsDisplay.length === 0 ? (
            <p className="no-scans-message">No students found for this section.</p>
          ) : (
            <div className="attendance-table-container">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Enrollment No.</th>
                    <th>Student Name</th>
                    <th>Status</th>
                    <th>Scanned At</th>
                  </tr>
                </thead>
                <tbody>
                  {allStudentsDisplay.map((student) => (
                    <tr key={student.id} className={student.status === 'ABSENT' ? 'absent-row' : ''}>
                      <td>{student.enrollmentNo}</td>
                      <td>{student.name}</td>
                      <td>{student.status}</td>
                      <td>{student.status === 'PRESENT' ? new Date(student.timestamp).toLocaleTimeString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendanceBoard;