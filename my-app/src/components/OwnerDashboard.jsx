import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './OwnerDashboard.css';

const OwnerDashboard = () => {
  const [parent, setParent] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dishForm, setDishForm] = useState({ name: '', price: '', photo: null });
  const [dishSearch, setDishSearch] = useState('');
  const [editingDish, setEditingDish] = useState(null);
  const [orderStatusUpdate, setOrderStatusUpdate] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Fetch parent where owner_id = user.id
      const { data: parentData } = await supabase.from('admin_items').select('*').eq('owner_id', user.id).single();
      setParent(parentData);
      if (parentData) {
        // Fetch orders for this parent
        const { data: ordersData } = await supabase.from('orders').select('*').eq('restaurant_id', parentData.id);
        setOrders(ordersData || []);
        // Fetch dishes for this parent
        const { data: dishesData } = await supabase.from('dishes').select('*').eq('parent_id', parentData.id);
        setDishes(dishesData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Dish Management Handlers
  const handleDishChange = e => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      setDishForm(f => ({ ...f, photo: files[0] }));
    } else {
      setDishForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleAddDish = async e => {
    e.preventDefault();
    if (!parent) return;
    let photo_url = '';
    if (dishForm.photo) {
      // Upload photo to Supabase Storage (optional, can be improved)
      const fileExt = dishForm.photo.name.split('.').pop();
      const fileName = `dishes/${parent.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('admin-photos')
        .upload(fileName, dishForm.photo, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('admin-photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }
    const { error: insertError } = await supabase.from('dishes').insert([
      { parent_id: parent.id, name: dishForm.name, price: Number(dishForm.price), photo_url }
    ]);
    if (!insertError) {
      // Refresh dishes
      const { data: dishesData } = await supabase.from('dishes').select('*').eq('parent_id', parent.id);
      setDishes(dishesData || []);
      setDishForm({ name: '', price: '', photo: null });
    } else {
      setError(insertError.message);
    }
  };

  const handleEditDish = dish => setEditingDish(dish);

  const handleUpdateDish = async e => {
    e.preventDefault();
    if (!editingDish) return;
    let photo_url = editingDish.photo_url;
    if (dishForm.photo) {
      const fileExt = dishForm.photo.name.split('.').pop();
      const fileName = `dishes/${parent.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('admin-photos')
        .upload(fileName, dishForm.photo, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('admin-photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }
    const { error: updateError } = await supabase.from('dishes').update({
      name: dishForm.name,
      price: Number(dishForm.price),
      photo_url
    }).eq('id', editingDish.id);
    if (!updateError) {
      const { data: dishesData } = await supabase.from('dishes').select('*').eq('parent_id', parent.id);
      setDishes(dishesData || []);
      setEditingDish(null);
      setDishForm({ name: '', price: '', photo: null });
    } else {
      setError(updateError.message);
    }
  };

  const handleDeleteDish = async id => {
    await supabase.from('dishes').delete().eq('id', id);
    const { data: dishesData } = await supabase.from('dishes').select('*').eq('parent_id', parent.id);
    setDishes(dishesData || []);
  };

  // Order Management Handlers
  const handleOrderStatusChange = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    const { data: ordersData } = await supabase.from('orders').select('*').eq('restaurant_id', parent.id);
    setOrders(ordersData || []);
  };

  // Filter dishes by search
  const filteredDishes = dishes.filter(dish =>
    dish.name.toLowerCase().includes(dishSearch.toLowerCase())
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/owner-login');
  };

  if (loading) return <div>Loading...</div>;
  if (!parent) return <div>No parent found for this owner.</div>;

  return (
    <div className="owner-dashboard-bg">
      <div className="owner-dashboard-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <h2 className="owner-dashboard-title">Welcome, {parent.name}!</h2>
          <button
            onClick={handleLogout}
            className="owner-dashboard-logout-btn"
          >
            Log Out
          </button>
        </div>
        <button
          className="owner-dashboard-order-btn"
          onClick={() => navigate('/owner-orders')}
        >
          Order Management
        </button>
        <section className="owner-dashboard-section">
          <h3>Your Dishes</h3>
          <form className="owner-dashboard-dish-form" onSubmit={editingDish ? handleUpdateDish : handleAddDish}>
            <input name="name" value={dishForm.name} onChange={handleDishChange} placeholder="Dish Name" required />
            <input name="price" type="number" value={dishForm.price} onChange={handleDishChange} placeholder="Price" required />
            <input name="photo" type="file" accept="image/*" onChange={handleDishChange} />
            <button type="submit">{editingDish ? 'Update' : 'Add'} Dish</button>
            {editingDish && <button type="button" className="cancel-btn" onClick={() => { setEditingDish(null); setDishForm({ name: '', price: '', photo: null }); }}>Cancel</button>}
          </form>
          <input
            className="owner-dashboard-search"
            type="text"
            placeholder="Search dishes..."
            value={dishSearch}
            onChange={e => setDishSearch(e.target.value)}
          />
          <div className="owner-dashboard-dishes-list">
            {filteredDishes.map(dish => (
              editingDish && editingDish.id === dish.id ? (
                <div key={dish.id} className="owner-dashboard-dish-card editing">
                  <form onSubmit={handleUpdateDish} className="owner-dashboard-edit-form">
                    <input name="name" value={dishForm.name} onChange={handleDishChange} placeholder="Dish Name" required />
                    <input name="price" type="number" value={dishForm.price} onChange={handleDishChange} placeholder="Price" required />
                    <input name="photo" type="file" accept="image/*" onChange={handleDishChange} />
                    <button type="submit">Update</button>
                    <button type="button" className="cancel-btn" onClick={() => { setEditingDish(null); setDishForm({ name: '', price: '', photo: null }); }}>Cancel</button>
                  </form>
                </div>
              ) : (
                <div key={dish.id} className="owner-dashboard-dish-card">
                  {dish.photo_url && <img src={dish.photo_url} alt={dish.name} className="dish-photo" />}
                  <div className="dish-info">
                    <div className="dish-name">{dish.name}</div>
                    <div className="dish-price">₹{dish.price}</div>
                    <div className="dish-actions">
                      <button className="edit-btn" onClick={() => handleEditDish(dish)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDeleteDish(dish.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OwnerDashboard; 