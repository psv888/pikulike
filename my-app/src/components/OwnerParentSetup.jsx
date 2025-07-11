import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getLatLngFromZip } from '../utils/locationFiltering';

const NominatimURL = 'https://nominatim.openstreetmap.org/search?format=json&q=';

const OwnerParentSetup = () => {
  const [form, setForm] = useState({ location: '', zipcode: '', photo: null });
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLocationChange = async (e) => {
    const value = e.target.value;
    setForm(f => ({ ...f, location: value }));
    if (value.length > 2) {
      const res = await fetch(NominatimURL + encodeURIComponent(value) + '&addressdetails=1&limit=5');
      const data = await res.json();
      setLocationSuggestions(data);
    } else {
      setLocationSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setForm(f => ({ ...f, location: suggestion.display_name }));
    setLocationSuggestions([]);
    // Try to auto-fill zipcode
    const zip = suggestion.address && (suggestion.address.postcode || suggestion.address.zipcode);
    if (zip) setForm(f => ({ ...f, zipcode: zip }));
  };

  const handleChange = e => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      setForm(f => ({ ...f, photo: files[0] }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      // Get lat/lng from zipcode
      const latLng = await getLatLngFromZip(form.zipcode);
      if (!latLng || latLng.lat == null || latLng.lon == null) throw new Error('Could not determine location from zipcode');
      // Update the owner's parent (admin_items) with location, zipcode, latitude, longitude
      const { error: updateError } = await supabase
        .from('admin_items')
        .update({ location: form.location, zipcode: form.zipcode, latitude: latLng.lat, longitude: latLng.lon })
        .eq('owner_id', user.id);
      if (updateError) throw updateError;
      setLoading(false);
      navigate('/owner-login');
    } catch (err) {
      setError(err.message || 'Failed to update parent details');
      setLoading(false);
    }
  };

  return (
    <div className="login-bg food-bg-animate">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="login-heading" style={{ color: '#ff4d5a' }}>Set Up Your Parent Details</h2>
        <div className="login-form-group left-align">
          <label>Location</label>
          <input
            name="location"
            value={form.location}
            onChange={handleLocationChange}
            placeholder="Type your address/location"
            autoComplete="off"
            required
          />
          {locationSuggestions.length > 0 && (
            <ul className="location-suggestions-dropdown" style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, marginTop: 2, padding: 0, listStyle: 'none', position: 'absolute', zIndex: 10, width: '100%' }}>
              {locationSuggestions.map((s, idx) => (
                <li
                  key={s.place_id}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f3f3' }}
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="login-form-group left-align">
          <label>Zipcode</label>
          <input
            name="zipcode"
            value={form.zipcode}
            onChange={handleChange}
            placeholder="Zipcode"
            required
          />
        </div>
        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Saving...' : 'Register'}</button>
        {error && <p style={{color:'red'}}>{error}</p>}
      </form>
      {/* Floating food SVGs for background - positioned behind all content */}
      <svg className="food-float food-float-1" width="48" height="48" viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" />
        <ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" />
        <ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" />
        <circle cx="24" cy="24" r="3" fill="#fff" />
        <path d="M18 18 Q24 20 30 18" stroke="#F59E42" strokeWidth="2" fill="none" />
        <path d="M18 30 Q24 28 30 30" stroke="#F59E42" strokeWidth="2" fill="none" />
      </svg>
      <svg className="food-float food-float-2" width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" />
        <ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" />
        <circle cx="16" cy="28" r="2" fill="#B91C1C" />
        <circle cx="28" cy="30" r="2" fill="#B91C1C" />
        <circle cx="22" cy="36" r="1.5" fill="#B91C1C" />
      </svg>
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

export default OwnerParentSetup; 