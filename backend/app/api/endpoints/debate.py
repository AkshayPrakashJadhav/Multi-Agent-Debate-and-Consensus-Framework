from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import User, DebateSession
from app.schemas.schemas import DebateCreate, DebateSessionResponse
from app.services.auth_service import get_current_user
from app.services.debate_orchestrator import debate_orchestrator
from app.services.pdf_service import pdf_service

router = APIRouter()

import json
from app.schemas.schemas import DebateCreate, DebateSessionResponse, FeedbackCreate

@router.post("/sessions")
def create_debate_session(
    payload: DebateCreate,
    stream: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        if stream:
            def event_generator():
                try:
                    generator = debate_orchestrator.run_debate_stream(
                        db=db,
                        user_id=current_user.id,
                        query=payload.query,
                        domain=payload.domain
                    )
                    for event in generator:
                        yield f"data: {json.dumps(event)}\n\n"
                except Exception as err:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(err)})}\n\n"
            return StreamingResponse(event_generator(), media_type="text/event-stream")
        else:
            session = debate_orchestrator.run_debate(
                db=db,
                user_id=current_user.id,
                query=payload.query,
                domain=payload.domain
            )
            return session
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during agent debate orchestration: {str(e)}"
        )

@router.post("/sessions/{session_id}/feedback", response_model=DebateSessionResponse)
def submit_session_feedback(
    session_id: str,
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(DebateSession).filter(
        DebateSession.id == session_id,
        DebateSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Debate session not found."
        )
        
    session.rating = payload.rating
    session.feedback_comment = payload.comment
    db.commit()
    db.refresh(session)
    return session

@router.get("/sessions", response_model=List[DebateSessionResponse])
def get_user_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(DebateSession).filter(
        DebateSession.user_id == current_user.id
    ).order_by(DebateSession.created_at.desc()).all()

@router.get("/sessions/{session_id}", response_model=DebateSessionResponse)
def get_session_details(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(DebateSession).filter(
        DebateSession.id == session_id,
        DebateSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Debate session not found."
        )
    return session

@router.get("/sessions/{session_id}/pdf")
def export_session_pdf(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(DebateSession).filter(
        DebateSession.id == session_id,
        DebateSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Debate session not found."
        )
        
    pdf_buffer = pdf_service.generate_debate_report(session)
    filename = f"debate_report_{session.id[:8]}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
