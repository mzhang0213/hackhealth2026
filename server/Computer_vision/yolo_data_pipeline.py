import os
import glob
import numpy as np
import pandas as pd

print("🤖 J.A.R.V.I.S. Data Pipeline (YOLO 2D-Mode) Initialized...")

# --- 1. 2D KINEMATIC MATH (MATCHING YOUR SERVER) ---
def calculate_2d_angle(a, b, c):
    """Calculates the 2D angle between three points (X, Y) exactly like YOLO."""
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    ba = a - b
    bc = c - b
    
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0) # Prevents math domain errors
    
    angle = np.degrees(np.arccos(cosine_angle))
    return angle

# --- 2. FEATURE ENGINEERING (The "Smart" Metrics) ---
def extract_kinematic_features(angles):
    """Takes an array of angles from a video and extracts ML features."""
    if len(angles) < 2:
        return None
        
    angles = np.array(angles)
    
    # Advanced Kinematics
    velocities = np.abs(np.diff(angles))
    
    return {
        "Peak_ROM": np.max(angles),
        "Min_ROM": np.min(angles),
        "Avg_ROM": np.mean(angles),
        "Avg_Velocity": np.mean(velocities) if len(velocities) > 0 else 0,
        "Jitter_Index": np.std(velocities) if len(velocities) > 0 else 0
    }

# --- 3. THE DATA PROCESSOR ---
def process_intellirehab_data(data_folder):
    """Reads raw files, calculates 2D features, and builds the dataset."""
    
    file_pattern = os.path.join(data_folder, "*.csv") # Change to .txt if needed
    files = glob.glob(file_pattern)
    
    if not files:
        print(f"⚠️ No data files found in {data_folder}.")
        return
        
    print(f"📂 Found {len(files)} raw clinical recordings. Stripping Z-Axis...")
    
    dataset_rows = []
    
    for file in files:
        filename = os.path.basename(file).upper()
        # IntelliRehab usually marks correct execution with 'C', incorrect with 'I'
        status = 1 if "_C" in filename else 0 
            
        df = pd.read_csv(file)
        
        # 🔥 CRITICAL: We only extract X and Y to match YOLO
        try:
            # Note: Update these column names based on the actual CSV headers!
            shoulder_cols = ['Shoulder_X', 'Shoulder_Y']
            elbow_cols = ['Elbow_X', 'Elbow_Y']
            wrist_cols = ['Wrist_X', 'Wrist_Y']
            
            video_angles = []
            
            for index, row in df.iterrows():
                shoulder = [row[shoulder_cols[0]], row[shoulder_cols[1]]]
                elbow = [row[elbow_cols[0]], row[elbow_cols[1]]]
                wrist = [row[wrist_cols[0]], row[wrist_cols[1]]]
                
                angle = calculate_2d_angle(shoulder, elbow, wrist)
                video_angles.append(angle)
                
            features = extract_kinematic_features(video_angles)
            if features:
                features['Status'] = status
                features['File_ID'] = filename
                dataset_rows.append(features)
                
        except KeyError:
            print(f"Skipping {filename}: Headers don't match expected names.")

    # --- 4. EXPORT THE FINAL DATASET ---
    final_dataset = pd.DataFrame(dataset_rows)
    output_file = "yolo_training_data.csv"
    final_dataset.to_csv(output_file, index=False)
    
    print(f"\n✅ Processing Complete!")
    print(f"📊 Extracted YOLO-compatible features from {len(final_dataset)} videos.")
    print(f"💾 Saved compiled dataset to: {output_file}")
    print("\nPreview of engineered features:")
    print(final_dataset.head(3))

# --- EXECUTION ---
# process_intellirehab_data("raw_intellirehab_data")