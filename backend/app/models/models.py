import uuid
from datetime import datetime, UTC
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    
    documents = relationship("Document", back_populates="uploader", cascade="all, delete-orphan")
    debate_sessions = relationship("DebateSession", back_populates="user", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    domain = Column(String(100), nullable=False)  # Healthcare, Finance, Legal, Technology, etc.
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    
    uploader = relationship("User", back_populates="documents")

class DebateSession(Base):
    __tablename__ = "debate_sessions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    query = Column(Text, nullable=False)
    domain = Column(String(100), nullable=False)
    consensus_answer = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    cost = Column(Float, default=0.0)
    tokens_used = Column(Integer, default=0)
    debate_length_rounds = Column(Integer, default=0)
    agent_influence = Column(JSON, nullable=True)
    rating = Column(String(50), nullable=True)  # thumbs_up or thumbs_down
    feedback_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    
    user = relationship("User", back_populates="debate_sessions")
    rounds = relationship("DebateRound", back_populates="session", cascade="all, delete-orphan")

class DebateRound(Base):
    __tablename__ = "debate_rounds"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("debate_sessions.id"), nullable=False)
    round_number = Column(Integer, nullable=False)
    agent_name = Column(String(100), nullable=False)  # Planner, Research, Expert, Risk, Critic, Arbiter, Verifier, Confidence
    response = Column(Text, nullable=False)
    critique = Column(Text, nullable=True)
    confidence = Column(Float, nullable=False, default=100.0)
    evidence = Column(JSON, nullable=True) # List of dictionaries containing sources/chunks used
    weaknesses = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    
    session = relationship("DebateSession", back_populates="rounds")

class Evaluation(Base):
    __tablename__ = "evaluations"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    query = Column(Text, nullable=False)
    domain = Column(String(100), nullable=False)
    
    # Store comparative JSON metrics
    # e.g., accuracy, faithfulness, BLEU, ROUGE-L, latency, cost, win_rate
    single_agent_metrics = Column(JSON, nullable=False)
    majority_voting_metrics = Column(JSON, nullable=True)
    approval_voting_metrics = Column(JSON, nullable=True)
    multi_agent_metrics = Column(JSON, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

class Experiment(Base):
    __tablename__ = "experiments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_name = Column(String(255), nullable=False)
    dataset_config = Column(String(255), nullable=False)
    dataset_version = Column(String(50), nullable=True)
    random_seed = Column(Integer, nullable=False)
    num_samples = Column(Integer, nullable=False)
    model_name = Column(String(100), nullable=False)
    model_temperature = Column(Float, nullable=False)
    debate_rounds = Column(Integer, nullable=False)
    retrieval_top_k = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    
    # Store aggregate summary metrics for comparisons
    metrics = Column(JSON, nullable=False)
    
    # Store list of results per example evaluated
    results = Column(JSON, nullable=False)

