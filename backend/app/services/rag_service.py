import os
import re
import numpy as np
from typing import List, Dict, Any, Tuple
from app.core.config import settings

# Graceful imports to allow offline mock fallback if ML dependencies fail to install
try:
    import faiss
    from sentence_transformers import SentenceTransformer
    HAS_ML_LIBS = True
except ImportError:
    HAS_ML_LIBS = False

# Simple PDF text extraction fallback
try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

class LocalEmbedder:
    """Handles local semantic embedding generation with a lightweight transformer."""
    def __init__(self):
        if HAS_ML_LIBS:
            try:
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
                self.dimension = 384
                self.is_mock = False
            except Exception:
                self.is_mock = True
        else:
            self.is_mock = True
            
        if self.is_mock:
            self.dimension = 100  # Simple mock representation

    def embed(self, texts: List[str]) -> np.ndarray:
        if not self.is_mock:
            return self.model.encode(texts, convert_to_numpy=True)
        # Mock embeddings based on word frequencies
        embeddings = []
        for text in texts:
            vec = np.zeros(self.dimension, dtype=np.float32)
            # Create a deterministic mock vector based on hash of words
            words = text.lower().split()
            for idx, word in enumerate(words[:self.dimension]):
                h = sum(ord(c) for c in word)
                vec[idx % self.dimension] = (h % 100) / 100.0
            # Normalize
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            embeddings.append(vec)
        return np.array(embeddings, dtype=np.float32)

class FAISSIndex:
    """Lightweight local vector database wrapper using FAISS or numpy fallback."""
    def __init__(self, domain: str, embedder: LocalEmbedder):
        self.domain = domain
        self.embedder = embedder
        self.chunks: List[Dict[str, Any]] = []
        self.index = None
        self.index_path = os.path.join(settings.VECTOR_DB_DIR, f"{domain}_faiss.index")
        self.chunks_path = os.path.join(settings.VECTOR_DB_DIR, f"{domain}_chunks.npy")
        self.load()

    def add_documents(self, documents: List[Dict[str, Any]]):
        if not documents:
            return
        self.chunks.extend(documents)
        texts = [doc["text"] for doc in documents]
        embeddings = self.embedder.embed(texts)
        
        if HAS_ML_LIBS and not self.embedder.is_mock:
            if self.index is None:
                self.index = faiss.IndexFlatIP(self.embedder.dimension)
            self.index.add(embeddings)
        self.save()

    def search(self, query: str, top_k: int = 5) -> List[Tuple[Dict[str, Any], float]]:
        if not self.chunks:
            return []
        
        query_vector = self.embedder.embed([query])
        
        if HAS_ML_LIBS and self.index is not None and not self.embedder.is_mock:
            # FAISS cosine similarity search (IndexFlatIP expects normalized vectors)
            faiss.normalize_L2(query_vector)
            scores, indices = self.index.search(query_vector, min(top_k, len(self.chunks)))
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0 or idx >= len(self.chunks):
                    continue
                results.append((self.chunks[idx], float(score)))
            return results
        else:
            # Fallback numpy cosine similarity
            results = []
            texts = [c["text"] for c in self.chunks]
            embeddings = self.embedder.embed(texts)
            q_vec = query_vector[0]
            
            for idx, c_vec in enumerate(embeddings):
                # Calculate cosine similarity
                dot_product = np.dot(q_vec, c_vec)
                norm_q = np.linalg.norm(q_vec)
                norm_c = np.linalg.norm(c_vec)
                score = dot_product / (norm_q * norm_c) if (norm_q > 0 and norm_c > 0) else 0.0
                results.append((self.chunks[idx], float(score)))
            
            results.sort(key=lambda x: x[1], reverse=True)
            return results[:top_k]

    def save(self):
        if not os.path.exists(settings.VECTOR_DB_DIR):
            os.makedirs(settings.VECTOR_DB_DIR)
        
        # Save chunks metadata
        np.save(self.chunks_path, self.chunks, allow_pickle=True)
        
        # Save FAISS index
        if HAS_ML_LIBS and self.index is not None and not self.embedder.is_mock:
            faiss.write_index(self.index, self.index_path)

    def load(self):
        if os.path.exists(self.chunks_path):
            try:
                self.chunks = list(np.load(self.chunks_path, allow_pickle=True))
                if HAS_ML_LIBS and os.path.exists(self.index_path) and not self.embedder.is_mock:
                    self.index = faiss.read_index(self.index_path)
                elif HAS_ML_LIBS and not self.embedder.is_mock:
                    # Rebuild index
                    texts = [doc["text"] for doc in self.chunks]
                    embeddings = self.embedder.embed(texts)
                    self.index = faiss.IndexFlatIP(self.embedder.dimension)
                    self.index.add(embeddings)
            except Exception:
                # Reset if corrupt
                self.chunks = []
                self.index = None

