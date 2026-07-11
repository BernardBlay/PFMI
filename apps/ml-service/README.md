# ml-service

FastAPI model-serving service for the Predictive Maintenance Intelligence
Platform (Tarkwa, Ghana mining sites). Scores sensor readings against a
per-machine-category XGBoost model and returns a failure probability, the
predicted failure mode, and SHAP feature attributions.

**This service is stateless.** It does not connect to Postgres/Supabase and
owns no database logic — that's a teammate's service. `ml-service` only loads
models and scores requests.

> Note: an earlier version of the team's architecture doc had this service
> writing predictions to Supabase directly. That's been superseded by the
> contract below — flagging here so it doesn't cause confusion if the old doc
> resurfaces.

## Core design principle: models are data, not code

Each machine category (`ball_mill`, `crusher`, `slurry_pump`,
`conveyor_drive`, `genset`, `bulldozer`, ...) ships as a **versioned** folder
under `models/`:

```
models/<category>/<version>/
├── meta.json      # contract: features, derived features, failure modes, threshold, version, metrics
└── model.joblib     # trained model artifact
```

Version folders are named `v1`, `v2`, ... — the registry parses the integer
after `v` and loads the **highest** version per category (numeric order, not
lexical: `v10` sorts after `v9`, not after `v1`). Every version folder found
is logged at startup, along with which one was selected — nothing is silently
picked. Adding a new category, or a new version of an existing one, should
never require a code change — drop a folder, restart the service. `meta.json`
is the single source of truth for what features a category expects; there is
no per-category logic in Python.

## `/score` contract (target — not yet implemented)

```json
// POST /score
{
  "machine_id": "TKW-BM-014",
  "category": "ball_mill",
  "readings": {
    "torque_nm": 812.4,
    "rpm": 14.2,
    "bearing_temp_k": 341.7,
    "liner_wear_mm": 6.3,
    "charge_volume_pct": 38.5
  }
}
```

```json
// 200 response - confident prediction
{
  "failure_prob": 0.62,
  "predicted_mode": "bearing_overheat",
  "shap_factors": {
    "bearing_temp_k": 0.31,
    "liner_wear_mm": 0.18,
    "torque_nm": 0.09,
    "rpm": -0.04,
    "charge_volume_pct": -0.02
  },
  "model_version": "ball_mill-xgb-v1"
}
```

```json
// 200 response - low-confidence / unreliable-class prediction
{
  "failure_prob": 0.71,
  "predicted_mode": "uncertain",
  "probabilities": {
    "cutting_edge_wear": 0.31,
    "undercarriage_wear": 0.29,
    "final_drive_wear": 0.02,
    "hydraulic_seal_failure": 0.03,
    "filter_clogging": 0.01,
    "none": 0.34
  },
  "model_version": "bulldozer-xgb-v1"
}
```

Field notes:
- `failure_prob` is `1 − P(class="none")` — probability *some* failure mode is
  occurring, not "confidence in `predicted_mode`". `failure_modes` in
  `meta.json` always includes `"none"` as a class; this is a multiclass model,
  not binary-plus-mode.
- **`predicted_mode` is gated, permanently, not just the raw argmax.** It is
  returned only when *both* hold: the argmax class is in that model's
  `meta.json["reliable_modes"]`, and the argmax probability clears
  `meta.json["mode_confidence_threshold"]`. Otherwise the response is
  `predicted_mode: "uncertain"` with a `probabilities` field carrying the full
  class distribution instead of `shap_factors` (SHAP for one wrong guess isn't
  useful; the full distribution is). `reliable_modes` is derived per-model
  from real per-class recall on a held-out evaluation — a model with no
  validated reliable classes (e.g. an untrained placeholder) has
  `reliable_modes: []` and therefore *always* returns `"uncertain"`, which is
  the correct, honest default for a model nobody has vetted yet.
- **Why this exists**: `predicted_mode` drives the reorder engine, which maps
  a failure mode to a specific part via `machine_parts`. A confidently wrong
  mode means confidently ordering the wrong part — worse than a slow order.
  When `predicted_mode` is `"uncertain"`, the reorder engine (not yet built)
  must fall back to considering all plausible parts for that category rather
  than committing to one.
- `shap_factors` are SHAP contributions for the predicted class only (not the
  full per-class matrix), present only on a confident response.
- `machine_id` is opaque to this service — used only for logging/traceability,
  never validated against anything (no DB access). Not currently echoed back
  in the response.
- Unknown/unregistered `category` falls back to the `generic` model, with
  `model_version` set to whatever that fallback actually is, so the caller can
  always see which model really answered.
- A payload with missing/extra fields for the routed category's `features`
  must fail loudly (422), never score garbage silently.

## What's implemented

