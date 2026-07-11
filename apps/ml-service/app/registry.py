from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib

logger = logging.getLogger(__name__)

REQUIRED_META_FIELDS = {
    "machine_category",
    "model_version",
    "features",
    "failure_modes",
    "threshold",
}

VERSION_DIR_RE = re.compile(r"^v(\d+)$")


@dataclass
class LoadedModel:
    machine_category: str
    model_version: str
    features: list[str]
    derived: list[str]
    failure_modes: list[str]
    threshold: float
    metrics: dict[str, Any]
    model: Any
    reliable_modes: list[str]
    mode_confidence_threshold: float | None


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, LoadedModel] = {}

    def load_from_dir(self, models_dir: Path) -> None:
        """Layout: models_dir/<category>/v<N>/{meta.json,model.joblib}.

        Every version folder found is logged; only the highest-numbered
        version per category is loaded into the registry. Version folders
        are ordered by the integer after 'v', not lexically (v10 > v2).
        """
        self._models = {}

        if not models_dir.exists():
            logger.warning("models_dir %s does not exist; registry will be empty", models_dir)
            return

        for category_dir in sorted(p for p in models_dir.iterdir() if p.is_dir()):
            category = category_dir.name

            versions: list[tuple[int, Path]] = []
            for version_dir in sorted(p for p in category_dir.iterdir() if p.is_dir()):
                match = VERSION_DIR_RE.match(version_dir.name)
                if not match:
                    logger.warning(
                        "category %s: ignoring folder %s (expected version folders named 'vN')",
                        category, version_dir.name,
                    )
                    continue
                versions.append((int(match.group(1)), version_dir))

            if not versions:
                logger.error("category %s: no version folders found, skipping", category)
                continue

            versions.sort(key=lambda v: v[0])
            logger.info(
                "category %s: found versions %s",
                category, [f"v{n}" for n, _ in versions],
            )

            latest_num, latest_dir = versions[-1]
            logger.info("category %s: selected v%d", category, latest_num)
            self._load_version(category, latest_dir)

    def _load_version(self, category: str, version_dir: Path) -> None:
        meta_path = version_dir / "meta.json"
        if not meta_path.exists():
            logger.error("category %s: %s has no meta.json, skipping", category, version_dir)
            return

        try:
            meta = json.loads(meta_path.read_text())
        except json.JSONDecodeError as exc:
            logger.error("skipping %s: invalid JSON (%s)", meta_path, exc)
            return

        missing = REQUIRED_META_FIELDS - meta.keys()
        if missing:
            logger.error("skipping %s: meta.json missing fields %s", meta_path, sorted(missing))
            return

        model_path = version_dir / "model.joblib"
        if not model_path.exists():
            logger.error("skipping %s: model.joblib not found next to meta.json", meta_path)
            return

        try:
            model = joblib.load(model_path)
        except Exception as exc:
            logger.error("skipping %s: failed to load model.joblib (%s)", meta_path, exc)
            return

        self._models[category] = LoadedModel(
            machine_category=category,
            model_version=meta["model_version"],
            features=meta["features"],
            derived=meta.get("derived", []),
            failure_modes=meta["failure_modes"],
            threshold=meta["threshold"],
            metrics=meta.get("metrics", {}),
            model=model,
            reliable_modes=meta.get("reliable_modes", []),
            mode_confidence_threshold=meta.get("mode_confidence_threshold"),
        )
        logger.info("loaded model category=%s version=%s", category, meta["model_version"])

    def get(self, category: str) -> LoadedModel | None:
        return self._models.get(category)

    def categories(self) -> list[str]:
        return sorted(self._models.keys())

    def items(self):
        return self._models.items()

    def __len__(self) -> int:
        return len(self._models)


registry = ModelRegistry()