class RAGService:
    def __init__(self):
        self.embedder = LocalEmbedder()
        self.indexes: Dict[str, FAISSIndex] = {}

    def get_index(self, domain: str) -> FAISSIndex:
        normalized_domain = domain.lower()
        if normalized_domain not in self.indexes:
            self.indexes[normalized_domain] = FAISSIndex(normalized_domain, self.embedder)
        return self.indexes[normalized_domain]

    def extract_text(self, file_path: str, filename: str) -> str:
        """Extracts plain text from doc files (PDF, TXT)."""
        if not os.path.exists(file_path):
            return ""
            
        ext = os.path.splitext(filename)[1].lower()
        
        if ext == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
                
        elif ext == ".pdf":
            if HAS_PYPDF:
                text = ""
                try:
                    with open(file_path, "rb") as f:
                        reader = pypdf.PdfReader(f)
                        for page in reader.pages:
                            t = page.extract_text()
                            if t:
                                text += t + "\n"
                    return text
                except Exception as e:
                    print(f"Error reading PDF with pypdf: {e}")
            
            # Simple fallback for parsing ascii characters in raw PDF
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    # Clean some typical PDF structure
                    cleaned = re.sub(r'[^a-zA-Z0-9\s\.\,\!\?\:\'\"]', '', content)
                    return cleaned[:100000] # Cap size for simple fallback
            except Exception:
                return "Failed to parse PDF binary file."
                
        else:
            # Fallback read
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

    def chunk_text(self, text: str, chunk_size: int = 800, chunk_overlap: int = 150) -> List[str]:
        """Performs recursive character chunking."""
        if not text:
            return []
            
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            
            # Try to find a sentence/paragraph break to split cleanly
            if end < len(text):
                # Search backwards for a paragraph, newline, or sentence period
                bracket_search = text[max(start, end-100):end]
                split_idx = -1
                for marker in ["\n\n", "\n", ". ", "? ", "! "]:
                    pos = bracket_search.rfind(marker)
                    if pos != -1:
                        split_idx = max(start, end-100) + pos + len(marker)
                        break
                if split_idx != -1:
                    end = split_idx
            
            chunks.append(text[start:end].strip())
            new_start = end - chunk_overlap
            if new_start <= start:
                start = end
            else:
                start = new_start
            if start >= len(text) or chunk_size <= chunk_overlap:
                break
                
        return [c for c in chunks if len(c) > min(20, chunk_size // 2)]

    def add_document_to_rag(self, file_path: str, filename: str, domain: str, doc_id: str):
        """Extracts, chunks, and indexes a document."""
        full_text = self.extract_text(file_path, filename)
        raw_chunks = self.chunk_text(full_text)
        
        chunks_metadata = []
        for i, chunk in enumerate(raw_chunks):
            chunks_metadata.append({
                "doc_id": doc_id,
                "filename": filename,
                "domain": domain,
                "chunk_index": i,
                "text": chunk
            })
            
        index = self.get_index(domain)
        index.add_documents(chunks_metadata)
        return len(chunks_metadata)

    def query_rewrite(self, query: str) -> str:
        """Rewrites and expands the query to focus key search terms."""
        # Clean query, remove common filler words, return clean core prompt
        cleaned = re.sub(r'^((please|tell me about|what is|how do i|explain)\s*)+', '', query, flags=re.IGNORECASE)
        return cleaned

    def rerank(self, query: str, retrieved: List[Tuple[Dict[str, Any], float]], top_n: int = 4) -> List[Dict[str, Any]]:
        """Re-ranks retrieved chunks based on word overlap and semantic density."""
        if not retrieved:
            return []
            
        # Re-score based on keyword overlap (BM25 flavor) combined with embedding similarity
        query_words = set(query.lower().split())
        reranked = []
        for doc, vector_score in retrieved:
            text = doc["text"].lower()
            overlap = sum(1 for w in query_words if w in text)
            word_score = overlap / len(query_words) if query_words else 0.0
            
            # Combine 60% vector / 40% keyword overlap for robust hybrid scoring
            combined_score = 0.6 * vector_score + 0.4 * word_score
            reranked.append((doc, combined_score))
            
        reranked.sort(key=lambda x: x[1], reverse=True)
        return [item[0] for item in reranked[:top_n]]

    def retrieve_context(self, query: str, domain: str, top_k: int = 8, top_n: int = 4) -> List[Dict[str, Any]]:
        """Advanced retrieval flow: Rewrite -> Hybrid Search -> Rerank."""
        rewritten_query = self.query_rewrite(query)
        index = self.get_index(domain)
        raw_matches = index.search(rewritten_query, top_k=top_k)
        final_chunks = self.rerank(query, raw_matches, top_n=top_n)
        return final_chunks

    def citation_validator(self, agent_response: str, context_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validates which chunks support claims in the response."""
        validated_citations = []
        sentences = re.split(r'(?<=[.!?])\s+', agent_response)
        
        for idx, chunk in enumerate(context_chunks):
            chunk_words = set(chunk["text"].lower().split())
            if not chunk_words:
                continue
                
            # Check if any sentence has significant overlap with this chunk
            max_overlap = 0.0
            matching_sentence = ""
            
            for sentence in sentences:
                s_words = set(sentence.lower().split())
                if not s_words:
                    continue
                intersection = chunk_words.intersection(s_words)
                overlap_ratio = len(intersection) / min(len(s_words), len(chunk_words))
                if overlap_ratio > max_overlap:
                    max_overlap = overlap_ratio
                    matching_sentence = sentence
            
            # If significant overlap, record citation support
            if max_overlap > 0.25:
                validated_citations.append({
                    "source": chunk["filename"],
                    "chunk_index": chunk["chunk_index"],
                    "citation_text": chunk["text"][:120] + "...",
                    "overlap_score": round(max_overlap, 2),
                    "supported_sentence": matching_sentence
                })
                
        return validated_citations

rag_service = RAGService()
