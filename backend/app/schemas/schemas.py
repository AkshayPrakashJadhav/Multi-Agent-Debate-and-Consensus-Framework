from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    sub: Optional[str] = None

# RAG / Document Schemas
class DocumentResponse(BaseModel):
    id: str
    filename: str
    domain: str
    created_at: datetime

    class Config:
        from_attributes = True

# Debate Schemas
class DebateCreate(BaseModel):
    query: str
    domain: str = Field(..., description="Healthcare, Finance, Legal, Technology, or Education")

class DebateRoundResponse(BaseModel):
    id: str
    round_number: int
    agent_name: str
    response: str
    critique: Optional[str]
    confidence: float
    evidence: Optional[Any] = None
    weaknesses: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class FeedbackCreate(BaseModel):
    rating: str = Field(..., description="thumbs_up or thumbs_down")
    comment: Optional[str] = None

class DebateSessionResponse(BaseModel):
    id: str
    query: str
    domain: str
    consensus_answer: Optional[str]
    confidence_score: Optional[float]
    cost: float
    tokens_used: int
    debate_length_rounds: int
    agent_influence: Optional[Dict[str, float]] = None
    rating: Optional[str] = None
    feedback_comment: Optional[str] = None
    created_at: datetime
    rounds: List[DebateRoundResponse] = []

    class Config:
        from_attributes = True

# Evaluation Schemas
class EvaluationResponse(BaseModel):
    id: str
    query: str
    domain: str
    single_agent_metrics: Dict[str, Any]
    majority_voting_metrics: Optional[Dict[str, Any]] = None
    approval_voting_metrics: Optional[Dict[str, Any]] = None
    multi_agent_metrics: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True

# Dataset API Schemas
class DatasetInfoResponse(BaseModel):
    dataset_name: str
    configuration: str
    split_names: List[str]
    num_examples: int
    feature_names: List[str]
    download_status: str

class DatasetStatusResponse(BaseModel):
    downloaded: bool
    processed: bool
    num_examples: int
    local_path: str
    last_processed_time: Optional[str] = None

class DatasetSampleResponse(BaseModel):
    exampleId: str
    instruction: str
    query: str
    reference: str
    personas: List[Dict[str, Any]]
    persona_diversity: float
    paradigm: str
    decisionSuccess: bool
    turns: int
    clockSeconds: float
    agreements: List[Dict[str, Any]]
    debate_rounds: List[Dict[str, Any]]

# Experiment Schemas
class ExperimentCreate(BaseModel):
    dataset_name: str
    dataset_config: str
    random_seed: int
    num_samples: int
    model_name: str
    model_temperature: float
    debate_rounds: int
    retrieval_top_k: int
    metrics: Dict[str, Any]
    results: List[Dict[str, Any]]

class ExperimentResponse(BaseModel):
    id: str
    dataset_name: str
    dataset_config: str
    dataset_version: Optional[str]
    random_seed: int
    num_samples: int
    model_name: str
    model_temperature: float
    debate_rounds: int
    retrieval_top_k: int
    created_at: datetime
    metrics: Dict[str, Any]
    results: List[Dict[str, Any]]

    class Config:
        from_attributes = True

