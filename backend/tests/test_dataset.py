import os
import pytest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.models import User, Experiment
from app.services.eval_service import eval_service, DebateDatasetAdapter, PROCESSED_PATH
from app.core.security import get_password_hash

# Setup testing db
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_dataset_files():
    # Verify that raw and processed datasets exist
    ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    raw_path = os.path.join(ROOT_DIR, "data", "debate", "raw_dataset.json")
    processed_path = os.path.join(ROOT_DIR, "data", "debate", "processed_dataset.json")
    
    assert os.path.exists(raw_path)
    assert os.path.exists(processed_path)
    
    with open(processed_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "splits" in data
    assert "train" in data["splits"]
    assert "evaluation" in data["splits"]
    assert len(data["splits"]["train"]) == 80
    assert len(data["splits"]["evaluation"]) == 20

def test_debate_dataset_adapter():
    adapter = DebateDatasetAdapter(PROCESSED_PATH)
    adapter.load()
    samples = adapter.get_samples(limit=5)
    assert len(samples) > 0
    assert "query" in samples[0]
    assert "reference" in samples[0]
    
    gt = adapter.get_ground_truth(samples[0])
    assert gt == samples[0].get("reference")
    
    meta = adapter.get_metadata(samples[0])
    assert meta["exampleId"] == samples[0].get("exampleId")

def test_run_dataset_evaluation(db_session):
    # Register test user
    test_user = User(
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test User"
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)

    # Run evaluations on 2 samples to keep test fast
    experiment = eval_service.run_dataset_evaluation(
        db=db_session,
        num_samples=2,
        random_seed=42,
        model_name="mock-model",
        temperature=0.4,
        debate_rounds=2,
        retrieval_top_k=2
    )
    
    assert experiment.id is not None
    assert experiment.num_samples == 2
    assert experiment.random_seed == 42
    assert "single_agent" in experiment.metrics
    assert "our_method" in experiment.metrics
    assert len(experiment.results) == 2
    assert experiment.results[0]["query"] is not None

    # Check database persistence
    db_exp = db_session.query(Experiment).filter(Experiment.id == experiment.id).first()
    assert db_exp is not None
    assert db_exp.metrics["our_method"]["accuracy"] >= 0
