import pandas as pd
import xgboost as xgb
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.utils.class_weight import compute_sample_weight

print("⚙️ J.A.R.V.I.S. Hyperparameter Optimization Initiated...")

# Load Data
df = pd.read_csv("clinical_training_data.csv")
X = df[['Peak_ROM', 'Min_ROM', 'Avg_ROM', 'Avg_Velocity', 'Jitter_Index', 'Avg_Acceleration']]
y = df['Status']

# Split & Balance
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
weights = compute_sample_weight(class_weight='balanced', y=y_train)

# The Matrix of settings to test
param_grid = {
    'max_depth': [3, 5, 7],             # How deep the logic trees go
    'learning_rate': [0.01, 0.05, 0.1], # How fast it learns
    'n_estimators': [100, 300, 500],    # How many trees it builds
    'subsample': [0.8, 1.0]             # How much data it looks at per tree
}

# Initialize Base Model
xgb_model = xgb.XGBClassifier(eval_metric='logloss', random_state=42)

# Run the Search (This might take 30-60 seconds depending on your Mac's speed)
print("🔍 Searching 54 combinations. Please wait...")
grid_search = GridSearchCV(
    estimator=xgb_model, 
    param_grid=param_grid, 
    cv=3, 
    scoring='accuracy', # Optimizing for overall accuracy
    verbose=1
)

grid_search.fit(X_train, y_train, sample_weight=weights)

print("\n🏆 OPTIMIZATION COMPLETE. THE BEST SETTINGS ARE:")
print(grid_search.best_params_)
print(f"Estimated Peak Accuracy: {grid_search.best_score_ * 100:.2f}%")