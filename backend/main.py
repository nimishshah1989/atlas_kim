"""ATLAS Kim — Unified RS Intelligence Engine (minimal FastAPI app)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, cast

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from backend.config import get_settings
from backend.routes import unified

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ],
)

settings = get_settings()
log = structlog.get_logger()

ALLOWED_ORIGINS: list[str] = settings.cors_origin_list

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.rate_limit_default],
    strategy="fixed-window",
)

app = FastAPI(
    title="ATLAS Kim — Unified RS Intelligence Engine",
    description="Deterministic relative-strength intelligence layer for equities, MFs, ETFs and global indices.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(Callable[..., Any], _rate_limit_exceeded_handler))
app.add_middleware(SlowAPIMiddleware)

# CORS — explicit allowlist sourced from settings.cors_origins (never "*").
app.add_middleware(
    CORSMiddleware,
    allow_origins=[*ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Tenant-ID"],
)


@app.middleware("http")
async def _add_process_time_header(request: Request, call_next: Any) -> Any:
    import time as _time
    start = _time.monotonic()
    response = await call_next(request)
    elapsed_ms = int((_time.monotonic() - start) * 1000)
    response.headers["X-Process-Time-Ms"] = str(elapsed_ms)
    return response


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(unified.router)


# ---------------------------------------------------------------------------
# Root / probes
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "service": "atlas-kim-unified",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "atlas-kim-unified"}


@app.get("/api/v1/openapi.json", include_in_schema=False)
async def api_v1_openapi() -> JSONResponse:
    return JSONResponse(app.openapi())


@app.get("/api/v1/docs", include_in_schema=False)
async def api_v1_docs() -> HTMLResponse:
    return get_swagger_ui_html(
        openapi_url="/api/v1/openapi.json",
        title="ATLAS Kim — API v1 docs",
    )


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup() -> None:
    try:
        spec_path = Path(__file__).resolve().parent / "openapi.json"
        spec_path.write_text(json.dumps(app.openapi(), indent=2))
    except OSError as exc:
        log.warning("openapi_export_failed", error=str(exc))

    log.info(
        "atlas_kim_starting",
        port=settings.atlas_api_port,
        cors_origins=ALLOWED_ORIGINS,
        rate_limit=settings.rate_limit_default,
    )


@app.on_event("shutdown")
async def shutdown() -> None:
    log.info("atlas_kim_shutting_down")
