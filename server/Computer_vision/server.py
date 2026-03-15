# from flask import Flask, request, jsonify, Response
# from flask_cors import CORS
# import cv2
# import numpy as np
# from ultralytics import YOLO
# import json
# from datetime import datetime
# import os
# import pickle
# import threading
# import time
# import google.generativeai as genai
# import warnings
#
# warnings.filterwarnings("ignore")
#
# with open('clinical_ai_model.pkl', 'rb') as f:
#     clinical_model = pickle.load(f)
#
# # PASTE YOUR API KEY HERE!
# genai.configure(api_key="AIzaSyD-oADg2AMo_HX-OL2lHolIA-QZ457WEXw")
# llm = genai.GenerativeModel('gemini-pro')
#
# app = Flask(__name__)
# CORS(app)
#
# model = YOLO('yolov8m-pose.pt')
# try:
#     model.to('mps')
#     print("🚀 Hardware Acceleration Enabled: Using Apple Silicon GPU (MPS)")
# except:
#     print("⚠️ MPS not found, falling back to CPU.")
#
# scanner_state = {
#     "is_scanning": False,
#     "max_angle": 0,
#     "history": [],
#     "current_frame": None
# }
#
# def video_worker():
#     global scanner_state
#     cap = cv2.VideoCapture(0)
#     cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
#     cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
#     cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
#
#     while True:
#         success, frame = cap.read()
#         if success:
#             scanner_state["current_frame"] = frame
#         time.sleep(0.01)
#
# threading.Thread(target=video_worker, daemon=True).start()
#
# def Calculate_angle(a, b, c):
#     a = np.array(a)
#     b = np.array(b)
#     c = np.array(c)
#     ba = a - b
#     bc = c - b
#     cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
#     angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
#     return np.degrees(angle)
#
# def generate_frames():
#     global scanner_state
#
#     while True:
#         frame = scanner_state["current_frame"]
#         if frame is None:
#             continue
#
#         results = model(frame, conf=0.5, verbose=False, half=True)
#
#         # 🎨 UI UPGRADE: Turn off messy default boxes, keep only the skeleton!
#         annotated_frame = results[0].plot(labels=False, conf=False, boxes=False)
#
#         try:
#             if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
#                 keypoints = results[0].keypoints.xy[0].cpu().numpy()
#
#                 if len(keypoints) > 10:
#                     pt1, pt2, pt3 = keypoints[6], keypoints[8], keypoints[10]
#                     if pt1[0] != 0 and pt2[0] != 0 and pt3[0] != 0:
#                         current_angle = int(Calculate_angle(pt1, pt2, pt3))
#
#                         if scanner_state["is_scanning"]:
#                             scanner_state["max_angle"] = max(scanner_state["max_angle"], current_angle)
#                             scanner_state["history"].append(current_angle)
#
#                         # 🎨 UI UPGRADE: Draw a sleek, dark, semi-transparent HUD background
#                         hud = annotated_frame.copy()
#                         cv2.rectangle(hud, (15, 15), (320, 120), (15, 20, 25), -1)
#                         cv2.addWeighted(hud, 0.85, annotated_frame, 0.15, 0, annotated_frame)
#
#                         # 🎨 UI UPGRADE: Dynamic Color Logic (BGR Format)
#                         rom_color = (0, 255, 255) # Yellow
#                         if current_angle > 130: rom_color = (0, 255, 0) # Green
#                         elif current_angle < 90: rom_color = (0, 0, 255) # Red
#
#                         # Add clean, modern typography
#                         cv2.putText(annotated_frame, f"// RECOVERY_HUD_v1.0", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
#                         cv2.putText(annotated_frame, f"LIVE ROM: {current_angle} DEG", (30, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.8, rom_color, 2)
#                         cv2.putText(annotated_frame, f"PEAK REC: {scanner_state['max_angle']} DEG", (30, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 100, 100), 2)
#
#                         # 🎨 UI UPGRADE: Glowing Targeting Reticle over the elbow/joint
#                         cv2.circle(annotated_frame, (int(pt2[0]), int(pt2[1])), 15, rom_color, 2)
#                         cv2.circle(annotated_frame, (int(pt2[0]), int(pt2[1])), 4, (255, 255, 255), -1)
#
#         except: pass
#
#         ret, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
#         yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
#
# @app.route('/video_feed')
# def video_feed():
#     return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')
#
# @app.route('/start-scan', methods=['POST'])
# def start_scan():
#     global scanner_state
#     scanner_state["is_scanning"] = True
#     scanner_state["max_angle"] = 0
#     scanner_state["history"] = []
#     return jsonify({"status": "recording_started"})
#
# @app.route('/analyze-range', methods=['POST'])
# def analyze_range():
#     global scanner_state
#     scanner_state["is_scanning"] = False
#
#     data = request.json
#     muscle = data.get('muscle', 'Unknown')
#     history = scanner_state["history"]
#
#     final_angle = scanner_state["max_angle"] if scanner_state["max_angle"] > 0 else 90
#     previous_rom = data.get('previous_rom', final_angle)
#
#     # CALCULATE THE DELTA
#     peak_delta = final_angle - previous_rom
#
#     if len(history) > 0:
#         average_angle = int(sum(history) / len(history))
#     else:
#         average_angle = final_angle
#
#     prediction = clinical_model.predict([[previous_rom, final_angle]])[0]
#     ml_status = "HEALTHY" if prediction == 2 else "IMPROVING" if prediction == 1 else "RESTRICTED"
#     emoji = "🟢" if prediction == 2 else "🟡" if prediction == 1 else "🔴"
#
#     try:
#         prompt = f"AI Assistant report for {muscle}. Prev Peak: {previous_rom}°, Current Peak: {final_angle}°, Average Sustained ROM: {average_angle}°, ML Status: {ml_status}. Suggest protocol."
#         response = llm.generate_content(prompt)
#         ai_msg = response.text
#     except:
#         ai_msg = f"{emoji} AI CLINICAL ASSISTANT: {ml_status}\nSuggested Protocol: Review data manually."
#
#     timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
#     filename = f"patient_data_{muscle}_{timestamp_str}.json"
#     session_data = {
#         "timestamp": str(datetime.now()),
#         "muscle": muscle,
#         "max_rom": final_angle,
#         "average_rom": average_angle,
#         "previous_rom": previous_rom,
#         "peak_delta": peak_delta,
#         "ml_classification": int(prediction),
#         "raw_angle_data": history
#     }
#
#     save_path = os.path.join(os.getcwd(), filename)
#     with open(save_path, "w") as f:
#         json.dump(session_data, f, indent=4)
#
#     return jsonify({
#         "status": "success",
#         "muscle": muscle,
#         "angle": final_angle,
#         "average_angle": average_angle,
#         "peak_delta": peak_delta,
#         "message": ai_msg,
#         "data_points": len(history),
#         "filename": filename,
#         "raw_data": history
#     })
#
# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)