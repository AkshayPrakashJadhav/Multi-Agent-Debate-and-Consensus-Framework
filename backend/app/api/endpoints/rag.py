import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.models import User, Document
from app.schemas.schemas import DocumentResponse
from app.services.auth_service import get_current_user
from app.services.rag_service import rag_service

router = APIRouter()

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    domain: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if domain.lower() not in ["healthcare", "finance", "legal", "technology", "education"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid domain specified. Choose from: Healthcare, Finance, Legal, Technology, Education."
        )

    # Clean filename
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{file_id}{ext}"
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    save_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    # Save physical file
    try:
        with open(save_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save uploaded file: {str(e)}"
        )

    # Record in SQL Database
    db_doc = Document(
        id=file_id,
        filename=file.filename,
        file_path=save_path,
        domain=domain,
        uploaded_by=current_user.id
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    # Run background RAG chunking & indexing
    try:
        chunks_added = rag_service.add_document_to_rag(save_path, file.filename, domain, file_id)
        print(f"Indexed {chunks_added} chunks for document: {file.filename}")
    except Exception as e:
        # Graceful warning if index rebuild fails
        print(f"Error during vector index addition: {e}")

    return db_doc

@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Document).filter(Document.uploaded_by == current_user.id).all()

@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(
        Document.id == document_id, 
        Document.uploaded_by == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found."
        )

    # Delete physical file
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    
    # Reload/refresh FAISS index by rebuilding without this doc
    # (Simplified for local development: in production, we do deletion on vector DB natively)
    try:
        active_docs = db.query(Document).filter(Document.domain == doc.domain).all()
        index = rag_service.get_index(doc.domain)
        # Clear vector database chunks list
        index.chunks = []
        index.index = None
        if os.path.exists(index.chunks_path):
            os.remove(index.chunks_path)
        if os.path.exists(index.index_path):
            os.remove(index.index_path)
            
        for active in active_docs:
            rag_service.add_document_to_rag(active.file_path, active.filename, active.domain, active.id)
    except Exception as e:
        print(f"Error rebuilding index after deletion: {e}")

    return
