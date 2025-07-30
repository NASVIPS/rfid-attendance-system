// rfid-attendance-system/apps/frontend/src/pages/CoursesSubjectsPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader.jsx';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select'; // For searchable dropdown
import './coursesSubjectsPage.css'; // Dedicated CSS for this page

// Helper for Degree Type options
const degreeTypes = ['UG', 'PG', 'Diploma']; // Example types
// Helper for Semester Type options
const semesterTypes = ['odd', 'even']; // Example types

// --- Reusable Management Components (Adapted for Nested Structure) ---

// Course Management Component
function CourseManagement({
    user, courses, departments,
    courseFormMode, setCourseFormMode, currentCourse, setCurrentCourse,
    courseFormData, setCourseFormData, courseHandlers,
    onManageSemesters
}) {
    return (
        <>
            <div className="management-section-card">
                <h2 className="section-title">{courseFormMode === 'create' ? 'Add New Course' : `Edit Course (ID: ${currentCourse?.name})`}</h2>
                <form onSubmit={courseHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="courseName" className="block text-sm font-medium text-gray-700">Course Name</label>
                        <input type="text" id="courseName" name="name" value={courseFormData.name} onChange={courseHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">Department</label>
                        <select id="departmentId" name="departmentId" value={courseFormData.departmentId} onChange={courseHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Department</option>
                            {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="durationYears" className="block text-sm font-medium text-gray-700">Duration (Years)</label>
                        <input type="number" id="durationYears" name="durationYears" value={courseFormData.durationYears} onChange={courseHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="degreeType" className="block text-sm font-medium text-gray-700">Degree Type</label>
                        <select id="degreeType" name="degreeType" value={courseFormData.degreeType} onChange={courseHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Degree Type</option>
                            {degreeTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    {/* NEW: Add Total Semesters field here */}
                    <div>
                        <label htmlFor="totalSemesters" className="block text-sm font-medium text-gray-700">Total Semesters (for auto-creation)</label>
                        <input type="number" id="totalSemesters" name="totalSemesters" value={courseFormData.totalSemesters} onChange={courseHandlers.handleFormChange} className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" min="0" />
                    </div>
                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            {courseFormMode === 'create' ? 'Add Course' : 'Update Course'}
                        </button>
                        {courseFormMode === 'edit' && (
                            <button type="button" onClick={() => { setCourseFormMode('create'); setCurrentCourse(null); courseHandlers.resetForm(); }} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Courses</h2>
            {courses.length === 0 ? (
                <p className="text-gray-700">No courses added yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Course Name</th>
                                <th scope="col" className="management-table-th">Department</th>
                                <th scope="col" className="management-table-th">Duration (Yrs)</th>
                                <th scope="col" className="management-table-th">Degree Type</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map((course) => (
                                <tr key={course.id} className="management-table-tr">
                                    <td className="management-table-td">{course.name}</td>
                                    <td className="management-table-td">{course.department.name}</td>
                                    <td className="management-table-td">{course.durationYears}</td>
                                    <td className="management-table-td">{course.degreeType}</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => courseHandlers.handleEditClick(course)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => courseHandlers.handleDeleteClick(course.id)} className="table-action-button delete-button">Delete</button>
                                        <button onClick={() => onManageSemesters(course)} className="table-action-button manage-button">Manage Semesters</button>
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

// Subject Management Component (remains largely standalone)
function SubjectManagement({ user, subjects, subjectFormMode, setSubjectFormMode, currentSubject, setCurrentSubject, subjectFormData, setSubjectFormData, subjectHandlers }) {
    return (
        <>
            <div className="management-section-card">
                <h2 className="section-title">{subjectFormMode === 'create' ? 'Add New Subject' : `Edit Subject (ID: ${currentSubject?.code})`}</h2>
                <form onSubmit={subjectHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="subjectCode" className="block text-sm font-medium text-gray-700">Subject Code</label>
                        <input type="text" id="subjectCode" name="code" value={subjectFormData.code} onChange={subjectHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700">Subject Name</label>
                        <input type="text" id="subjectName" name="name" value={subjectFormData.name} onChange={subjectHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="subjectCredits" className="block text-sm font-medium text-gray-700">Credits (Optional)</label>
                        <input type="number" id="subjectCredits" name="credits" value={subjectFormData.credits || ''} onChange={subjectHandlers.handleFormChange} className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>

                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            {subjectFormMode === 'create' ? 'Add Subject' : 'Update Subject'}
                        </button>
                        {subjectFormMode === 'edit' && (
                            <button type="button" onClick={() => { setSubjectFormMode('create'); setCurrentSubject(null); setSubjectFormData({ code: '', name: '', credits: '' }); }} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Subjects</h2>
            {subjects.length === 0 ? (
                <p className="text-gray-700">No subjects added yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Subject Code</th>
                                <th scope="col" className="management-table-th">Subject Name</th>
                                <th scope="col" className="management-table-th">Credits</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjects.map((subject) => (
                                <tr key={subject.id} className="management-table-tr">
                                    <td className="management-table-td">{subject.code}</td>
                                    <td className="management-table-td">{subject.name}</td>
                                    <td className="management-table-td">{subject.credits || '-'}</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => subjectHandlers.handleEditClick(subject)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => subjectHandlers.handleDeleteClick(subject.id)} className="table-action-button delete-button">Delete</button>
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

// Semester Management Component (Nested within Course)
function SemestersForCourseManagement({
    course, semesters, semesterFormMode, setSemesterFormMode,
    currentSemester, setCurrentSemester, semesterFormData, setSemesterFormData,
    semesterHandlers, onBackToCourses, onManageSections, onManageSubjectsForSemester, // Added onManageSubjectsForSemester
    resetSemesterForm
}) {
    // Filter semesters to show only those for the current course
    const semestersForCurrentCourse = semesters.filter(sem => sem.courseId === course.id);

    // Reset form when switching course or back to create mode
    useEffect(() => {
        resetSemesterForm(course.id);
    }, [course.id, semesterFormMode]); // Depend on course.id and form mode

    return (
        <>
            <button onClick={onBackToCourses} className="back-button">← Back to All Courses</button>
            <div className="management-section-card">
                <h2 className="section-title">Manage Semesters for: {course.name}</h2>
                <form onSubmit={semesterHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Hidden input for courseId since it's implied by the current context */}
                    <input type="hidden" name="courseId" value={course.id} />
                    <div>
                        <label htmlFor="semesterNumber" className="block text-sm font-medium text-gray-700">Semester Number</label>
                        <input type="number" id="semesterNumber" name="number" value={semesterFormData.number} onChange={semesterHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="semesterType" className="block text-sm font-medium text-gray-700">Semester Type</label>
                        <select id="semesterType" name="type" value={semesterFormData.type} onChange={semesterHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select Type</option>
                            {semesterTypes.map(type => <option key={type} value={type}>{type.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="semesterAcademicYear" className="block text-sm font-medium text-gray-700">Academic Year</label>
                        <input type="number" id="semesterAcademicYear" name="academicYear" value={semesterFormData.academicYear} onChange={semesterHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>

                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            {semesterFormMode === 'create' ? 'Add Semester' : 'Update Semester'}
                        </button>
                        {semesterFormMode === 'edit' && (
                            <button type="button" onClick={() => resetSemesterForm(course.id)} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Semesters for {course.name}</h2>
            {semestersForCurrentCourse.length === 0 ? (
                <p className="text-gray-700">No semesters added for this course yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Semester Number</th>
                                <th scope="col" className="management-table-th">Type</th>
                                <th scope="col" className="management-table-th">Academic Year</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {semestersForCurrentCourse.map((semester) => (
                                <tr key={semester.id} className="management-table-tr">
                                    <td className="management-table-td">{semester.number}</td>
                                    <td className="management-table-td">{semester.type}</td>
                                    <td className="management-table-td">{semester.academicYear}</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => semesterHandlers.handleEditClick(semester)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => semesterHandlers.handleDeleteClick(semester.id)} className="table-action-button delete-button">Delete</button>
                                        <button onClick={() => onManageSections(semester)} className="table-action-button manage-button">Manage Sections</button>
                                        <button onClick={() => onManageSubjectsForSemester(semester)} className="table-action-button manage-button">Manage Subjects</button> {/* NEW BUTTON */}
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

// Section Management Component (Nested within Semester)
function SectionsForSemesterManagement({
    semester, sections, sectionFormMode, setSectionFormMode,
    currentSection, setCurrentSection, sectionFormData, setSectionFormData,
    sectionHandlers, onBackToSemesters,
    resetSectionForm
}) {
    // Filter sections to show only those for the current semester
    const sectionsForCurrentSemester = sections.filter(sec => sec.semesterId === semester.id);

    // Reset form when switching semester or back to create mode
    useEffect(() => {
        resetSectionForm(semester.id);
    }, [semester.id, sectionFormMode]); // Depend on semester.id and form mode


    return (
        <>
            <button onClick={onBackToSemesters} className="back-button">← Back to Semesters for {semester.course.name}</button>
            <div className="management-section-card">
                <h2 className="section-title">Manage Sections for: {semester.course.name} - Sem {semester.number} ({semester.type.toUpperCase()}), {semester.academicYear}</h2>
                <form onSubmit={sectionHandlers.handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Hidden input for semesterId since it's implied by the current context */}
                    <input type="hidden" name="semesterId" value={semester.id} />
                    <div>
                        <label htmlFor="sectionName" className="block text-sm font-medium text-gray-700">Section Name</label>
                        <input type="text" id="sectionName" name="name" value={sectionFormData.name} onChange={sectionHandlers.handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>

                    <div className="md:col-span-3 flex justify-end space-x-3">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            {sectionFormMode === 'create' ? 'Add Section' : 'Update Section'}
                        </button>
                        {sectionFormMode === 'edit' && (
                            <button type="button" onClick={() => resetSectionForm(semester.id)} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Sections for Sem {semester.number} ({semester.academicYear})</h2>
            {sectionsForCurrentSemester.length === 0 ? (
                <p className="text-gray-700">No sections added for this semester yet.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Section Name</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sectionsForCurrentSemester.map((section) => (
                                <tr key={section.id} className="management-table-tr">
                                    <td className="management-table-td">{section.name}</td>
                                    <td className="management-table-td actions-td">
                                        <button onClick={() => sectionHandlers.handleEditClick(section)} className="table-action-button edit-button">Edit</button>
                                        <button onClick={() => sectionHandlers.handleDeleteClick(section.id)} className="table-action-button delete-button">Delete</button>
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

// Subjects For Semester Management Component (NEW)
function SubjectsForSemesterManagement({
    semester, allSubjects, semesterSubjects,
    semesterSubjectHandlers, onBackToSemesters
}) {
    // Filter subjects already assigned to this semester
    const assignedSubjectIds = semesterSubjects
        .filter(ss => ss.semesterId === semester.id)
        .map(ss => ss.subjectId);

    const availableSubjectsForDropdown = allSubjects.filter(
        subject => !assignedSubjectIds.includes(subject.id)
    ).map(subject => ({ value: subject.id, label: `${subject.name} (${subject.code})` }));

    return (
        <>
            <button onClick={onBackToSemesters} className="back-button">← Back to Semesters for {semester.course.name}</button>
            <div className="management-section-card">
                <h2 className="section-title">Manage Subjects for: {semester.course.name} - Sem {semester.number} ({semester.type.toUpperCase()}), {semester.academicYear}</h2>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const subjectId = formData.get('subjectToAssign');
                    if (subjectId) {
                        semesterSubjectHandlers.handleAddSubject(semester.id, parseInt(subjectId));
                        e.target.reset(); // Reset the form/select
                    } else {
                        toast.error('Please select a subject to add.');
                    }
                }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="subjectToAssign" className="block text-sm font-medium text-gray-700">Add Subject</label>
                        <Select
                            id="subjectToAssign"
                            name="subjectToAssign"
                            options={availableSubjectsForDropdown}
                            placeholder="Search or Select Subject to Add..."
                            className="mt-1 basic-single"
                            classNamePrefix="select"
                            isClearable
                            isSearchable
                        />
                    </div>
                    <div className="flex items-end">
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none">
                            Add Subject to Semester
                        </button>
                    </div>
                </form>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Subjects Offered in Sem {semester.number} ({semester.academicYear})</h2>
            {semesterSubjects.filter(ss => ss.semesterId === semester.id).length === 0 ? (
                <p className="text-gray-700">No subjects currently offered in this semester.</p>
            ) : (
                <div className="overflow-x-auto management-section-card-table-container">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th scope="col" className="management-table-th">Subject Code</th>
                                <th scope="col" className="management-table-th">Subject Name</th>
                                <th scope="col" className="management-table-th actions-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {semesterSubjects
                                .filter(ss => ss.semesterId === semester.id)
                                .map((ss) => (
                                    <tr key={ss.id} className="management-table-tr">
                                        <td className="management-table-td">{ss.subject.code}</td>
                                        <td className="management-table-td">{ss.subject.name}</td>
                                        <td className="management-table-td actions-td">
                                            <button onClick={() => semesterSubjectHandlers.handleRemoveSubject(ss.id)} className="table-action-button delete-button">Remove</button>
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

// --- Main CoursesSubjectsPage component ---
function CoursesSubjectsPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Main view state: 'courses', 'subjects', 'semestersForCourse', 'sectionsForSemester', 'subjectsForSemester'
    const [activeSubSection, setActiveSubSection] = useState('courses');

    // State for selected entities when drilling down
    const [selectedCourse, setSelectedCourse] = useState(null); // When managing semesters for a specific course
    const [selectedSemester, setSelectedSemester] = useState(null); // When managing sections/subjects for a specific semester

    // Course Management States and Handlers
    const [courses, setCourses] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [courseFormMode, setCourseFormMode] = useState('create');
    const [currentCourse, setCurrentCourse] = useState(null);
    const [courseFormData, setCourseFormData] = useState({
        name: '', departmentId: '', durationYears: '', degreeType: '', totalSemesters: '', // Added totalSemesters
    });

    const fetchCoursesAndDepartments = async () => {
        try {
            const [coursesRes, departmentsRes] = await Promise.all([
                api.get('/api/course'),
                api.get('/api/course/helpers/departments'),
            ]);
            setCourses(coursesRes.data);
            setDepartments(departmentsRes.data);
        } catch (error) {
            console.error('Error fetching courses/departments:', error);
            toast.error(error.response?.data?.message || 'Failed to load course data.');
        }
    };

    const courseHandlers = {
        handleFormChange: (e) => {
            const { name, value } = e.target;
            setCourseFormData(prev => ({
                ...prev,
                [name]: (name === 'departmentId' || name === 'durationYears' || name === 'totalSemesters') ? (value ? parseInt(value) : '') : value
            }));
        },
        handleFormSubmit: async (e) => {
            e.preventDefault();
            const { totalSemesters, ...courseData } = courseFormData; // Extract totalSemesters
            if (totalSemesters !== '' && totalSemesters < 0) {
                toast.error('Total semesters cannot be negative.');
                return;
            }

            try {
                let savedCourse;
                if (courseFormMode === 'create') {
                    savedCourse = await api.post('/api/course', courseData);
                    toast.success('Course created successfully!');
                } else {
                    savedCourse = await api.put(`/api/course/${currentCourse.id}`, courseData);
                    toast.success('Course updated successfully!');
                }

                // If in create mode and totalSemesters is provided, auto-create semesters
                if (courseFormMode === 'create' && totalSemesters > 0) {
                    await Promise.all(
                        Array.from({ length: totalSemesters }, (_, i) => {
                            const semesterNumber = i + 1;
                            const semesterType = semesterNumber % 2 !== 0 ? 'odd' : 'even';
                            // Use current academic year or a sensible default
                            const currentYear = new Date().getFullYear();
                            return api.post('/api/semester', {
                                courseId: savedCourse.data.course.id, // Use ID from newly created course
                                number: semesterNumber,
                                type: semesterType,
                                academicYear: currentYear // Auto-assign current year
                            });
                        })
                    );
                    toast.success(`${totalSemesters} semesters auto-created for the new course!`);
                }


                courseHandlers.resetForm(); // Reset form using the new handler
                fetchCoursesAndDepartments(); // Re-fetch courses to update the list
            } catch (error) {
                console.error('Error saving course:', error);
                toast.error(error.response?.data?.message || 'Failed to save course.');
            }
        },
        handleEditClick: (course) => {
            setCourseFormMode('edit');
            setCurrentCourse(course);
            setCourseFormData({
                name: course.name, departmentId: course.departmentId,
                durationYears: course.durationYears, degreeType: course.degreeType,
                totalSemesters: '' // Do not pre-fill totalSemesters on edit as it's for auto-creation
            });
        },
        handleDeleteClick: async (courseId) => {
            if (window.confirm('Are you sure you want to delete this course? This might also delete associated semesters and sections. This action cannot be undone.')) {
                try {
                    await api.delete(`/api/course/${courseId}`);
                    toast.success('Course deleted successfully!');
                    fetchCoursesAndDepartments();
                } catch (error) {
                    console.error('Error deleting course:', error);
                    toast.error(error.response?.data?.message || 'Failed to delete course.');
                }
            }
        },
        resetForm: () => { // New reset function for course form
            setCourseFormMode('create');
            setCurrentCourse(null);
            setCourseFormData({ name: '', departmentId: '', durationYears: '', degreeType: '', totalSemesters: '' });
        }
    };

    // Subject Management States and Handlers
    const [subjects, setSubjects] = useState([]); // All master subjects
    const [subjectFormMode, setSubjectFormMode] = useState('create');
    const [currentSubject, setCurrentSubject] = useState(null);
    const [subjectFormData, setSubjectFormData] = useState({
        code: '', name: '', credits: '',
    });

    const fetchSubjects = async () => {
        try {
            const response = await api.get('/api/subject');
            setSubjects(response.data);
        } catch (error) {
            console.error('Error fetching subjects:', error);
            toast.error(error.response?.data?.message || 'Failed to load subjects.');
        }
    };

    const subjectHandlers = {
        handleFormChange: (e) => {
            const { name, value } = e.target;
            setSubjectFormData(prev => ({ ...prev, [name]: name === 'credits' ? (value ? parseInt(value) : '') : value }));
        },
        handleFormSubmit: async (e) => {
            e.preventDefault();
            try {
                if (subjectFormMode === 'create') {
                    await api.post('/api/subject', subjectFormData);
                    toast.success('Subject added successfully!');
                } else {
                    await api.put(`/api/subject/${currentSubject.id}`, subjectFormData);
                    toast.success('Subject updated successfully!');
                }
                subjectHandlers.resetForm(); // Use the new reset handler
                fetchSubjects();
            } catch (error) {
                console.error('Error saving subject:', error);
                toast.error(error.response?.data?.message || 'Failed to save subject.');
            }
        },
        handleEditClick: (subject) => {
            setSubjectFormMode('edit');
            setCurrentSubject(subject);
            setSubjectFormData({
                code: subject.code, name: subject.name, credits: subject.credits || '',
            });
        },
        handleDeleteClick: async (subjectId) => {
            if (window.confirm('Are you sure you want to delete this subject? This might also affect associated subject instances. This action cannot be undone.')) {
                try {
                    await api.delete(`/api/subject/${subjectId}`);
                    toast.success('Subject deleted successfully!');
                    fetchSubjects();
                } catch (error) {
                    console.error('Error deleting subject:', error);
                    toast.error(error.response?.data?.message || 'Failed to delete subject.');
                }
            }
        },
        resetForm: () => { // New reset function for subject form
            setSubjectFormMode('create');
            setCurrentSubject(null);
            setSubjectFormData({ code: '', name: '', credits: '' });
        }
    };

    // Semester Management States and Handlers
    const [semesters, setSemesters] = useState([]); // All semesters (needed for filtering in nested components)
    const [semesterFormMode, setSemesterFormMode] = useState('create');
    const [currentSemester, setCurrentSemester] = useState(null);
    const [semesterFormData, setSemesterFormData] = useState({
        courseId: '', number: '', type: '', academicYear: new Date().getFullYear(), // Default academicYear to current year
    });

    const fetchSemesters = async () => { // Fetches all semesters
        try {
            const response = await api.get('/api/semester');
            setSemesters(response.data);
        } catch (error) {
            console.error('Error fetching semesters:', error);
            toast.error(error.response?.data?.message || 'Failed to load semester data.');
        }
    };

    const semesterHandlers = {
        handleFormChange: (e) => {
            const { name, value } = e.target;
            setSemesterFormData(prev => ({ ...prev, [name]: (name === 'courseId' || name === 'number' || name === 'academicYear') ? (value ? parseInt(value) : '') : value }));
        },
        handleFormSubmit: async (e) => {
            e.preventDefault();
            // Ensure courseId is set from selectedCourse context if in nested mode
            const finalFormData = { ...semesterFormData };
            if (selectedCourse && !finalFormData.courseId) {
                finalFormData.courseId = selectedCourse.id;
            }
            if (!finalFormData.academicYear) { // Ensure academicYear is set if somehow empty
                finalFormData.academicYear = new Date().getFullYear();
            }

            try {
                if (semesterFormMode === 'create') {
                    await api.post('/api/semester', finalFormData);
                    toast.success('Semester added successfully!');
                } else {
                    await api.put(`/api/semester/${currentSemester.id}`, finalFormData);
                    toast.success('Semester updated successfully!');
                }
                semesterHandlers.resetForm(selectedCourse ? selectedCourse.id : null); // Reset form with current course context
                fetchSemesters(); // Re-fetch all semesters to update all views
            } catch (error) {
                console.error('Error saving semester:', error);
                toast.error(error.response?.data?.message || 'Failed to save semester.');
            }
        },
        handleEditClick: (semester) => {
            setSemesterFormMode('edit');
            setCurrentSemester(semester);
            setSemesterFormData({
                courseId: semester.courseId, number: semester.number, type: semester.type, academicYear: semester.academicYear,
            });
        },
        handleDeleteClick: async (semesterId) => {
            if (window.confirm('Are you sure you want to delete this semester? This might also delete associated sections. This action cannot be undone.')) {
                try {
                    await api.delete(`/api/semester/${semesterId}`);
                    toast.success('Semester deleted successfully!');
                    fetchSemesters();
                } catch (error) {
                    console.error('Error deleting semester:', error);
                    toast.error(error.response?.data?.message || 'Failed to delete semester.');
                }
            }
        },
        resetForm: (courseId = null) => { // Reset function for semester form, takes optional courseId
            setSemesterFormMode('create');
            setCurrentSemester(null);
            setSemesterFormData({ courseId: courseId || '', number: '', type: '', academicYear: new Date().getFullYear() });
        }
    };

    // Section Management States and Handlers
    const [sections, setSections] = useState([]); // All sections (needed for filtering in nested components)
    const [sectionFormMode, setSectionFormMode] = useState('create');
    const [currentSection, setCurrentSection] = useState(null);
    const [sectionFormData, setSectionFormData] = useState({
        name: '', semesterId: '',
    });

    const fetchSections = async () => { // Fetches all sections
        try {
            const response = await api.get('/api/section');
            setSections(response.data);
        } catch (error) {
            console.error('Error fetching sections:', error);
            toast.error(error.response?.data?.message || 'Failed to load section data.');
        }
    };

    const sectionHandlers = {
        handleFormChange: (e) => {
            const { name, value } = e.target;
            setSectionFormData(prev => ({ ...prev, [name]: name === 'semesterId' ? (value ? parseInt(value) : '') : value }));
        },
        handleFormSubmit: async (e) => {
            e.preventDefault();
            // Ensure semesterId is set from selectedSemester context if in nested mode
            const finalFormData = { ...sectionFormData };
            if (selectedSemester && !finalFormData.semesterId) {
                finalFormData.semesterId = selectedSemester.id;
            }

            try {
                if (sectionFormMode === 'create') {
                    await api.post('/api/section', finalFormData);
                    toast.success('Section added successfully!');
                } else {
                    await api.put(`/api/section/${currentSection.id}`, finalFormData);
                    toast.success('Section updated successfully!');
                }
                sectionHandlers.resetForm(selectedSemester ? selectedSemester.id : null); // Reset form with current semester context
                fetchSections(); // Re-fetch all sections to update all views
            } catch (error) {
                console.error('Error saving section:', error);
                toast.error(error.response?.data?.message || 'Failed to save section.');
            }
        },
        handleEditClick: (section) => {
            setSectionFormMode('edit');
            setCurrentSection(section);
            setSectionFormData({
                name: section.name, semesterId: section.semesterId,
            });
        },
        handleDeleteClick: async (sectionId) => {
            if (window.confirm('Are you sure you want to delete this section? This might also delete associated students. This action cannot be undone.')) {
                try {
                    await api.delete(`/api/section/${sectionId}`);
                    toast.success('Section deleted successfully!');
                    fetchSections();
                } catch (error) {
                    console.error('Error deleting section:', error);
                    toast.error(error.response?.data?.message || 'Failed to delete section.');
                }
            }
        },
        resetForm: (semesterId = null) => { // Reset function for section form, takes optional semesterId
            setSectionFormMode('create');
            setCurrentSection(null);
            setSectionFormData({ name: '', semesterId: semesterId || '' });
        }
    };

    // Semester-Subject Management States and Handlers (NEW)
    const [semesterSubjects, setSemesterSubjects] = useState([]); // All Semester-Subject associations

    const fetchSemesterSubjects = async () => {
        try {
            const response = await api.get('/api/semester-subject');
            setSemesterSubjects(response.data);
        } catch (error) {
            console.error('Error fetching semester-subjects:', error);
            toast.error(error.response?.data?.message || 'Failed to load semester-subject associations.');
        }
    };

    const semesterSubjectHandlers = {
        handleAddSubject: async (semesterId, subjectId) => {
            try {
                await api.post('/api/semester-subject', { semesterId, subjectId });
                toast.success('Subject added to semester successfully!');
                fetchSemesterSubjects(); // Refresh associations
            } catch (error) {
                console.error('Error adding subject to semester:', error);
                toast.error(error.response?.data?.message || 'Failed to add subject to semester.');
            }
        },
        handleRemoveSubject: async (associationId) => {
            if (window.confirm('Are you sure you want to remove this subject from the semester? This will NOT delete the subject itself.')) {
                try {
                    await api.delete(`/api/semester-subject/${associationId}`);
                    toast.success('Subject removed from semester successfully!');
                    fetchSemesterSubjects(); // Refresh associations
                } catch (error) {
                    console.error('Error removing subject from semester:', error);
                    toast.error(error.response?.data?.message || 'Failed to remove subject from semester.');
                }
            }
        },
    };


    // Combined useEffect for fetching data based on active sub-section
    useEffect(() => {
        // Always fetch courses and departments as they are needed for top-level CourseManagement
        fetchCoursesAndDepartments();
        // Fetch all subjects, semesters, sections, and semester-subjects for dropdowns and filtering in nested components
        fetchSubjects(); // All subjects for SubjectManagement tab and Subject-Semester management
        fetchSemesters(); // All semesters for Semester-Subject management
        fetchSections(); // All sections for Section management
        fetchSemesterSubjects(); // All semester-subject associations

    }, [activeSubSection]); // This useEffect runs on tab change, but fetches all general data.
                           // Specific nested fetches (like selected course's semesters) are done by handlers

    // Handlers for navigating nested views
    const handleManageSemestersForCourse = (course) => {
        setSelectedCourse(course);
        setActiveSubSection('semestersForCourse');
        semesterHandlers.resetForm(course.id); // Reset semester form with context
    };

    const handleBackToCourses = () => {
        setSelectedCourse(null);
        setActiveSubSection('courses');
        courseHandlers.resetForm(); // Reset course form state when going back
    };

    const handleManageSectionsForSemester = (semester) => {
        setSelectedSemester(semester);
        setActiveSubSection('sectionsForSemester');
        sectionHandlers.resetForm(semester.id); // Reset section form with context
    };

    const handleBackToSemesters = () => {
        setSelectedSemester(null);
        setActiveSubSection('semestersForCourse'); // Go back to semesters for the previous course
        semesterHandlers.resetForm(selectedCourse.id); // Reset semester form context
    };

    // NEW: Handler for navigating to Subjects for a Semester
    const handleManageSubjectsForSemester = (semester) => {
        setSelectedSemester(semester);
        setActiveSubSection('subjectsForSemester');
        // No specific form reset needed as AddSubject is simple post
    };


    // Conditional rendering based on active sub-section and drilling
    const renderContent = () => {
        if (activeSubSection === 'semestersForCourse' && selectedCourse) {
            return (
                <SemestersForCourseManagement
                    course={selectedCourse}
                    semesters={semesters}
                    semesterFormMode={semesterFormMode} setSemesterFormMode={setSemesterFormMode}
                    currentSemester={currentSemester} setCurrentSemester={setCurrentSemester}
                    semesterFormData={semesterFormData} setSemesterFormData={setSemesterFormData}
                    semesterHandlers={semesterHandlers}
                    onBackToCourses={handleBackToCourses}
                    onManageSections={handleManageSectionsForSemester}
                    onManageSubjectsForSemester={handleManageSubjectsForSemester} // Pass NEW handler
                    resetSemesterForm={semesterHandlers.resetForm}
                />
            );
        } else if (activeSubSection === 'sectionsForSemester' && selectedSemester) {
            return (
                <SectionsForSemesterManagement
                    semester={selectedSemester}
                    sections={sections}
                    sectionFormMode={sectionFormMode} setSectionFormMode={setSectionFormMode}
                    currentSection={currentSection} setCurrentSection={setCurrentSection}
                    sectionFormData={sectionFormData} setSectionFormData={setSectionFormData}
                    sectionHandlers={sectionHandlers}
                    onBackToSemesters={handleBackToSemesters}
                    resetSectionForm={sectionHandlers.resetForm}
                />
            );
        } else if (activeSubSection === 'subjectsForSemester' && selectedSemester) { // NEW conditional render
            return (
                <SubjectsForSemesterManagement
                    semester={selectedSemester}
                    allSubjects={subjects} // Pass all subjects for dropdown
                    semesterSubjects={semesterSubjects} // Pass all associations to filter
                    semesterSubjectHandlers={semesterSubjectHandlers}
                    onBackToSemesters={handleBackToSemesters}
                />
            );
        } else if (activeSubSection === 'courses') {
            return (
                <CourseManagement
                    user={user}
                    courses={courses} departments={departments}
                    courseFormMode={courseFormMode} setCourseFormMode={setCourseFormMode}
                    currentCourse={currentCourse} setCurrentCourse={setCurrentCourse}
                    courseFormData={courseFormData} setCourseFormData={setCourseFormData}
                    courseHandlers={courseHandlers}
                    onManageSemesters={handleManageSemestersForCourse} // Pass drill-down handler
                />
            );
        } else if (activeSubSection === 'subjects') {
            return (
                <SubjectManagement
                    user={user}
                    subjects={subjects}
                    subjectFormMode={subjectFormMode} setSubjectFormMode={setSubjectFormMode}
                    currentSubject={currentSubject} setCurrentSubject={setCurrentSubject}
                    subjectFormData={subjectFormData} setSubjectFormData={setSubjectFormData}
                    subjectHandlers={subjectHandlers}
                />
            );
        }
        return <p>Select a management option.</p>; // Fallback
    };


    return (
        <div className="pcoord-sub-page-container">
            <PageHeader dashboardTitle="ACADEMIC STRUCTURE MANAGEMENT" />
            <div className="pcoord-sub-page-main-content">

                <div className="sub-navigation-tabs mb-8">
                <button onClick={() => navigate(-1)} className="back-button">Back to PC Dashboard</button>
                    <button className={`nav-tab-button ${activeSubSection === 'courses' || activeSubSection === 'semestersForCourse' || activeSubSection === 'sectionsForSemester' || activeSubSection === 'subjectsForSemester' ? 'active' : ''}`} onClick={() => { setActiveSubSection('courses'); setSelectedCourse(null); setSelectedSemester(null); courseHandlers.resetForm(); }}>
                        Manage Courses
                    </button>
                    <button className={`nav-tab-button ${activeSubSection === 'subjects' ? 'active' : ''}`} onClick={() => { setActiveSubSection('subjects'); setSelectedCourse(null); setSelectedSemester(null); subjectHandlers.resetForm(); }}>
                        Manage Subjects
                    </button>
                </div>

                {renderContent()}

            </div>
        </div>
    );
}

export default CoursesSubjectsPage;