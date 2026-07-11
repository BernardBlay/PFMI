import numpy as np
import pandas as pd
import os

def generate_grinder_predictive_maintenance_data(output_filepath="raw/grinder_telemetry.csv"):
    np.random.seed(42)
    
    # Ensure raw directory exists
    dir_name = os.path.dirname(output_filepath)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
        
    # Configuration across 10 independent operational runs (Sessions)
    sessions_config = [
        {"id": 0, "hours": 560, "ore_hardness": 3, "ambient_base": 28, "type": "soft_shale_slow_wear"},
        {"id": 1, "hours": 590, "ore_hardness": 4, "ambient_base": 31, "type": "soft_shale_slow_wear"},
        {"id": 2, "hours": 510, "ore_hardness": 6, "ambient_base": 24, "type": "mixed_mid_failure"},
        {"id": 3, "hours": 600, "ore_hardness": 5, "ambient_base": 33, "type": "mixed_mid_failure"},
        {"id": 4, "hours": 530, "ore_hardness": 7, "ambient_base": 26, "type": "mixed_mid_failure"},
        {"id": 5, "hours": 550, "ore_hardness": 6, "ambient_base": 29, "type": "mixed_mid_failure"},
        {"id": 6, "hours": 500, "ore_hardness": 8, "ambient_base": 35, "type": "hard_granite_aggressive"},
        {"id": 7, "hours": 520, "ore_hardness": 9, "ambient_base": 21, "type": "hard_quartzite_aggressive"},
        {"id": 8, "hours": 510, "ore_hardness": 7, "ambient_base": 30, "type": "hard_granite_aggressive"},
        {"id": 9, "hours": 570, "ore_hardness": 6, "ambient_base": 41, "type": "extreme_heat_lubrication_fault"}
    ]
    
    all_rows = []
    
    for config in sessions_config:
        sid = config["id"]
        total_hours = config["hours"]
        hardness = config["ore_hardness"]
        amb_base = config["ambient_base"]
        stype = config["type"]
        
        # Accelerate internal physical degradation rates based on Mohs mineral proxy scale
        wear_multiplier = 1.9 if hardness >= 7 else 1.0
        if stype == "extreme_heat_lubrication_fault":
            wear_multiplier = 2.4
            
        # Target failure hours established within the temporal framework
        fail_times = {}
        if stype == "soft_shale_slow_wear":
            fail_times = {"crusher_liner": total_hours - 35, "lube_filter": total_hours - 15}
        elif stype == "mixed_mid_failure":
            fail_times = {"crusher_liner": 240, "main_gearbox": 390, "hydraulic_seal": total_hours - 45}
        elif stype == "hard_granite_aggressive" or stype == "hard_quartzite_aggressive":
            fail_times = {"crusher_liner": 130, "main_gearbox": 250, "drive_pinion": 370, "tramp_hydraulics": 450}
        else: # extreme_heat_lubrication_fault
            fail_times = {"hydraulic_seal": 160, "hydraulic_hose": 290, "lube_filter": 420}
            
        # Initialization baseline states for drift tracking variables
        runtime_since_overhaul = 85.0 + np.random.uniform(0, 30)
        current_filter_dp = np.random.uniform(0.35, 0.55)
        current_metal_particles = np.random.uniform(70.0, 110.0)
        current_tank_level = np.random.uniform(88.0, 94.0)
        
        for hour in range(total_hours):
            runtime_since_overhaul += 1.0
            
            # --- 1. HEALTH AND DRIFT STATE EVALUATION LAYER ---
            health = {c: 0 for c in ["crusher_liner", "main_gearbox", "drive_pinion", "tramp_hydraulics", "hydraulic_seal", "hydraulic_hose", "lube_filter"]}
            drifts = {c: 0.0 for c in ["vibration", "friction_temp", "system_leak", "filter_clog"]}
            
            # Component 1: Crusher Liner Wear (50-150 hours)
            if "crusher_liner" in fail_times:
                f_hr = fail_times["crusher_liner"]
                ramp = 110 / wear_multiplier
                if hour >= f_hr:
                    health["crusher_liner"] = 2
                    drifts["vibration"] += 5.8
                elif hour >= (f_hr - ramp):
                    health["crusher_liner"] = 1
                    drifts["vibration"] += ((hour - (f_hr - ramp)) / ramp) * 3.8

            # Component 2: Main Gearbox Mechanical Fatigue (80-200 hours)
            if "main_gearbox" in fail_times:
                f_hr = fail_times["main_gearbox"]
                ramp = 140 / wear_multiplier
                if hour >= f_hr:
                    health["main_gearbox"] = 2
                    drifts["vibration"] += 4.5
                    drifts["friction_temp"] += 14.0
                elif hour >= (f_hr - ramp):
                    health["main_gearbox"] = 1
                    progress = (hour - (f_hr - ramp)) / ramp
                    drifts["vibration"] += progress * 2.2
                    drifts["friction_temp"] += progress * 8.0

            # Component 3: Drive Pinion Shaft Integrity (100-300 hours)
            if "drive_pinion" in fail_times:
                f_hr = fail_times["drive_pinion"]
                ramp = 160 / wear_multiplier
                if hour >= f_hr:
                    health["drive_pinion"] = 2
                elif hour >= (f_hr - ramp):
                    health["drive_pinion"] = 1

            # Component 4: Tramp Release Hydraulics System (40-120 hours)
            if "tramp_hydraulics" in fail_times:
                f_hr = fail_times["tramp_hydraulics"]
                ramp = 70 / wear_multiplier
                if hour >= f_hr:
                    health["tramp_hydraulics"] = 2
                elif hour >= (f_hr - ramp):
                    health["tramp_hydraulics"] = 1

            # Component 5: High-Pressure Hydraulic Seals (30-100 hours)
            if "hydraulic_seal" in fail_times:
                f_hr = fail_times["hydraulic_seal"]
                ramp = 60 / wear_multiplier
                if hour >= f_hr:
                    health["hydraulic_seal"] = 2
                    drifts["friction_temp"] += 10.0
                elif hour >= (f_hr - ramp):
                    health["hydraulic_seal"] = 1
                    drifts["friction_temp"] += ((hour - (f_hr - ramp)) / ramp) * 6.0

            # Component 6: Hydraulic Line/Hose Pinhole Leaks (40-120 hours)
            if "hydraulic_hose" in fail_times:
                f_hr = fail_times["hydraulic_hose"]
                ramp = 90 / wear_multiplier
                if hour >= f_hr:
                    health["hydraulic_hose"] = 2
                    drifts["system_leak"] += 0.75
                elif hour >= (f_hr - ramp):
                    health["hydraulic_hose"] = 1
                    drifts["system_leak"] += ((hour - (f_hr - ramp)) / ramp) * 0.40

            # Component 7: Lubrication Oil Filter Clogging (20-60 hours)
            if "lube_filter" in fail_times:
                f_hr = fail_times["lube_filter"]
                ramp = 45 / wear_multiplier
                if hour >= f_hr:
                    health["lube_filter"] = 2
                    drifts["filter_clog"] += 3.0
                elif hour >= (f_hr - ramp):
                    health["lube_filter"] = 1
                    drifts["filter_clog"] += ((hour - (f_hr - ramp)) / ramp) * 1.75

            # --- 2. GENERATE COMPONENT CORRELATED SENSOR WAVEFORMS ---
            ambient_temp = amb_base + 5.0 * np.sin(2 * np.pi * hour / 24.0) + np.random.normal(0, 0.4)
            
            # Vibration Signals (Pinion/Main Housing Structural Sensors)
            v_x_rms = max(0.15, 1.35 + (drifts["vibration"] * 0.75) + np.random.normal(0, 0.07))
            v_y_rms = max(0.15, 1.10 + (drifts["vibration"] * 0.60) + np.random.normal(0, 0.06))
            v_z_rms = max(0.20, 1.60 + (drifts["vibration"] * 0.85) + np.random.normal(0, 0.09))
            
            v_x_peak = v_x_rms * np.random.uniform(2.2, 2.7) + (4.0 if health["drive_pinion"] == 2 else 0.0)
            v_y_peak = v_y_rms * np.random.uniform(2.1, 2.6) + (3.0 if health["main_gearbox"] == 2 else 0.0)
            v_z_peak = v_z_rms * np.random.uniform(2.3, 2.9) + (4.5 if health["crusher_liner"] == 2 else 0.0)
            
            # Production Dynamics
            acoustic_rms = max(0.2, 0.95 + (drifts["vibration"] * 0.45) + np.random.normal(0, 0.06))
            throughput = max(10.0, (450.0 - (hardness * 22.0) - (drifts["vibration"] * 25.0)) + np.random.normal(0, 8.0))
            rpm = max(2.0, 12.5 - (drifts["vibration"] * 0.4) + np.random.normal(0, 0.15))
            bowl_gap = max(5.0, 32.0 + (drifts["vibration"] * 1.8) + np.random.normal(0, 0.25))
            
            # Hydraulic and Lubrication Physics
            tramp_press = 110.0 + (hardness * 4.5) + np.random.normal(0, 2.5)
            if health["tramp_hydraulics"] == 1:
                tramp_press += np.random.uniform(-25.0, 25.0) # Unstable compensation
                
            lube_press = 4.8 - (drifts["system_leak"] * 1.4) + np.random.normal(0, 0.12)
            lube_oil_temp = max(25.0, 52.0 + (ambient_temp * 0.15) + drifts["friction_temp"] + np.random.normal(0, 0.45))
            lube_flow = max(10.0, 140.0 - (drifts["filter_clog"] * 15.0) - (drifts["system_leak"] * 22.0) + np.random.normal(0, 2.5))
            
            # Fluid Metrics
            current_filter_dp = min(4.8, current_filter_dp + 0.0018 * wear_multiplier + (drifts["filter_clog"] * 0.065))
            current_metal_particles = min(5000.0, current_metal_particles + (2.1 * wear_multiplier) + (75.0 if health["main_gearbox"] >= 1 else 0.0))
            oil_moisture = max(40.0, 130.0 + (hour * 0.12) + np.random.normal(0, 2.5))
            oil_viscosity = max(20.0, 68.0 - (lube_oil_temp - 50.0) * 0.40 + np.random.normal(0, 0.15))
            
            tank_loss = 0.008 + (0.42 if health["hydraulic_hose"] >= 1 else 0.0)
            current_tank_level = max(15.0, current_tank_level - tank_loss)
            if current_tank_level < 68.0 and np.random.rand() < 0.025:
                current_tank_level += 18.0 # Top-up replenishment logging
                
            # Electrical Drive Parameters
            motor_current = 220.0 + (hardness * 14.5) + (drifts["vibration"] * 8.0) + np.random.normal(0, 4.0)
            motor_temp = lube_oil_temp + 16.5 + np.random.normal(0, 0.35)
            
            # --- 3. TARGET LABELS GENERATION ---
            active_failure_horizons = [f_hr for f_hr in fail_times.values() if f_hr >= hour]
            if active_failure_horizons:
                rul_hours = float(min(active_failure_horizons) - hour)
            else:
                rul_hours = float(total_hours - hour + np.random.uniform(250, 450))
                
            imminent_failures = [c for c, state in health.items() if state == 2]
            if len(imminent_failures) == 0:
                ftype = "none"
            elif len(imminent_failures) > 1:
                ftype = "multiple"
            else:
                mapping = {
                    "crusher_liner": "crusher_liner", "main_gearbox": "main_gearbox",
                    "drive_pinion": "drive_pinion", "tramp_hydraulics": "tramp_hydraulics",
                    "hydraulic_seal": "seal_leak", "hydraulic_hose": "hose_burst",
                    "lube_filter": "filter_clog"
                }
                ftype = mapping[imminent_failures[0]]
                
            # Format row element payload maps
            row_payload = {
                # Sensors (21 Columns)
                "Vibration_X_RMS": round(v_x_rms, 4), "Vibration_X_Peak": round(v_x_peak, 4),
                "Vibration_Y_RMS": round(v_y_rms, 4), "Vibration_Y_Peak": round(v_y_peak, 4),
                "Vibration_Z_RMS": round(v_z_rms, 4), "Vibration_Z_Peak": round(v_z_peak, 4),
                "Acoustic_Emission_RMS": round(acoustic_rms, 4),
                "Throughput_Rate_Avg": round(throughput, 2), "Rotational_Speed_Avg": round(rpm, 2),
                "Gyratory_Clamping_Pressure": round(bowl_gap, 2),
                "Tramp_Release_Hydraulic_Pressure": round(tramp_press, 2), "Lubrication_Oil_Pressure": round(lube_press, 2),
                "Lubrication_Oil_Temp": round(lube_oil_temp, 2), "Lube_Flow_Rate": round(lube_flow, 2),
                "Lube_Filter_Differential_Pressure": round(current_filter_dp, 3),
                "Metal_Debris_Particle_Count": round(current_metal_particles, 1), "Oil_Moisture_Avg": round(oil_moisture, 1),
                "Oil_Viscosity_Avg": round(oil_viscosity, 2), "Lube_Tank_Level": round(current_tank_level, 2),
                "Main_Motor_Current": round(motor_current, 2), "Main_Motor_Winding_Temp": round(motor_temp, 2),
                
                # Health Codes Targets
                "crusher_liner_health": health["crusher_liner"], "main_gearbox_health": health["main_gearbox"],
                "drive_pinion_health": health["drive_pinion"], "tramp_hydraulics_health": health["tramp_hydraulics"],
                "hydraulic_seal_health": health["hydraulic_seal"], "hydraulic_hose_health": health["hydraulic_hose"],
                "lube_filter_health": health["lube_filter"],
                
                # RUL Metric
                "rul_hours": round(rul_hours, 1),
                "failure_type": ftype,
                
                # Operational Metas
                "rock_hardness": hardness,
                "drill_hours_since_overhaul": round(runtime_since_overhaul, 1),
                "hour_in_session": hour,
                "session_id": sid,
                "ambient_temp_C": round(ambient_temp, 1)
            }
            all_rows.append(row_payload)
            
    df = pd.DataFrame(all_rows)
    df.to_csv(output_filepath, index=False)
    print(f"Grinder maintenance dataset completed! {len(df)} lines written to '{output_filepath}'.")
    return df

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "raw", "grinder_telemetry.csv")
    generate_grinder_predictive_maintenance_data(output_filepath=output_path)
