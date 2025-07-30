// rfid-attendance-system/apps/frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../lib/api'; // Our configured axios instance
import { jwtDecode } from 'jwt-decode'; // To decode JWT payload
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom'; // For programmatic navigation

// Create the Auth Context
export const AuthContext = createContext(null); // EXPORT AuthContext as a named export

// Custom hook to use the Auth Context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Stores decoded user info
  const [loading, setLoading] = useState(true); // Loading state for initial auth check
  const navigate = useNavigate(); // Get navigate function

  // Function to load user from local storage (if token exists)
  const loadUserFromToken = () => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      try {
        const decodedUser = jwtDecode(accessToken);
        setUser(decodedUser);
      } catch (error) {
        console.error("Error decoding access token:", error);
        // If token is invalid, clear it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      }
    }
    setLoading(false); // Done loading
  };

  useEffect(() => {
    loadUserFromToken();
  }, []); // Run once on component mount

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { accessToken, refreshToken, user: userData } = response.data;

      // Store tokens in local storage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Decode and set user state
      const decodedUser = jwtDecode(accessToken);
      setUser(decodedUser);
      toast.success('Login successful!');

      // Redirect based on role (simple example)
      if (decodedUser.role === 'ADMIN') {
        navigate('/admin-dashboard'); // New route for Admin
      } else if (decodedUser.role === 'TEACHER') {
        navigate('/teacher-dashboard'); // New route for Teacher
      } else if (decodedUser.role === 'PCOORD') {
        navigate('/program-coordinator-dashboard'); // New route for Program Coordinator
      } else {
        navigate('/'); // Default to home
      }

    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Login failed. Please check credentials.');
      setUser(null);
      throw error; // Re-throw to allow component to handle
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    toast('Logged out successfully!');
    navigate('/login'); // Redirect to login page
  };

  // Value provided by the context
  const authContextValue = {
    user,
    isAuthenticated: !!user, // true if user is not null
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};
