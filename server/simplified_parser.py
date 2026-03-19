import os
import glob
import numpy as np
import pandas as pd

print("🤖 J.A.R.V.I.S. Simplified Data Parser Initialized...")

def calculate_2d_angle(a, b, c):
    """Calculates 2D angle between 3 points [x, y], matching YOLO output."""
    ba = np.array(a) - np.array(b)
    bc = np.array(c) - np.array(b)
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    return np.degrees(np.arccos(np.clip(cosine_angle, -1.0, 1.0)))

def process_simplified_data(folder_path):
    # The IntelliRehabDS simplified files are .txt files
    files = glob.glob(os.path.join(folder_path, "*.txt"))
    dataset = []

    if not files:
        print(f"⚠️ No files found in '{folder_path}'. Please check the folder name.")
        return

    print(f"📂 Found {len(files)} Simplified clinical files. Processing and stripping Z-Axis...")

    for file_path in files:
        filename = os.path.basename(file_path)
        # Nomenclature: Subject_Date_Gesture_Rep_CorrectLabel_Position.txt
        parts = filename.replace('.txt', '').split('_')
        
        # Failsafe for incorrectly named files
        if len(parts) < 5: 
            continue
        
        # Label: 1 (Healthy) if file says 1, 0 (Restricted) if file says 2
        status = 1 if parts[4] == "1" else 0
        
        video_angles = []
        
        with open(file_path, 'r') as f:
            for line in f:
                data = line.strip().split(',')
                
                # Ensure the line has all 75 data points (25 joints * 3 coords)
                if len(data) < 75: 
                    continue
                
                # Extract X and Y (ignoring Z) for Right Arm joints based on the Readme
                try:
                    shoulder_x, shoulder_y = float(data[24]), float(data[25])
                    elbow_x, elbow_y = float(data[27]), float(data[28])
                    wrist_x, wrist_y = float(data[30]), float(data[31])
                    
                    angle = calculate_2d_angle(
                        [shoulder_x, shoulder_y],
                        [elbow_x, elbow_y],
                        [wrist_x, wrist_y]
                    )
                    video_angles.append(angle)
                except ValueError:
                    continue # Skip corrupted lines
        
        # Extract ML Features (Velocity & Jitter) if we got valid angles
        if video_angles:
            angles = np.array(video_angles)
            velocities = np.abs(np.diff(angles))
            accelerations = np.abs(np.diff(velocities)) # 🔥 THE NEW 6TH FEATURE
            
            dataset.append({
                "File_ID": filename,
                "Peak_ROM": np.max(angles),
                "Min_ROM": np.min(angles),
                "Avg_ROM": np.mean(angles),
                "Avg_Velocity": np.mean(velocities) if len(velocities) > 0 else 0,
                "Jitter_Index": np.std(velocities) if len(velocities) > 0 else 0,
                "Avg_Acceleration": np.mean(accelerations) if len(accelerations) > 0 else 0, # 🔥 ADDED HERE
                "Status": status
            })
    # Save to CSV
    df = pd.DataFrame(dataset)
    output_file = "clinical_training_data.csv"
    df.to_csv(output_file, index=False)
    
    print(f"\n✅ Processing Complete!")
    print(f"📊 Successfully compressed {len(df)} videos into '{output_file}'.")
    print("\nPreview of extracted features:")
    print(df.head())

# --- EXECUTION ---
# Ensure your 'Simplified' folder is in the same directory as this script.
process_simplified_data("Simplified")