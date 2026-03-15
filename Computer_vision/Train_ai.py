import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import pickle

#mock dataset 

data = []

for _ in range(500):
    prev_rom = np.random.randint(40, 160)
    curr_rom = np.random.randint(40, 160)
    
    # Define the "Ground Truth" logic for the AI to learn
    if curr_rom >= 135:
        status = 2  # Healthy
    elif curr_rom > prev_rom + 5:
        status = 1  # Improving
    else:
        status = 0  # Injured/Restricted
        
    data.append([prev_rom, curr_rom, status])

df = pd.DataFrame(data, columns=['Previous_ROM', 'Current_ROM', 'Status'])

print('Training AI model on mock dataset..')
x=df[['Previous_ROM', 'Current_ROM']]
y=df['Status']

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(x, y)

with open('rom_classifier.pkl', 'wb') as f:
    pickle.dump(model, f)

print('Model trained and saved as rom_classifier.pkl')
