const assignDeliveryBoyToOrder = require('./assignDeliveryBoy');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getLatLngFromZip(zipcode, country = 'India') {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=${country}&format=json&limit=1`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ChickfillA-Delivery-App/1.0',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error('Geocoding request failed:', error.message);
    return null;
  }
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function reassignDeliveryBoy(orderId) {
  try {
    console.log('reassignDeliveryBoy called with orderId:', orderId);
    
    // 1. Fetch order with current assignment status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError) {
      console.log('Order fetch error:', orderError);
      return null;
    }
    
    if (!order) { 
      console.log('No order found for id', orderId); 
      return null; 
    }

    // 2. Check if order is already accepted
    if (order.assignment_status === 'accepted') {
      console.log('Order already accepted, no need to reassign');
      return null;
    }

    // 3. Get declined delivery person IDs
    let declinedIds = [];
    try {
      declinedIds = JSON.parse(order.declined_delivery_person_ids || '[]');
    } catch (e) { 
      console.log('Error parsing declined_delivery_person_ids:', e);
      declinedIds = []; 
    }

    // 4. Get assignment history for round-robin logic
    let assignmentHistory = [];
    try {
      assignmentHistory = JSON.parse(order.assignment_history || '[]');
    } catch (e) {
      assignmentHistory = [];
    }

    const restaurantId = order.restaurant_id;
    if (!restaurantId) { 
      console.log('No restaurant_id in order'); 
      return null; 
    }

    // 5. Check if we've cycled through all delivery boys
    const { data: allOnlineDeliveryBoys, error: boysError } = await supabase
      .from('delivery_personnel')
      .select('id')
      .eq('is_online', true);

    if (boysError) {
      console.log('Error fetching online delivery boys:', boysError);
      return null;
    }

    const allOnlineIds = allOnlineDeliveryBoys.map(boy => boy.id);
    const hasCycledThroughAll = allOnlineIds.every(id => declinedIds.includes(id));

    if (hasCycledThroughAll && allOnlineIds.length > 0) {
      console.log('All online delivery boys have been tried. Resetting declined list for round-robin.');
      declinedIds = [];
      
      // Update the order to reset declined list
      await supabase
        .from('orders')
        .update({ 
          declined_delivery_person_ids: JSON.stringify(declinedIds),
          assignment_status: 'pending_acceptance'
        })
        .eq('id', orderId);
    }

    // 6. Use the improved assignment logic
    const assignedBoy = await assignDeliveryBoyToOrder(order, restaurantId, declinedIds);
    
    if (assignedBoy) {
      console.log('Successfully reassigned order to delivery boy:', assignedBoy.id);
      return assignedBoy;
    } else {
      console.log('No available delivery boy found for reassignment');
      
      // 7. If no delivery boy available, update order status
      await supabase
        .from('orders')
        .update({ 
          assignment_status: 'no_delivery_available',
          status: 'cancelled'
        })
        .eq('id', orderId);
      
      return null;
    }
    
  } catch (err) {
    console.error('reassignDeliveryBoy error:', err);
    throw err;
  }
}

module.exports = reassignDeliveryBoy; 