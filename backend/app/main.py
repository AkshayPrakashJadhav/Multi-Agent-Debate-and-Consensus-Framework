import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine, Base
from app.api.endpoints import auth, debate, rag, evaluation, dataset

from sqlalchemy import text
# Create SQL Tables on startup (SQLite/Postgres automatic schema generation)
Base.metadata.create_all(bind=engine)

# Auto-migration / alter tables for new columns (backward compatibility)
with engine.connect() as conn:
    # 1. Alter debate_sessions
    for col_name, col_type in [("agent_influence", "JSON"), ("rating", "VARCHAR(50)"), ("feedback_comment", "TEXT")]:
        try:
            conn.execute(text(f"SELECT {col_name} FROM debate_sessions LIMIT 1"))
        except Exception:
            try:
                conn.execute(text(f"ALTER TABLE debate_sessions ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception as e:
                print(f"Migration error adding {col_name} to debate_sessions: {e}")
                
    # 2. Alter evaluations
    for col_name, col_type in [("majority_voting_metrics", "JSON"), ("approval_voting_metrics", "JSON")]:
        try:
            conn.execute(text(f"SELECT {col_name} FROM evaluations LIMIT 1"))
        except Exception:
            try:
                conn.execute(text(f"ALTER TABLE evaluations ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception as e:
                print(f"Migration error adding {col_name} to evaluations: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-Agent Debate-and-Consensus Framework for Domain-Specific Decision Support.",
    version="1.0.0"
)

# CORS configurations for Next.js communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(debate.router, prefix=f"{settings.API_V1_STR}/debate", tags=["Agent Debate Orchestrator"])
app.include_router(rag.router, prefix=f"{settings.API_V1_STR}/rag", tags=["RAG Ingestion Engine"])
app.include_router(evaluation.router, prefix=f"{settings.API_V1_STR}/evaluation", tags=["System Evaluation Engine"])
app.include_router(dataset.router, prefix=f"{settings.API_V1_STR}/dataset", tags=["Dataset Explorer & Benchmark"])


@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0",
        "documentation": "/docs"
    }
