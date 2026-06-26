from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import exports, layers, llm
from app.services.bootstrap import ensure_layers_initialized


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_layers_initialized()
    yield


app = FastAPI(title="Prompt Studio", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(layers.router)
app.include_router(exports.router)
app.include_router(llm.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