**Deliverable 1: scaffold + model registry**
- `app/main.py` — FastAPI app, CORS middleware, lifespan hook that builds the
  registry at startup, `GET /health`, `GET /models`.
- `app/config.py` — typed settings (`pydantic-settings`): `models_dir`,
  `cors_origin`, read from `.env`.
- `app/registry.py` — scans `models_dir/<category>/<version>/meta.json`
  (two levels, versioned — see above), validates each has the required
  fields (`machine_category`, `model_version`, `features`, `failure_modes`,
  `threshold`), and **eager-loads** the matching `model.joblib` at startup
  via `joblib.load()`. Loads only the highest version per category; logs
  every version found and which was selected. A category with a broken or
  missing `meta.json`/`model.joblib`, or no valid `vN` folders, is logged and
  skipped — it never crashes startup, and a fully empty `models/` directory
  is a valid (if useless) state.

**Deliverable: `bulldozer` model, trained** — `ml-service/training/`
- `bulldozer_training.ipynb` — trains and exports `models/bulldozer/v1/`.
  Two XGBoost multiclass models (`health_state`, `dominant_failure_mode`)
  bundled into one `model.joblib`. Session-grouped leave-one-out evaluation
  (not a naive row split — see the notebook's Section 3 for why that number
  would be a lie). Full walkthrough, honest metrics, and the confidence-gate
  derivation live in the notebook itself; don't duplicate the numbers here,
  they'll drift — read `meta.json` and the notebook for current truth.
- `training/requirements.txt` + `training/.venv` — training-only
  dependencies (`scikit-learn`, `shap`, `jupyter`, ...). These never touch
  the serving `requirements.txt` below; the shipped model is a raw
  `xgboost.Booster`, sklearn-free to load.

Not yet built: `/score` itself, request/response Pydantic schemas
(`schemas.py`), feature engineering (`features.py`), SHAP scoring
(`scoring.py`), the sensor simulator, or the reorder engine.

## Worth noting

- **`models/generic/v1/` currently holds a placeholder, not a real model.**
  `model.joblib` is an `xgboost.Booster` trained on random synthetic data —
  it exists purely to prove the eager-load path works, and will produce
  meaningless scores. `meta.json` marks this explicitly
  (`model_version: "generic-xgb-v1-PLACEHOLDER"`, `metrics.note`, and
  `reliable_modes: []` so `/score` always answers `"uncertain"` for it once
  scoring exists). Replace both files with the real trained baseline (AI4I
  2020, ROC-AUC 0.980, PR-AUC 0.849) — same versioned-folder shape, no code
  changes needed; bump to `v2/` if you want the old placeholder kept around
  for comparison.
- **`models/bulldozer/v1/` is a real trained model, with a known, documented
  weakness — do not treat it as production-ready for `dominant_failure_mode`
  yet.** `undercarriage_wear` and `final_drive_wear` are noise-level (LOSO
  recall 0.01 / 0.07) because the simulator that generated the training data
  drives both from the same undercarriage vibration channel — see
  `training/simulator_spec.md` for the specific fix needed upstream, and
  retrain once that lands. `health_state` doesn't have this problem.
- **No `scikit-learn` dependency in serving**, confirmed empirically twice
  now (once for the placeholder, once for the real bulldozer model): both
  use the raw `xgboost.Booster` API and `joblib.load()` cleanly in a venv
  with no `sklearn` installed. If a future training pipeline instead pickles
  a `xgboost.XGBClassifier` (sklearn wrapper), loading will fail with an
  `ImportError` for `sklearn`, and we add it then — not preemptively.
- **Pydantic v2 gotcha**: the settings field is named `models_dir`, not
  `model_dir`. Pydantic reserves the `model_` prefix on `BaseModel`/
  `BaseSettings` fields (it collides with Pydantic's own internals like
  `model_config`) and warns if you use it.
- No DB connection, no `sqlalchemy`, no `psycopg` — deliberate, per the
  stateless scope correction above.

## Running locally

```bash
cd ml-service
python -m venv .venv
./.venv/Scripts/activate        # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then:
```
GET http://127.0.0.1:8000/health
GET http://127.0.0.1:8000/models
```

## requirements.txt

| Package | Why |
|---|---|
| `fastapi` | web framework |
| `uvicorn[standard]` | ASGI server (uvloop/httptools) |
| `pydantic>=2.0` | request/response models; pinned explicitly even though transitive via fastapi, since v2 semantics matter for upcoming `schemas.py` |
| `pydantic-settings` | typed env config |
| `python-dotenv` | required by `pydantic-settings` to read `.env` locally |
| `joblib` | loads `model.joblib` artifacts |
| `xgboost` | model runtime |

## Next up

Deliverable 2: `schemas.py` — Pydantic request/response models for `/score`,
with per-category dynamic validation against `meta.json["features"]`.
