from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
import json
from datetime import datetime
import os
import pickle
import threading
import time
import google.generativeai as genai
import warnings
from ultralytics import YOLO

warnings.filterwarnings("ignore") 

# ── Paths ──
CV_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(CV_DIR, 'clinical_ai_model.pkl')

# 🧠 1. LOAD THE LOCAL ML MODEL
with open(MODEL_PATH, 'rb') as f:
    clinical_model = pickle.load(f)

# ── Load YOLO (Optimized Nano) ──
pose_model = YOLO("yolov8n-pose.pt")
try:
    pose_model.to("mps")
except Exception:
    pass

# YOLO Keypoint Index for Right Arm (Shoulder, Elbow, Wrist)
JOINTS = (6, 8, 10)

# 🗣️ 2. INITIALIZE GEMINI 
api_key = os.environ.get("GEMINI_API_KEY", "AIzaSyDgEd0_HwS8ALXgcwLrIHj_GZrU9v7mu2s")
genai.configure(api_key=api_key)
llm = genai.GenerativeModel('gemini-1.5-flash') 

app = Flask(__name__)
CORS(app)

# --- GLOBAL STATE ---
scanner_state = {
    "is_scanning": False,
    "max_angle": 0,
    "history": [],
    "current_frame": None  
}

# --- BACKGROUND CAMERA THREAD ---
def video_worker():
    global scanner_state
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while True:
        success, frame = cap.read()
        if success:
            scanner_state["current_frame"] = frame
        time.sleep(0.01) 

threading.Thread(target=video_worker, daemon=True).start()

# --- 2D KINEMATIC MATH ---
def Calculate_angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    # Stability check
    if np.linalg.norm(ba) == 0 or np.linalg.norm(bc) == 0:
        return 0.0
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    return float(np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0))))

