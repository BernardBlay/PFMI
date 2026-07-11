#!/usr/bin/env python3
"""
Predictive Maintenance LSTM -- Interactive Interface

Two modes:
  python predict.py web     -> Launches local web UI at http://localhost:8080
  python predict.py csv <file> -> Batch-predicts all rows in a CSV file
  python predict.py cli     -> Interactive terminal mode

Zero extra dependencies -- uses only stdlib + tensorflow + pandas + numpy.
"""

import json
import os
import sys
import csv
import io
import math
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs

import numpy as np
import pandas as pd
import tensorflow as tf

# -- Constants --------------------------------------------------------------
MODEL_PATH = "best_lstm_model.keras"
WINDOW_SIZE = 24
MASK_VALUE = -1.0

SENSOR_COLS = [
    "Vibration_X_RMS", "Vibration_X_Peak", "Vibration_Y_RMS", "Vibration_Y_Peak",
    "Vibration_Z_RMS", "Vibration_Z_Peak", "Acoustic_Emission_RMS",
    "Penetration_Rate_Avg", "Rotation_Speed_Avg", "Feed_Pressure_Avg",
    "Hydraulic_Pressure_Avg", "Hydraulic_Return_Pressure_Avg",
    "Hydraulic_Oil_Temp_Avg", "Flow_Rate_Avg",
    "Differential_Pressure_Filter_Avg", "Oil_Particle_Count_Avg",
    "Oil_Moisture_Avg", "Oil_Viscosity_Avg", "Tank_Level_End",
    "Drive_Motor_Current_Avg", "Motor_Winding_Temp_Avg",
]

HEALTH_COLS = [
    "drill_bit_health", "striker_bar_health", "drill_rod_health",
    "coupling_sleeve_health", "hydraulic_seal_health",
    "hydraulic_hose_health", "filter_health",
]

HEALTH_LABELS = ["Healthy", "Degraded", "IMMINENT FAILURE"]

FAILURE_TYPES = [
    "none", "drill_bit", "striker_bar", "drill_rod",
    "coupling_sleeve", "seal_leak", "hose_burst", "filter_clog", "multiple",
]

# -- Model Loading ----------------------------------------------------------
_model = None
_scaler_mean = None
_scaler_std = None

def load_model():
    global _model, _scaler_mean, _scaler_std
    if _model is None:
        print("Loading model...", flush=True)
        _model = tf.keras.models.load_model(MODEL_PATH)
        print("Model loaded. Loading scaler...", flush=True)
        # Load precomputed scaler params saved during training
        scaler_path = "scaler_params.npz"
        if os.path.exists(scaler_path):
            data = np.load(scaler_path)
            _scaler_mean = data["mean"]
            _scaler_std = data["std"]
            print(f"Scaler loaded from {scaler_path}", flush=True)
        else:
            # Fallback: compute from dataset
            print("Computing scaler from dataset...", flush=True)
            df = pd.read_csv("synthetic_drill_rig_dataset.csv")
            _scaler_mean = df[SENSOR_COLS].mean().values.astype(np.float32)
            _scaler_std = df[SENSOR_COLS].std().values.astype(np.float32)
            _scaler_std[_scaler_std < 1e-6] = 1.0
        print(f"Ready. Model: {MODEL_PATH}", flush=True)
    return _model


