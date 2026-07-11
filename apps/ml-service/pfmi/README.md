# PFMI Wheel Loader Dataset Generator

Synthetic IoT sensor dataset for training **Predictive Failure/Maintenance Intelligence** models on heavy wheel loaders.

Simulates data from **Cat 950GC, Volvo L120H, Komatsu WA380, and Hyundai HL960** across 120 machines, 10 job sites, and up to 4 years of operation.

---

## Quick Start

```bash
pip install numpy pandas

# Generate 10 million rows (~2 hours)
python generate_pfmi_fast.py --records 10000000 --machines 120 --out output

# Quick test run (5 minutes)
python generate_pfmi_fast.py --records 12000 --machines 120 --out output_test
```

Output files in `output/`:
- `wheel_loader_pfmi_full.csv` — merged dataset (~6–7 GB for 10M rows)
- `wheel_loader_pfmi_chunk_NNNN.csv` — 500k-row chunks
- `wheel_loader_pfmi_sample_1000.json` — JSON sample of first 1,000 rows

---

## Generator Files

| File | Purpose |
|---|---|
| `generate_pfmi_fast.py` | **Primary** — vectorized numpy batch generator (~1,300 rows/sec) |
| `generate_pfmi_dataset.py` | Reference — row-by-row Python generator (~600 rows/sec), more readable |
| `run_generator.py` | Simple wrapper for the row-by-row generator |

---

## Dataset Specs

| Property | Value |
|---|---|
| Records (target) | 10,000,000 |
| Columns | 93 |
| Machines | 120 |
| Manufacturers | Caterpillar, Volvo, Komatsu, Hyundai |
| Job sites | 10 (mining, quarry, port, construction) |
| Sampling interval | 5 minutes |
| Date range | 2022–2025 |
| Missing value rate | ~0.3% per numeric column (random sensor dropout) |
| Estimated file size | ~6–7 GB (merged CSV) |

---

## Column Groups (93 total)

| Group | Columns |
|---|---|
| Machine Info | Machine_ID, Manufacturer, Model, Year, Engine_Hours, Machine_Age, Serial_Number, Firmware_Version |
| GPS & Environment | Timestamp, Latitude, Longitude, Elevation, Ambient_Temperature, Humidity, Rainfall, Dust_Level, Terrain_Type, Slope, Altitude, Weather, Job_Site |
| Operating State | Engine_RPM, Fuel_Rate, Fuel_Level, Engine_Load, Hydraulic_Load, Bucket_Load, Travel_Speed, Gear, Idle_Time, PTO_Status, Working_Mode, Operator_ID, Operator_Experience, Shift |
| Engine Sensors | Coolant_Temperature, Oil_Temperature, Engine_Temperature, Oil_Pressure, Coolant_Pressure, Intake_Air_Temperature, Intake_Pressure, Exhaust_Temperature, Exhaust_Backpressure, Turbo_Boost, Fuel_Pressure, Air_Filter_Restriction |
| Hydraulic System | Hydraulic_Pressure, Hydraulic_Temperature, Pump_Efficiency, Pump_Vibration, Pump_Current, Hydraulic_Flow, Hydraulic_Oil_Level |
| Electrical | Battery_Voltage, Battery_Current, Alternator_Output, ECU_Temperature |
| Mechanical | Transmission_Temperature, Transmission_Pressure, Brake_Temperature, Brake_Pressure, Tire_Pressure_FL/FR/RL/RR, Tire_Temperature, Steering_Angle, Suspension_Vibration |
| Condition Monitoring | Overall_Vibration, FFT_Peak, RMS_Vibration, Bearing_Temperature, Bearing_Vibration, Acoustic_Noise_Level, Ultrasonic_Emission |
| Maintenance History | Last_Service_Days, Last_Service_Hours, Lubrication_Status, Filter_Age, Oil_Age, Previous_Failure_Count, Parts_Replaced, Warranty_Status |
| Diagnostics | Active_DTC, Warning_Level, Error_Code, Fault_Category |
| **Labels** | **Failure_Within_24h, Failure_Within_7d, Remaining_Useful_Life, Maintenance_Action, Failure_Type** |

---

## Failure Types (12 classes)

```
No Failure | Hydraulic Pump Failure | Bearing Wear | Engine Overheating
Fuel System Failure | Turbo Failure | Transmission Failure | Brake Failure
Tire Failure | Electrical Failure | Cooling System Failure | Sensor Failure
```

Failures emerge **naturally through component degradation** — bearing wear accumulates over 1,400+ engine-hours before triggering; the first failure arcs appear around row 2,000,000 in the 10M dataset.

---

## ML Targets

| Column | Task | Notes |
|---|---|---|
| `Failure_Within_24h` | Binary classification | ~2% positive rate; use F2-score |
| `Failure_Within_7d` | Binary classification | ~8% positive rate |
| `Remaining_Useful_Life` | Regression / Survival | Hours until failure; null when healthy |
| `Failure_Type` | 12-class classification | Severe imbalance |
| `Maintenance_Action` | Ordinal classification | Routine / Soon / Urgent |

**Train/val/test split:** time-based only — never random shuffle.
- Train: 2022-01-01 → 2024-06-30
- Val:   2024-07-01 → 2024-12-31
- Test:  2025-01-01 → 2025-12-31

**Sequence length for LSTM/Transformer:** 288 steps (24 hours) recommended.

---

## Reference Files

| File | Contents |
|---|---|
| `data_dictionary.json` | All 93 columns — type, unit, description, normal range, failure threshold, PM importance |
| `operating_ranges.json` | Sensor normal ranges, warn/critical thresholds, failure progression windows |
| `ml_guide.json` | ML targets, train/test split, preprocessing steps, anomaly detection features, sequence length guide, feature importance explanations |
| `requirements.txt` | Python dependencies (numpy, pandas only) |

---

## Realistic Behaviors Simulated

- Gradual bearing wear → rising vibration and bearing temperature over weeks
- Hydraulic pump efficiency decline → pressure drop before failure
- Cooling system degradation → rising coolant temperature in heat
- Seasonal ambient temperature variation (±10°C)
- Operator behavior differences (experience 1–25 years)
- Maintenance resets that partially restore component health
- Random sensor dropout (~0.3% per column)
- Dust level accelerating air filter restriction
- High altitude reducing turbocharger boost
- Overloading causing tire and axle stress
- J1939 DTC codes auto-generated from sensor thresholds
