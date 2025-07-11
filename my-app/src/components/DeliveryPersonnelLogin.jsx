import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import './DeliveryPersonnelLogin.css';

const DeliveryPersonnelLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            if (data.user) {
                navigate('/delivery-dashboard'); 
            }
        } catch (error) {
            setError(error.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="delivery-login-container food-bg-animate">
            <div className="login-card">
                <h1 className="login-title">Delivery Personnel Login</h1>
                <p className="login-subtitle">Access your delivery dashboard</p>
                
                {error && <p className="error-message">{error}</p>}
                
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                
                <div className="register-form-link" style={{ marginTop: '20px', textAlign: 'center' }}>
                    <Link to="/delivery-register">New delivery personnel? <span>Register here</span></Link>
                </div>
            </div>

            {/* Floating food SVGs for delivery login page background - positioned behind all content */}
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
            
            {/* Ice Cream Cone */}
            <svg className="food-float food-float-4" width="38" height="38" viewBox="0 0 38 38" fill="none">
                <ellipse cx="19" cy="22" rx="10" ry="6" fill="#FBBF24" />
                <ellipse cx="19" cy="18" rx="8" ry="4" fill="#F59E42" />
                <ellipse cx="19" cy="14" rx="6" ry="3" fill="#F87171" />
                <ellipse cx="19" cy="10" rx="4" ry="2" fill="#A78BFA" />
                <rect x="15" y="22" width="8" height="10" rx="2" fill="#FDE68A" />
                <ellipse cx="19" cy="32" rx="6" ry="2" fill="#F59E42" />
            </svg>
            
            {/* Burger */}
            <svg className="food-float food-float-5" width="36" height="36" viewBox="0 0 36 36" fill="none">
                <ellipse cx="18" cy="13" rx="15" ry="6" fill="#FFD966" stroke="#B45309" strokeWidth="1.5"/>
                <rect x="6" y="18" width="24" height="8" rx="4" fill="#F59E42" stroke="#B45309" strokeWidth="1.5"/>
                <ellipse cx="18" cy="28" rx="12" ry="4" fill="#A3E635" stroke="#15803D" strokeWidth="1.5"/>
            </svg>
            
            {/* French Fries */}
            <svg className="food-float food-float-6" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="12" y="8" width="8" height="16" rx="2" fill="#FDE68A" />
                <rect x="10" y="10" width="2" height="12" rx="1" fill="#F59E42" />
                <rect x="20" y="10" width="2" height="12" rx="1" fill="#F59E42" />
                <rect x="14" y="12" width="4" height="8" rx="1" fill="#F59E42" />
                <ellipse cx="16" cy="24" rx="6" ry="2" fill="#FDE68A"/>
            </svg>
            
            {/* Hot Dog */}
            <svg className="food-float food-float-7" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <ellipse cx="16" cy="16" rx="12" ry="4" fill="#F59E42" />
                <ellipse cx="16" cy="16" rx="8" ry="2" fill="#FDE68A" />
                <ellipse cx="16" cy="16" rx="4" ry="1" fill="#F59E42" />
            </svg>
            
            {/* Sushi */}
            <svg className="food-float food-float-8" width="28" height="28" viewBox="0 0 28 28" fill="none">
                <ellipse cx="14" cy="18" rx="10" ry="4" fill="#FDE68A" />
                <ellipse cx="14" cy="16" rx="8" ry="3" fill="#F59E42" />
                <ellipse cx="14" cy="14" rx="6" ry="2" fill="#FDE68A" />
                <ellipse cx="14" cy="12" rx="4" ry="1.5" fill="#F59E42" />
            </svg>
            
            {/* Taco */}
            <svg className="food-float food-float-9" width="30" height="30" viewBox="0 0 30 30" fill="none">
                <ellipse cx="15" cy="20" rx="12" ry="6" fill="#FDE68A" />
                <ellipse cx="15" cy="18" rx="10" ry="4" fill="#F59E42" />
                <ellipse cx="15" cy="16" rx="8" ry="3" fill="#A3E635" />
                <ellipse cx="15" cy="14" rx="6" ry="2" fill="#F87171" />
            </svg>
            
            {/* Cupcake */}
            <svg className="food-float food-float-10" width="26" height="26" viewBox="0 0 26 26" fill="none">
                <ellipse cx="13" cy="18" rx="8" ry="3" fill="#FDE68A"/>
                <ellipse cx="13" cy="15" rx="6" ry="2" fill="#fff"/>
                <ellipse cx="13" cy="12" rx="4" ry="1.5" fill="#F59E42"/>
                <ellipse cx="13" cy="9" rx="3" ry="1" fill="#B91C1C"/>
            </svg>
            
            {/* Croissant */}
            <svg className="food-float food-float-11" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <ellipse cx="12" cy="12" rx="10" ry="5" fill="#FDE68A" stroke="#F59E42" strokeWidth="1.5"/>
                <ellipse cx="12" cy="12" rx="6" ry="2" fill="#F59E42" />
            </svg>
            
            {/* Apple */}
            <svg className="food-float food-float-12" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <ellipse cx="11" cy="14" rx="8" ry="6" fill="#F87171" />
                <ellipse cx="11" cy="14" rx="4" ry="3" fill="#FECACA" />
                <rect x="10" y="6" width="2" height="4" rx="1" fill="#65A30D" />
                <ellipse cx="11" cy="6" rx="1.5" ry="0.8" fill="#A3E635" />
            </svg>
        </div>
    );
};

export default DeliveryPersonnelLogin; 