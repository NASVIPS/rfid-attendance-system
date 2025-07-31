// src/lib/api.js
import axios from "axios";
import toast from "react-hot-toast";

// Get backend URL from environment variables
// make it import from VITE_BACKEND_URL from vercel.json
const BASE_URL = import.meta.env.VITE_BACKEND_URL; // Fallback to local server if not set

// Create an Axios instance
const api = axios.create({
  baseURL: BASE_URL, // Use VITE_BACKEND_URL for full control
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Attach JWT token from localStorage to every request
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('accessToken'); // Use localStorage
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle token expiration and refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and it's not the refresh token request itself,
    // and we haven't already tried to refresh the token for this request
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark request as retried

      const refreshToken = localStorage.getItem('refreshToken'); // Get refresh token from localStorage
      if (refreshToken) {
        try {
          // Attempt to refresh the token
          const refreshResponse = await axios.post(`${BASE_URL}/api/auth/refresh-token`, { refreshToken });
          const { accessToken: newAccessToken } = refreshResponse.data;

          // Update tokens in localStorage
          localStorage.setItem('accessToken', newAccessToken);
          // Refresh token is typically not re-issued on every access token refresh.
          // If your backend re-issues refresh tokens, you'd update localStorage.setItem('refreshToken', newRefreshToken);

          // Update the original request's header with the new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          // Retry the original request with the new token
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh token failed or invalid, force logout
          console.error('Refresh token failed:', refreshError);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          // Redirect to login page or show a logout message
          window.location.href = '/login'; // Simple redirect, can be handled better with context/toast
          return Promise.reject(refreshError);
        }
      }
    }
    // If it's not a 401, or it's the refresh token request itself, or no refresh token,
    // or if retry fails again, just reject the promise.
    const msg = error.response?.data?.message || error.message || "Request failed. Please try again.";
    toast.error(msg); // Display error using toast
    return Promise.reject(error);
  }
);

export default api;
// Removed fetchMySubjects export as it's not the main api instance.