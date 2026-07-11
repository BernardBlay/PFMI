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
