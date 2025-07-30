import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader.jsx';
import { useNavigate } from 'react-router-dom';
import './attendanceReportsPage.css';

function AttendanceReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [reportFilters, setReportFilters] = useState({
    courseId: '',
    subjectId: '',
    sectionId: '', // Default to empty string for "All Sections"
    from: '',
    to: new Date().toISOString().slice(0, 10), // Default to today's date
    predefinedRange: 'custom',
  });

  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coursesRes, subjectsRes, sectionsRes] = await Promise.all([
          api.get('/api/course'),
          api.get('/api/subject'),
          api.get('/api/section'), // Using the new /api/section route to get all sections
        ]);
        setCourses(coursesRes.data);
        setSubjects(subjectsRes.data);
        setSections(sectionsRes.data);
      } catch (error) { // Added error parameter
        console.error('Error fetching filter options:', error); // Log the error
        toast.error(error.response?.data?.message || 'Failed to load filter options.'); // Display a user-friendly error
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setReportFilters(prev => ({ ...prev, [name]: value }));
    setReportData(null); // Clear previous report data on filter change
  };

  const handlePredefinedRangeChange = (e) => {
    const range = e.target.value;
    const today = new Date();
    let fromDate = '';
    let toDate = today.toISOString().slice(0, 10);

    if (range === 'weekly') {
      const firstDayOfWeek = new Date(today); // Clone today
      firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as first day of week
      fromDate = firstDayOfWeek.toISOString().slice(0, 10);
    } else if (range === 'monthly') {
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    } else if (range === 'semester') {
      const m = today.getMonth();
      const semesterStart = m <= 6 ? new Date(today.getFullYear(), 0, 1) : new Date(today.getFullYear(), 7, 1); // Assuming Jan-Jul and Aug-Dec semesters
      fromDate = semesterStart.toISOString().slice(0, 10);
    }

    setReportFilters(prev => ({
      ...prev,
      predefinedRange: range,
      from: fromDate,
      to: toDate,
    }));
    setReportData(null);
  };

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    setReportLoading(true);
    const { courseId, subjectId, sectionId, from, to } = reportFilters;

    if (!from || !to) { // Only 'from' and 'to' are strictly required now
      toast.error('Please select From Date and To Date.');
      setReportLoading(false);
      return;
    }
    if (new Date(from) > new Date(to)) {
      toast.error('From date cannot be later than To date.');
      setReportLoading(false);
      return;
    }

    try {
      const params = { from, to };
      if (sectionId) params.sectionId = sectionId; // ONLY send sectionId if it's not empty string
      if (courseId) params.courseId = courseId;
      if (subjectId) params.subjectId = subjectId;

      // Call the new backend route /api/report (without :sectionId in path)
      const response = await api.get('/api/report', { params });
      setReportData(response.data.report);
      if (response.data.report.length === 0) toast('No attendance records found.', { icon: '🤔' });
      else toast.success('Report generated successfully!');
    } catch (error) { // Added error parameter
      console.error('Error generating report:', error); // Log the error
      toast.error(error.response?.data?.message || 'Failed to generate report.'); // Display error
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    const { courseId, subjectId, sectionId, from, to } = reportFilters;

    if (!from || !to) { // Only 'from' and 'to' are strictly required now for download
      toast.error('Please select From Date and To Date.');
      return;
    }
     if (new Date(from) > new Date(to)) {
      toast.error('From date cannot be later than To date.');
      return;
    }

    try {
      const params = { from, to };
      if (sectionId) params.sectionId = sectionId; // ONLY send sectionId if it's not empty string
      if (subjectId) params.subjectId = subjectId;
      if (courseId) params.courseId = courseId;

      // Call the new backend route /api/report/export.xlsx (without :sectionId in path)
      const url = '/api/report/export.xlsx';
      const response = await api.get(url, { params, responseType: 'blob' });

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');

      // Generate a more descriptive filename
      const fileNameParts = [
        'attendance_report',
        courses.find(c => c.id === parseInt(courseId))?.name?.replace(/[^a-zA-Z0-9]/g, '') || '',
        subjects.find(s => s.id === parseInt(subjectId))?.code || '',
        sections.find(s => s.id === parseInt(sectionId))?.name || '', // This will be empty if "All Sections"
        from,
        to,
      ].filter(Boolean); // Remove empty parts

      a.href = blobUrl;
      a.download = `${fileNameParts.join('_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      toast.success('Excel downloaded successfully!');
    } catch (error) { // Added error parameter
      console.error('Error downloading Excel report:', error); // Log the error
      toast.error(error.response?.data?.message || 'Failed to download Excel report.'); // Display error
    }
  };

  if (loading) {
    return <div className="pcoord-sub-page-main-content text-center p-8">Loading Attendance Reports...</div>;
  }

  return (
    <div className="pcoord-sub-page-container">
      <PageHeader dashboardTitle="ATTENDANCE REPORTS" />
      <div className="pcoord-sub-page-main-content">
        <button onClick={() => navigate(-1)} className="back-button">Back to PC Dashboard</button>

        <h1 className="page-title">Comprehensive Attendance Reports</h1>
        <p className="page-description">Filter and view attendance data across courses, subjects, and sections.</p>

        <form onSubmit={handleGenerateReport} className="report-filter-form">
          <div className="form-group">
            <label htmlFor="courseId">Course</label>
            <select id="courseId" name="courseId" value={reportFilters.courseId} onChange={handleFilterChange}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="subjectId">Subject</label>
            <select id="subjectId" name="subjectId" value={reportFilters.subjectId} onChange={handleFilterChange}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sectionId">Section</label>
            <select id="sectionId" name="sectionId" value={reportFilters.sectionId} onChange={handleFilterChange}> {/* Removed 'required' attribute */}
              <option value="">All Sections</option> {/* Added "All Sections" option */}
              {sections.map(s => <option key={s.id} value={s.id}>{s.name} (Sem {s.semester.number}, {s.semester.course.name})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="predefinedRange">Date Range Preset</label>
            <select id="predefinedRange" name="predefinedRange" value={reportFilters.predefinedRange} onChange={handlePredefinedRangeChange}>
              <option value="custom">Custom Range</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="semester">This Semester</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="from">From Date</label>
            <input
              type="date"
              id="from"
              name="from"
              value={reportFilters.from}
              onChange={handleFilterChange}
              required
              disabled={reportFilters.predefinedRange !== 'custom'}
            />
          </div>

          <div className="form-group">
            <label htmlFor="to">To Date</label>
            <input
              type="date"
              id="to"
              name="to"
              value={reportFilters.to}
              onChange={handleFilterChange}
              required
              disabled={reportFilters.predefinedRange !== 'custom'}
            />
          </div>

          <button type="submit" disabled={reportLoading} className="generate-report-button">
            {reportLoading ? 'Generating...' : 'Generate Report'}
          </button>
        </form>

        {reportData && (
          <div className="report-results-card">
            <div className="report-summary">
              <p>Total Classes Occurred: <strong>{reportData.length > 0 ? reportData[0].totalClassesOccurred : 0}</strong></p>
              <button onClick={handleDownloadExcel} className="download-excel-button">Download Excel</button>
            </div>

            {reportData.length === 0 ? (
              <p>No attendance records found for the selected criteria.</p>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Enrollment No.</th>
                    <th>Student Name</th>
                    <th>Classes Present</th>
                    <th>Classes Absent</th>
                    <th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map(rec => (
                    <tr key={rec.studentId}>
                      <td>{rec.enrollmentNo}</td>
                      <td>{rec.name}</td>
                      <td>{rec.presentCount}</td>
                      <td>{rec.absentCount}</td>
                      <td className={rec.percentage >= 75 ? 'text-green-600' : 'text-red-600'}>
                        {rec.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendanceReportsPage;