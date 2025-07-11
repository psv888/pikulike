import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useLocationTracking } from '../contexts/LocationTrackingContext';
import './DeliveryDashboard.css';

const DeliveryDashboard = () => {
    const [user, setUser] = useState(null);
    const [deliveryPerson, setDeliveryPerson] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [onlineStatusLoading, setOnlineStatusLoading] = useState(false);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [trackingIntervalId, setTrackingIntervalId] = useState(null);
    const navigate = useNavigate();
    
    // Live tracking context
    const { 
        isTracking, 
        startTracking, 
        stopTracking, 
        addOrderToTracking, 
        removeOrderFromTracking 
    } = useLocationTracking();

    const watchIds = useRef({});

    // Fetching logic can be kept in useCallback as it's used by the initialization effect
    const fetchDeliveryPersonData = useCallback(async (authUser) => {
        const { data: personData, error: personError } = await supabase
            .from('delivery_personnel').select('*').eq('user_id', authUser.id).single();
        if (personError) {
            setError('Could not find your delivery profile.');
            return null;
        }
        setDeliveryPerson(personData);
        return personData;
    }, []);

    const fetchAssignedOrders = useCallback(async (personId) => {
        const { data, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('delivery_person_id', personId)
            .eq('assignment_status', 'accepted')
            .order('created_at', { ascending: false });
        if (fetchError) {
            setError('Could not fetch assigned orders.');
        } else {
            setOrders(data);
        }
    }, []);

    // Effect for initializing user and fetching initial data
    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/delivery-login');
                return;
            }
            setUser(user);
            const person = await fetchDeliveryPersonData(user);
            if (person) {
                await fetchAssignedOrders(person.id);
            }
            setLoading(false);
        };
        initialize();
    }, [navigate, fetchDeliveryPersonData, fetchAssignedOrders]);

    // Start live tracking when delivery person is loaded
    useEffect(() => {
        if (deliveryPerson?.id && !isTracking) {
            startTracking(deliveryPerson.id);
        }
    }, [deliveryPerson?.id, isTracking, startTracking]);

    // Effect for real-time tracking based on orders
    useEffect(() => {
        const watchIds = {};
        const stopTracking = (orderId) => {
            if (watchIds[orderId]) {
                navigator.geolocation.clearWatch(watchIds[orderId]);
                delete watchIds[orderId];
            }
        };
        const startTracking = (orderId) => {
            if (!navigator.geolocation) return;
            if (watchIds[orderId]) return;
            watchIds[orderId] = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const orderIdNum = Number(orderId);
                    console.log('Calling update_order_location RPC with:', {
                      order_id: orderIdNum,
                      lon: longitude,
                      lat: latitude
                    });
                    const { error } = await supabase.rpc('update_order_location', {
                      order_id: orderIdNum,
                      lon: longitude,
                      lat: latitude
                    });
                    if (error) {
                      console.error('Error updating delivery_person_location via RPC:', error);
                    }
                },
                (geoError) => {
                    stopTracking(orderId);
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
            );
        };
        orders.forEach(order => {
            if (order.status === 'out_for_delivery') {
                startTracking(order.id);
            } else {
                stopTracking(order.id);
            }
        });
        return () => {
            Object.values(watchIds).forEach(watchId => {
                navigator.geolocation.clearWatch(watchId);
            });
        };
    }, [orders]);

    // Manage tracking orders when orders change
    useEffect(() => {
        orders.forEach(order => {
            if (order.status === 'out_for_delivery') {
                addOrderToTracking(order);
            } else {
                removeOrderFromTracking(order.id);
            }
        });
    }, [orders, addOrderToTracking, removeOrderFromTracking]);

    // Poll for pending assignments with improved logic
    useEffect(() => {
        if (!user || !deliveryPerson?.id) return;
        
        const interval = setInterval(async () => {
            console.log('Polling for pending orders for delivery person:', deliveryPerson?.id);
            
            try {
                const { data: pendingOrders, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('delivery_person_id', deliveryPerson?.id)
                    .eq('assignment_status', 'pending_acceptance');
                
                if (error) {
                    console.error('Error fetching pending orders:', error);
                    return;
                }
                
                console.log('Pending orders found:', pendingOrders);
                
                if (pendingOrders && pendingOrders.length > 0) {
                    const order = pendingOrders[0];
                    
                    // Check if order has been assigned for too long (60 seconds instead of 30)
                    if (order.assignment_time) {
                        const assignedAt = new Date(order.assignment_time);
                        const now = new Date();
                        const timeSinceAssignment = now - assignedAt;
                        
                        if (timeSinceAssignment > 60000) { // 60 seconds
                            console.log('Order assignment expired, auto-declining and reassigning');
                            
                            // Auto-decline and reassign
                            let declinedIds = [];
                            try {
                                declinedIds = JSON.parse(order.declined_delivery_person_ids || '[]');
                            } catch { 
                                declinedIds = []; 
                            }
                            
                            if (!declinedIds.includes(deliveryPerson.id)) {
                                declinedIds.push(deliveryPerson.id);
                            }
                            
                            // Update order with declined status
                            await supabase
                                .from('orders')
                                .update({ 
                                    assignment_status: 'declined',
                                    declined_delivery_person_ids: JSON.stringify(declinedIds)
                                })
                                .eq('id', order.id);
                            
                            // Trigger reassignment via backend
                            try {
                                const response = await fetch('https://pikulike.onrender.com/reassign-delivery-boy', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ orderId: order.id })
                                });
                                
                                if (!response.ok) {
                                    console.error('Failed to trigger reassignment:', response.statusText);
                                }
                            } catch (fetchError) {
                                console.error('Error triggering reassignment:', fetchError);
                            }
                            
                            setShowPopup(false);
                            setPendingOrder(null);
                            return;
                        }
                    }
                    
                    // Show pending order popup
                    setPendingOrder(order);
                    setShowPopup(true);
                } else {
                    setShowPopup(false);
                    setPendingOrder(null);
                }
            } catch (error) {
                console.error('Error in polling for pending orders:', error);
            }
        }, 5000); // Poll every 5 seconds instead of 3
        
        return () => clearInterval(interval);
    }, [user, deliveryPerson]);

    // 60-second auto-decline timer for pending order popup
    useEffect(() => {
        if (showPopup && pendingOrder) {
            const timer = setTimeout(() => {
                // Auto-decline and reassign if not accepted/declined in 60 seconds
                handleDecline();
            }, 60000); // 60 seconds
            return () => clearTimeout(timer);
        }
    }, [showPopup, pendingOrder]);

    const handleAccept = async () => {
        if (!pendingOrder) return;
        
        try {
            const { error } = await supabase
                .from('orders')
                .update({ 
                    assignment_status: 'accepted',
                    status: 'confirmed' // changed from 'assigned' to 'confirmed'
                })
                .eq('id', pendingOrder.id);
                
            if (error) {
                console.error('Error accepting order:', error);
                alert('Failed to accept order. Please try again.');
                return;
            }
            
            setShowPopup(false);
            setPendingOrder(null);
            
            // Refresh the page to show the new order
            window.location.reload();
        } catch (error) {
            console.error('Error accepting order:', error);
            alert('Failed to accept order. Please try again.');
        }
    };

    const handleDecline = async () => {
        if (!pendingOrder) return;
        
        try {
            // 1. Update assignment_status and add to declined_delivery_person_ids
            let declinedIds = [];
            try {
                declinedIds = JSON.parse(pendingOrder.declined_delivery_person_ids || '[]');
            } catch { 
                declinedIds = []; 
            }
            
            if (!declinedIds.includes(deliveryPerson.id)) {
                declinedIds.push(deliveryPerson.id);
            }
            
            const { error: updateError } = await supabase
                .from('orders')
                .update({ 
                    assignment_status: 'declined',
                    declined_delivery_person_ids: JSON.stringify(declinedIds)
                })
                .eq('id', pendingOrder.id);
                
            if (updateError) {
                console.error('Error declining order:', updateError);
                alert('Failed to decline order. Please try again.');
                return;
            }
            
            setShowPopup(false);
            setPendingOrder(null);
            
            // 2. Trigger reassignment via backend
            try {
                const response = await fetch('https://pikulike.onrender.com/reassign-delivery-boy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: pendingOrder.id })
                });
                
                if (!response.ok) {
                    console.error('Failed to trigger reassignment:', response.statusText);
                } else {
                    console.log('Reassignment triggered successfully');
                }
            } catch (fetchError) {
                console.error('Error triggering reassignment:', fetchError);
            }
            
            // Refresh the page after a short delay to show updated status
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            console.error('Error declining order:', error);
            alert('Failed to decline order. Please try again.');
        }
    };

    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        const { error: updateError } = await supabase
            .from('orders').update({ status: newStatus }).eq('id', orderId);
        if (updateError) {
            alert('Error updating status: ' + updateError.message);
        } else {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        }
    };

    const handleLogout = async () => {
        // Stop live tracking before logout
        stopTracking();
        await supabase.auth.signOut();
        navigate('/delivery-login');
    };

    const handleToggleOnlineStatus = async () => {
        if (!deliveryPerson) return;
        setOnlineStatusLoading(true);
        const newStatus = !deliveryPerson.is_online;
        const { error } = await supabase
            .from('delivery_personnel')
            .update({ is_online: newStatus })
            .eq('user_id', user.id);
        if (!error) {
            setDeliveryPerson(prev => ({ ...prev, is_online: newStatus }));
        }
        setOnlineStatusLoading(false);
    };

    const handleStartDelivery = async (orderId) => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }
        // Initial location update
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            await supabase
                .from('orders')
                .update({
                    status: 'out_for_delivery',
                    delivery_person_location: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    }
                })
                .eq('id', orderId);
            // Start interval for real-time updates
            const intervalId = setInterval(() => {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    await supabase
                        .from('orders')
                        .update({
                            delivery_person_location: {
                                type: 'Point',
                                coordinates: [longitude, latitude]
                            }
                        })
                        .eq('id', orderId);
                });
            }, 5000); // every 5 seconds
            setTrackingIntervalId(intervalId);
        });
    };

    // Periodically send live location to backend when online
    useEffect(() => {
        let intervalId;
        if (deliveryPerson?.is_online && deliveryPerson?.id) {
            const sendLocation = () => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            const { latitude, longitude } = position.coords;
                            // Update delivery_personnel table with new location
                            await supabase
                                .from('delivery_personnel')
                                .update({ latitude, longitude })
                                .eq('id', deliveryPerson.id);
                        },
                        (error) => {
                            console.error('Error getting location:', error);
                        }
                    );
                }
            };
            // Send immediately and then every 30 seconds
            sendLocation();
            intervalId = setInterval(sendLocation, 30000);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [deliveryPerson?.is_online, deliveryPerson?.id]);

    if (loading) return <div className="dashboard-loading">Loading Dashboard...</div>;
    if (error) return <div className="dashboard-error">Error: {error}</div>;

    return (
        <div className="delivery-dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-main-row">
                    <div className="dashboard-header-title">Delivery Dashboard</div>
                </div>
                <div className="dashboard-header-main-row">
                    <div className="dashboard-header-user">Welcome, {deliveryPerson?.name || user?.email?.split('@')[0]}</div>
                    <button className="logout-button logout-inline" onClick={handleLogout}>Logout</button>
                </div>
                <div className="dashboard-header-toggle">
                    <div className="online-toggle-switch" onClick={onlineStatusLoading ? undefined : handleToggleOnlineStatus} tabIndex={0} role="button" aria-pressed={deliveryPerson?.is_online}>
                        <div className={`toggle-track${deliveryPerson?.is_online ? ' online' : ' offline'}`}> 
                          {deliveryPerson?.is_online ? (
                            <>
                              <span className="toggle-label online">Online</span>
                              <div className="toggle-thumb online"></div>
                            </>
                          ) : (
                            <>
                              <div className="toggle-thumb offline"></div>
                              <span className="toggle-label offline">Offline</span>
                            </>
                          )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="dashboard-content">
                <h2>Your Assigned Orders</h2>
                {loading ? (
                    <div className="dashboard-loading">Loading...</div>
                ) : error ? (
                    <div className="dashboard-error">{error}</div>
                ) : orders.length === 0 ? (
                    <div className="orders-list-placeholder">You have no orders assigned.</div>
                ) : (
                    <div className="delivery-orders-grid">
                        {orders.map(order => (
                            <div key={order.id} className={`delivery-order-card status-${order.status}`}>
                                <div className="card-header">
                                    <h3>Order #{order.id}</h3>
                                    <span className={`status-tag status-${order.status}`}>{order.status.replace(/_/g, ' ')}</span>
                                </div>
                                <div className="card-content">
                                    <p><strong>Customer:</strong> {order.name}</p>
                                    <p><strong>Address:</strong> {order.address}</p>
                                    <p><strong>Phone:</strong> {order.phone}</p>
                                </div>
                                <div className="card-actions">
                                    {order.status !== 'out_for_delivery' && (
                                        <button onClick={() => handleUpdateOrderStatus(order.id, 'out_for_delivery')} className="action-button pickup">Start Delivery</button>
                                    )}
                                    {order.status === 'out_for_delivery' && (
                                        <button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} className="action-button deliver">Mark as Delivered</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            {showPopup && pendingOrder && (
                <div className="order-popup-modal" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.35)',
                    zIndex: 3000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 8px 32px rgba(26,115,232,0.18)',
                        padding: '32px 36px',
                        minWidth: 320,
                        maxWidth: '90vw',
                        textAlign: 'center',
                        position: 'relative',
                    }}>
                        <h2 style={{marginBottom: 18}}>New Order Assignment</h2>
                        <p style={{fontSize: 18, marginBottom: 8}}>You have a new order to deliver!</p>
                        <p style={{fontWeight: 700, fontSize: 20, marginBottom: 18}}>Order #{pendingOrder.id}</p>
                        <p><strong>Customer:</strong> {pendingOrder.name}</p>
                        <p><strong>Address:</strong> {pendingOrder.address}</p>
                        <div style={{display: 'flex', gap: 18, justifyContent: 'center', marginTop: 24}}>
                            <button onClick={handleAccept} style={{background:'#3ec16c', color:'#fff', border:'none', borderRadius:8, padding:'10px 28px', fontWeight:700, fontSize:16, cursor:'pointer'}}>Accept</button>
                            <button onClick={handleDecline} style={{background:'#ff4d5a', color:'#fff', border:'none', borderRadius:8, padding:'10px 28px', fontWeight:700, fontSize:16, cursor:'pointer'}}>Decline</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeliveryDashboard;