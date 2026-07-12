# Database Migrations

This directory contains SQL migration files for the PFMI database schema.

## How to Apply Migrations

### Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of the migration file
4. Paste and run the SQL

### Using `psql` Command Line
```bash
# Connect to your database
psql -h [your-host] -U [your-user] -d [your-database]

# Run the migration
\i db/migrations/002_add_ml_predictions_table.sql
```

### Using Supabase CLI
```bash
supabase db push
```

## Migration Files

### `001_initial_schema.sql` (Existing)
- Creates base tables: equipment, sensor_readings, maintenance_logs, alerts, profiles
- Initial schema for PFMI application

### `002_add_ml_predictions_table.sql` (New)
- Adds `ml_predictions` table for ML prediction history
- Creates indexes for performance
- Adds view `latest_ml_predictions` for quick access
- Includes cleanup function for old predictions

## Features Added in ml_predictions Table

**Tracking:**
- Health scores over time
- RUL (Remaining Useful Life) trends
- Severity changes
- Prediction confidence scores

**Benefits:**
- Historical trending and analytics
- Performance monitoring of ML models
- Audit trail for predictions
- Data for model retraining

## Rollback

To rollback the ml_predictions table:
```sql
DROP VIEW IF EXISTS latest_ml_predictions;
DROP FUNCTION IF EXISTS cleanup_old_ml_predictions();
DROP TABLE IF EXISTS ml_predictions CASCADE;
```

## Notes

- The table uses JSONB for flexible sensor data storage
- Indexes optimize queries by equipment_id and timestamp
- The cleanup function prevents unbounded growth
- All predictions are kept for at least 100 entries per equipment
