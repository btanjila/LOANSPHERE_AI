#ai/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib

app = FastAPI()

# Mock ML model (replace with real training later)
model = RandomForestClassifier()
X_train = np.array([[10000, 2], [50000, 5]])  # [income, credit_history]
y_train = np.array([0, 1])  # 0=high risk, 1=low risk
model.fit(X_train, y_train)
joblib.dump(model, 'model.pkl')

class LoanApplication(BaseModel):
    income: float
    credit_history: float  # in years

@app.post("/predict")
def predict(application: LoanApplication):
    try:
        features = [[application.income, application.credit_history]]
        risk_prob = model.predict_proba(features)[0][1]  # Probability of being low-risk
        risk_score = int(risk_prob * 850)  # Scale to credit score range (300-850)
        return {"risk_score": risk_score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def status():
    return {"status": "LoanSphere AI Service Online"}