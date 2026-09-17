import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.models import User, DebateSession, DebateRound
from app.services.debate_orchestrator import debate_orchestrator
from app.core.security import get_password_hash

# Setup mock testing database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_debate.db"
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
        import os
        if os.path.exists("./test_debate.db"):
            try:
                os.remove("./test_debate.db")
            except Exception:
                pass

def test_debate_pipeline(db_session):
    # 1. Register a test user
    test_user = User(
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test User"
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)

    # 2. Run debate orchestration
    query = "Should we migrate healthcare systems to cloud micro-frontends?"
    domain = "Technology"
    
    session = debate_orchestrator.run_debate(
        db=db_session,
        user_id=test_user.id,
        query=query,
        domain=domain
    )

    # 3. Assert debate session attributes are initialized
    assert session.id is not None
    assert session.user_id == test_user.id
    assert session.domain == domain
    assert len(session.consensus_answer) > 0
    assert session.confidence_score > 0
    assert session.cost >= 0
    assert session.tokens_used > 0
    assert session.debate_length_rounds >= 1

    # 4. Check that rounds are recorded in the database
    rounds = db_session.query(DebateRound).filter(DebateRound.session_id == session.id).all()
    assert len(rounds) >= 8
    
    # Verify planner output
    planner_round = next((r for r in rounds if r.agent_name == "Planner"), None)
    assert planner_round is not None
    assert "subtasks" in planner_round.response

    # Verify arbiter output
    arbiter_round = next((r for r in rounds if r.agent_name == "Arbiter"), None)
    assert arbiter_round is not None
    assert len(arbiter_round.response) > 0

    # Verify compliance output
    compliance_round = next((r for r in rounds if r.agent_name == "Compliance Agent"), None)
    assert compliance_round is not None
    assert "complianceFlags" in compliance_round.response

    # Verify explainability output
    explain_round = next((r for r in rounds if r.agent_name == "Explainability Agent"), None)
    assert explain_round is not None
    assert "plainSummary" in explain_round.response

    # Verify agent influence dictionary is populated
    assert session.agent_influence is not None
    assert "Research Agent" in session.agent_influence
    assert sum(session.agent_influence.values()) == pytest.approx(100.0, 1.0)


def test_feedback_and_analytics_endpoints(db_session):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.db.database import get_db
    
    # Mock user and session setup
    test_user = User(
        email="test2@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Feedback Tester"
    )
    db_session.add(test_user)
    db_session.commit()
    
    session = DebateSession(
        user_id=test_user.id,
        query="Is blockchain suitable for records management?",
        domain="Technology",
        consensus_answer="Consensus recommends encrypted centralized databases.",
        confidence_score=85.0
    )
    db_session.add(session)
    db_session.commit()

    # Override get_db dependency
    app.dependency_overrides[get_db] = lambda: db_session
    
    # Mock get_current_user to bypass JWT validation
    from app.services.auth_service import get_current_user
    app.dependency_overrides[get_current_user] = lambda: test_user
    
    client = TestClient(app)
    
    # Test POST Feedback
    feedback_payload = {
        "rating": "thumbs_up",
        "comment": "Accurate synthesis of consensus tradeoffs."
    }
    response = client.post(f"/api/v1/debate/sessions/{session.id}/feedback", json=feedback_payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["rating"] == "thumbs_up"
    assert res_data["feedback_comment"] == "Accurate synthesis of consensus tradeoffs."
    
    # Test GET Analytics
    response = client.get("/api/v1/evaluation/analytics")
    assert response.status_code == 200
    analytics_data = response.json()
    assert analytics_data["total_sessions"] >= 1
    assert len(analytics_data["avg_confidence_by_domain"]) >= 1
    assert "calibration_curve" in analytics_data
    assert "cost_accuracy_tradeoff" in analytics_data
    
    # Clean up overrides
    app.dependency_overrides.clear()
