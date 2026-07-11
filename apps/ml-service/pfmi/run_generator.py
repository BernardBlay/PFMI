"""
Quick-start runner — edit CONFIG below then run:
    python run_generator.py
"""

from generate_pfmi_dataset import generate, CONFIG

# ── Customize settings ──────────────────────────────────────────────────────
CONFIG["target_records"]  = 10_000_000   # change to e.g. 100_000 for a quick test
CONFIG["num_machines"]    = 120
CONFIG["interval_minutes"]= 5
CONFIG["output_dir"]      = "output"
CONFIG["chunk_size"]      = 500_000

# ── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    merged, chunks = generate(CONFIG)
    print(f"\nDone. Full dataset: {merged}")
    print(f"Chunk files ({len(chunks)}): {CONFIG['output_dir']}/wheel_loader_pfmi_chunk_*.csv")
    print(f"JSON sample (1,000 rows): {CONFIG['output_dir']}/wheel_loader_pfmi_sample_1000.json")
