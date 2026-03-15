from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO
import json
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

model = YOLO('yolov8m-pose.pt')

scanner_state = {
    "is_scanning": False,
    "max_angle": 0,
    "history": []
}

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
    cap = cv2.VideoCapture(0)
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success: break

        results = model(frame, conf=0.5, verbose=False)
        annotated_frame = results[0].plot() 
        
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
                            cv2.putText(annotated_frame, f"REC: {scanner_state['max_angle']} MAX ROM", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)

                        cv2.putText(annotated_frame, f"{current_angle} DEG", 
                            (int(pt2[0]) + 15, int(pt2[1])), 
                             cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 3)
        except Exception as e:
            pass         
        
        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start-scan', methods=['POST'])
def start_scan():
    global scanner_state
    scanner_state["is_scanning"] = True
    scanner_state["max_angle"] = 0
    scanner_state["history"] = []
    print("\n▶️ AI SCAN INITIATED. RECORDING DATA...")
    return jsonify({"status": "recording_started"})

@app.route('/analyze-range', methods=['POST'])
def analyze_range():
    global scanner_state
    scanner_state["is_scanning"] = False 
    
    data = request.json
    muscle = data.get('muscle', 'Unknown')
    final_angle = scanner_state["max_angle"] if scanner_state["max_angle"] > 0 else 90

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"patient_data_{muscle}_{timestamp_str}.json"
    
    session_data = {
        "timestamp": str(datetime.now()),
        "muscle": muscle,
        "max_rom": final_angle,
        "raw_angle_data": scanner_state["history"]
    }

    save_path = os.path.join(os.getcwd(), filename)
    with open(save_path, "w") as f:
        json.dump(session_data, f, indent=4)

    print(f"\n✅ DATA ARCHIVED: {filename}")
    print(f"📈 TOTAL SAMPLES CAPTURED: {len(scanner_state['history'])}")
    print(f"📊 PEAK ANGLE: {final_angle}°")

    if final_angle < 130:
        ai_msg = (f"AI SPECIALIST REPORT:\nData shows restricted {muscle} mobility (Max ROM: {final_angle}°).\n\n"
                  f"RECOMMENDATION:\n"
                  f"- Prescribe Active-Assisted Range of Motion (AAROM) exercises.\n"
                  f"- Apply heat therapy prior to stretching.\n"
                  f"- Avoid heavy load-bearing until ROM reaches 140°.")
    else:
        ai_msg = (f"AI SPECIALIST REPORT:\nData indicates optimal {muscle} mobility (Max ROM: {final_angle}°).\n\n"
                  f"RECOMMENDATION:\n"
                  f"- Transition patient from recovery to strength-building phase.\n"
                  f"- Introduce progressive overload with resistance bands.\n"
                  f"- Maintain current stretching protocol.")

    return jsonify({
        "status": "success",
        "muscle": muscle,
        "angle": final_angle,
        "message": ai_msg,
        "data_points": len(scanner_state["history"]),
        "filename": filename,
        "raw_data": scanner_state["history"]
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)