# -- Prediction -------------------------------------------------------------
def predict_single(sensor_values: list[float]) -> dict:
    """
    Predict from a single hour of sensor readings.
    Returns dict with health, RUL, failure type.
    """
    model = load_model()

    # Normalize
    arr = np.array(sensor_values, dtype=np.float32)
    arr = (arr - _scaler_mean) / _scaler_std

    # The model expects sequences of 24 hours. For a single reading,
    # we replicate it 24 times (static snapshot prediction).
    seq = np.tile(arr, (WINDOW_SIZE, 1)).reshape(1, WINDOW_SIZE, 21)

    preds = model.predict(seq, verbose=0)

    # Parse outputs
    health_preds = {}
    for i, name in enumerate(HEALTH_COLS):
        probs = preds[i][0]
        cls = int(np.argmax(probs))
        health_preds[name] = {
            "class": cls,
            "label": HEALTH_LABELS[cls],
            "probabilities": [round(float(p), 3) for p in probs],
        }

    rul_norm = float(preds[7][0][0])
    rul_hours = round(max(0.0, rul_norm) * 2000.0, 1)

    ft_probs = preds[8][0]
    ft_cls = int(np.argmax(ft_probs))
    failure_type = {
        "class": ft_cls,
        "label": FAILURE_TYPES[ft_cls],
        "probabilities": {FAILURE_TYPES[i]: round(float(p), 3) for i, p in enumerate(ft_probs)},
    }

    return {
        "health": health_preds,
        "rul_hours": rul_hours,
        "failure_type": failure_type,
    }


def predict_sequence(sensor_sequence: np.ndarray) -> dict:
    """
    Predict from a sequence of N hours (N x 21).
    Uses the LAST 24 hours if N > 24, or pads with replication if N < 24.
    """
    model = load_model()

    arr = sensor_sequence.astype(np.float32)
    arr = (arr - _scaler_mean) / _scaler_std

    n = arr.shape[0]
    if n >= WINDOW_SIZE:
        seq = arr[-WINDOW_SIZE:].reshape(1, WINDOW_SIZE, 21)
    else:
        pad = np.tile(arr[0:1], (WINDOW_SIZE - n, 1))
        seq = np.vstack([pad, arr]).reshape(1, WINDOW_SIZE, 21)

    preds = model.predict(seq, verbose=0)

    health_preds = {}
    for i, name in enumerate(HEALTH_COLS):
        probs = preds[i][0]
        cls = int(np.argmax(probs))
        health_preds[name] = {
            "class": cls,
            "label": HEALTH_LABELS[cls],
            "probabilities": [round(float(p), 3) for p in probs],
        }

    rul_norm = float(preds[7][0][0])
    rul_hours = round(max(0.0, rul_norm) * 2000.0, 1)

    ft_probs = preds[8][0]
    ft_cls = int(np.argmax(ft_probs))

    return {
        "health": health_preds,
        "rul_hours": rul_hours,
        "failure_type": {
            "class": ft_cls,
            "label": FAILURE_TYPES[ft_cls],
            "probabilities": {FAILURE_TYPES[i]: round(float(p), 3) for i, p in enumerate(ft_probs)},
        },
    }


# -- Color codes for terminal -----------------------------------------------
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"

def health_color(label: str) -> str:
    if "IMMINENT" in label:
        return RED
    elif "Degraded" in label:
        return YELLOW
    return GREEN


