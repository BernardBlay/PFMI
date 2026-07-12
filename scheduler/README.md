# PFMI ML Prediction Scheduler

Automated scheduling configurations for the ML prediction pipeline (`predict_to_db.py`).

## Overview

The scheduler runs `apps/ml-service/predict_to_db.py` at regular intervals (default: every 30 minutes) to:
- Fetch latest sensor readings for all equipment
- Run ML predictions via `/predict/rul` endpoint
- Update equipment health scores and status in database
- Create alerts when health scores drop below thresholds
- Store prediction history for trending and analytics

## Prerequisites

1. **Environment Variables** - Must be set before running:
   ```bash
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_ANON_KEY=your-anon-key-here
   export ML_SERVICE_URL=http://localhost:8000
   ```

2. **ML Service** - Must be running at `ML_SERVICE_URL`
3. **Python Dependencies** - Install with `pip install -r apps/ml-service/requirements.txt`
4. **Database Migration** - Apply `db/migrations/002_add_ml_predictions_table.sql` to Supabase

## Quick Start

### Test Manually (Dry Run)
```bash
cd apps/ml-service
python predict_to_db.py --dry-run
```

### Test with Database Writes
```bash
cd apps/ml-service
python predict_to_db.py
```

## Platform-Specific Setup

### 1. Linux/macOS (Cron)

**File:** `cron.conf`

```bash
# 1. Make script executable
chmod +x apps/ml-service/predict_to_db.py

# 2. Edit crontab
crontab -e

# 3. Add these lines (update paths):
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-key
ML_SERVICE_URL=http://localhost:8000

*/30 * * * * cd /path/to/PFMI/apps/ml-service && python3 predict_to_db.py >> /var/log/pfmi-predictions.log 2>&1

# 4. Verify cron entry
crontab -l

# 5. Check logs
tail -f /var/log/pfmi-predictions.log
```

**Schedules:**
- Every 30 min: `*/30 * * * *`
- Every 15 min: `*/15 * * * *`
- Every hour: `0 * * * *`
- Daily at 2 AM: `0 2 * * *`

---

### 2. Windows (Task Scheduler)

**File:** `windows-task.xml`

**Option A: PowerShell**
```powershell
# Set environment variables (run as Administrator)
[Environment]::SetEnvironmentVariable("SUPABASE_URL", "https://your-project.supabase.co", "User")
[Environment]::SetEnvironmentVariable("SUPABASE_ANON_KEY", "your-key", "User")
[Environment]::SetEnvironmentVariable("ML_SERVICE_URL", "http://localhost:8000", "User")

# Import task (update path in XML first)
schtasks /create /xml "C:\path\to\PFMI\scheduler\windows-task.xml" /tn "PFMI ML Predictions"

# Start task manually (test)
schtasks /run /tn "PFMI ML Predictions"

# Check status
schtasks /query /tn "PFMI ML Predictions" /v /fo list
```

**Option B: Task Scheduler GUI**
1. Open Task Scheduler (`taskschd.msc`)
2. Action > Import Task
3. Select `windows-task.xml`
4. Update paths in Actions tab:
   - Program: `C:\Python\python.exe`
   - Arguments: `predict_to_db.py`
   - Start in: `C:\path\to\PFMI\apps\ml-service`
5. Test: Right-click > Run

---

### 3. Linux (systemd)

**Files:** `systemd.service`, `systemd.timer`

```bash
# 1. Update paths and env vars in systemd.service

# 2. Copy files
sudo cp scheduler/systemd.service /etc/systemd/system/pfmi-predictions.service
sudo cp scheduler/systemd.timer /etc/systemd/system/pfmi-predictions.timer

# 3. Reload systemd
sudo systemctl daemon-reload

# 4. Enable and start timer
sudo systemctl enable pfmi-predictions.timer
sudo systemctl start pfmi-predictions.timer

# 5. Check status
sudo systemctl status pfmi-predictions.timer
sudo systemctl list-timers pfmi-predictions.timer

# 6. Test service manually
sudo systemctl start pfmi-predictions.service

# 7. View logs
sudo journalctl -u pfmi-predictions.service -f

# 8. Stop timer
sudo systemctl stop pfmi-predictions.timer
```

---

### 4. Docker (Containerized Cron)

**File:** `docker-compose.yml`

```bash
# 1. Update environment variables in docker-compose.yml

# 2. Start scheduler container
docker-compose -f scheduler/docker-compose.yml up -d

# 3. View logs
docker-compose -f scheduler/docker-compose.yml logs -f

# 4. Run manually (test)
docker-compose -f scheduler/docker-compose.yml exec prediction-scheduler python3 /app/predict_to_db.py --dry-run

# 5. Stop container
docker-compose -f scheduler/docker-compose.yml down
```

---

## Configuration

### Schedule Frequency

Default: **Every 30 minutes**

Adjust based on:
- **Real-time needs**: More frequent (15 min) for critical operations
- **Data volume**: Less frequent (hourly) for large sensor datasets
- **ML service load**: Balance prediction latency vs. throughput

### Health Thresholds

Defined in `predict_to_db.py`:

```python
CRITICAL_HEALTH_THRESHOLD = 40   # <= 40% → Critical alert
HIGH_HEALTH_THRESHOLD = 60       # <= 60% → High alert
MEDIUM_HEALTH_THRESHOLD = 75     # <= 75% → Medium alert
```

