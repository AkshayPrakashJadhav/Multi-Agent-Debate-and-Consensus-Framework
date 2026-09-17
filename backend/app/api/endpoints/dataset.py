import os
import json
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any
from app.schemas.schemas import DatasetInfoResponse, DatasetSampleResponse, DatasetStatusResponse

router = APIRouter()

# Locate workspace root dynamically (5 levels up from endpoints/dataset.py)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
RAW_PATH = os.path.join(ROOT_DIR, "data", "debate", "raw_dataset.json")
PROCESSED_PATH = os.path.join(ROOT_DIR, "data", "debate", "processed_dataset.json")

@router.get("/status", response_model=DatasetStatusResponse)
def get_dataset_status():
    downloaded = os.path.exists(RAW_PATH)
    processed = os.path.exists(PROCESSED_PATH)
    num_examples = 0
    last_processed = None
    
    if processed:
        try:
            with open(PROCESSED_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            num_examples = data.get("total_records", 0)
            mtime = os.path.getmtime(PROCESSED_PATH)
            from datetime import datetime, UTC
            last_processed = datetime.fromtimestamp(mtime, UTC).isoformat()
        except Exception:
            pass
            
    return {
        "downloaded": downloaded,
        "processed": processed,
        "num_examples": num_examples,
        "local_path": PROCESSED_PATH if processed else (RAW_PATH if downloaded else ""),
        "last_processed_time": last_processed
    }

@router.get("/info", response_model=DatasetInfoResponse)
def get_dataset_info():
    if not os.path.exists(PROCESSED_PATH):
        raise HTTPException(
            status_code=404, 
            detail="Dataset not preprocessed yet. Run scripts/prepare_debate_dataset.py"
        )
    try:
        with open(PROCESSED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Get some features from first record of train split
        features = []
        train_records = data.get("splits", {}).get("train", [])
        if train_records:
            features = list(train_records[0].keys())
            
        return {
            "dataset_name": data.get("dataset_name", "Multi-Agent-LLMs/DEBATE"),
            "configuration": data.get("configuration", "critical_expert_debate_majority_consensus"),
            "split_names": list(data.get("splits", {}).keys()),
            "num_examples": data.get("total_records", 0),
            "feature_names": features,
            "download_status": "completed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(e)}")

@router.get("/samples", response_model=List[DatasetSampleResponse])
def get_dataset_samples(
    limit: int = Query(5, ge=1, le=100), 
    split: str = Query("evaluation", description="train or evaluation")
):
    if not os.path.exists(PROCESSED_PATH):
        raise HTTPException(
            status_code=404, 
            detail="Dataset not preprocessed yet. Run scripts/prepare_debate_dataset.py"
        )
    try:
        with open(PROCESSED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        split_data = data.get("splits", {}).get(split, [])
        if not split_data:
            # Fallback to train
            split_data = data.get("splits", {}).get("train", [])
            
        return split_data[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch samples: {str(e)}")

@router.get("/statistics")
def get_dataset_statistics():
    if not os.path.exists(PROCESSED_PATH):
        raise HTTPException(
            status_code=404, 
            detail="Dataset not preprocessed yet. Run scripts/prepare_debate_dataset.py"
        )
    try:
        with open(PROCESSED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        all_records = []
        for split_name, split_list in data.get("splits", {}).items():
            all_records.extend(split_list)
            
        if not all_records:
            return {}
            
        total_examples = len(all_records)
        decision_success_count = sum(1 for r in all_records if r.get("decisionSuccess", False))
        
        turns_dist = {}
        personas_freq = {}
        response_lengths = []
        rounds_dist = {}
        
        for r in all_records:
            turns = r.get("turns", 0)
            turns_dist[turns] = turns_dist.get(turns, 0) + 1
            
            p_list = r.get("personas", [])
            for p in p_list:
                p_name = p.get("persona", "Unknown")
                personas_freq[p_name] = personas_freq.get(p_name, 0) + 1
                
            debate_rounds = r.get("debate_rounds", [])
            for dr in debate_rounds:
                msg = dr.get("message", "")
                if msg:
                    response_lengths.append(len(msg.split()))
                turn_num = dr.get("turn", 0)
                rounds_dist[turn_num] = rounds_dist.get(turn_num, 0) + 1
                
        avg_len = sum(response_lengths) / len(response_lengths) if response_lengths else 0
        
        # Word length bins
        length_bins = {"0-50": 0, "51-150": 0, "151-300": 0, "301-500": 0, "501+": 0}
        for length in response_lengths:
            if length <= 50:
                length_bins["0-50"] += 1
            elif length <= 150:
                length_bins["51-150"] += 1
            elif length <= 300:
                length_bins["151-300"] += 1
            elif length <= 500:
                length_bins["301-500"] += 1
            else:
                length_bins["501+"] += 1
                
        # Format for charts
        turns_chart = [{"turns": f"Turn {k}", "count": v} for k, v in sorted(turns_dist.items())]
        personas_chart = [{"persona": k, "count": v} for k, v in sorted(personas_freq.items(), key=lambda x: x[1], reverse=True)[:8]]
        length_chart = [{"range": k, "count": v} for k, v in length_bins.items()]
        rounds_chart = [{"round": f"Round {k}", "messages": v} for k, v in sorted(rounds_dist.items())]
        
        return {
            "total_examples": total_examples,
            "decision_success_rate": round((decision_success_count / total_examples) * 100, 2) if total_examples > 0 else 0.0,
            "turns_distribution": turns_chart,
            "personas_frequency": personas_chart,
            "average_response_word_length": round(avg_len, 2),
            "response_length_distribution": length_chart,
            "rounds_message_count": rounds_chart
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate statistics: {str(e)}")
