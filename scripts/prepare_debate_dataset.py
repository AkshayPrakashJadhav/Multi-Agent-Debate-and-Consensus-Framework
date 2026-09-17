import os
import json
import random

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "debate")
RAW_PATH = os.path.join(DATA_DIR, "raw_dataset.json")
PROCESSED_PATH = os.path.join(DATA_DIR, "processed_dataset.json")

def preprocess_record(record):
    """Cleans and structures a single raw record from the HF DEBATE dataset."""
    # 1. Basic properties
    example_id = record.get("exampleId", "")
    instruction = record.get("instruction", "")
    
    # 2. Extract single query string from input (usually list containing one string)
    input_list = record.get("input", [])
    query = input_list[0] if isinstance(input_list, list) and len(input_list) > 0 else str(input_list)
    
    # 3. Ground truth / references
    ref_list = record.get("references", [])
    reference = ref_list[0] if isinstance(ref_list, list) and len(ref_list) > 0 else str(ref_list)
    
    # 4. Personas details
    personas = []
    for p in record.get("personas", []):
        personas.append({
            "agentId": p.get("agentId", ""),
            "model": p.get("model", ""),
            "persona": p.get("persona", ""),
            "description": p.get("personaDescription", "")
        })
        
    # 5. Agreements / Voting details
    agreements = []
    for a in record.get("agreements", []):
        agreements.append({
            "agent_id": a.get("agent_id", ""),
            "persona": a.get("persona", ""),
            "agreement": a.get("agreement", False),
            "solution": a.get("solution", ""),
            "response": a.get("response", "")
        })
        
    # 6. Parse debate rounds from globalMemory
    debate_rounds = []
    global_memory = record.get("globalMemory", [])
    if isinstance(global_memory, list):
        for entry in global_memory:
            debate_rounds.append({
                "turn": entry.get("turn", 0),
                "message_id": entry.get("message_id", 0),
                "persona": entry.get("persona", ""),
                "agent_id": entry.get("agent_id", ""),
                "message": entry.get("message", ""),
                "solution": entry.get("solution", ""),
                "agreement": entry.get("agreement", None),
                "contribution": entry.get("contribution", "")
            })
            
    # Sort debate rounds by turn and message_id
    debate_rounds.sort(key=lambda x: (x["turn"], x["message_id"]))

    return {
        "exampleId": example_id,
        "instruction": instruction,
        "query": query,
        "reference": reference,
        "personas": personas,
        "persona_diversity": record.get("persona_diversity", 0.0),
        "paradigm": record.get("paradigm", "debate"),
        "decisionSuccess": record.get("decisionSuccess", False),
        "turns": record.get("turns", 0),
        "clockSeconds": record.get("clockSeconds", 0.0),
        "agreements": agreements,
        "debate_rounds": debate_rounds
    }

def main():
    print("=== DEBATE DATASET PREPROCESSING SCRIPT ===")
    
    if not os.path.exists(RAW_PATH):
        print(f"Error: Raw dataset not found at {RAW_PATH}. Please run download_debate.py first.")
        return
        
    with open(RAW_PATH, "r", encoding="utf-8") as f:
        raw_records = json.load(f)
        
    print(f"Loaded {len(raw_records)} raw records.")
    
    processed_records = []
    for rec in raw_records:
        cleaned = preprocess_record(rec)
        processed_records.append(cleaned)
        
    # Set a fixed random seed for reproducibility
    random.seed(42)
    random.shuffle(processed_records)
    
    # Create train/evaluation splits (80% train, 20% evaluation)
    split_idx = int(len(processed_records) * 0.8)
    train_split = processed_records[:split_idx]
    eval_split = processed_records[split_idx:]
    
    output_data = {
        "dataset_name": "Multi-Agent-LLMs/DEBATE",
        "configuration": "critical_expert_debate_majority_consensus",
        "total_records": len(processed_records),
        "splits": {
            "train": train_split,
            "evaluation": eval_split
        }
    }
    
    with open(PROCESSED_PATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        
    print(f"Preprocessing completed successfully!")
    print(f"Saved processed dataset to {PROCESSED_PATH}")
    print(f"Train split size: {len(train_split)}")
    print(f"Evaluation split size: {len(eval_split)}")

if __name__ == "__main__":
    main()
