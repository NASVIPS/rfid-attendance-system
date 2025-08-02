// rfid-attendance-system/apps/frontend/src/pages/TimetableSchedulesPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Select from 'react-select';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader.jsx';
import { useNavigate } from 'react-router-dom';
import './timetableSchedulesPage.css'; // Dedicated CSS for this page

// Helper for DayOfWeek enum order
const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

// --- Reusable Management Components for Timetable & Schedules ---

// Subject Instance Assignment Component
function SubjectInstanceAssignment({
    subjectInstances, subjects, sections, facultyMembers,
    subjectInstanceFormMode, setSubjectInstanceFormMode, currentSubjectInstance, setCurrentSubjectInstance,
    subjectInstanceFormData, setSubjectInstanceFormData, subjectInstanceHandlers
}) {
    return (
        <>
            <div className="management-section-card">
                <h2 className="section-title">{subjectInstanceFormMode === 'create' ? 'Assign Subject to Faculty' : `Edit Subject Instance (ID: ${currentSubjectInstance?.id})`}</h2>
                <form onSubmit={subjectInstanceHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="subjectId" className="block text-sm font-medium text-gray-700">Subject</label>
                        <select id="subjectId" name="subjectId" value={subjectInstanceFormData.subjectId} onChange={subjectInstanceHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Subject</option>
                            {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="sectionId" className="block text-sm font-medium text-gray-700">Section</label>
                        <select id="sectionId" name="sectionId" value={subjectInstanceFormData.sectionId} onChange={subjectInstanceHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Section</option>
                            {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.name} (Sem {sec.semester.number}, {sec.semester.course.name})</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="facultyId" className="block text-sm font-medium text-gray-700">Faculty</label>
                        <select id="facultyId" name="facultyId" value={subjectInstanceFormData.facultyId} onChange={subjectInstanceHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Faculty</option>
                            {facultyMembers.map(fac => <option key={fac.id} value={fac.id}>{fac.name} ({fac.empId})</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            {subjectInstanceFormMode === 'create' ? 'Assign Subject' : 'Update Assignment'}
                        </button>
                        {subjectInstanceFormMode === 'edit' && (
                            <button type="button" onClick={subjectInstanceHandlers.resetForm} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Subject Instances (Assignments)</h2>
            {subjectInstances.length === 0 ? (
                <p className="text-gray-700">No subject instances assigned yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Course</th>
                                <th scope="col" className="management-table-th">Semester</th>
                                <th scope="col" className="management-table-th">Section</th>
                                <th scope="col" className="management-table-th">Subject</th>
                                <th scope="col" className="management-table-th">Faculty</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjectInstances.map((instance) => (
                                <tr key={instance.id} className="management-table-tr">
                                    <td className="management-table-td">{instance.section.semester.course.name}</td>
                                    <td className="management-table-td">Sem {instance.section.semester.number} ({instance.section.semester.type.toUpperCase()})</td>
                                    <td className="management-table-td">{instance.section.name}</td>
                                    <td className="management-table-td">{instance.subject.name} ({instance.subject.code})</td>
                                    <td className="management-table-td">{instance.faculty.name} ({instance.faculty.empId})</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => subjectInstanceHandlers.handleEditClick(instance)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => subjectInstanceHandlers.handleDeleteClick(instance.id)} className="table-action-button delete-button">Delete</button>
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

// Scheduled Class Management Component
function ScheduledClassManagement({
    scheduledClasses, subjectInstances,
    scheduledClassFormMode,
    currentScheduledClass,
    scheduledClassFormData,
    scheduledClassHandlers
}) {
    // Helper function to format Subject Instance for display in dropdown
    const formatSubjectInstanceLabel = (instance) => {
        if (!instance || !instance.subject || !instance.section || !instance.faculty) {
            return "Invalid Assignment Data";
        }
        const courseName = instance.section.semester.course?.name || '';
        const semesterNum = instance.section.semester?.number || '';
        const sectionName = instance.section?.name || '';
        const subjectName = instance.subject?.name || '';
        const subjectCode = instance.subject?.code || '';
        const facultyName = instance.faculty?.name || '';
        const facultyEmpId = instance.faculty?.empId || '';

        return `${subjectName} (${subjectCode}) - ${sectionName} (Sem ${semesterNum}, ${courseName}) by ${facultyName} (${facultyEmpId})`;
    };

    const selectOptions = subjectInstances.map(instance => ({
        value: instance.id,
        label: formatSubjectInstanceLabel(instance),
    }));

    const selectedValue = selectOptions.find(option => option.value === scheduledClassFormData.subjectInstanceId);

    return (
        <>
            <div className="management-section-card">
                <h2 className="section-title">{scheduledClassFormMode === 'create' ? 'Add New Scheduled Class' : `Edit Scheduled Class (ID: ${currentScheduledClass?.id})`}</h2>
                <form onSubmit={scheduledClassHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    <div>
                        <label htmlFor="subjectInstanceId" className="block text-sm font-medium text-gray-700">Subject Instance (Subject, Section, Faculty)</label>
                        <Select
                            id="subjectInstanceId"
                            name="subjectInstanceId"
                            options={selectOptions}
                            value={selectedValue}
                            onChange={(selectedOption) => scheduledClassHandlers.handleFormChange({ target: { name: 'subjectInstanceId', value: selectedOption ? selectedOption.value : '' } })}
                            required
                            className="mt-1 basic-single"
                            classNamePrefix="select"
                            placeholder="Search or Select Assignment..."
                            isClearable
                            isSearchable
                        />
                    </div>
                    <div>
                        <label htmlFor="dayOfWeek" className="block text-sm font-medium text-gray-700">Day of Week</label>
                        <select id="dayOfWeek" name="dayOfWeek" value={scheduledClassFormData.dayOfWeek} onChange={scheduledClassHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Day</option>
                            {dayOrder.map(day => <option key={day} value={day}>{day}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">Start Time (HH:MM)</label>
                        <input type="time" id="startTime" name="startTime" value={scheduledClassFormData.startTime} onChange={scheduledClassHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">End Time (HH:MM)</label>
                        <input type="time" id="endTime" name="endTime" value={scheduledClassFormData.endTime} onChange={scheduledClassHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>

                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            {scheduledClassFormMode === 'create' ? 'Add Scheduled Class' : 'Update Scheduled Class'}
                        </button>
                        {scheduledClassFormMode === 'edit' && (
                            <button type="button" onClick={scheduledClassHandlers.resetForm} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Scheduled Classes</h2>
            {scheduledClasses.length === 0 ? (
                <p className="text-gray-700">No classes scheduled yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Course</th>
                                <th scope="col" className="management-table-th">Semester</th>
                                <th scope="col" className="management-table-th">Section</th>
                                <th scope="col" className="management-table-th">Subject</th>
                                <th scope="col" className="management-table-th">Faculty</th>
                                <th scope="col" className="management-table-th">Day</th>
                                <th scope="col" className="management-table-th">Time</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scheduledClasses.map((sClass) => (
                                <tr key={sClass.id} className="management-table-tr">
                                    <td className="management-table-td">{sClass.subjectInst?.section?.semester?.course?.name || 'N/A'}</td>
                                    <td className="management-table-td">Sem {sClass.subjectInst?.section?.semester?.number || 'N/A'}</td>
                                    <td className="management-table-td">{sClass.subjectInst?.section?.name || 'N/A'}</td>
                                    <td className="management-table-td">{sClass.subjectInst?.subject?.name || 'N/A'} ({sClass.subjectInst?.subject?.code || 'N/A'})</td>
                                    <td className="management-table-td">{sClass.faculty?.name || sClass.subjectInst?.faculty?.name || 'N/A'}</td>
                                    <td className="management-table-td">{sClass.dayOfWeek}</td>
                                    <td className="management-table-td">{sClass.startTime} - {sClass.endTime}</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => scheduledClassHandlers.handleEditClick(sClass)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => scheduledClassHandlers.handleDeleteClick(sClass.id)} className="table-action-button delete-button">Delete</button>
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

// --- Main TimetableSchedulesPage component ---
function TimetableSchedulesPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [activeSubSection, setActiveSubSection] = useState('assignments');

    // State for Subject Instance Management
    const [subjectInstances, setSubjectInstances] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [sections, setSections] = useState([]);
    const [facultyMembers, setFacultyMembers] = useState([]);
    const [subjectInstanceFormMode, setSubjectInstanceFormMode] = useState('create');
    const [currentSubjectInstance, setCurrentSubjectInstance] = useState(null);
    const [subjectInstanceFormData, setSubjectInstanceFormData] = useState({
        subjectId: '', sectionId: '', facultyId: '',
    });

    // State for Scheduled Class Management
    const [scheduledClasses, setScheduledClasses] = useState([]);
    const [scheduledClassFormMode, setScheduledClassFormMode] = useState('create');
    const [currentScheduledClass, setCurrentScheduledClass] = useState(null);
    const [scheduledClassFormData, setScheduledClassFormData] = useState({
        subjectInstanceId: '', dayOfWeek: '', startTime: '', endTime: '',
    });

    const fetchDropdownData = async () => {
        try {
            const [subjectsRes, sectionsRes, facultyRes] = await Promise.all([
                api.get('/api/subject'),
                api.get('/api/section'),
                api.get('/api/faculty'),
            ]);
            setSubjects(subjectsRes.data);
            setSections(sectionsRes.data);
            setFacultyMembers(facultyRes.data);
        } catch (error) {
            console.error('Error fetching dropdown data:', error);
            toast.error(error.response?.data?.message || 'Failed to load dropdown options.');
        }
    };

    const fetchSubjectInstances = async () => {
        try {
            const response = await api.get('/api/subject-instance');
            setSubjectInstances(response.data);
        } catch (error) {
            console.error('Error fetching subject instances:', error);
            toast.error(error.response?.data?.message || 'Failed to load subject instances.');
        }
    };

    const fetchScheduledClasses = async () => {
        try {
            const response = await api.get('/api/scheduled-classes');
            setScheduledClasses(response.data);
        } catch (error) {
            console.error('Error fetching scheduled classes:', error);
            toast.error(error.response?.data?.message || 'Failed to load scheduled classes.');
        }
    };

    // Subject Instance Handlers
    const subjectInstanceHandlers = {
        handleFormChange: (e) => {
            const { name, value } = e.target;
            // FIX: Removed parseInt. Treat all IDs as strings.
            setSubjectInstanceFormData(prev => ({ ...prev, [name]: value }));
        },
        handleFormSubmit: async (e) => {
            e.preventDefault();
            try {
                if (subjectInstanceFormMode === 'create') {
                    await api.post('/api/subject-instance', subjectInstanceFormData);
                    toast.success('Subject Instance assigned successfully!');
                } else {
                    await api.put(`/api/subject-instance/${currentSubjectInstance.id}`, subjectInstanceFormData);
                    toast.success('Subject Instance updated successfully!');
                }
                subjectInstanceHandlers.resetForm();
                fetchSubjectInstances();
            } catch (error) {
                console.error('Error saving subject instance:', error);
                toast.error(error.response?.data?.message || 'Failed to save subject instance.');
            }
        },
        handleEditClick: (instance) => {
            setSubjectInstanceFormMode('edit');
            setCurrentSubjectInstance(instance);
            setSubjectInstanceFormData({
                subjectId: instance.subjectId, sectionId: instance.sectionId, facultyId: instance.facultyId,
            });
        },
        handleDeleteClick: async (instanceId) => {
            if (window.confirm('Are you sure you want to delete this Subject Instance?')) {
                try {
                    await api.delete(`/api/subject-instance/${instanceId}`);
                    toast.success('Subject Instance deleted successfully!');
                    fetchSubjectInstances();
                } catch (error) {
                    console.error('Error deleting subject instance:', error);
                    toast.error(error.response?.data?.message || 'Failed to delete subject instance.');
                }
            }
        },
        resetForm: () => {
            setSubjectInstanceFormMode('create');
            setCurrentSubjectInstance(null);
            setSubjectInstanceFormData({ subjectId: '', sectionId: '', facultyId: '' });
        }
    };

    // Scheduled Class Handlers
    const scheduledClassHandlers = {
        handleFormChange: (e) => {
            const { name, value } = e.target;
            // FIX: Removed parseInt. Treat all IDs as strings.
            setScheduledClassFormData(prev => ({ ...prev, [name]: value }));
        },
        handleFormSubmit: async (e) => {
            e.preventDefault();
            try {
                if (scheduledClassFormMode === 'create') {
                    await api.post('/api/scheduled-classes', scheduledClassFormData);
                    toast.success('Scheduled Class added successfully!');
                } else {
                    await api.put(`/api/scheduled-classes/${currentScheduledClass.id}`, scheduledClassFormData);
                    toast.success('Scheduled Class updated successfully!');
                }
                scheduledClassHandlers.resetForm();
                fetchScheduledClasses();
            } catch (error) {
                console.error('Error saving scheduled class:', error);
                toast.error(error.response?.data?.message || 'Failed to save scheduled class.');
            }
        },
        handleEditClick: (sClass) => {
            setScheduledClassFormMode('edit');
            setCurrentScheduledClass(sClass);
            setScheduledClassFormData({
                subjectInstanceId: sClass.subjectInstId,
                dayOfWeek: sClass.dayOfWeek,
                startTime: sClass.startTime,
                endTime: sClass.endTime,
            });
        },
        handleDeleteClick: async (sClassId) => {
            if (window.confirm('Are you sure you want to delete this Scheduled Class?')) {
                try {
                    await api.delete(`/api/scheduled-classes/${sClassId}`);
                    toast.success('Scheduled Class deleted successfully!');
                    fetchScheduledClasses();
                } catch (error) {
                    console.error('Error deleting scheduled class:', error);
                    toast.error(error.response?.data?.message || 'Failed to delete scheduled class.');
                }
            }
        },
        resetForm: () => {
            setScheduledClassFormMode('create');
            setCurrentScheduledClass(null);
            setScheduledClassFormData({ subjectInstanceId: '', dayOfWeek: '', startTime: '', endTime: '' });
        }
    };

    useEffect(() => {
        fetchDropdownData();
        fetchSubjectInstances();
        fetchScheduledClasses();
    }, []);

    useEffect(() => {
        if (activeSubSection === 'assignments') {
            fetchSubjectInstances();
        } else if (activeSubSection === 'schedules') {
            fetchScheduledClasses();
        }
    }, [activeSubSection]);

    const renderContent = () => {
        if (activeSubSection === 'assignments') {
            return (
                <SubjectInstanceAssignment
                    subjectInstances={subjectInstances}
                    subjects={subjects}
                    sections={sections}
                    facultyMembers={facultyMembers}
                    subjectInstanceFormMode={subjectInstanceFormMode}
                    currentSubjectInstance={currentSubjectInstance}
                    subjectInstanceFormData={subjectInstanceFormData}
                    subjectInstanceHandlers={subjectInstanceHandlers}
                />
            );
        } else if (activeSubSection === 'schedules') {
            return (
                <ScheduledClassManagement
                    scheduledClasses={scheduledClasses}
                    subjectInstances={subjectInstances}
                    scheduledClassFormMode={scheduledClassFormMode}
                    currentScheduledClass={currentScheduledClass}
                    scheduledClassFormData={scheduledClassFormData}
                    scheduledClassHandlers={scheduledClassHandlers}
                />
            );
        }
        return <p>Select a management option.</p>;
    };

    return (
        <div className="pcoord-sub-page-container">
            <PageHeader dashboardTitle="TIMETABLE & SCHEDULES" />
            <div className="pcoord-sub-page-main-content">
                <div className="sub-navigation-tabs mb-8">
                    <button onClick={() => navigate(-1)} className="back-button">Back to PC Dashboard</button>
                    <button
                        className={`nav-tab-button ${activeSubSection === 'assignments' ? 'active' : ''}`}
                        onClick={() => setActiveSubSection('assignments')}
                    >
                        Assign Subjects
                    </button>
                    <button
                        className={`nav-tab-button ${activeSubSection === 'schedules' ? 'active' : ''}`}
                        onClick={() => setActiveSubSection('schedules')}
                    >
                        Class Schedules
                    </button>
                </div>
                {renderContent()}
            </div>
        </div>
    );
}

export default TimetableSchedulesPage;