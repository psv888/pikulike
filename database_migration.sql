-- Database Migration for Improved Delivery Boy Assignment System
-- Run this script in your Supabase SQL Editor

-- 1. Add assignment_history column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assignment_history JSONB DEFAULT '[]';

-- 2. Add assignment_time column if not exists
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assignment_time TIMESTAMP WITH TIME ZONE;

-- 3. Add assignment_status column if not exists
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'pending';

-- 4. Add declined_delivery_person_ids column if not exists
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS declined_delivery_person_ids JSONB DEFAULT '[]';

-- 5. Add delivery_person_location column for real-time tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_person_location JSONB;

-- 6. Add is_online column to delivery_personnel if not exists
ALTER TABLE delivery_personnel 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- 7. Add latitude and longitude columns to delivery_personnel if not exists
ALTER TABLE delivery_personnel 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE delivery_personnel 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- 8. Add latitude and longitude columns to admin_items if not exists
ALTER TABLE admin_items 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE admin_items 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_assignment_status ON orders(assignment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_person_id ON orders(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_delivery_personnel_is_online ON delivery_personnel(is_online);
CREATE INDEX IF NOT EXISTS idx_delivery_personnel_location ON delivery_personnel(latitude, longitude);

-- 10. Create function to update order location for real-time tracking
CREATE OR REPLACE FUNCTION update_order_location(
    order_id INTEGER,
    lon DOUBLE PRECISION,
    lat DOUBLE PRECISION
)
RETURNS VOID AS $$
BEGIN
    UPDATE orders 
    SET delivery_person_location = jsonb_build_object(
        'type', 'Point',
        'coordinates', jsonb_build_array(lon, lat)
    )
    WHERE id = order_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Update existing orders to have proper assignment_status
UPDATE orders 
SET assignment_status = 'pending' 
WHERE assignment_status IS NULL;

-- 12. Create a view for delivery assignment analytics
CREATE OR REPLACE VIEW delivery_assignment_analytics AS
SELECT 
    o.id as order_id,
    o.assignment_status,
    o.assignment_time,
    o.delivery_person_id,
    dp.full_name as delivery_person_name,
    dp.is_online,
    o.declined_delivery_person_ids,
    o.assignment_history,
    o.status as order_status,
    o.created_at
FROM orders o
LEFT JOIN delivery_personnel dp ON o.delivery_person_id = dp.id
WHERE o.assignment_status IS NOT NULL;

-- 13. Add comments for documentation
COMMENT ON COLUMN orders.assignment_history IS 'JSON array of delivery person IDs who have been assigned this order (for round-robin tracking)';
COMMENT ON COLUMN orders.assignment_status IS 'Status of delivery assignment: pending, pending_acceptance, accepted, declined, no_delivery_available';
COMMENT ON COLUMN orders.declined_delivery_person_ids IS 'JSON array of delivery person IDs who have declined this order';
COMMENT ON COLUMN orders.assignment_time IS 'Timestamp when the order was last assigned to a delivery person';
COMMENT ON COLUMN orders.delivery_person_location IS 'Real-time location of delivery person during delivery (GeoJSON Point)';
COMMENT ON COLUMN delivery_personnel.is_online IS 'Whether the delivery person is currently online and available for assignments';
COMMENT ON COLUMN delivery_personnel.latitude IS 'Current latitude of delivery person (for distance calculations)';
COMMENT ON COLUMN delivery_personnel.longitude IS 'Current longitude of delivery person (for distance calculations)';

-- 14. Create RLS policies for the new columns
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_personnel ENABLE ROW LEVEL SECURITY;

-- Policy for delivery personnel to update their own location
CREATE POLICY "Delivery personnel can update own location" ON delivery_personnel
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for delivery personnel to view their assigned orders
CREATE POLICY "Delivery personnel can view assigned orders" ON orders
    FOR SELECT USING (delivery_person_id IN (
        SELECT id FROM delivery_personnel WHERE user_id = auth.uid()
    ));

-- Policy for delivery personnel to update their assigned orders
CREATE POLICY "Delivery personnel can update assigned orders" ON orders
    FOR UPDATE USING (delivery_person_id IN (
        SELECT id FROM delivery_personnel WHERE user_id = auth.uid()
    ));

-- 15. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON delivery_personnel TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_location TO authenticated;

-- 16. Create a function to get nearest delivery boys
CREATE OR REPLACE FUNCTION get_nearest_delivery_boys(
    restaurant_lat DOUBLE PRECISION,
    restaurant_lon DOUBLE PRECISION,
    max_distance_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
    delivery_person_id UUID,
    full_name TEXT,
    distance_km DOUBLE PRECISION,
    current_order_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dp.id,
        dp.full_name,
        (
            6371 * acos(
                cos(radians(restaurant_lat)) * 
                cos(radians(dp.latitude)) * 
                cos(radians(dp.longitude) - radians(restaurant_lon)) + 
                sin(radians(restaurant_lat)) * 
                sin(radians(dp.latitude))
            )
        ) as distance_km,
        COALESCE(order_counts.count, 0) as current_order_count
    FROM delivery_personnel dp
    LEFT JOIN (
        SELECT 
            delivery_person_id,
            COUNT(*) as count
        FROM orders 
        WHERE status IN ('accepted', 'out_for_delivery', 'picked_up')
        GROUP BY delivery_person_id
    ) order_counts ON dp.id = order_counts.delivery_person_id
    WHERE dp.is_online = true
    AND dp.latitude IS NOT NULL 
    AND dp.longitude IS NOT NULL
    AND (
        6371 * acos(
            cos(radians(restaurant_lat)) * 
            cos(radians(dp.latitude)) * 
            cos(radians(dp.longitude) - radians(restaurant_lon)) + 
            sin(radians(restaurant_lat)) * 
            sin(radians(dp.latitude))
        )
    ) <= max_distance_km
    ORDER BY distance_km ASC, current_order_count ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_nearest_delivery_boys TO authenticated; 