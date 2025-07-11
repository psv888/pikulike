import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './AdminOrderManagement.css';

const AdminOrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryPersonnel, setDeliveryPersonnel] = useState([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false);
  const navigate = useNavigate();

  // Order status configuration
  const orderStatuses = {
    'pending': { label: 'Order Placed', icon: '📋', color: '#ff9800' },
    'confirmed': { label: 'Order Confirmed', icon: '✅', color: '#4caf50' },
    'preparing': { label: 'Preparing', icon: '👨‍🍳', color: '#2196f3' },
    'ready': { label: 'Ready for Pickup', icon: '📦', color: '#9c27b0' },
    'out_for_delivery': { label: 'Out for Delivery', icon: '🚚', color: '#ff5722' },
    'delivered': { label: 'Delivered', icon: '🎉', color: '#4caf50' },
    'cancelled': { label: 'Cancelled', icon: '❌', color: '#f44336' }
  };

  useEffect(() => {
    fetchOrders();
    fetchDeliveryPersonnel();

    // Set up real-time subscription for order updates
    const ordersSubscription = supabase
      .channel('admin_orders_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('Order update received:', payload);
          fetchOrders(); // Refresh orders when there's an update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setSearchDebounce(searchQuery), 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            dishes (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryPersonnel = async () => {
    const { data, error } = await supabase.from('delivery_personnel').select('*');
    if (error) {
      console.error('Error fetching delivery personnel:', error);
    } else {
      setDeliveryPersonnel(data);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));

      // Close selected order if it was the one updated
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  const assignDeliveryPerson = async (orderId, personnelId) => {
    if (!personnelId) {
      alert('Please select a delivery person.');
      return;
    }
    try {
      const { error } = await supabase
        .from('orders')
        .update({ delivery_person_id: personnelId, status: 'confirmed' })
        .eq('id', orderId);

      if (error) throw error;
      
      // Manually update local state to reflect the change immediately
      setOrders(prevOrders => prevOrders.map(order => 
        order.id === orderId 
          ? { ...order, delivery_person_id: personnelId, status: 'confirmed' } 
          : order
      ));
      setSelectedOrder(null); // Close the details view
      alert('Order assigned successfully!');

    } catch (error) {
      console.error('Error assigning delivery person:', error);
      alert('Failed to assign delivery person.');
    }
  };

  const getOrderStatus = (order) => {
    return orderStatuses[order.status] || orderStatuses['pending'];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotal = (orderItems) => {
    return orderItems.reduce((total, item) => {
      return total + (item.price_at_order * item.quantity);
    }, 0);
  };

  const getOrderItemsText = (orderItems) => {
    const items = orderItems.map(item => 
      `${item.dishes?.name || 'Unknown'} (${item.quantity})`
    );
    return items.join(', ');
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(selectedOrder?.id === order.id ? null : order);
  };

  const filteredOrders = useMemo(() => orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = searchDebounce === '' || 
      order.name.toLowerCase().includes(searchDebounce.toLowerCase()) ||
      order.id.toString().includes(searchDebounce) ||
      order.phone.includes(searchDebounce);
    return matchesStatus && matchesSearch;
  }), [orders, filterStatus, searchDebounce]);

  const getStatusCount = useCallback((status) => {
    return orders.filter(order => order.status === status).length;
  }, [orders]);

  if (loading) {
    return (
      <div className="admin-order-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-order-container">
      {/* Header */}
      <header className="admin-order-header">
        <button className="back-btn" onClick={() => navigate('/admin-home')} aria-label="Back to Admin Home">
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="admin-order-header-content">
          <span className="admin-order-header-icon">📦</span>
          <div>
            <h1 className="admin-order-title">Order Management</h1>
            <div className="admin-order-subtitle">Manage, track, and update all customer orders</div>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <section className="order-stats">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-number">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon pending">📋</div>
          <div className="stat-number">{getStatusCount('pending')}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon preparing">👨‍🍳</div>
          <div className="stat-number">{getStatusCount('preparing')}</div>
          <div className="stat-label">Preparing</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon delivery">🚚</div>
          <div className="stat-number">{getStatusCount('out_for_delivery')}</div>
          <div className="stat-label">In Delivery</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon delivered">🎉</div>
          <div className="stat-number">{getStatusCount('delivered')}</div>
          <div className="stat-label">Delivered</div>
        </div>
        <div className="stat-card available-delivery" onClick={() => setShowOnlineDropdown(v => !v)} onMouseLeave={() => setShowOnlineDropdown(false)}>
          <div className="stat-icon online">🟢</div>
          <div className="stat-number">{deliveryPersonnel.filter(p => p.is_online).length}</div>
          <div className="stat-label">Available Delivery Boys</div>
          {showOnlineDropdown && (
            <>
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.18)',
                zIndex: 3999
              }} />
              <div className="online-dropdown">
                <div className="online-dropdown-caret" />
                <div className="online-dropdown-caret-inner" />
                {deliveryPersonnel.filter(p => p.is_online).length === 0 ? (
                  <div className="online-dropdown-empty">No delivery boys online</div>
                ) : deliveryPersonnel.filter(p => p.is_online).map((p, idx, arr) => (
                  <div key={p.id} className="online-dropdown-item">
                    <span className="online-person-avatar">{p.full_name?.[0]?.toUpperCase() || <span className="material-icons">person</span>}</span>
                    <div className="online-person-details">
                      <span className="online-person-name">{p.full_name}</span>
                      <span className="online-person-phone">{p.phone_number}</span>
                      {p.zipcode && <span className="online-person-zip">Zip: {p.zipcode}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Filters & Search */}
      <section className={`order-filters${showOnlineDropdown ? ' hide-search' : ''}`}>
        <div className="search-bar">
          <span className="search-icon material-icons">search</span>
          <input
            type="text"
            placeholder="Search by customer name, order ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <span className="material-icons clear-search" onClick={()=>setSearchQuery('')}>close</span>
          )}
        </div>
        <div className="status-filters">
          <button 
            className={`filter-btn${filterStatus === 'all' ? ' active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All ({orders.length})
          </button>
          {Object.entries(orderStatuses).map(([key, status]) => (
            <button 
              key={key}
              className={`filter-btn${filterStatus === key ? ' active' : ''}`}
              onClick={() => setFilterStatus(key)}
            >
              {status.icon} {status.label} ({getStatusCount(key)})
            </button>
          ))}
        </div>
      </section>

      {/* Orders List */}
      <section className="orders-list">
        {filteredOrders.length === 0 ? (
          <div className="no-orders">
            <div className="no-orders-icon">📦</div>
            <h3>No Orders Found</h3>
            <p>No orders match your current filters.</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className={`order-card${selectedOrder?.id===order.id ? ' selected' : ''}`} onClick={() => handleOrderClick(order)}>
              <div className="order-card-center">
                <h3>Order #{order.id}</h3>
                <p className="order-date">{formatDate(order.created_at)}</p>
                <div className="customer-info">
                  <span className="customer-avatar">{order.name?.[0]?.toUpperCase() || '?'}</span>
                  <span className="customer-name-phone">
                    <strong>{order.name}</strong>
                    <br />
                    {order.phone}
                  </span>
                </div>
                <p className="order-items">{getOrderItemsText(order.order_items)}</p>
                <div className="order-card-status-row">
                  <div className="status-badge" style={{ background: getOrderStatus(order).color }}>
                    <span className="status-icon">{getOrderStatus(order).icon}</span>
                    <span className="status-label">{getOrderStatus(order).label}</span>
                  </div>
                  <div className="order-total">₹{calculateTotal(order.order_items)}</div>
                </div>
              </div>
              {selectedOrder?.id === order.id && (
                <div className="order-details">
                  <div className="order-details-grid">
                    <div className="detail-section">
                      <h4>Customer Details</h4>
                      <div className="detail-item"><span className="label">Name:</span> <span className="value">{order.name}</span></div>
                      <div className="detail-item"><span className="label">Phone:</span> <span className="value">{order.phone}</span></div>
                      <div className="detail-item"><span className="label">Address:</span> <span className="value">{order.address}</span></div>
                      <div className="detail-item"><span className="label">Order Time:</span> <span className="value">{formatDate(order.created_at)}</span></div>
                    </div>
                    <div className="detail-section">
                      <h4>Order Actions</h4>
                      <div className="status-update-buttons">
                        {Object.entries(orderStatuses).map(([key, status]) => (
                          <button
                            key={key}
                            className="status-update-btn"
                            style={{ background: status.color }}
                            onClick={() => updateOrderStatus(order.id, key)}
                          >
                            {status.icon} Set to "{status.label}"
                          </button>
                        ))}
                      </div>
                      <div className="assign-delivery">
                        <h4>Assign Delivery Person</h4>
                        <select 
                          value={selectedPersonnelId} 
                          onChange={(e) => setSelectedPersonnelId(e.target.value)}
                          className="personnel-select"
                        >
                          <option value="">Select a person...</option>
                          {deliveryPersonnel.map(person => (
                            <option key={person.id} value={person.id}>
                              {person.full_name} - {person.phone_number}
                            </option>
                          ))}
                        </select>
                        <button className="assign-btn" onClick={() => assignDeliveryPerson(order.id, selectedPersonnelId)}>
                          🚚 Assign & Confirm Order
                        </button>
                      </div>
                    </div>
                    <div className="detail-section">
                      <h4>Order Items</h4>
                      {order.order_items.map((item, index) => (
                        <div key={index} className="order-item">
                          <div className="item-info">
                            <span className="item-name">{item.dishes?.name || 'Unknown Item'}</span>
                            <span className="item-quantity">x{item.quantity}</span>
                          </div>
                          <span className="item-price">₹{item.price_at_order * item.quantity}</span>
                        </div>
                      ))}
                      <div className="order-total-item">
                        <span className="total-label">Total:</span>
                        <span className="total-amount">₹{calculateTotal(order.order_items)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="quick-actions">
                    <h4>Quick Actions</h4>
                    <div className="action-buttons">
                      <button 
                        className="action-btn call-btn"
                        onClick={() => window.open(`tel:${order.phone}`)}
                      >
                        <span className="material-icons">call</span> Call Customer
                      </button>
                      <button 
                        className="action-btn message-btn"
                        onClick={() => window.open(`sms:${order.phone}`)}
                      >
                        <span className="material-icons">sms</span> Send SMS
                      </button>
                      <button 
                        className="action-btn copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(`Order #${order.id} - ${order.name} - ${order.phone}`);
                          alert('Order details copied to clipboard!');
                        }}
                      >
                        <span className="material-icons">content_copy</span> Copy Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default AdminOrderManagement; 