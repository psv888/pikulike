const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testAssignmentSystem() {
  console.log('🔍 Testing Delivery Boy Assignment System...\n');

  try {
    // 1. Check if we have any delivery boys
    console.log('1. Checking delivery boys...');
    const { data: deliveryBoys, error: boysError } = await supabase
      .from('delivery_personnel')
      .select('*');
    
    if (boysError) {
      console.error('❌ Error fetching delivery boys:', boysError);
      return;
    }
    
    console.log(`✅ Found ${deliveryBoys.length} delivery boys:`, deliveryBoys.map(b => ({ id: b.id, name: b.full_name, online: b.is_online })));

    // 2. Check if we have any restaurants
    console.log('\n2. Checking restaurants...');
    const { data: restaurants, error: restError } = await supabase
      .from('admin_items')
      .select('*')
      .limit(5);
    
    if (restError) {
      console.error('❌ Error fetching restaurants:', restError);
      return;
    }
    
    console.log(`✅ Found ${restaurants.length} restaurants:`, restaurants.map(r => ({ id: r.id, name: r.name, lat: r.latitude, lng: r.longitude })));

    // 3. Check if we have any orders
    console.log('\n3. Checking orders...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(5);
    
    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return;
    }
    
    console.log(`✅ Found ${orders.length} orders:`, orders.map(o => ({ id: o.id, status: o.status, assignment_status: o.assignment_status, delivery_person_id: o.delivery_person_id })));

    // 4. Check database schema
    console.log('\n4. Checking database schema...');
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'orders' });
    
    if (schemaError) {
      console.log('⚠️ Could not check schema, but continuing...');
    } else {
      console.log('✅ Orders table columns:', columns);
    }

    // 5. Test creating a simple order
    console.log('\n5. Testing order creation...');
    const testOrderData = {
      name: 'Test Customer',
      phone: '1234567890',
      address: 'Test Address, 12345',
      total_price: 100,
      restaurant_id: restaurants[0]?.id || 1,
      status: 'pending',
      assignment_status: 'pending_acceptance'  // Changed from 'pending' to 'pending_acceptance'
    };

    const { data: newOrder, error: createError } = await supabase
      .from('orders')
      .insert([testOrderData])
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating test order:', createError);
      return;
    }

    console.log('✅ Created test order:', newOrder);

    // 6. Test assignment
    console.log('\n6. Testing assignment...');
    const assignDeliveryBoyToOrder = require('./api/assignDeliveryBoy');
    
    const assignedBoy = await assignDeliveryBoyToOrder(newOrder, newOrder.restaurant_id, []);
    
    if (assignedBoy) {
      console.log('✅ Assignment successful!');
      console.log('Assigned to:', assignedBoy.full_name, '(ID:', assignedBoy.id, ')');
    } else {
      console.log('❌ Assignment failed - no delivery boy available');
    }

    // 7. Check the updated order
    console.log('\n7. Checking updated order...');
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', newOrder.id)
      .single();

    if (updateError) {
      console.error('❌ Error fetching updated order:', updateError);
    } else {
      console.log('✅ Updated order:', {
        id: updatedOrder.id,
        assignment_status: updatedOrder.assignment_status,
        delivery_person_id: updatedOrder.delivery_person_id,
        assignment_time: updatedOrder.assignment_time
      });
    }

    // 8. Clean up test order
    console.log('\n8. Cleaning up test order...');
    await supabase
      .from('orders')
      .delete()
      .eq('id', newOrder.id);
    console.log('✅ Test order cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAssignmentSystem(); 