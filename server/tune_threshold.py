import pandas as pd
import numpy as np
import pickle
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

print("🎛️ J.A.R.V.I.S. Threshold Calibration Initiated...\n")

# 1. LOAD DATA & MODEL
df = pd.read_csv("clinical_training_data.csv")
X = df[['Peak_ROM', 'Min_ROM', 'Avg_ROM', 'Avg_Velocity', 'Jitter_Index', 'Avg_Acceleration']]
y = df['Status']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

with open('clinical_ai_model.pkl', 'rb') as f:
    model = pickle.load(f)

# 2. GET RAW PROBABILITIES (Instead of rigid 0 or 1)
# This gets the % confidence that the patient is Healthy (Class 1)
probabilities = model.predict_proba(X_test)[:, 1]

# 3. TEST DIFFERENT STRICTNESS LEVELS
thresholds = [0.50, 0.60, 0.70, 0.80]

for thresh in thresholds:
    print(f"--- Testing Threshold: {thresh * 100:.0f}% Confidence Required to be 'Healthy' ---")
    
    # If probability of being healthy is >= threshold, predict 1. Else predict 0 (Restricted).
    custom_preds = (probabilities >= thresh).astype(int)
    
    acc = accuracy_score(y_test, custom_preds)
    report = classification_report(y_test, custom_preds, target_names=["Restricted", "Healthy"], output_dict=True)
    
    restricted_recall = report['Restricted']['recall']
    healthy_recall = report['Healthy']['recall']
    
    print(f"Overall Accuracy:   {acc * 100:.2f}%")
    print(f"Restricted Recall:  {restricted_recall:.2f}  <-- (How many injured we caught)")
    print(f"Healthy Recall:     {healthy_recall:.2f}\n")