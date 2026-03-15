import cv2 
from ultralytics import YOLO
import numpy as np

model = YOLO('yolov8m-pose.pt')

def Calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    ba = a - b
    bc = c - b
    # Added np.clip to prevent random math crashes!
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
    return np.degrees(angle)

def Full_body_tracker():
    cap = cv2.VideoCapture(0)
    joints_map = {
        'L_elbow': (5, 7, 9), 'R_elbow': (6, 8, 10),
        'L_shoulder': (11, 5, 7), 'R_shoulder': (12, 6, 8), 
        'L_Hip': (5, 11, 13),   'R_Hip': (6, 12, 14),
        'L_Knee': (11, 13, 15), 'R_Knee': (12, 14, 16)
    }

    print('Tracking Started. Press Q to quit.')
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            print('Failed to capture frame')
            break

        results = model(frame, conf=0.5, verbose=False)
        annotated_frame = results[0].plot()
        
        try:
            # 1. Check if keypoints exist at all
            if results[0].keypoints is not None:
                
                # 2. Check if YOLO actually sees at least 1 person in the room
                if len(results[0].keypoints.xy) > 0:
                    keypoints = results[0].keypoints.xy[0].cpu().numpy()
                    
                    # 3. Check if all 17 joints are visible
                    if len(keypoints) > 16:
                        live_angle = {}
                        
                        for joint_name, indice in joints_map.items():
                            pt1, pt2, pt3 = keypoints[indice[0]], keypoints[indice[1]], keypoints[indice[2]]
                            
                            if pt1[0] != 0 and pt2[0] != 0 and pt3[0] != 0:
                                angle = Calculate_angle(pt1, pt2, pt3)
                                live_angle[joint_name] = int(angle)
                                
                                cv2.putText(annotated_frame, f"{int(angle)}", 
                                    (int(pt2[0]) + 15, int(pt2[1])), 
                                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        except Exception as e:
            pass         
        cv2.imshow('PT Tracker', annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    Full_body_tracker()