import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './OwnerOrders.css';

const OwnerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setError('Not logged in');
      // Fetch parent for this owner
      const { data: parentData } = await supabase.from('admin_items').select('*').eq('owner_id', user.id).single();
      setParent(parentData);
      if (parentData) {
        // Fetch orders for this parent
        const { data: ordersData } = await supabase.from('orders').select('*').eq('restaurant_id', parentData.id);
        setOrders(ordersData || []);
      }
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const handleOrderStatusChange = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (!parent) return;
    const { data: ordersData } = await supabase.from('orders').select('*').eq('restaurant_id', parent.id);
    setOrders(ordersData || []);
  };

  if (loading) return <div style={{textAlign:'center',marginTop:80}}>Loading...</div>;
  if (!parent) return <div style={{textAlign:'center',marginTop:80}}>No parent found for this owner.</div>;

  return (
    <div className="owner-orders-bg">
      <div className="owner-orders-back-arrow-outer">
        <button
          onClick={() => navigate('/owner-dashboard')}
          className="owner-orders-back-arrow-circle"
          aria-label="Back"
        >
          <span className="owner-orders-back-arrow-icon">&larr;</span>
        </button>
      </div>
      <div className="owner-orders-form">
        <div className="owner-orders-title-row">
          <span className="owner-orders-title-struct">Order Management</span>
        </div>
        <div className="owner-orders-list">
          {orders.length === 0 && <div style={{textAlign:'center',color:'#888'}}>No orders yet.</div>}
          {orders.map(order => (
            <div key={order.id} className="owner-orders-card-struct">
              <div className="owner-orders-card-row">
                <div className="order-id-struct">
                  Order #{order.id}
                </div>
                <div className="order-status-struct">
                  <span className="order-status-badge">{order.status}</span>
                </div>
              </div>
              <div className="order-detail-row"><span className="order-label">Customer:</span> {order.name} ({order.phone})</div>
              <div className="order-detail-row"><span className="order-label">Address:</span> {order.address}</div>
              <div className="order-detail-row"><span className="order-label">Total:</span> ₹{order.total_price}</div>
              <div className="order-detail-row order-status-row">
                <span className="order-label">Status:</span>
                <select
                  value={order.status}
                  onChange={e => handleOrderStatusChange(order.id, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready for Pickup</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        {error && <p style={{color:'red', textAlign: 'center'}}>{error}</p>}
      </div>
    </div>
  );
};

export default OwnerOrders; 