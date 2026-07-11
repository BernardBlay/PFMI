-- PFMI Database Schema

-- Equipment Table
CREATE TABLE IF NOT EXISTS equipment (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Healthy',
    health_score INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sensor Readings Table (for time-series data)
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(50) REFERENCES equipment(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vibration FLOAT,
    temperature FLOAT,
    pressure FLOAT,
    voltage FLOAT
);

-- Maintenance Logs Table (OCR Ingested Logs)
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(50) REFERENCES equipment(id) ON DELETE CASCADE,
    technician VARCHAR(100),
    service_date DATE NOT NULL,
    notes TEXT,
    status_after_service VARCHAR(50),
    extracted_text TEXT, -- Raw OCR text
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(50) PRIMARY KEY,
    equipment_id VARCHAR(50) REFERENCES equipment(id) ON DELETE CASCADE,
    severity VARCHAR(20) CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Insert mock data
INSERT INTO equipment (id, name, status, health_score) 
VALUES 
('EQ-101', 'Hydraulic Pump A', 'Healthy', 94),
('EQ-102', 'Cooling Fan B', 'Warning', 72),
('EQ-103', 'Rotary Motor C', 'Critical', 45)
ON CONFLICT (id) DO NOTHING;

INSERT INTO alerts (id, equipment_id, severity, message)
VALUES
('ALT-01', 'EQ-103', 'High', 'Bearing vibration exceeds safe threshold'),
('ALT-02', 'EQ-102', 'Medium', 'Temperature anomaly detected')
ON CONFLICT (id) DO NOTHING;

-- Profiles Table linked to auth.users
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- references auth.users(id)
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'Operator Node 04',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Sync trigger function from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'Operator Node 04')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger activation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable pgcrypto extension for password encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert preset operator04@pfmi.ai (Admin)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'operator04@pfmi.ai',
  crypt('demo-operator-pass', gen_salt('bf', 10)),
  NOW(),
  '{"role": "Admin", "full_name": "operator04"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert preset miller@pfmi.ai (Lead Tech)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'miller@pfmi.ai',
  crypt('demo-operator-pass', gen_salt('bf', 10)),
  NOW(),
  '{"role": "Lead Tech", "full_name": "miller"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert preset chen@pfmi.ai (Sys Eng)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'chen@pfmi.ai',
  crypt('demo-operator-pass', gen_salt('bf', 10)),
  NOW(),
  '{"role": "Sys Eng", "full_name": "chen"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;


