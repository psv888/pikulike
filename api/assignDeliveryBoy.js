const { createClient } = require('@supabase/supabase-js');
let fetch;
try {
  fetch = global.fetch || require('node-fetch');
} catch (e) {
  fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper function to add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    
    const text = await res.text();
    console.log('Geocode API response for zipcode', zipcode, ':', text.substring(0, 200) + '...');
    
    if (text.trim().startsWith('<')) {
      console.error('Geocode API returned HTML, likely rate-limited or error page.');
      return null;
    }
    
    try {
      const data = JSON.parse(text);
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
      return null;
    } catch (e) {
      console.error('Failed to parse geocode response:', text.substring(0, 200));
      return null;
    }
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

// Calculate total delivery distance (restaurant to delivery boy + delivery boy to customer)
function calculateTotalDeliveryDistance(restaurantLat, restaurantLon, deliveryBoyLat, deliveryBoyLon, customerLat, customerLon) {
  const distanceToRestaurant = getDistanceKm(deliveryBoyLat, deliveryBoyLon, restaurantLat, restaurantLon);
  const distanceToCustomer = getDistanceKm(restaurantLat, restaurantLon, customerLat, customerLon);
  return distanceToRestaurant + distanceToCustomer;
}

async function assignDeliveryBoyToOrder(order, restaurantId, declinedIds = []) {
  try {
    console.log('Starting assignment for order:', order.id, 'restaurant:', restaurantId);
    
    // 1. Get restaurant latitude/longitude
    const { data: restaurant, error: restError } = await supabase
      .from('admin_items')
      .select('latitude, longitude, zipcode')
      .eq('id', restaurantId)
      .single();
    if (restError) console.log('Restaurant fetch error:', restError);
    console.log('Restaurant data:', restaurant);
    
    if (!restaurant) {
      console.log('No restaurant found with ID:', restaurantId);
      return null;
    }
    
    if (!restaurant.latitude || !restaurant.longitude) {
      // Fallback: try geocoding zipcode if lat/lng missing
      if (!restaurant.zipcode) {
        console.log('No restaurant zipcode found, cannot calculate distance');
        return null;
      }
      const restLatLng = await getLatLngFromZip(restaurant.zipcode);
      if (!restLatLng) {
        console.log('Could not geocode restaurant location');
        return null;
      }
      restaurant.latitude = restLatLng.lat;
      restaurant.longitude = restLatLng.lon;
    }

    // 2. Get customer delivery location (from order address)
    let customerLat = null, customerLon = null;
    if (order.address) {
      // Try to extract zipcode from address for geocoding
      const zipMatch = order.address.match(/\b\d{5,6}\b/);
      if (zipMatch) {
        const customerLatLng = await getLatLngFromZip(zipMatch[0]);
        if (customerLatLng) {
          customerLat = customerLatLng.lat;
          customerLon = customerLatLng.lon;
        }
      }
    }

    // 3. Get ALL delivery boys first (not just online ones) for debugging
    const { data: allDeliveryBoys, error: allBoysError } = await supabase
      .from('delivery_personnel')
      .select('id, full_name, latitude, longitude, zipcode, is_online');
    if (allBoysError) console.log('All delivery boys fetch error:', allBoysError);
    console.log('All delivery boys:', allDeliveryBoys);

    // 4. Get online delivery boys
    const { data: deliveryBoys, error: boysError } = await supabase
      .from('delivery_personnel')
      .select('id, full_name, latitude, longitude, zipcode, is_online')
      .eq('is_online', true);
    if (boysError) console.log('Online delivery boys fetch error:', boysError);
    console.log('Online delivery boys:', deliveryBoys);
    console.log('Declined delivery person IDs:', declinedIds);

    // If no online delivery boys, try to assign to any delivery boy
    if (!deliveryBoys || deliveryBoys.length === 0) {
      console.log('No online delivery boys found. Trying to assign to any delivery boy...');
      if (allDeliveryBoys && allDeliveryBoys.length > 0) {
        // Assign to first available delivery boy and set them online
        const firstBoy = allDeliveryBoys[0];
        console.log('Assigning to first available delivery boy:', firstBoy.full_name);
        
        // Set them online temporarily
        await supabase
          .from('delivery_personnel')
          .update({ is_online: true })
          .eq('id', firstBoy.id);
        
        deliveryBoys = [firstBoy];
      } else {
        console.log('No delivery boys found in system');
        return null;
      }
    }

    // 5. Get current order counts for each delivery boy
    const deliveryBoysWithOrders = await Promise.all(
      deliveryBoys.map(async (boy) => {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('delivery_person_id', boy.id)
          .in('status', ['accepted', 'out_for_delivery', 'picked_up']);
        
        return {
          ...boy,
          currentOrderCount: count || 0
        };
      })
    );

    // 6. Filter out declined delivery boys
    let filteredBoys = deliveryBoysWithOrders.filter(boy => !declinedIds.includes(boy.id));
    console.log('Filtered delivery boys (excluding declined):', filteredBoys.map(b => ({ id: b.id, orders: b.currentOrderCount })));

    // 7. If all online boys have declined, implement round-robin cycling
    if (filteredBoys.length === 0 && deliveryBoys.length > 0) {
      console.log('All online delivery boys have declined. Implementing round-robin cycling.');
      
      // Get the order's assignment history to determine next in rotation
      let assignmentHistory = [];
      try {
        assignmentHistory = JSON.parse(order.assignment_history || '[]');
      } catch (e) {
        assignmentHistory = [];
      }

      // Find the next delivery boy in rotation (round-robin)
      const allOnlineBoys = deliveryBoysWithOrders;
      if (allOnlineBoys.length > 0) {
        // If no history, start with first delivery boy
        if (assignmentHistory.length === 0) {
          filteredBoys = [allOnlineBoys[0]];
        } else {
          // Find the next delivery boy in rotation
          const lastAssignedId = assignmentHistory[assignmentHistory.length - 1];
          const currentIndex = allOnlineBoys.findIndex(boy => boy.id === lastAssignedId);
          const nextIndex = (currentIndex + 1) % allOnlineBoys.length;
          filteredBoys = [allOnlineBoys[nextIndex]];
        }
        console.log('Round-robin: Next delivery boy in rotation:', filteredBoys[0]);
      }
    }

    if (filteredBoys.length === 0) {
      console.log('No available delivery boy found');
      return null;
    }

    // 8. Calculate distances and sort by priority
    const boysWithDistance = [];
    
    for (const boy of filteredBoys) {
      let distance = Infinity;
      
      if (boy.latitude != null && boy.longitude != null) {
        if (customerLat && customerLon) {
          // Calculate total delivery distance (restaurant to delivery boy + restaurant to customer)
          distance = calculateTotalDeliveryDistance(
            restaurant.latitude, restaurant.longitude,
            boy.latitude, boy.longitude,
            customerLat, customerLon
          );
        } else {
          // Fallback to restaurant to delivery boy distance only
          distance = getDistanceKm(restaurant.latitude, restaurant.longitude, boy.latitude, boy.longitude);
        }
      } else if (boy.zipcode) {
        // Fallback: use zipcode geocoding
        const boyLatLng = await getLatLngFromZip(boy.zipcode);
        if (boyLatLng) {
          if (customerLat && customerLon) {
            distance = calculateTotalDeliveryDistance(
              restaurant.latitude, restaurant.longitude,
              boyLatLng.lat, boyLatLng.lon,
              customerLat, customerLon
            );
          } else {
            distance = getDistanceKm(restaurant.latitude, restaurant.longitude, boyLatLng.lat, boyLatLng.lon);
          }
        }
        await delay(1000); // avoid rate limiting
      }

      if (distance !== Infinity) {
        boysWithDistance.push({
          ...boy,
          distance: distance
        });
      }
    }

    console.log('Boys with distance:', boysWithDistance.map(b => ({ id: b.id, distance: b.distance, orders: b.currentOrderCount })));

    // 9. Sort by distance and order count (prefer closer delivery boys with fewer orders)
    boysWithDistance.sort((a, b) => {
      // Primary sort by distance
      if (Math.abs(a.distance - b.distance) < 2) { // Within 2km, consider order count
        return a.currentOrderCount - b.currentOrderCount;
      }
      return a.distance - b.distance;
    });

    const assignedBoy = boysWithDistance[0];
    
    if (!assignedBoy) {
      console.log('No suitable delivery boy found after distance calculation');
      return null;
    }

    // 10. Update assignment history and assign order
    let assignmentHistory = [];
    try {
      assignmentHistory = JSON.parse(order.assignment_history || '[]');
    } catch (e) {
      assignmentHistory = [];
    }
    assignmentHistory.push(assignedBoy.id);

    console.log('Assigning order to delivery boy:', assignedBoy.id, typeof assignedBoy.id);
    const updateObj = {
      delivery_person_id: assignedBoy.id,
      assignment_status: 'pending_acceptance',
      declined_delivery_person_ids: JSON.stringify(declinedIds),
      assignment_history: JSON.stringify(assignmentHistory),
      assignment_time: new Date().toISOString()
    };
    console.log('Assigning with:', updateObj);
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateObj)
      .eq('id', order.id)
      .select();
    console.log('Order assignment update result:', data, error);
    
    if (error) {
      console.error('Error assigning order:', error);
      return null;
    }
    
    console.log('Order assigned successfully');
    console.log('Assigned delivery boy ID:', assignedBoy.id);
    return assignedBoy;
    
  } catch (err) {
    console.error('assignDeliveryBoyToOrder error:', err);
    throw err;
  }
}

module.exports = assignDeliveryBoyToOrder; 