# `bulldozer_data_genertor.py` — changes needed to separate failure-mode signatures

Written for whoever edits the simulator next. Goal: make `undercarriage_wear`,
`final_drive_wear`, and `filter_clogging` learnable as distinct classes.
Nothing here touches `bulldozer_sensor_data.csv` or the generator directly —
this is a spec, not a patch. After making these changes, regenerate the CSV
and this model gets retrained against the new data.

## Problem 1: `undercarriage_wear` and `final_drive_wear` are nearly the same signal

LOSO recall on the current data: `undercarriage_wear` 0.01, `final_drive_wear`
0.07. Both are effectively unlearnable. Root cause, in `build_session()`:

```python
ch["Vibration_Undercarriage_RMS"] = (
    base["Vibration_Undercarriage_RMS"]
    * (1.0 + 1.20 * uc + 0.55 * fd)          # <- both processes drive this
    + 0.35 * (density / 10.0)
)
...
crest_u = HEALTHY_CREST_UNDERCARRIAGE * (1.0 + 0.85 * fd + 0.15 * uc) ...  # <- fd DOMINATES the crest signal
ch["Vibration_Undercarriage_Peak"] = ch["Vibration_Undercarriage_RMS"] * crest_u
```

Both processes push the same two channels (`Vibration_Undercarriage_RMS`,
`Vibration_Undercarriage_Peak`), and the crest factor — the one feature meant
to be diagnostic — is actually *more* final-drive signal than undercarriage
signal (0.85 vs 0.15). A model fed these channels sees two processes writing
to the same two dials in barely-distinguishable proportions.

`Oil_Particle_Count` is already close to a clean `final_drive_wear` signature
(coefficient 1650 on `fd`, only 120 on `uc`, 260 on `hs`) — that one's fine as
is. `Track_Slip_Ratio` is already `undercarriage_wear`-exclusive (`11.0 * uc`,
no `fd` term at all) — also fine as is, but its signal is currently getting
drowned out by the shared vibration channels dominating feature importance.

### Recommended changes

1. **Cut `final_drive_wear`'s contribution to `Vibration_Undercarriage_RMS`.**
   Drop the `0.55 * fd` term to something like `0.15 * fd` (a mild secondary
   effect, not co-equal with `uc`'s `1.20`).
2. **Make the crest factor final-drive-exclusive**, since the existing code
   comment already frames it that way ("final-drive wear makes the peak
   SPIKE — that's the diagnostic"). Drop `crest_u`'s `0.15 * uc` term to
   `0.0`. Then: `Vibration_Undercarriage_RMS` reads mostly `undercarriage_wear`,
   crest factor reads almost purely `final_drive_wear`.
3. **Widen the `Oil_Particle_Count` gap further**: drop its `120.0 * uc` term
   to ~`40.0`, so metal-shedding stays a final-drive-dominant tell, not one
   partially explained by mere looseness.
4. **Strengthen `Track_Slip_Ratio`'s `uc` coefficient** from `11.0` to
   something like `16.0`–`18.0`, so undercarriage wear has one channel where
   it's unambiguously the strongest signal in the data, not just the only
   contributor.

Net effect: `undercarriage_wear` becomes readable primarily from
`Track_Slip_Ratio` (+ moderate `Vibration_Undercarriage_RMS`);
`final_drive_wear` becomes readable primarily from `Oil_Particle_Count` and
crest factor. Two distinct channel fingerprints instead of one shared one.

## Problem 2: `filter_clogging` has 22 rows total

It's assigned to only 3 of 10 sessions (1, 5, 8), always at a late onset
(0.74–0.90 — "only a hint" per the session config comments), against a short
duration range (20–60h). Late onset + short duration + a session that ends
shortly after = almost no rows ever reach the labeled-dominant threshold
(`progress > 0.10` and it being the max).

### Recommended changes

- Add `filter_clogging` to 2 more sessions (e.g. one currently `cutting_edge_wear`-only
  session like 2 or 6, so it doesn't just pile onto already-complex overlap
  sessions).
- Move onset earlier — `0.40`–`0.55` instead of `0.74`–`0.90` — so the process
  has enough session-hours left to actually progress and become dominant
  before the session ends.
- Target: **at least 150–200 `filter_clogging`-dominant rows** across the
  dataset (roughly matching current `final_drive_wear` support), enough for
  LOSO recall to be measurable at all. 22 rows is close to the floor where
  precision/recall are statistical noise regardless of model quality.

## What NOT to change

- Don't touch `hours_offset` / `operating_hours_since_overhaul`'s reset
  behavior as part of this pass — that's a separate, already-documented bug
  (see the training notebook's Limitations section and `health_state`
  Section 2). Fixing it is worthwhile eventually but is unrelated to this
  failure-mode-separation problem and would needlessly widen this change.
- Don't rebalance `cutting_edge_wear` or `hydraulic_seal_failure` — both are
  already learnable (LOSO recall 0.53 and 0.75) and don't need channel changes.

## After regenerating

Retraining against the new CSV should be a straight re-run of
`bulldozer_training.ipynb` — nothing in the notebook is hardcoded to today's
class balance or channel names beyond the column list at the top, so a
regenerated CSV with the same schema just flows through. Expect
`reliable_modes` in the new `meta.json` to grow to include
`undercarriage_wear` and `final_drive_wear` if the separation worked; if it
doesn't, that's a real result too — report it honestly, same as this round.
