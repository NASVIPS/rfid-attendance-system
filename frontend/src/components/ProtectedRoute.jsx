// rfid-attendance-system/apps/frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Our AuthContext hook
import toast from 'react-hot-toast';

// Component to protect routes based on authentication and optional roles
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="text-center p-4">Loading authentication...</div>; // Or a spinner
  }

  if (!isAuthenticated) {
    toast.error('You need to log in to access this page.');
    return <Navigate to="/login" replace />; // Redirect to login
  }

  // Check for role-based authorization if allowedRoles are specified
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    toast.error('You do not have permission to view this page.');
    // Redirect based on available role, or a generic forbidden page
    if (user?.role === 'ADMIN') return <Navigate to="/admin-dashboard" replace />;
    if (user?.role === 'TEACHER') return <Navigate to="/teacher-dashboard" replace />;
    if (user?.role === 'PCOORD') return <Navigate to="/program-coordinator-dashboard" replace />;
    return <Navigate to="/forbidden" replace />; // A generic forbidden page
  }

  return <Outlet />; // Render child routes if authenticated and authorized
};

export default ProtectedRoute;