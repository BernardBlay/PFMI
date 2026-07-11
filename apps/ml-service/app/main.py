from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.registry import registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry.load_from_dir(Path(settings.models_dir))
    yield


app = FastAPI(title="Predictive Maintenance ML Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": registry.categories(),
    }


@app.get("/models")
def list_models():
    return {
        category: {
            "model_version": m.model_version,
            "features": m.features,
            "derived": m.derived,
            "failure_modes": m.failure_modes,
            "threshold": m.threshold,
            "metrics": m.metrics,
        }
        for category, m in registry.items()
    }
