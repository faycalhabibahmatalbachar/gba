-- Migration: Add missing columns to orders table and ensure order_details_view exists
-- Created: 2026-02-26
-- Purpose: Support enriched orders drawer and fallback-less order queries

-- 1. Add missing columns to orders table (if they don't exist)
DO $$
BEGIN
    -- Add customer_phone_profile column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'customer_phone_profile'
    ) THEN
        ALTER TABLE orders ADD COLUMN customer_phone_profile TEXT;
        COMMENT ON COLUMN orders.customer_phone_profile IS 'Customer phone number from profile';
    END IF;

    -- Add total_items column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'total_items'
    ) THEN
        ALTER TABLE orders ADD COLUMN total_items INTEGER DEFAULT 0;
        COMMENT ON COLUMN orders.total_items IS 'Total number of items in the order';
    END IF;

    -- Add driver_name column (denormalized for quick access)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'driver_name'
    ) THEN
        ALTER TABLE orders ADD COLUMN driver_name TEXT;
        COMMENT ON COLUMN orders.driver_name IS 'Driver name (denormalized from profiles)';
    END IF;

    -- Add driver_phone column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'driver_phone'
    ) THEN
        ALTER TABLE orders ADD COLUMN driver_phone TEXT;
        COMMENT ON COLUMN orders.driver_phone IS 'Driver phone number';
    END IF;

    -- Add payment_provider column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_provider'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_provider TEXT;
        COMMENT ON COLUMN orders.payment_provider IS 'Payment provider (e.g., flutterwave, stripe)';
    END IF;

    -- Add paid_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'paid_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN paid_at TIMESTAMPTZ;
        COMMENT ON COLUMN orders.paid_at IS 'Payment confirmation timestamp';
    END IF;

    -- Add shipping columns as JSONB for flexibility
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shipping_address'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_address JSONB;
        COMMENT ON COLUMN orders.shipping_address IS 'Shipping address as JSON';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shipping_city'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_city TEXT;
        COMMENT ON COLUMN orders.shipping_city IS 'Shipping city';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shipping_district'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_district TEXT;
        COMMENT ON COLUMN orders.shipping_district IS 'Shipping district/neighborhood';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shipping_country'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_country TEXT DEFAULT 'Tchad';
        COMMENT ON COLUMN orders.shipping_country IS 'Shipping country';
    END IF;

    -- Add items column to store order items as JSONB
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'items'
    ) THEN
        ALTER TABLE orders ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN orders.items IS 'Order items as JSON array';
    END IF;
END $$;

-- 1b. Add user control columns to profiles table
DO $$
BEGIN
    -- Add avatar_url column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
        COMMENT ON COLUMN profiles.avatar_url IS 'User avatar image URL';
    END IF;

    -- Add is_suspended column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'is_suspended'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN profiles.is_suspended IS 'User account suspension status';
    END IF;

    -- Add is_blocked column (for compatibility with admin-react)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'is_blocked'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN profiles.is_blocked IS 'User account blocked status (legacy admin-react compatibility)';
    END IF;

    -- Add suspended_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'suspended_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN suspended_at TIMESTAMPTZ;
        COMMENT ON COLUMN profiles.suspended_at IS 'Timestamp when user was suspended';
    END IF;

    -- Add suspended_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'suspended_by'
    ) THEN
        ALTER TABLE profiles ADD COLUMN suspended_by UUID REFERENCES auth.users(id);
        COMMENT ON COLUMN profiles.suspended_by IS 'Admin who suspended the user';
    END IF;

    -- Add suspension_reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'suspension_reason'
    ) THEN
        ALTER TABLE profiles ADD COLUMN suspension_reason TEXT;
        COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for user suspension';
    END IF;
END $$;

-- 2. Create or replace order_details_view
-- This view joins orders with profiles to get enriched data

DROP VIEW IF EXISTS order_details_view;

CREATE VIEW order_details_view AS
SELECT 
    o.id,
    o.order_number,
    o.created_at,
    o.updated_at,
    o.customer_name,
    o.customer_phone,
    o.customer_phone_profile,
    o.status,
    o.total_amount,
    o.total_items,
    o.items,
    o.driver_id,
    COALESCE(o.driver_name, d.first_name || ' ' || d.last_name) AS driver_name,
    COALESCE(o.driver_phone, d.phone) AS driver_phone,
    o.payment_provider,
    o.paid_at,
    o.shipping_address,
    o.shipping_city,
    o.shipping_district,
    o.shipping_country,
    o.user_id,
    o.user_id AS customer_id
FROM orders o
LEFT JOIN profiles d ON d.id = o.driver_id AND d.role = 'driver';

-- Add comment to view
COMMENT ON VIEW order_details_view IS 'Enriched order view with driver details and shipping info';

-- 3. Create function to auto-update driver_name on driver assignment
CREATE OR REPLACE FUNCTION update_order_driver_info()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.driver_id IS NOT NULL THEN
        SELECT first_name || ' ' || last_name, phone
        INTO NEW.driver_name, NEW.driver_phone
        FROM profiles
        WHERE id = NEW.driver_id AND role = 'driver';
    ELSE
        NEW.driver_name := NULL;
        NEW.driver_phone := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_order_driver_info ON orders;

CREATE TRIGGER trg_update_order_driver_info
    BEFORE INSERT OR UPDATE OF driver_id ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_driver_info();

-- 4. Update RLS policies to ensure admin can access all columns
ALTER VIEW order_details_view OWNER TO postgres;

-- Grant access to authenticated users (adjust as needed for your RLS setup)
GRANT SELECT ON order_details_view TO authenticated;
GRANT SELECT ON order_details_view TO anon;

-- 5. Create index for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 6. Create trigger to sync is_blocked with is_suspended automatically
CREATE OR REPLACE FUNCTION sync_is_blocked_with_suspended()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync is_blocked with is_suspended
    NEW.is_blocked := NEW.is_suspended;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_is_blocked ON profiles;

CREATE TRIGGER trg_sync_is_blocked
    BEFORE INSERT OR UPDATE OF is_suspended ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_is_blocked_with_suspended();

-- Output confirmation
SELECT 'Migration completed: Added trigger to sync is_blocked with is_suspended' AS result;
