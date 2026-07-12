-- Migration: Add ML Predictions Table for Historical Tracking
-- Date: 2024-07-12
-- Purpose: Store ML prediction history for equipment health trending and analytics

-- Create ml_predictions table
CREATE TABLE IF NOT EXISTS ml_predictions (
  id SERIAL PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  rul_hours DECIMAL(10,2),
  rul_days DECIMAL(10,2),
  severity TEXT CHECK (severity IN ('normal', 'low', 'medium', 'high', 'critical')),
  failure_mode TEXT,
  recommendation TEXT,
  degradation_pct DECIMAL(5,2) CHECK (degradation_pct >= 0 AND degradation_pct <= 100),
  confidence DECIMAL(5,4) CHECK (confidence >= 0 AND confidence <= 1),
  sensor_data JSONB, -- Store the sensor readings used for prediction
  prediction_source TEXT CHECK (prediction_source IN ('ml', 'fallback', 'default')),
  prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_predictions_equipment 
  ON ml_predictions(equipment_id);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_timestamp 
  ON ml_predictions(prediction_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_equipment_timestamp 
  ON ml_predictions(equipment_id, prediction_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_severity 
  ON ml_predictions(severity);

-- Add comments for documentation
COMMENT ON TABLE ml_predictions IS 'Historical ML predictions for equipment health monitoring';
COMMENT ON COLUMN ml_predictions.equipment_id IS 'Foreign key to equipment table';
COMMENT ON COLUMN ml_predictions.health_score IS 'Calculated health score (0-100) derived from ML prediction';
COMMENT ON COLUMN ml_predictions.rul_hours IS 'Remaining Useful Life in hours';
COMMENT ON COLUMN ml_predictions.rul_days IS 'Remaining Useful Life in days (based on operating_hours_per_day)';
COMMENT ON COLUMN ml_predictions.severity IS 'Severity level from ML model: normal, low, medium, high, critical';
COMMENT ON COLUMN ml_predictions.degradation_pct IS 'Degradation percentage (0-100) from ML model';
COMMENT ON COLUMN ml_predictions.confidence IS 'Prediction confidence score (0-1)';
COMMENT ON COLUMN ml_predictions.sensor_data IS 'JSON object containing sensor readings used for prediction';
COMMENT ON COLUMN ml_predictions.prediction_source IS 'Source of prediction: ml (ML service), fallback (DB), default (no data)';

-- Create a view for latest predictions per equipment
CREATE OR REPLACE VIEW latest_ml_predictions AS
SELECT DISTINCT ON (equipment_id)
  id,
  equipment_id,
  health_score,
  rul_hours,
  rul_days,
  severity,
  failure_mode,
  recommendation,
  degradation_pct,
  confidence,
  prediction_source,
  prediction_timestamp,
  created_at
FROM ml_predictions
ORDER BY equipment_id, prediction_timestamp DESC;

COMMENT ON VIEW latest_ml_predictions IS 'Latest ML prediction for each equipment';

-- Create a function to clean up old predictions (keep last 100 per equipment)
CREATE OR REPLACE FUNCTION cleanup_old_ml_predictions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH ranked_predictions AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY equipment_id ORDER BY prediction_timestamp DESC) as rn
    FROM ml_predictions
  )
  DELETE FROM ml_predictions
  WHERE id IN (
    SELECT id FROM ranked_predictions WHERE rn > 100
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_ml_predictions() IS 'Deletes old ML predictions, keeping only the 100 most recent per equipment';

-- Optional: Create a scheduled job to run cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-ml-predictions', '0 2 * * *', 'SELECT cleanup_old_ml_predictions();');
