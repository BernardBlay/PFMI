import os
import pandas as pd
import requests
import json

def load_env_vars():
    # Read apps/web/.env.local to find Supabase keys
    env_path = os.path.join("..", "web", ".env.local")
    if not os.path.exists(env_path):
        env_path = os.path.join("apps", "web", ".env.local")
        
    url, key = None, None
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                    url = line.split("=", 1)[1].strip()
                elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                    key = line.split("=", 1)[1].strip()
    return url, key

def get_auth_token(supabase_url, supabase_key):
    print("Authenticating as Admin user (operator04@pfmi.ai)...")
    auth_url = f"{supabase_url}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": supabase_key,
        "Content-Type": "application/json"
    }
    payload = {
        "email": "operator04@pfmi.ai",
        "password": "demo-operator-pass"
    }
    res = requests.post(auth_url, headers=headers, json=payload)
    if res.status_code == 200:
        data = res.json()
        print("Authentication successful!")
        return data.get("access_token")
    else:
        print(f"Auth failed: {res.status_code} {res.text}")
        return None

def seed_data():
    csv_path = r"C:\Users\Thinkpad X270\Downloads\mining_haul_truck_telemetry_1k.csv"
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return

    supabase_url, supabase_key = load_env_vars()
    if not supabase_url or not supabase_key:
        print("Error: Supabase environment variables not found.")
        return

    print(f"Found Supabase URL: {supabase_url}")
    
    # Authenticate as operator04 to bypass RLS policies
    token = get_auth_token(supabase_url, supabase_key)
    if not token:
        print("Warning: Could not authenticate. Proceeding with Anon key...")
        token = supabase_key

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    print("Reading CSV dataset...")
    df = pd.read_csv(csv_path)

    # 1. Unique Trucks (Equipment)
    unique_trucks = df.drop_duplicates(subset=["truck_id"]).copy()
    
    equipment_payload = []
    for _, row in unique_trucks.iterrows():
        truck_id = str(row["truck_id"])
        model = str(row["truck_model"])
        
        # Get the latest state for this truck from the dataset
        truck_rows = df[df["truck_id"] == truck_id]
        latest_row = truck_rows.iloc[-1]
        
        status = "Healthy"
        health_score = 95
        label = str(latest_row["label"]).lower()
        if label == "failure":
            status = "Critical"
            health_score = 42
        elif label == "wear":
            status = "Warning"
            health_score = 72

        equipment_payload.append({
            "id": truck_id,
            "name": f"{model} ({truck_id})",
            "status": status,
            "health_score": health_score
        })

    print(f"Upserting {len(equipment_payload)} trucks into 'equipment' table...")
    res = requests.post(f"{supabase_url}/rest/v1/equipment", headers=headers, data=json.dumps(equipment_payload))
    if res.status_code >= 200 and res.status_code < 300:
        print("Trucks upserted successfully!")
    else:
        print(f"Failed to upsert trucks: {res.status_code} {res.text}")
        return

    # 2. Ingest Sensor Readings
    sensor_payload = []
    alerts_payload = []
    
    print("Preparing sensor readings and alerts...")
    for idx, row in df.iterrows():
        truck_id = str(row["truck_id"])
        ts = str(row["timestamp"])
        
        # Map values to the DB schema
        vibration = float(row["vibration_g"]) if not pd.isna(row["vibration_g"]) else 0.0
        
        # Temperature mapping: hub oil temperature
        temp = float(row["hub_oil_temp_c"]) if not pd.isna(row["hub_oil_temp_c"]) else 0.0
        
        # Pressure mapping: system pressure
        press = float(row["system_pressure_bar"]) if not pd.isna(row["system_pressure_bar"]) else 0.0
        
        # Voltage mapping: winding_temp_c if present, else strut_imbalance_pct, else 0.0
        volt = float(row["winding_temp_c"]) if not pd.isna(row["winding_temp_c"]) else (float(row["strut_imbalance_pct"]) if not pd.isna(row["strut_imbalance_pct"]) else 0.0)

        sensor_payload.append({
            "equipment_id": truck_id,
            "timestamp": ts,
            "vibration": vibration,
            "temperature": temp,
            "pressure": press,
            "voltage": volt
        })

        # Check for alert-worthy records (wear or failure)
        label = str(row["label"]).lower()
        if label in ["wear", "failure"]:
            severity = "Critical" if label == "failure" else "High"
            fm = str(row["failure_mode"]) if not pd.isna(row["failure_mode"]) else "Anomaly detected"
            alert_id = f"ALT-{truck_id}-{ts[:19].replace(':', '')}"
            alerts_payload.append({
                "id": alert_id,
                "equipment_id": truck_id,
                "severity": severity,
                "message": f"Diagnostics flag: {fm}. Value limits exceeded (Vib: {vibration}g, Temp: {temp}C, Press: {press}bar).",
                "resolved": False,
                "created_at": ts
            })

    # Ingest sensor readings in chunks of 100 to avoid request size limits
    chunk_size = 100
    print(f"Upserting {len(sensor_payload)} sensor readings in chunks of {chunk_size}...")
    for i in range(0, len(sensor_payload), chunk_size):
        chunk = sensor_payload[i:i+chunk_size]
        res = requests.post(f"{supabase_url}/rest/v1/sensor_readings", headers=headers, data=json.dumps(chunk))
        if res.status_code < 200 or res.status_code >= 300:
            print(f"Failed to upsert sensor readings chunk starting at {i}: {res.status_code} {res.text}")
            break
    else:
        print("Sensor readings ingested successfully!")

    # Ingest alerts in chunks of 50
    if alerts_payload:
        # Keep only the last 15 alerts to avoid cluttering the dashboard completely
        alerts_payload = alerts_payload[-15:]
        print(f"Upserting {len(alerts_payload)} active alerts...")
        res = requests.post(f"{supabase_url}/rest/v1/alerts", headers=headers, data=json.dumps(alerts_payload))
        if res.status_code >= 200 and res.status_code < 300:
            print("Alerts ingested successfully!")
        else:
            print(f"Failed to upsert alerts: {res.status_code} {res.text}")

if __name__ == "__main__":
    seed_data()
