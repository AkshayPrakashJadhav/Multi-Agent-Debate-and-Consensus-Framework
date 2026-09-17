import os
import json
import sys

# Ensure datasets is importable, print helpful error if not
try:
    from datasets import load_dataset
except ImportError:
    print("Error: The 'datasets' library is not installed in this environment. Run pip install datasets first.")
    sys.exit(1)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "debate")
RAW_PATH = os.path.join(DATA_DIR, "raw_dataset.json")

def main():
    print("=== DEBATE DATASET DOWNLOAD SCRIPT ===")
    os.makedirs(DATA_DIR, exist_ok=True)
    
    if os.path.exists(RAW_PATH):
        print(f"Dataset already exists locally at: {RAW_PATH}")
        print("Loading local copy for inspection...")
        with open(RAW_PATH, "r", encoding="utf-8") as f:
            records = json.load(f)
        
        print("\n--- Local Dataset Info ---")
        print("Dataset Name: Multi-Agent-LLMs/DEBATE")
        print("Configuration: critical_expert_debate_majority_consensus")
        print(f"Number of rows: {len(records)}")
        if len(records) > 0:
            print(f"Columns: {list(records[0].keys())}")
            print("\nFirst 3 sample records:")
            for i, r in enumerate(records[:3]):
                print(f"\nSample {i+1}:")
                # Format a preview
                preview = json.dumps(r, indent=2)
                if len(preview) > 500:
                    preview = preview[:500] + "\n... (truncated)"
                print(preview)
        return

    print("Downloading 'critical_expert_debate_majority_consensus' configuration from 'Multi-Agent-LLMs/DEBATE'...")
    try:
        ds = load_dataset("Multi-Agent-LLMs/DEBATE", "critical_expert_debate_majority_consensus")
        print("Download successful!")
        
        # Get active split (usually 'train')
        split_name = "train"
        if split_name not in ds:
            split_name = list(ds.keys())[0]
            
        records = [row for row in ds[split_name]]
        
        with open(RAW_PATH, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(records)} records to {RAW_PATH}")
        
        # Print info
        print("\n--- Dataset Details ---")
        print("Dataset Name: Multi-Agent-LLMs/DEBATE")
        print("Configuration: critical_expert_debate_majority_consensus")
        print(f"Available Splits: {list(ds.keys())}")
        print(f"Number of rows (split '{split_name}'): {len(records)}")
        print(f"Column Names: {ds[split_name].column_names}")
        print(f"Features: {ds[split_name].features}")
        
        print("\nFirst 3 sample records:")
        for i, r in enumerate(records[:3]):
            print(f"\nSample {i+1}:")
            preview = json.dumps(r, indent=2)
            if len(preview) > 500:
                preview = preview[:500] + "\n... (truncated)"
            print(preview)
            
    except Exception as e:
        print(f"Error downloading or processing dataset: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
