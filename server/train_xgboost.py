import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
# 🔥 NEW IMPORT:
from sklearn.utils.class_weight import compute_sample_weight 
import pickle
import matplotlib.pyplot as plt

print("🧠 J.A.R.V.I.S. Deep Learning Protocol Initiated...")

# 1. LOAD THE DATA
df = pd.read_csv("clinical_training_data.csv")

X = df[['Peak_ROM', 'Min_ROM', 'Avg_ROM', 'Avg_Velocity', 'Jitter_Index', 'Avg_Acceleration']]
y = df['Status']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 🔥 THE FIX: Calculate perfect balancing weights for the training data
weights = compute_sample_weight(class_weight='balanced', y=y_train)

# 2. COMPILE THE XGBOOST BRAIN
print("⚙️ Compiling XGBoost Architecture with Balanced Weights...")
model = xgb.XGBClassifier(
    n_estimators=500,        
    max_depth=7,             
    learning_rate=0.01,      
    subsample=0.8,           
    colsample_bytree=0.8,
    eval_metric='logloss',
    random_state=42
    # Removed scale_pos_weight because we are using sample_weight below!
)

# 🔥 Train it using the dynamic weights
model.fit(X_train, y_train, sample_weight=weights)

# 3. VALIDATE INTELLIGENCE
print("\n📊 Running Clinical Validation...")
preds = model.predict(X_test)
accuracy = accuracy_score(y_test, preds)

print(f"🎯 Final Accuracy Score: {accuracy * 100:.2f}%\n")
print(classification_report(y_test, preds, target_names=["Restricted", "Healthy"]))

# 4. EXPORT FOR PRODUCTION
with open('clinical_ai_model.pkl', 'wb') as f:
    pickle.dump(model, f)
print("✅ Master Model saved as 'clinical_ai_model.pkl'") 