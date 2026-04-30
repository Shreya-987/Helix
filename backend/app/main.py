"""FastAPI application entry-point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import nominations

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Helix Nominations API",
    description="API for managing employee promotion nominations.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nominations.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
