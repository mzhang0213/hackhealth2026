from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO
import json
from datetime import datetime
import os
import pickle
import threading
import time
import google.generativeai as genai
import warnings

warnings.filterwarnings("ignore") 

# 🧠 1. LOAD THE LOCAL ML MODEL
with open('clinical_ai_model.pkl', 'rb') as f:
    clinical_model = pickle.load(f)

# 🗣️ 2. INITIALIZE GEMINI 
# PASTE YOUR NEW API KEY DIRECTLY BETWEEN THE QUOTES BELOW
api_key = "AIzaSyDgEd0_HwS8ALXgcwLrIHj_GZrU9v7mu2s"
genai.configure(api_key=api_key)
llm = genai.GenerativeModel('gemini-2.5-flash')

app = Flask(__name__)
CORS(app)

# --- PERFORMANCE TWEAK: LOADING M WITH HARDWARE ACCEL ---
model = YOLO('yolov8m-pose.pt')
try:
    model.to('mps') 
    print("🚀 Hardware Acceleration Enabled: Using Apple Silicon GPU (MPS)")
except:
    print("⚠️ MPS not found, falling back to CPU.")

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
    cap.set(cv2.CAP_gitP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while True:
        success, frame = cap.read()
        if success:
            scanner_state["current_frame"] = frame
        time.sleep(0.01) 

threading.Thread(target=video_worker, daemon=True).start()

def Calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    ba = a - b
    bc = c - b
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
    return np.degrees(angle)

def generate_frames():
    global scanner_state
    while True:
        frame = scanner_state["current_frame"]
        if frame is None:
            continue

        results = model(frame, conf=0.5, verbose=False, half=True)
        annotated_frame = results[0].plot(labels=False, conf=False, boxes=False) 
        
        try:
            if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
                keypoints = results[0].keypoints.xy[0].cpu().numpy()
                if len(keypoints) > 10:
                    pt1, pt2, pt3 = keypoints[6], keypoints[8], keypoints[10] 
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
                        cv2.putText(annotated_frame, f"// RECOVERY_HUD_v1.0", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        cv2.putText(annotated_frame, f"LIVE ROM: {current_angle} DEG", (30, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.8, rom_color, 2)
                        cv2.putText(annotated_frame, f"PEAK REC: {scanner_state['max_angle']} DEG", (30, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 100, 100), 2)
                        cv2.circle(annotated_frame, (int(pt2[0]), int(pt2[1])), 15, rom_color, 2)
                        cv2.circle(annotated_frame, (int(pt2[0]), int(pt2[1])), 4, (255, 255, 255), -1)
        except: pass         
        
        ret, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

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

@app.route('/analyze-range', methods=['POST'])
def analyze_range():
    global scanner_state
    scanner_state["is_scanning"] = False 
    
    data = request.json
    muscle = data.get('muscle', 'Unknown')
    history = scanner_state["history"]
    final_angle = scanner_state["max_angle"] if scanner_state["max_angle"] > 0 else 90
    previous_rom = data.get('previous_rom', final_angle) 
    peak_delta = final_angle - previous_rom
    average_angle = int(sum(history) / len(history)) if history else final_angle

    prediction = clinical_model.predict([[previous_rom, final_angle]])[0]
    ml_status = "HEALTHY" if prediction == 2 else "IMPROVING" if prediction == 1 else "RESTRICTED"
    emoji = "🟢" if prediction == 2 else "🟡" if prediction == 1 else "🔴"

    try:
        prompt = (f"As a physical therapy AI, analyze this {muscle} data: "
                 f"Previous Peak: {previous_rom} degrees, Current Peak: {final_angle} degrees, "
                 f"Average ROM during session: {average_angle} degrees. "
                 f"Status: {ml_status}. Provide a 2-sentence recovery protocol.")
        
        response = llm.generate_content(prompt)
        ai_msg = response.text
    except Exception as e:
        # 🕵️‍♂️ THIS WILL SHOW THE REAL ERROR IN YOUR TERMINAL
        print(f"❌ GEMINI ERROR: {e}")
        ai_msg = f"{emoji} AI CLINICAL ASSISTANT: {ml_status}\nSuggested Protocol: Review data manually."

    return jsonify({
        "status": "success",
        "muscle": muscle,
        "angle": final_angle,
        "average_angle": average_angle, 
        "peak_delta": peak_delta, 
        "message": ai_msg,
        "raw_data": history
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)