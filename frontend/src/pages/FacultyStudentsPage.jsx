// rfid-attendance-system/apps/frontend/src/pages/FacultyStudentsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader.jsx';
import { useNavigate } from 'react-router-dom';
import './facultyStudentsPage.css';


// Reusable Faculty Management component
function FacultyManagement({ user, facultyMembers, facultyFormMode, setFacultyFormMode, currentFaculty, setCurrentFaculty, facultyFormData, setFacultyFormData, facultyHandlers }) {
    const [isScanningRfid, setIsScanningRfid] = useState(false);
    const rfidScanWsRef = useRef(null);
    const rfidScanTokenRef = useRef(null);

    const generateScanToken = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const handleScanRfidClick = () => {
        if (isScanningRfid) {
            if (rfidScanWsRef.current) {
                rfidScanWsRef.current.close();
            }
            setIsScanningRfid(false);
            toast.info('RFID scan stopped.', { id: 'rfidScanToast' });
            return;
        }

        setIsScanningRfid(true);
        rfidScanTokenRef.current = generateScanToken();
        console.log('DEBUG RFID Scan Token:', rfidScanTokenRef.current);
        toast.loading('Waiting for RFID scan... Please scan a card on the hardware.', { id: 'rfidScanToast', duration: 10000 });

        const ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);
        rfidScanWsRef.current = ws;

        ws.onopen = () => {
            console.log('RFID Scan WebSocket Connected!');
            ws.send(JSON.stringify({ type: 'START_RFID_ENROLLMENT', token: rfidScanTokenRef.current }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'RFID_SCANNED' && message.rfidUid) {
                setFacultyFormData(prev => ({ ...prev, rfidUid: message.rfidUid }));
                toast.success(`RFID Scanned: ${message.rfidUid}`, { id: 'rfidScanToast' });
                setIsScanningRfid(false);
                if (rfidScanWsRef.current) {
                    rfidScanWsRef.current.close();
                }
            } else if (message.type === 'RFID_ENROLLMENT_READY') {
                console.log('Backend ready for RFID enrollment.');
            }
        };

        ws.onclose = () => {
            console.log('RFID Scan WebSocket Disconnected.');
            if (isScanningRfid) {
                toast.error('RFID scan session ended.', { id: 'rfidScanToast' });
            }
            setIsScanningRfid(false);
        };

        ws.onerror = (error) => {
            console.error('RFID Scan WebSocket Error:', error);
            toast.error('RFID scan connection error.', { id: 'rfidScanToast' });
            setIsScanningRfid(false);
            ws.close();
        };
    };

    useEffect(() => {
        return () => {
            if (rfidScanWsRef.current && rfidScanWsRef.current.readyState === WebSocket.OPEN) {
                rfidScanWsRef.current.close();
            }
            toast.dismiss('rfidScanToast');
        };
    }, []);


    return (
        <>
            <div className="management-section-card">
                <h2 className="section-title">{facultyFormMode === 'create' ? 'Add New Faculty' : `Edit Faculty (ID: ${currentFaculty?.empId})`}</h2>
                <form onSubmit={facultyHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="facultyEmail" className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" id="facultyEmail" name="email" value={facultyFormData.email} onChange={facultyHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    {facultyFormMode === 'create' || !facultyFormData.password ? (
                        <div>
                        <label htmlFor="facultyPassword" className="block text-sm font-medium text-gray-700">Password {facultyFormMode === 'edit' && '(Leave blank to keep current)'}</label>
                        <input type="password" id="facultyPassword" name="password" value={facultyFormData.password} onChange={facultyHandlers.handleFormChange} required={facultyFormMode === 'create'} className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    ) : null}
                    <div>
                        <label htmlFor="facultyName" className="block text-sm font-medium text-gray-700">Name</label>
                        <input type="text" id="facultyName" name="name" value={facultyFormData.name} onChange={facultyHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="facultyEmpId" className="block text-sm font-medium text-gray-700">Employee ID</label>
                        <input type="text" id="facultyEmpId" name="empId" value={facultyFormData.empId} onChange={facultyHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="facultyPhone" className="block text-sm font-medium text-gray-700">Phone</label>
                        <input type="text" id="facultyPhone" name="phone" value={facultyFormData.phone} onChange={facultyHandlers.handleFormChange} className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>

                    {/* RFID UID field with Scan Button */}
                    <div className="relative">
                        <label htmlFor="facultyRfidUid" className="block text-sm font-medium text-gray-700">RFID UID</label>
                        <input
                            type="text"
                            id="facultyRfidUid"
                            name="rfidUid"
                            value={facultyFormData.rfidUid}
                            onChange={facultyHandlers.handleFormChange}
                            required
                            className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            readOnly={isScanningRfid}
                        />
                        <button
                            type="button"
                            onClick={handleScanRfidClick}
                            className={`absolute inset-y-0 right-0 flex items-center px-2 text-sm font-medium rounded-r-md ${isScanningRfid ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white focus:outline-none`}
                            style={{ top: 'calc(0.25rem + 1.4rem)' }}
                        >
                            {isScanningRfid ? 'Stop Scan' : 'Scan RFID'}
                        </button>
                    </div>

                    <div>
                        <label htmlFor="facultyRole" className="block text-sm font-medium text-gray-700">User Role</label>
                        <select id="facultyRole" name="role" value={facultyFormData.role} onChange={facultyHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="TEACHER">TEACHER</option>
                        <option value="PCOORD">PROGRAM COORDINATOR</option>
                        <option value="ADMIN">ADMIN</option>
                        </select>
                    </div>

                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                        {facultyFormMode === 'create' ? 'Add Faculty' : 'Update Faculty'}
                        </button>
                        {facultyFormMode === 'edit' && (
                        <button type="button" onClick={() => { setFacultyFormMode('create'); setCurrentFaculty(null); setFacultyFormData({ email: '', password: '', name: '', empId: '', phone: '', rfidUid: '', role: 'TEACHER' }); }} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                            Cancel Edit
                        </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Faculty Members</h2>
            {facultyMembers.length === 0 ? (
                <p className="text-gray-700">No faculty members registered yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Email</th>
                                <th scope="col" className="management-table-th">Name</th>
                                <th scope="col" className="management-table-th">Emp ID</th>
                                <th scope="col" className="management-table-th">Phone</th>
                                <th scope="col" className="management-table-th">RFID UID</th>
                                <th scope="col" className="management-table-th">Role</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {facultyMembers.map((faculty) => (
                                <tr key={faculty.id} className="management-table-tr">
                                    <td className="management-table-td">{faculty.user.email}</td>
                                    <td className="management-table-td">{faculty.name}</td>
                                    <td className="management-table-td">{faculty.empId}</td>
                                    <td className="management-table-td">{faculty.phone}</td>
                                    <td className="management-table-td">{faculty.rfidUid}</td>
                                    <td className="management-table-td">{faculty.user.role}</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => facultyHandlers.handleEditClick(faculty)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => facultyHandlers.handleDeleteClick(faculty.id)} className="table-action-button delete-button">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

// Reusable Student Management component (NEW)
function StudentManagement({ user, students, studentFormMode, setStudentFormMode, currentStudent, setCurrentStudent, studentFormData, setStudentFormData, studentHandlers, sections }) {
    const [isScanningRfid, setIsScanningRfid] = useState(false);
    const rfidScanWsRef = useRef(null);
    const rfidScanTokenRef = useRef(null);

    const generateScanToken = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const handleScanRfidClick = () => {
        if (isScanningRfid) {
            if (rfidScanWsRef.current) {
                rfidScanWsRef.current.close();
            }
            setIsScanningRfid(false);
            toast.info('RFID scan stopped.', { id: 'rfidScanToastStudent' });
            return;
        }

        setIsScanningRfid(true);
        rfidScanTokenRef.current = generateScanToken();
        console.log('DEBUG Student RFID Scan Token:', rfidScanTokenRef.current);
        toast.loading('Waiting for RFID scan... Please scan a card on the hardware.', { id: 'rfidScanToastStudent', duration: 10000 });

        const ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);
        rfidScanWsRef.current = ws;

        ws.onopen = () => {
            console.log('Student RFID Scan WebSocket Connected!');
            ws.send(JSON.stringify({ type: 'START_RFID_ENROLLMENT', token: rfidScanTokenRef.current }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'RFID_SCANNED' && message.rfidUid) {
                setStudentFormData(prev => ({ ...prev, rfidUid: message.rfidUid }));
                toast.success(`RFID Scanned: ${message.rfidUid}`, { id: 'rfidScanToastStudent' });
                setIsScanningRfid(false);
                if (rfidScanWsRef.current) {
                    rfidScanWsRef.current.close();
                }
            } else if (message.type === 'RFID_ENROLLMENT_READY') {
                console.log('Backend ready for Student RFID enrollment.');
            }
        };

        ws.onclose = () => {
            console.log('Student RFID Scan WebSocket Disconnected.');
            if (isScanningRfid) {
                toast.error('RFID scan session ended.', { id: 'rfidScanToastStudent' });
            }
            setIsScanningRfid(false);
        };

        ws.onerror = (error) => {
            console.error('Student RFID Scan WebSocket Error:', error);
            toast.error('Student RFID scan connection error.', { id: 'rfidScanToastStudent' });
            setIsScanningRfid(false);
            ws.close();
        };
    };

    useEffect(() => {
        return () => {
            if (rfidScanWsRef.current && rfidScanWsRef.current.readyState === WebSocket.OPEN) {
                rfidScanWsRef.current.close();
            }
            toast.dismiss('rfidScanToastStudent');
        };
    }, []);

    return (
        <>
            <div className="management-section-card">
                <h2 className="section-title">{studentFormMode === 'create' ? 'Add New Student' : `Edit Student (ID: ${currentStudent?.enrollmentNo})`}</h2>
                <form onSubmit={studentHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="studentName" className="block text-sm font-medium text-gray-700">Name</label>
                        <input type="text" id="studentName" name="name" value={studentFormData.name} onChange={studentHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="enrollmentNo" className="block text-sm font-medium text-gray-700">Enrollment No.</label>
                        <input type="text" id="enrollmentNo" name="enrollmentNo" value={studentFormData.enrollmentNo} onChange={studentHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    {/* <div>
                        <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700">Email (Optional)</label>
                        <input type="email" id="studentEmail" name="email" value={studentFormData.email || ''} onChange={studentHandlers.handleFormChange} className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div> */}
                    <div>
                        <label htmlFor="studentPhone" className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                        <input type="text" id="studentPhone" name="phone" value={studentFormData.phone || ''} onChange={studentHandlers.handleFormChange} className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>

                    {/* RFID UID field with Scan Button */}
                    <div className="relative">
                        <label htmlFor="studentRfidUid" className="block text-sm font-medium text-gray-700">RFID UID</label>
                        <input
                            type="text"
                            id="studentRfidUid"
                            name="rfidUid"
                            value={studentFormData.rfidUid || ''}
                            onChange={studentHandlers.handleFormChange}
                            required
                            className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            readOnly={isScanningRfid}
                        />
                        <button
                            type="button"
                            onClick={handleScanRfidClick}
                            className={`absolute inset-y-0 right-0 flex items-center px-2 text-sm font-medium rounded-r-md ${isScanningRfid ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white focus:outline-none`}
                            style={{ top: 'calc(0.25rem + 1.4rem)' }}
                        >
                            {isScanningRfid ? 'Stop Scan' : 'Scan RFID'}
                        </button>
                    </div>

                    <div>
                        <label htmlFor="studentSectionId" className="block text-sm font-medium text-gray-700">Section</label>
                        <select id="studentSectionId" name="sectionId" value={studentFormData.sectionId || ''} onChange={studentHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Section</option>
                            {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.name} (Sem {sec.semester.number} - {sec.semester.course.name})</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            {studentFormMode === 'create' ? 'Add Student' : 'Update Student'}
                        </button>
                        {studentFormMode === 'edit' && (
                            <button type="button" onClick={() => { setStudentFormMode('create'); setCurrentStudent(null); setStudentFormData({}); }} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Students</h2>
            {students.length === 0 ? (
                <p className="text-gray-700">No students registered yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Enrollment No.</th>
                                <th scope="col" className="management-table-th">Name</th>
                                <th scope="col" className="management-table-th">Email</th>
                                <th scope="col" className="management-table-th">Phone</th>
                                <th scope="col" className="management-table-th">RFID UID</th>
                                <th scope="col" className="management-table-th">Section</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((student) => (
                                <tr key={student.id} className="management-table-tr">
                                    <td className="management-table-td">{student.enrollmentNo}</td>
                                    <td className="management-table-td">{student.name}</td>
                                    <td className="management-table-td">{student.email || '-'}</td>
                                    <td className="management-table-td">{student.phone || '-'}</td>
                                    <td className="management-table-td">{student.rfidUid}</td>
                                    <td className="management-table-td">{student.section.name} (Sem {student.section.semester.number}, {student.section.semester.course.name})</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => studentHandlers.handleEditClick(student)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => studentHandlers.handleDeleteClick(student.id)} className="table-action-button delete-button">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

// --- Main FacultyStudentsPage component ---
function FacultyStudentsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Faculty Management States and Handlers (moved to FacultyStudentsPage component scope)
  const [facultyMembers, setFacultyMembers] = useState([]);
  const [facultyFormMode, setFacultyFormMode] = useState('create');
  const [currentFaculty, setCurrentFaculty] = useState(null);
  const [facultyFormData, setFacultyFormData] = useState({
    email: '', password: '', name: '', empId: '', phone: '', rfidUid: '', role: 'TEACHER',
  });

  const fetchFacultyMembers = async () => {
    try {
      const response = await api.get('/api/faculty');
      setFacultyMembers(response.data);
    } catch (error) {
      console.error('Error fetching faculty members:', error);
      toast.error(error.response?.data?.message || 'Failed to load faculty members.');
    }
  };

  const facultyHandlers = {
    handleFormChange: (e) => {
      const { name, value } = e.target;
      setFacultyFormData(prev => ({ ...prev, [name]: value }));
    },
    handleFormSubmit: async (e) => {
      e.preventDefault();
      try {
        if (facultyFormMode === 'create') {
          if (!facultyFormData.password) { toast.error('Password is required for new faculty.'); return; }
          await api.post('/api/faculty', facultyFormData);
          toast.success('Faculty member added successfully!');
        } else {
          await api.put(`/api/faculty/${currentFaculty.id}`, facultyFormData);
          toast.success('Faculty member updated successfully!');
        }
        setFacultyFormMode('create');
        setCurrentFaculty(null);
        setFacultyFormData({ email: '', password: '', name: '', empId: '', phone: '', rfidUid: '', role: 'TEACHER' });
        fetchFacultyMembers();
      } catch (error) {
        console.error('Error saving faculty member:', error);
        toast.error(error.response?.data?.message || 'Failed to save faculty member.');
      }
    },
    handleEditClick: (faculty) => {
      setFacultyFormMode('edit');
      setCurrentFaculty(faculty);
      setFacultyFormData({
        email: faculty.user.email, password: '', name: faculty.name, empId: faculty.empId,
        phone: faculty.phone, rfidUid: faculty.rfidUid, role: faculty.user.role,
      });
    },
    handleDeleteClick: async (facultyId) => {
      if (window.confirm('Are you sure you want to delete this faculty member and their associated user account? This action cannot be undone.')) {
        try {
          await api.delete(`/api/faculty/${facultyId}`);
          toast.success('Faculty member deleted successfully!');
          fetchFacultyMembers();
        } catch (error) {
          console.error('Error deleting faculty member:', error);
          toast.error(error.response?.data?.message || 'Failed to delete faculty member.');
        }
      }
    }
  };

  // Student Management States and Handlers (NEW)
  const [students, setStudents] = useState([]);
  const [studentFormMode, setStudentFormMode] = useState('create');
  const [currentStudent, setCurrentStudent] = useState(null);
  const [studentFormData, setStudentFormData] = useState({
    name: '', enrollmentNo: '', email: '', phone: '', rfidUid: '', sectionId: '',
  });
  const [sections, setSections] = useState([]); // For student section dropdown

  const fetchStudentsAndSections = async () => {
    try {
      const [studentsRes, sectionsRes] = await Promise.all([
        api.get('/api/student'), // Fetch all students
        api.get('/api/student/helpers/sections'), // Fetch all sections for dropdown
      ]);
      setStudents(studentsRes.data);
      setSections(sectionsRes.data);
    } catch (error) {
      console.error('Error fetching students/sections:', error);
      toast.error(error.response?.data?.message || 'Failed to load student data.');
    }
  };

  const studentHandlers = {
    handleFormChange: (e) => {
      const { name, value } = e.target;
      setStudentFormData(prev => ({ ...prev, [name]: name === 'sectionId' ? (value ? parseInt(value) : '') : value }));
    },
    handleFormSubmit: async (e) => {
      e.preventDefault();
      try {
        if (studentFormMode === 'create') {
          await api.post('/api/student', studentFormData);
          toast.success('Student added successfully!');
        } else {
          await api.put(`/api/student/${currentStudent.id}`, studentFormData);
          toast.success('Student updated successfully!');
        }
        setStudentFormMode('create');
        setCurrentStudent(null);
        setStudentFormData({ name: '', enrollmentNo: '', email: '', phone: '', rfidUid: '', sectionId: '' });
        fetchStudentsAndSections(); // Refresh student data
      } catch (error) {
        console.error('Error saving student:', error);
        toast.error(error.response?.data?.message || 'Failed to save student.');
      }
    },
    handleEditClick: (student) => {
      setStudentFormMode('edit');
      setCurrentStudent(student);
      setStudentFormData({
        name: student.name, enrollmentNo: student.enrollmentNo, email: student.email || '',
        phone: student.phone || '', rfidUid: student.rfidUid, sectionId: student.sectionId,
      });
    },
    handleDeleteClick: async (studentId) => {
      if (window.confirm('Are you sure you want to delete this student? This might also delete associated attendance logs. This action cannot be undone.')) {
        try {
          await api.delete(`/api/student/${studentId}`);
          toast.success('Student deleted successfully!');
          fetchStudentsAndSections(); // Refresh student data
        } catch (error) {
          console.error('Error deleting student:', error);
          toast.error(error.response?.data?.message || 'Failed to delete student.');
        }
      }
    }
  };


  const [activeSubSection, setActiveSubSection] = useState('manageFaculty'); // 'manageFaculty', 'manageStudents'

  useEffect(() => {
    // Fetch data based on active sub-section
    if (activeSubSection === 'manageFaculty') {
        fetchFacultyMembers();
    } else if (activeSubSection === 'manageStudents') {
        fetchStudentsAndSections();
    }
  }, [activeSubSection]);

  return (
    <div className="pcoord-sub-page-container">
        <PageHeader dashboardTitle="FACULTY & STUDENTS" />
        <div className="pcoord-sub-page-main-content">
            <div className="sub-navigation-tabs mb-8">
                            <button onClick={() => navigate(-1)} className="back-button">Back to PC Dashboard</button>
                <button className={`nav-tab-button ${activeSubSection === 'manageFaculty' ? 'active' : ''}`} onClick={() => setActiveSubSection('manageFaculty')}>
                    Manage Faculty
                </button>
                <button className={`nav-tab-button ${activeSubSection === 'manageStudents' ? 'active' : ''}`} onClick={() => setActiveSubSection('manageStudents')}>
                    Manage Students
                </button>
            </div>

            {activeSubSection === 'manageFaculty' && (
                <FacultyManagement
                    user={user} // Pass user prop
                    facultyMembers={facultyMembers}
                    facultyFormMode={facultyFormMode} setFacultyFormMode={setFacultyFormMode}
                    currentFaculty={currentFaculty} setCurrentFaculty={setCurrentFaculty}
                    facultyFormData={facultyFormData} setFacultyFormData={setFacultyFormData}
                    facultyHandlers={facultyHandlers}
                />
            )}

            {activeSubSection === 'manageStudents' && (
                <StudentManagement
                    user={user}
                    students={students}
                    studentFormMode={studentFormMode} setStudentFormMode={setStudentFormMode}
                    currentStudent={currentStudent} setCurrentStudent={setCurrentStudent}
                    studentFormData={studentFormData} setStudentFormData={setStudentFormData}
                    studentHandlers={studentHandlers}
                    sections={sections} // Pass sections for dropdown
                />
            )}
        </div>
    </div>
  );
}

export default FacultyStudentsPage;