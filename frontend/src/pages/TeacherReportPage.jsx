// rfid-attendance-system/apps/frontend/src/pages/TeacherReportPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import PageHeader from '../components/PageHeader.jsx';
import './teacherReportPage.css'; // New CSS file for this page

function TeacherReportPage() {
  const { subjectId, sectionId } = useParams(); // Get IDs from URL
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportFilters, setReportFilters] = useState({
    from: '',
    to: new Date().toISOString().slice(0, 10), // Default 'to' to today
  });
  const [reportData, setReportData] = useState(null); // Stores the report object from backend
  const [reportLoading, setReportLoading] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [sectionName, setSectionName] = useState('');

  useEffect(() => {
    // Fetch subject and section names for display
    const fetchNames = async () => {
      try {
        // Fetch all subjects and sections to find names by ID
        const [subjectsRes, sectionsRes] = await Promise.all([
          api.get('/api/scheduled-classes/helpers/subjects'),
          api.get('/api/scheduled-classes/helpers/sections'),
        ]);

        const foundSubject = subjectsRes.data.find(s => s.id === parseInt(subjectId));
        const foundSection = sectionsRes.data.find(s => s.id === parseInt(sectionId));

        if (foundSubject) setSubjectName(`${foundSubject.name} (${foundSubject.code})`);
        if (foundSection) setSectionName(foundSection.name);

      } catch (error) {
        console.error('Error fetching subject/section names:', error);
        toast.error('Failed to load class details.');
      }
    };

    fetchNames();
    setLoading(false); // Initial loading for names is done
  }, [subjectId, sectionId]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setReportFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    setReportLoading(true);
    try {
      const { from, to } = reportFilters;
      if (!from || !to) {
        toast.error('Please select both From and To dates.');
        setReportLoading(false);
        return;
      }
      if (new Date(from) > new Date(to)) {
        toast.error('From date cannot be after To date.');
        setReportLoading(false);
        return;
      }

      // Call the backend report API
      const response = await api.get(`/api/report/${sectionId}`, {
        params: { from, to },
      });
      setReportData(response.data.report); // Backend returns { report: [...] }
      if (response.data.report.length === 0) {
        toast('No attendance records found for the selected date range.', { icon: '🤔' });
      } else {
        toast.success('Attendance report generated successfully!');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(error.response?.data?.message || 'Failed to generate report.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    const { from, to } = reportFilters;
    if (!from || !to) {
      toast.error('Please select From and To dates before downloading.');
      return;
    }
    try {
      const url = `/api/report/${sectionId}/export.xlsx?from=${from}&to=${to}`;
      const resp = await api.get(url, { responseType: 'blob' });

      const blobUrl = URL.createObjectURL(new Blob(
        [resp.data],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      ));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `attendance_report_${subjectName.replace(/[^a-zA-Z0-9]/g, '')}_${sectionName}_${from}_${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success('Excel report download initiated!');
    } catch (error) {
      console.error('Error downloading Excel report:', error);
      toast.error(error.response?.data?.message || 'Failed to download Excel report.');
    }
  };


  if (loading) {
    return (
        <div className="teacher-report-page-container">
            <PageHeader dashboardTitle="ATTENDANCE REPORT" />
            <div className="report-main-content">
                <div className="text-center p-8">Loading report page...</div>
            </div>
        </div>
    );
  }

  return (
    <div className="teacher-report-page-container">
      <PageHeader dashboardTitle="ATTENDANCE REPORT" />
      <div className="report-main-content">
        
        <h1 className="report-page-title">Attendance Report for:</h1>
        <p className="report-class-info">Subject: <span className="font-semibold">{subjectName}</span></p>
        <p className="report-class-info">Section: <span className="font-semibold">{sectionName}</span></p>

        <div className="filter-card">
          <h2 className="filter-heading">Select Date Range</h2>
          <form onSubmit={handleGenerateReport} className="report-filter-form">
            <div className="form-group">
              <label htmlFor="from-date">From Date:</label>
              <input
                type="date"
                id="from-date"
                name="from"
                value={reportFilters.from}
                onChange={handleFilterChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="to-date">To Date:</label>
              <input
                type="date"
                id="to-date"
                name="to"
                value={reportFilters.to}
                onChange={handleFilterChange}
                required
              />
            </div>
            <button type="submit" disabled={reportLoading} className="generate-report-button">
              {reportLoading ? 'Generating...' : 'Generate Report'}
            </button>
          </form>
        </div>

        {reportData && (
          <div className="report-results-card">
            <div className="report-summary">
                <button onClick={() => navigate(-1)} className="back-button">Back to Dashboard</button>
              <p>Total Classes Occurred: <span className="font-bold">{reportData.length > 0 ? reportData[0].totalCount : 0}</span></p>
              <button onClick={handleDownloadExcel} className="download-excel-button">Download Excel</button>
            </div>

            {reportData.length === 0 ? (
              <p className="no-records-message">No attendance records found for the selected range.</p>
            ) : (
              <div className="report-table-container">
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
                    {reportData.map((record) => (
                      <tr key={record.studentId}>
                        <td>{record.enrollmentNo}</td>
                        <td>{record.name}</td>
                        <td>{record.presentCount}</td>
                        <td>{record.absentCount}</td>
                        <td><span className={`attendance-percentage ${record.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>{record.percentage}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherReportPage;