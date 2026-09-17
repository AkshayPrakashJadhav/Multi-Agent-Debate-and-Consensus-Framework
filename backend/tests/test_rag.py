import os
import shutil
import pytest
from app.services.rag_service import rag_service, FAISSIndex, LocalEmbedder
from app.core.config import settings

def test_chunk_text():
    # Test simple recursive text chunking
    text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five."
    chunks = rag_service.chunk_text(text, chunk_size=20, chunk_overlap=5)
    assert len(chunks) > 0
    for chunk in chunks:
        assert len(chunk) <= 25

def test_query_rewrite():
    query = "Please tell me about clinical diabetes recommendations"
    rewritten = rag_service.query_rewrite(query)
    assert "please" not in rewritten.lower()
    assert "tell me about" not in rewritten.lower()
    assert "clinical" in rewritten.lower()

def test_faiss_numpy_fallback_index():
    # Force a local test index
    embedder = LocalEmbedder()
    test_index = FAISSIndex("test_domain", embedder)
    
    docs = [
        {"doc_id": "1", "filename": "t1.txt", "domain": "test_domain", "chunk_index": 0, "text": "blockchain decentralized ledger transactions verification"},
        {"doc_id": "2", "filename": "t2.txt", "domain": "test_domain", "chunk_index": 0, "text": "clinical trials for oncology patient treatment dosages"},
    ]
    
    test_index.add_documents(docs)
    
    # Search for technology terms
    tech_results = test_index.search("blockchain verification ledger", top_k=1)
    assert len(tech_results) == 1
    assert tech_results[0][0]["filename"] == "t1.txt"
    
    # Search for medical terms
    med_results = test_index.search("oncology patient dosing", top_k=1)
    assert len(med_results) == 1
    assert med_results[0][0]["filename"] == "t2.txt"

    # Cleanup test files generated
    if os.path.exists(test_index.chunks_path):
        os.remove(test_index.chunks_path)
    if os.path.exists(test_index.index_path):
        os.remove(test_index.index_path)