# --- VIDEO STREAM GENERATOR ---
def generate_frames():
    global scanner_state
    while True:
        frame = scanner_state["current_frame"]
        if frame is None:
            time.sleep(0.01)
            continue

        # YOLO Inference
        results = pose_model(frame, conf=0.40, verbose=False, half=True)
        annotated_frame = results[0].plot(labels=False, conf=False, boxes=False)
        
        try:
            if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
                kps = results[0].keypoints.xy[0].cpu().numpy()
                
                if len(kps) > 10:
                    idx1, idx2, idx3 = JOINTS
                    pt1, pt2, pt3 = kps[idx1], kps[idx2], kps[idx3]
                    
                    if pt1[0] != 0 and pt2[0] != 0 and pt3[0] != 0:
                        current_angle = int(Calculate_angle(pt1, pt2, pt3))
                        
                        if scanner_state["is_scanning"]:
                            scanner_state["max_angle"] = max(scanner_state["max_angle"], current_angle)
                            scanner_state["history"].append(current_angle)
                        
                        # --- CUSTOM HUD ---
                        hud = annotated_frame.copy()
                        cv2.rectangle(hud, (15, 15), (320, 120), (15, 20, 25), -1) 
                        cv2.addWeighted(hud, 0.85, annotated_frame, 0.15, 0, annotated_frame) 
                        
                        rom_color = (0, 255, 255)
                        if current_angle > 130: rom_color = (0, 255, 0)
                        elif current_angle < 90: rom_color = (0, 0, 255)
                        
                        cv2.putText(annotated_frame, f"// YOLO_POSE_v8.0", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        cv2.putText(annotated_frame, f"LIVE ROM: {current_angle} DEG", (30, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.8, rom_color, 2)
                        cv2.putText(annotated_frame, f"PEAK REC: {scanner_state['max_angle']} DEG", (30, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 100, 100), 2)
                        
                        # Target Reticle on Elbow
                        cx, cy = int(pt2[0]), int(pt2[1])
                        cv2.circle(annotated_frame, (cx, cy), 15, rom_color, 2)
                        cv2.circle(annotated_frame, (cx, cy), 4, (255, 255, 255), -1)
        except Exception: 
            pass         
        
        ret, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

# --- API ROUTES ---
@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start-scan', methods=['POST'])
def start_scan():
    global scanner_state
    scanner_state["is_scanning"] = True
    scanner_state["max_angle"] = 0
    scanner_state["history"] = []
    return jsonify({"status": "recording_started"})

@app.route("/analyze-range", methods=["POST"])
def analyze_range():
    global scanner_state
    
    # Stop the scanner
    scanner_state["is_scanning"] = False
    history = scanner_state["history"]
    
    # Safely get payload data from Flask request
    payload = request.json or {}
    previous_rom = float(payload.get("previous_rom", 0.0))
    muscle = payload.get("muscle", "Joint")

    # 🧠 1. EXTRACT THE 6 KINEMATIC FEATURES
    if len(history) >= 3:
        arr = np.array(history)
        peak_rom = float(np.max(arr))
        min_rom = float(np.min(arr))
        avg_rom = float(np.mean(arr))
        
        velocities = np.abs(np.diff(arr))
        avg_vel = float(np.mean(velocities))
        jitter = float(np.std(velocities))
        
        # 🔥 THE NEW 6TH FEATURE (Acceleration)
        accelerations = np.abs(np.diff(velocities))
        avg_accel = float(np.mean(accelerations)) if len(accelerations) > 0 else 0.0
    else:
        # Failsafe for empty or ultra-short scans
        peak_rom = float(scanner_state["max_angle"]) if scanner_state["max_angle"] > 0 else 90.0
        min_rom, avg_rom = peak_rom, peak_rom
        avg_vel, jitter, avg_accel = 0.0, 0.0, 0.0

    peak_delta = peak_rom - previous_rom

    # 🧠 2. RUN XGBOOST PREDICTION
    try:
        features = [[peak_rom, min_rom, avg_rom, avg_vel, jitter, avg_accel]]
        
        # Get the % confidence that the patient is Healthy (Class 1)
        healthy_probability = clinical_model.predict_proba(features)[0][1]
        
        # J.A.R.V.I.S. Clinical Rule: Lowered to 20% per user feedback
        CLINICAL_THRESHOLD = 0.20
        prediction = 1 if healthy_probability >= CLINICAL_THRESHOLD else 0
        
        ml_status = "HEALTHY" if prediction == 1 else "RESTRICTED"
        
        # 🟢 NEW: IMPROVING LOGIC
        if ml_status == "RESTRICTED":
            if peak_rom > 80 or peak_delta > 5:
                ml_status = "IMPROVING"
        
        print(f"🧠 ML Confidence: {healthy_probability*100:.1f}% -> Status: {ml_status}")
    except Exception as e:
        print(f"XGBOOST ERROR: {e}")
        ml_status = "UNKNOWN"

    # 🗣️ 3. GEMINI CLINICAL SYNTHESIS
    try:
        prompt = (
            f"You are a Senior Clinical Physical Therapist. Analyze this {muscle} scan:\n"
            f"- ROM: {min_rom:.1f} to {peak_rom:.1f} (Prev: {previous_rom})\n"
            f"- Velocity: {avg_vel:.2f} | Jitter: {jitter:.2f}\n"
            f"- Status: {ml_status}\n\n"
            f"Provide a precise 2-sentence clinical verdict."
        )
        ai_msg = llm.generate_content(prompt).text
    except Exception as e:
        print(f"GEMINI ERROR: {e}")
        ai_msg = f"Report: Status {ml_status}. Rom {peak_rom:.1f}. Data captured."

    return jsonify({
        "status": "success",
        "angle": round(peak_rom, 2),
        "peak_delta": round(peak_delta, 2),
        "velocity": round(avg_vel, 2),
        "jitter": round(jitter, 2),
        "acceleration": round(avg_accel, 2),
        "ml_status": ml_status,
        "message": ai_msg
    })

if __name__ == '__main__':
    # Running threaded so video and ML processing don't block each other
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)