Customize thresholds in the script header.

---

## Monitoring

### Check Scheduler Status

**Cron:**
```bash
crontab -l                                    # List cron jobs
tail -f /var/log/pfmi-predictions.log         # View logs
grep "Pipeline Complete" /var/log/pfmi-predictions.log  # Check runs
```

**Windows Task Scheduler:**
```powershell
schtasks /query /tn "PFMI ML Predictions"
Get-EventLog -LogName Application -Source "PFMI ML Predictions"
```

**systemd:**
```bash
systemctl status pfmi-predictions.timer       # Timer status
journalctl -u pfmi-predictions.service -n 100 # Last 100 logs
journalctl -u pfmi-predictions.service --since "1 hour ago"
```

**Docker:**
```bash
docker-compose -f scheduler/docker-compose.yml ps
docker-compose -f scheduler/docker-compose.yml logs --tail 100
```

### Verify Predictions

```sql
-- Check latest predictions
SELECT * FROM ml_predictions 
ORDER BY prediction_timestamp DESC 
LIMIT 10;

-- Equipment health score history
SELECT equipment_id, health_score, status, updated_at
FROM equipment
ORDER BY updated_at DESC;

-- ML-generated alerts
SELECT * FROM alerts 
WHERE id LIKE 'ALT-ML-%'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Script Fails to Run

1. **Check environment variables:**
   ```bash
   echo $SUPABASE_URL
   echo $ML_SERVICE_URL
   ```

2. **Verify Python path:**
   ```bash
   which python3
   ```

3. **Test script manually:**
   ```bash
   cd apps/ml-service
   python3 predict_to_db.py --dry-run
   ```

4. **Check permissions:**
   ```bash
   ls -l apps/ml-service/predict_to_db.py
   chmod +x apps/ml-service/predict_to_db.py
   ```

### ML Service Unavailable

Error: `ML service unavailable: [Errno 111] Connection refused`

**Solutions:**
- Ensure ML service is running: `curl http://localhost:8000/health`
- Check `ML_SERVICE_URL` environment variable
- Verify firewall/network access

### Database Connection Errors

Error: `Supabase configuration missing`

**Solutions:**
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Verify Supabase project is running
- Check network connectivity

### No Sensor Data

Warning: `No sensor data for EQ-XXX`

**Impact:** Equipment gets default healthy prediction (95% health)

**Solution:** Ensure sensor readings are being ingested into `sensor_readings` table

---

## Logs

### Log Locations

- **Cron**: `/var/log/pfmi-predictions.log`
- **Windows**: Task Scheduler History
- **systemd**: `journalctl -u pfmi-predictions.service`
- **Docker**: Container logs via `docker-compose logs`

### Log Format

```
2024-07-11 14:30:00 [INFO] ============================================================
2024-07-11 14:30:00 [INFO] PFMI ML-to-Database Writeback Pipeline
2024-07-11 14:30:00 [INFO] ============================================================
2024-07-11 14:30:01 [INFO] Fetching equipment from database...
2024-07-11 14:30:01 [INFO] Found 12 equipment records
2024-07-11 14:30:02 [INFO] Running ML prediction for EQ-101 (Hydraulic Pump A)
2024-07-11 14:30:03 [INFO] Updating EQ-101: health_score=87, status=Healthy
2024-07-11 14:30:03 [INFO] ✓ Updated equipment EQ-101
2024-07-11 14:30:04 [INFO] ============================================================
2024-07-11 14:30:04 [INFO] Pipeline Complete
2024-07-11 14:30:04 [INFO] ============================================================
2024-07-11 14:30:04 [INFO] Total equipment processed: 12
2024-07-11 14:30:04 [INFO] Healthy: 8
2024-07-11 14:30:04 [INFO] Warning: 3
2024-07-11 14:30:04 [INFO] Critical: 1
```

---

## Maintenance

### Update Schedule

Edit cron expression or timer unit, then reload:

**Cron:** `crontab -e`  
**systemd:** Edit timer file, then `sudo systemctl daemon-reload && sudo systemctl restart pfmi-predictions.timer`  
**Docker:** Edit `docker-compose.yml`, then `docker-compose restart`

### Pause Scheduler

**Cron:** Comment out line in `crontab -e`  
**Windows:** Task Scheduler > Disable task  
**systemd:** `sudo systemctl stop pfmi-predictions.timer`  
**Docker:** `docker-compose stop`

### Clean Up Old Predictions

```sql
-- Run cleanup function (keeps last 100 per equipment)
SELECT cleanup_old_ml_predictions();
```

Or add to cron:
```cron
0 2 * * * psql -h your-host -U your-user -d your-db -c "SELECT cleanup_old_ml_predictions();"
```

---

## Support

- **Script Issues**: Check `apps/ml-service/predict_to_db.py` logs
- **Scheduler Issues**: Verify platform-specific configuration
- **Database Issues**: Check Supabase logs and RLS policies
- **ML Service Issues**: Check ML service logs at `apps/ml-service/`

For production deployments, consider:
- High availability: Run on multiple nodes with leader election
- Monitoring: Integrate with Prometheus/Grafana
- Alerting: Send notifications on pipeline failures
- Backup: Regular database backups of `ml_predictions` table
