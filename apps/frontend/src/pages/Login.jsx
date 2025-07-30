// rfid-attendance-system/apps/frontend/src/pages/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Our AuthContext hook
import vipsLogo from '../assets/vips-logo.webp'; // Assuming you have these logos in assets
import emblemLogo from '../assets/emblem.webp'; // Assuming you have these logos in assets
import backgroundImage from '../assets/background.jpeg'; // Import the background image

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuth(); // Get login function and loading state from context

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Navigation handled within AuthContext based on role
    } catch (error) {
      // Error message handled by toast in AuthContext
      console.error("Login component caught error:", error);
    }
  };

  return (
    <div className="login-page"> {/* Main container for the login page */}
      {/* Background Image Container */}
      <div className="background-image-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
        {/* Using imported background image */}
      </div>
      {/* Background Overlay */}
      <div className="background-overlay"></div>

      {/* Top Header Bar */}
      <div className="top-header-bar">
        Student Attendance Dashboard
      </div>

      {/* Main Header Section */}
      <header className="main-header-section">
        <div className="header-left">
          {/* Ensure your logo paths are correct */}
          <img src={vipsLogo} alt="VIPS Logo" className="vips-logo" />
        </div>
        <div className="header-center">
          <h1 className="main-title">Vivekananda Institute of Professional Studies - Technical Campus</h1>
          <p className="accreditation-text">Approved by AICTE, Accredited Grade 'A++' Institution by NAAC, NBA Accredited, Recognized under Section 2(f)<br />by UGC, Affiliated to GGSIP University, Recognized by Bar Council of India, ISO 9001:2015 Certified</p>
          <h2 className="school-title">Vivekananda School of Information Technology</h2>
        </div>
        <div className="header-right">
          {/* Ensure your logo paths are correct */}
          <img src={emblemLogo} alt="Emblem Logo" className="emblem-logo" />
        </div>
      </header>

      {/* Central Login Container */}
      <div className="login-container">
        <div className="login-border">
          <form className="login-form" onSubmit={handleSubmit}>
            <h2 className="login-heading">LOGIN</h2> {/* Updated to "LOGIN" */}

            <div className="input-group">
              <label htmlFor="email-address">Email address</label> {/* Removed sr-only to make label visible */}
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="login-input" // Changed to login-input
                placeholder="Example@gmail.com" // Updated placeholder
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label> {/* Removed sr-only to make label visible */}
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="login-input" // Changed to login-input
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="w-full flex justify-end"> {/* For forgot password link alignment */}
              <a href="#" className="forgot-password-link">Forgot Password?</a>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="login-button" // Changed to login-button
              >
                {loading ? 'Logging in...' : 'Login'} {/* Updated text */}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;