def print_prediction(result: dict):
    """Pretty-print a prediction result to terminal."""
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  PREDICTIVE MAINTENANCE -- DRILL RIG DIAGNOSTIC{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")

    print(f"\n{BOLD}Component Health:{RESET}")
    for name, info in result["health"].items():
        c = health_color(info["label"])
        bar = "#" * int(info["probabilities"][info["class"]] * 20)
        display_name = name.replace("_health", "").replace("_", " ").title()
        print(f"  {display_name:25s} {c}{info['label']:20s}{RESET} {bar} ({info['probabilities'][info['class']]:.0%})")

    print(f"\n{BOLD}Estimated RUL:{RESET} {result['rul_hours']:.0f} hours remaining")

    ft = result["failure_type"]
    print(f"\n{BOLD}Most Likely Failure:{RESET} {ft['label'].replace('_',' ').title()}")
    print(f"  Top predictions: ", end="")
    sorted_ft = sorted(ft["probabilities"].items(), key=lambda x: -x[1])[:3]
    for name, prob in sorted_ft:
        if name == "none":
            continue
        c = RED if prob > 0.3 else (YELLOW if prob > 0.1 else "")
        print(f"{c}{name.replace('_',' ').title()}: {prob:.0%}{RESET}  ", end="")
    print()


# -- CLI Mode ---------------------------------------------------------------
def cli_mode():
    """Interactive terminal mode -- enter sensor values one by one."""
    print(f"{BOLD}Predictive Maintenance LSTM -- Interactive Mode{RESET}")
    print("Enter sensor values (press Enter for defaults)\n")

    load_model()

    defaults = {
        "Vibration_X_RMS": 1.2, "Vibration_X_Peak": 2.5,
        "Vibration_Y_RMS": 1.3, "Vibration_Y_Peak": 2.8,
        "Vibration_Z_RMS": 1.6, "Vibration_Z_Peak": 3.2,
        "Acoustic_Emission_RMS": 1.0,
        "Penetration_Rate_Avg": 0.8, "Rotation_Speed_Avg": 48,
        "Feed_Pressure_Avg": 74,
        "Hydraulic_Pressure_Avg": 175, "Hydraulic_Return_Pressure_Avg": 8.5,
        "Hydraulic_Oil_Temp_Avg": 51, "Flow_Rate_Avg": 96,
        "Differential_Pressure_Filter_Avg": 0.5,
        "Oil_Particle_Count_Avg": 150, "Oil_Moisture_Avg": 120,
        "Oil_Viscosity_Avg": 46.5, "Tank_Level_End": 90,
        "Drive_Motor_Current_Avg": 59, "Motor_Winding_Temp_Avg": 63,
    }

    while True:
        print(f"\n{BOLD}Enter sensor values (or 'q' to quit, 'demo' for worn bit):{RESET}")
        values = []
        for col in SENSOR_COLS:
            prompt = f"  {col} [{defaults[col]}]: "
            inp = input(prompt).strip()
            if inp.lower() == 'q':
                return
            if inp.lower() == 'demo':
                # Preset: worn drill bit scenario
                values = [8.5, 14.2, 3.5, 7.0, 5.0, 9.0, 5.5, 0.2, 44, 98, 182, 10.5, 58, 92, 0.8, 280, 140, 45.0, 87, 72, 70]
                print("  -> Loaded 'worn drill bit' preset")
                break
            if inp == '':
                values.append(defaults[col])
            else:
                values.append(float(inp))

        result = predict_single(values)
        print_prediction(result)


# -- CSV Mode ---------------------------------------------------------------
def csv_mode(filepath: str):
    """Batch predict from a CSV file."""
    load_model()
    df = pd.read_csv(filepath)

    # Check which sensor columns exist
    available = [c for c in SENSOR_COLS if c in df.columns]
    if len(available) < len(SENSOR_COLS):
        missing = set(SENSOR_COLS) - set(available)
        print(f"Warning: Missing columns in CSV: {missing}")
        print(f"Using {len(available)}/{len(SENSOR_COLS)} available columns")

    results = []
    for _, row in df.iterrows():
        vals = [float(row.get(c, 0)) for c in SENSOR_COLS]
        result = predict_single(vals)
        results.append(result)

    # Print summary
    print(f"\n{BOLD}Batch Prediction -- {len(results)} rows{RESET}")
    for i, r in enumerate(results[:20]):  # First 20
        health_summary = ", ".join(
            f"{name.replace('_health','').replace('_',' ').title()}={info['label']}"
            for name, info in r["health"].items()
            if info["class"] > 0
        )
        if not health_summary:
            health_summary = "All Healthy"
        print(f"  Row {i}: RUL={r['rul_hours']:.0f}h  Failure={r['failure_type']['label']}  [{health_summary}]")

    if len(results) > 20:
        print(f"  ... and {len(results) - 20} more rows")

    # Save detailed results
    outpath = filepath.replace(".csv", "_predictions.json")
    with open(outpath, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nFull results saved to {outpath}")


# -- Web Server -------------------------------------------------------------
HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Drill Rig Predictive Maintenance</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 20px; }
  .container { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin-bottom: 8px; color: #38bdf8; }
  .subtitle { color: #94a3b8; margin-bottom: 24px; font-size: 0.9rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .field { background: #1e293b; border-radius: 8px; padding: 10px 14px; }
  .field label { display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px; }
  .field input { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 4px;
                 color: #e2e8f0; padding: 6px 8px; font-size: 0.9rem; font-family: monospace; }
  .field input:focus { outline: none; border-color: #38bdf8; }
  .section-title { font-size: 0.85rem; color: #64748b; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  .buttons { display: flex; gap: 10px; margin: 20px 0; }
  button { padding: 10px 24px; border: none; border-radius: 6px; font-size: 0.95rem; cursor: pointer; font-weight: 600; }
  .btn-predict { background: #38bdf8; color: #0f172a; }
  .btn-predict:hover { background: #7dd3fc; }
  .btn-preset { background: #334155; color: #e2e8f0; }
  .btn-preset:hover { background: #475569; }
  .results { display: none; margin-top: 20px; }
  .results.active { display: block; }
  .card { background: #1e293b; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .card h3 { color: #38bdf8; margin-bottom: 12px; font-size: 1rem; }
  .health-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #1a2332; }
  .health-row:last-child { border-bottom: none; }
  .health-name { flex: 0 0 160px; font-size: 0.85rem; }
  .health-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
  .badge-healthy { background: #065f46; color: #6ee7b7; }
  .badge-degraded { background: #78350f; color: #fbbf24; }
  .badge-imminent { background: #7f1d1d; color: #fca5a5; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
  .health-bar { flex: 1; height: 6px; background: #334155; border-radius: 3px; overflow: hidden; }
  .health-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
  .rul-display { font-size: 2rem; font-weight: 700; color: #38bdf8; }
  .rul-label { color: #94a3b8; font-size: 0.85rem; }
  .ft-tag { display: inline-block; padding: 3px 12px; border-radius: 4px; font-size: 0.8rem; margin: 2px; }
  .ft-high { background: #7f1d1d; color: #fca5a5; }
  .ft-med { background: #78350f; color: #fbbf24; }
  .ft-low { background: #1e293b; color: #64748b; }
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #334155;
             border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
  <h1>[DRILL] Drill Rig Predictive Maintenance</h1>
  <p class="subtitle">LSTM Model -- Enter hourly sensor readings for instant diagnostic</p>

  <div class="section-title">Vibration & Acoustics</div>
  <div class="grid" id="vib-group"></div>

  <div class="section-title">Position & Rotary</div>
  <div class="grid" id="pos-group"></div>

  <div class="section-title">Hydraulic System</div>
  <div class="grid" id="hyd-group"></div>

  <div class="section-title">Fluid Health</div>
  <div class="grid" id="fluid-group"></div>

  <div class="section-title">Electrical / Motor</div>
  <div class="grid" id="elec-group"></div>

  <div class="buttons">
    <button class="btn-predict" onclick="predict()">[SCAN] Run Diagnostic</button>
    <button class="btn-preset" onclick="loadPreset('healthy')">Healthy Rig</button>
    <button class="btn-preset" onclick="loadPreset('worn_bit')">Worn Bit</button>
    <button class="btn-preset" onclick="loadPreset('seal_leak')">Seal Leak</button>
    <button class="btn-preset" onclick="loadPreset('filter_clog')">Clogged Filter</button>
  </div>

  <div class="results" id="results">
    <div class="card">
      <h3>Component Health</h3>
      <div id="health-results"></div>
    </div>
    <div class="card">
      <h3>[RUL] Remaining Useful Life</h3>
      <div class="rul-display" id="rul-display">--</div>
      <div class="rul-label">estimated hours until failure</div>
    </div>
    <div class="card">
      <h3>[!] Most Likely Failure Mode</h3>
      <div id="ft-results"></div>
    </div>
  </div>
</div>

<script>
const SENSORS = [
  {id:"Vibration_X_RMS", group:"vib", label:"Vib X RMS (g)", def:1.2},
  {id:"Vibration_X_Peak", group:"vib", label:"Vib X Peak (g)", def:2.5},
  {id:"Vibration_Y_RMS", group:"vib", label:"Vib Y RMS (g)", def:1.3},
  {id:"Vibration_Y_Peak", group:"vib", label:"Vib Y Peak (g)", def:2.8},
  {id:"Vibration_Z_RMS", group:"vib", label:"Vib Z RMS (g)", def:1.6},
  {id:"Vibration_Z_Peak", group:"vib", label:"Vib Z Peak (g)", def:3.2},
  {id:"Acoustic_Emission_RMS", group:"vib", label:"Acoustic RMS (V)", def:1.0},
  {id:"Penetration_Rate_Avg", group:"pos", label:"Penetration Rate (m/hr)", def:0.8},
  {id:"Rotation_Speed_Avg", group:"pos", label:"Rotation Speed (RPM)", def:48},
  {id:"Feed_Pressure_Avg", group:"pos", label:"Feed Pressure (bar)", def:74},
  {id:"Hydraulic_Pressure_Avg", group:"hyd", label:"Hydraulic Pressure (bar)", def:175},
  {id:"Hydraulic_Return_Pressure_Avg", group:"hyd", label:"Return Pressure (bar)", def:8.5},
  {id:"Hydraulic_Oil_Temp_Avg", group:"hyd", label:"Oil Temp (°C)", def:51},
  {id:"Flow_Rate_Avg", group:"hyd", label:"Flow Rate (L/min)", def:96},
  {id:"Differential_Pressure_Filter_Avg", group:"fluid", label:"Diff Press Filter (bar)", def:0.5},
  {id:"Oil_Particle_Count_Avg", group:"fluid", label:"Particle Count (/mL)", def:150},
  {id:"Oil_Moisture_Avg", group:"fluid", label:"Oil Moisture (ppm)", def:120},
  {id:"Oil_Viscosity_Avg", group:"fluid", label:"Oil Viscosity (cSt)", def:46.5},
  {id:"Tank_Level_End", group:"fluid", label:"Tank Level (%)", def:90},
  {id:"Drive_Motor_Current_Avg", group:"elec", label:"Motor Current (A)", def:59},
  {id:"Motor_Winding_Temp_Avg", group:"elec", label:"Winding Temp (°C)", def:63},
];

const PRESETS = {
  healthy: [1.1,2.3,1.3,2.8,1.6,3.1,1.0,0.8,48,74,175,8.5,51,96,0.5,142,115,46.5,90,59,63],
  worn_bit: [7.2,15.0,3.5,7.5,5.8,10.2,5.5,0.18,43,102,185,11.0,58,90,0.9,320,150,44.0,86,74,71],
  seal_leak: [1.8,3.5,1.6,3.2,2.0,4.0,1.5,0.65,46,78,172,28.0,68,82,1.8,1800,160,43.0,84,62,68],
  filter_clog: [1.4,2.8,1.5,3.0,1.8,3.5,1.2,0.55,44,76,192,12.0,62,72,3.2,480,140,44.5,87,60,65],
};

function buildForm() {
  const groups = {vib:[], pos:[], hyd:[], fluid:[], elec:[]};
  SENSORS.forEach(s => {
    groups[s.group].push(
      `<div class="field"><label>${s.label}</label><input id="${s.id}" type="number" step="any" value="${s.def}"></div>`
    );
  });
  for (const [gid, html] of Object.entries(groups)) {
    document.getElementById(gid + '-group').innerHTML = html.join('');
  }
}

function getValues() {
  return SENSORS.map(s => parseFloat(document.getElementById(s.id).value) || 0);
}

function loadPreset(name) {
  const vals = PRESETS[name];
  SENSORS.forEach((s, i) => { document.getElementById(s.id).value = vals[i]; });
}

async function predict() {
  const results = document.getElementById('results');
  results.classList.add('active');
  document.getElementById('health-results').innerHTML = '<span class="spinner"></span> Running diagnostic...';
  document.getElementById('rul-display').textContent = '...';
  document.getElementById('ft-results').textContent = '';

  try {
    const resp = await fetch('/predict', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({values: getValues()})
    });
    const data = await resp.json();
    render(data);
  } catch(e) {
    document.getElementById('health-results').innerHTML = `<span style="color:#fca5a5">Error: ${e.message}</span>`;
  }
}

function render(data) {
  // Health
  const HEALTH_NAMES = {
    drill_bit_health: "Drill Bit", striker_bar_health: "Striker Bar",
    drill_rod_health: "Drill Rod", coupling_sleeve_health: "Coupling Sleeve",
    hydraulic_seal_health: "Hydraulic Seal", hydraulic_hose_health: "Hydraulic Hose",
    filter_health: "Filter"
  };
  const BADGE_CLASS = {0:"badge-healthy", 1:"badge-degraded", 2:"badge-imminent"};
  const BAR_COLOR = {0:"#6ee7b7", 1:"#fbbf24", 2:"#fca5a5"};

  let html = '';
  for (const [key, info] of Object.entries(data.health)) {
    const name = HEALTH_NAMES[key] || key;
    const pct = Math.round(info.probabilities[info.class] * 100);
    html += `<div class="health-row">
      <span class="health-name">${name}</span>
      <span class="health-badge ${BADGE_CLASS[info.class]}">${info.label}</span>
      <div class="health-bar"><div class="health-bar-fill" style="width:${pct}%;background:${BAR_COLOR[info.class]}"></div></div>
      <span style="font-size:0.75rem;color:#94a3b8">${pct}%</span>
    </div>`;
  }
  document.getElementById('health-results').innerHTML = html;

  // RUL
  const rul = data.rul_hours;
  const rulEl = document.getElementById('rul-display');
  if (rul < 50) rulEl.style.color = '#fca5a5';
  else if (rul < 200) rulEl.style.color = '#fbbf24';
  else rulEl.style.color = '#38bdf8';
  rulEl.textContent = rul < 1 ? '< 1 hour' : `${Math.round(rul)} hours`;

  // Failure type
  let ftHtml = '';
  const ft = data.failure_type;
  const sorted = Object.entries(ft.probabilities).sort((a,b) => b[1]-a[1]);
  for (const [name, prob] of sorted) {
    if (name === 'none' && prob > 0.9) continue;
    const cls = prob > 0.4 ? 'ft-high' : (prob > 0.15 ? 'ft-med' : 'ft-low');
    ftHtml += `<span class="ft-tag ${cls}">${name.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}: ${Math.round(prob*100)}%</span> `;
  }
  if (!ftHtml) ftHtml = '<span style="color:#6ee7b7">v No failure predicted</span>';
  document.getElementById('ft-results').innerHTML = ftHtml;
}

buildForm();
</script>
</body>
</html>"""


class PredictHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/predict":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            values = data.get("values", [])

            if len(values) != 21:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Need exactly 21 sensor values"}).encode())
                return

            try:
                result = predict_single(values)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress logs


def web_mode(port=8080):
    """Launch interactive web UI."""
    load_model()
    print(f"\n{BOLD}[DRILL] Drill Rig Predictive Maintenance -- Web Interface{RESET}")
    print(f"   Open {GREEN}http://localhost:{port}{RESET} in your browser")
    print(f"   Press Ctrl+C to stop\n")

    server = HTTPServer(("0.0.0.0", port), PredictHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


# -- Main -------------------------------------------------------------------
def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python predict.py web              -> Launch web UI")
        print("  python predict.py cli              -> Interactive terminal mode")
        print("  python predict.py csv <file.csv>   -> Batch predict from CSV")
        sys.exit(1)

    mode = sys.argv[1]
    if mode == "web":
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8080
        web_mode(port)
    elif mode == "cli":
        cli_mode()
    elif mode == "csv":
        if len(sys.argv) < 3:
            print("Usage: python predict.py csv <file.csv>")
            sys.exit(1)
        csv_mode(sys.argv[2])
    else:
        print(f"Unknown mode: {mode}")
        sys.exit(1)


if __name__ == "__main__":
    main()
