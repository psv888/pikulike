import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './DeliveryPersonnelLogin.css';

const OwnerLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else navigate('/owner-dashboard');
  };

  return (
    <div className="delivery-login-container food-bg-animate">
      <div className="login-card">
        <div style={{ marginBottom: '12px', marginTop: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <DotLottieReact
            src="/animations/admin.lottie"
            loop
            autoplay
            style={{ width: 120, height: 120 }}
          />
        </div>
        <h1 className="login-title">Owner Login</h1>
        <p className="login-subtitle">Access your owner dashboard</p>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" className="login-button">Login</button>
        </form>
        <div className="register-form-link" style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/owner-register">Don't have an account? <span>Register here</span></Link>
        </div>
      </div>
      {/* Floating food SVGs for background - positioned behind all content */}
      {/* Donut */}
      <svg className="food-float food-float-1" width="48" height="48" viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" />
        <ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" />
        <ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" />
        <circle cx="24" cy="24" r="3" fill="#fff" />
        <path d="M18 18 Q24 20 30 18" stroke="#F59E42" strokeWidth="2" fill="none" />
        <path d="M18 30 Q24 28 30 30" stroke="#F59E42" strokeWidth="2" fill="none" />
      </svg>
      {/* Pizza Slice */}
      <svg className="food-float food-float-2" width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" />
        <ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" />
        <circle cx="16" cy="28" r="2" fill="#B91C1C" />
        <circle cx="28" cy="30" r="2" fill="#B91C1C" />
        <circle cx="22" cy="36" r="1.5" fill="#B91C1C" />
      </svg>
      {/* Chicken Leg Piece */}
      <svg className="food-float food-float-3" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <ellipse cx="20" cy="28" rx="12" ry="6" fill="#F59E42" />
        <ellipse cx="20" cy="24" rx="10" ry="4" fill="#FDE68A" />
        <ellipse cx="20" cy="20" rx="8" ry="3" fill="#F59E42" />
        <ellipse cx="20" cy="16" rx="6" ry="2" fill="#FDE68A" />
        <ellipse cx="20" cy="12" rx="4" ry="1.5" fill="#F59E42" />
        <ellipse cx="20" cy="8" rx="2" ry="1" fill="#FDE68A" />
      </svg>
    </div>
  );
};

export default OwnerLogin; 