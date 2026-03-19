import os
import glob
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import pickle

print("🤖 J.A.R.V.I.S. XGBoost Training Module Initialized...")

# --- 1. MAPPING THE SIMPLIFIED DATA INDICES ---
# Each joint takes 3 slots (X, Y, Z). We only want X and Y.
JOINT_MAP = {
    "ShoulderRight": 8 * 3, # Starts at index 24
    "ElbowRight":    9 * 3, # Starts at index 27
    "WristRight":    10 * 3 # Starts at index 30
}

def calculate_2d_angle(a, b, c):
    ba = np.array(a) - np.array(b)
    bc = np.array(c) - np.array(b)
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    return np.degrees(np.arccos(np.clip(cosine_angle, -1.0, 1.0)))

def process_simplified_folder(folder_path):
    files = glob.glob(os.path.join(folder_path, "*.txt"))
    dataset = []

    for file_path in files:
        filename = os.path.basename(file_path)
        parts = filename.replace('.txt', '').split('_')
        if len(parts) < 5: continue
        
        # Labeling based on CorrectLabel: 1 -> Healthy(1), 2 -> Restricted(0)
        status = 1 if parts[4] == "1" else 0
        
        video_angles = []
        with open(file_path, 'r') as f:
            for line in f:
                data = line.strip().split(',')
                if len(data) < 75: continue
                
                # Extract X, Y for the 3 points of the Right Elbow
                sr = [float(data[24]), float(data[25])] # ShoulderRight
                er = [float(data[27]), float(data[28])] # ElbowRight
                wr = [float(data[30]), float(data[31])] # WristRight
                
                angle = calculate_2d_angle(sr, er, wr)
                video_angles.append(angle)
        
        if video_angles:
            angles = np.array(video_angles)
            velocities = np.abs(np.diff(angles))
            
            dataset.append({
                "Peak_ROM": np.max(angles),
                "Avg_ROM": np.mean(angles),
                "Avg_Velocity": np.mean(velocities) if len(velocities) > 0 else 0,
                "Jitter_Index": np.std(velocities) if len(velocities) > 0 else 0,
                "Status": status
            })
            
    return pd.DataFrame(dataset)

# --- 2. TRAINING THE XGBOOST MODEL ---
# Replace 'Simplified' with your actual folder path
df = process_simplified_folder("Simplified") 

X = df.drop(['Status'], axis=1)
y = df['Status']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("🧠 Training Next-Gen XGBoost Brain...")
model = xgb.XGBClassifier(
    n_estimators=200,
    max_depth=5,
    learning_rate=0.1, # XGBoost uses learning rates!
    subsample=0.8,
    colsample_bytree=0.8,
    use_label_encoder=False,
    eval_metric='logloss'
)

model.fit(X_train, y_train)

# --- 3. EVALUATION ---
preds = model.predict(X_test)
print(f"🎯 XGBoost Accuracy: {accuracy_score(y_test, preds) * 100:.2f}%")
print(classification_report(y_test, preds))

# --- 4. EXPORT FOR REBOUND SERVER ---
with open('clinical_ai_model.pkl', 'wb') as f:
    pickle.dump(model, f)
print("✅ Success: 'clinical_ai_model.pkl' is ready for deployment.")