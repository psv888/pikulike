import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './DeliveryPersonnelLogin.css';
import Select from 'react-select';

const OwnerRegister = () => {
  const [form, setForm] = useState({ email: '', password: '', name: '', parentName: '', section: '', photo: null });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = e => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      setForm({ ...form, photo: files[0] });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    // 1. Register user in Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });
    if (signUpError) return setError(signUpError.message);

    // 2. Insert into users table
    const { error: userError } = await supabase.from('users').insert([
      { user_id: data.user.id, email: form.email, name: form.name }
    ]);
    if (userError) return setError(userError.message);

    // 3. Upload parent photo if present
    let photo_url = '';
    if (form.photo) {
      const fileExt = form.photo.name.split('.').pop();
      const fileName = `parent_photos/${data.user.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('admin-photos')
        .upload(fileName, form.photo, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('admin-photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }

    // 4. Create parent (admin_items) and link owner_id
    const { error: parentError } = await supabase.from('admin_items').insert([
      { name: form.parentName, section: form.section, owner_id: data.user.id, photo_url }
    ]);
    if (parentError) return setError(parentError.message);

    navigate('/owner-parent-setup');
  };

  // Add these options for React Select
  const sectionOptions = [
    { value: '', label: 'Select Parent Type' },
    { value: 'restaurants', label: 'Restaurant' },
    { value: 'biryani', label: 'Biryani Point' },
    { value: 'pickles', label: 'Pickles' },
    { value: 'tiffins', label: 'Tiffin Center' },
    { value: 'freshmeat', label: 'Fresh Meat Vendor' },
  ];

  return (
    <div className="delivery-login-container food-bg-animate">
      <div className="login-card">
        <h1 className="login-title">Owner Registration</h1>
        <p className="login-subtitle">Create your owner account</p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleRegister}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email" required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" required />
          </div>
          <div className="input-group">
            <label htmlFor="name">Your Name</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Your Name" required />
          </div>
          <div className="input-group">
            <label htmlFor="parentName">Restaurant/Biryani Name</label>
            <input name="parentName" value={form.parentName} onChange={handleChange} placeholder="Restaurant/Biryani Name" required />
          </div>
          <div className="input-group">
            <label htmlFor="section">Select Parent Type</label>
            <Select
              inputId="section"
              name="section"
              options={sectionOptions}
              value={sectionOptions.find(opt => opt.value === form.section)}
              onChange={option => setForm({ ...form, section: option.value })}
              placeholder="Select Parent Type"
              styles={{
                control: (provided, state) => ({
                  ...provided,
                  borderRadius: 999,
                  border: '2.5px solid #ffb347',
                  boxShadow: state.isFocused ? '0 0 0 3px rgba(255,77,90,0.10)' : 'none',
                  background: '#fff7ed',
                  paddingLeft: 2,
                  fontSize: '1.08rem',
                  minHeight: 48,
                }),
                option: (provided, state) => ({
                  ...provided,
                  borderRadius: 12,
                  background: state.isSelected ? '#ffb347' : state.isFocused ? '#fff0f3' : '#fff',
                  color: '#222',
                  fontSize: 16,
                  padding: 12,
                }),
                menu: (provided) => ({
                  ...provided,
                  borderRadius: 18,
                  zIndex: 20,
                  overflow: 'hidden',
                }),
                singleValue: (provided) => ({
                  ...provided,
                  color: '#222',
                }),
                placeholder: (provided) => ({
                  ...provided,
                  color: '#b36a4a',
                }),
                dropdownIndicator: (provided) => ({
                  ...provided,
                  color: '#b36a4a',
                }),
                indicatorSeparator: () => ({ display: 'none' }),
              }}
              isSearchable={false}
            />
          </div>
          <div className="input-group">
            <label htmlFor="photo">Upload Photo</label>
            <input name="photo" type="file" accept="image/*" onChange={handleChange} />
          </div>
          <button type="submit" className="login-button">Next</button>
        </form>
      </div>
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

export default OwnerRegister; 