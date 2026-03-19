import os
import re
import pickle
import random
import ssl
import certifi
import tempfile
import urllib.parse
import urllib.request
import json as _json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
import threading
import time
import warnings
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from supabase import create_client, Client

import cv2 as cv
import numpy as np
import google.generativeai as genai
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ultralytics import YOLO

warnings.filterwarnings("ignore")

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Rebound API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# ── Paths ─────────────────────────────────────────────────────────────────────

SERVER_DIR = os.path.dirname(__file__)
CV_DIR     = os.path.join(SERVER_DIR, "Computer_vision")

# ── Load CV models ────────────────────────────────────────────────────────────

with open(os.path.join(CV_DIR, "clinical_ai_model.pkl"), "rb") as f:
    clinical_model = pickle.load(f)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
llm = genai.GenerativeModel("gemini-1.5-flash") # 1.5-flash is faster

# ── Supabase ──────────────────────────────────────────────────────────────────

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

def verify_token(authorization: str = Header(default="")):
    """
    Verify a Supabase JWT and return the user's UUID.
    We use the global `supabase` client (with service_role key) for DB ops
    to bypass RLS, while manually enforcing data ownership.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_response = supabase.auth.get_user(token)
        return str(user_response.user.id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

# ── Initialize YOLO (Optimized Nano Model) ───────────────────────────────────

pose_model = YOLO(os.path.join(CV_DIR, "yolov8n-pose.pt"))
try:
    pose_model.to("mps")
    print("🚀 Hardware Acceleration Enabled: Using Apple Silicon GPU (MPS)")
except Exception:
    print("⚠️ MPS not available, falling back to CPU.")

# ── Joint map (YOLO Keypoint Indices) ────────────────────────────────────────

JOINTS_MAP: dict[str, tuple[int, int, int]] = {
    "L_elbow":    (5, 7, 9),    # Shoulder, Elbow, Wrist
    "R_elbow":    (6, 8, 10),
    "L_shoulder": (11, 5, 7),   # Hip, Shoulder, Elbow
    "R_shoulder": (12, 6, 8),
    "L_hip":      (5, 11, 13),  # Shoulder, Hip, Knee
    "R_hip":      (6, 12, 14),
    "L_knee":     (11, 13, 15), # Hip, Knee, Ankle
    "R_knee":     (12, 14, 16),
}

def _joint_for_muscle(muscle: str) -> str:
    """Map a free-form muscle/joint name to a JOINTS_MAP key."""
    m = muscle.lower()
    for key in JOINTS_MAP:
        if key.lower() in m or m in key.lower():
            return key
    # fallback heuristics
    if "elbow" in m:
        return "R_elbow"
    if "shoulder" in m:
        return "R_shoulder"
    if "hip" in m:
        return "R_hip"
    if "knee" in m:
        return "R_knee"
    return "R_elbow"


# ── CV scanner state + background video thread ────────────────────────────────

def _fresh_joint_data() -> dict:
    return {name: {"max_angle": 0, "history": []} for name in JOINTS_MAP}

scanner_state: dict = {
    "is_scanning": False,
    "joint_data": _fresh_joint_data(),
    "current_frame": None,
}


def _video_worker():
    cap = cv.VideoCapture(0)
    cap.set(cv.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv.CAP_PROP_BUFFERSIZE, 1)
    while True:
        success, frame = cap.read()
        if success:
            scanner_state["current_frame"] = frame
        time.sleep(0.01)


threading.Thread(target=_video_worker, daemon=True).start()


def _calculate_angle(a, b, c) -> float:
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    return float(np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0))))


def _generate_frames():
    while True:
        frame = scanner_state["current_frame"]
        if frame is None:
            time.sleep(0.01)
            continue

        results = pose_model(frame, conf=0.45, verbose=False, half=True)
        annotated = results[0].plot(labels=False, conf=False, boxes=False)

        try:
            if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
                kps = results[0].keypoints.xy[0].cpu().numpy()
                if len(kps) > 16:
                    live_angles: dict[str, int] = {}

                    for joint_name, (i1, i2, i3) in JOINTS_MAP.items():
                        pt1, pt2, pt3 = kps[i1], kps[i2], kps[i3]
                        if pt1[0] != 0 and pt2[0] != 0 and pt3[0] != 0:
                            angle = int(_calculate_angle(pt1, pt2, pt3))
                            live_angles[joint_name] = angle

                            # Per-joint angle label on skeleton
                            cx, cy = int(pt2[0]) + 15, int(pt2[1])
                            cv.putText(annotated, str(angle), (cx, cy),
                                        cv.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)

                            if scanner_state["is_scanning"]:
                                jd = scanner_state["joint_data"][joint_name]
                                jd["max_angle"] = max(jd["max_angle"], angle)
                                jd["history"].append(angle)

                    # HUD panel — list all visible joints
                    panel_h = 30 + len(live_angles) * 22
                    hud = annotated.copy()
                    cv.rectangle(hud, (12, 12), (230, 12 + panel_h), (10, 15, 22), -1)
                    cv.addWeighted(hud, 0.82, annotated, 0.18, 0, annotated)
                    cv.putText(annotated, "// RECOVERY_HUD_v1.0", (22, 32),
                                cv.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

                    for idx, (jname, angle) in enumerate(live_angles.items()):
                        y = 54 + idx * 22
                        jd = scanner_state["joint_data"][jname]
                        color = (0, 255, 0) if angle > 130 else (0, 0, 255) if angle < 90 else (0, 255, 255)
                        peak = jd["max_angle"] if scanner_state["is_scanning"] else angle
                        cv.putText(annotated, f"{jname:<12} {angle:>3}  pk:{peak:>3}", (22, y),
                                    cv.FONT_HERSHEY_SIMPLEX, 0.40, color, 1)
        except Exception:
            pass

        ret, buffer = cv.imencode(".jpg", annotated, [int(cv.IMWRITE_JPEG_QUALITY), 70])
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"


# ── User helpers ──────────────────────────────────────────────────────────────

def compute_recovery_day(injury_date_str: str) -> int:
    try:
        return max(0, (date.today() - date.fromisoformat(injury_date_str)).days)
    except Exception:
        return 0


def build_profile(raw: dict) -> "UserProfile":
    """Build a UserProfile from a Supabase users row (supabase_id → id)."""
    profile_id = raw.get("supabase_id") or raw.get("id", "")
    return UserProfile(
        id=profile_id,
        name=raw.get("name", ""),
        sport=raw.get("sport", ""),
        injury_description=raw.get("injury_description", ""),
        injury_date=raw.get("injury_date", ""),
        doctor_diagnosis=raw.get("doctor_diagnosis", ""),
        pt_name=raw.get("pt_name", ""),
        created_at=raw.get("created_at") or datetime.utcnow().isoformat(),
        recovery_day=compute_recovery_day(raw.get("injury_date", "")),
    )


# ── Pydantic models ───────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    supabase_id: str
    name: str
    sport: str
    injury_description: str
    injury_date: str
    doctor_diagnosis: Optional[str] = ""
    pt_name: Optional[str] = ""


class UserProfile(BaseModel):
    id: str
    name: str
    sport: str
    injury_description: str
    injury_date: str
    doctor_diagnosis: str
    pt_name: str
    created_at: str
    recovery_day: int


class UserUpdate(BaseModel):
    name: Optional[str] = None
    sport: Optional[str] = None
    injury_description: Optional[str] = None
    injury_date: Optional[str] = None
    doctor_diagnosis: Optional[str] = None
    pt_name: Optional[str] = None


class AnalyzeRangeRequest(BaseModel):
    muscle: str = "Unknown"
    previous_rom: Optional[float] = None


class CheckinCreate(BaseModel):
    pain_level: int
    symptoms: list[str] = []


class InjuryMarkerCreate(BaseModel):
    slug: str
    side: Optional[str] = None          # 'left' | 'right' | null
    status: str                         # 'pain' | 'moderate' | 'recovering'
    how_it_happened: Optional[str] = None
    date_of_injury: Optional[str] = None
    doctor_diagnosis: Optional[str] = None
    initial_symptoms: Optional[str] = None


# ── Routes: general ───────────────────────────────────────────────────────────

@api_router.get("/")
def root():
    return {"status": "ok", "service": "rebound-api"}


@api_router.get("/health")
def health():
    checks: dict[str, str] = {}

    # Supabase
    try:
        supabase.table("users").select("supabase_id").limit(1).execute()
        checks["supabase"] = "ok"
    except Exception as e:
        checks["supabase"] = f"error: {e}"

    # Gemini
    try:
        _ = llm.model_name
        checks["gemini"] = "ok"
    except Exception as e:
        checks["gemini"] = f"error: {e}"

    # CV model
    try:
        _ = clinical_model
        checks["cv_model"] = "ok"
    except Exception as e:
        checks["cv_model"] = f"error: {e}"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}


# ── Routes: users ─────────────────────────────────────────────────────────────

@api_router.post("/users", response_model=UserProfile, status_code=201)
def create_user(payload: UserCreate, _uid: str = Depends(verify_token)):
    """Create or update a user profile. Bypasses RLS via service_role key."""
    row = {
        "user_id": int(random.random()*10**9),
        "supabase_id": _uid,
        "name": payload.name,
        "sport": payload.sport,
        "injury_description": payload.injury_description,
        "injury_date": payload.injury_date,
        "doctor_diagnosis": payload.doctor_diagnosis or "",
        "pt_name": payload.pt_name or "",
    }
    try:
        res = supabase.table("users").upsert(row, on_conflict="supabase_id").execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to save user profile")
        return build_profile(res.data[0])
    except Exception as exc:
        print(f"SUPABASE ERROR (create_user): {exc}")
        raise HTTPException(status_code=400, detail=str(exc))


@api_router.get("/users/{user_id}", response_model=UserProfile)
def get_user(user_id: str, _uid: str = Depends(verify_token)):
    """Fetch user profile. Manually enforces ownership."""
    if user_id != _uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    try:
        res = supabase.table("users").select("*").eq("supabase_id", _uid).limit(1).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        return build_profile(res.data[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@api_router.patch("/users/{user_id}", response_model=UserProfile)
def update_user(user_id: str, payload: UserUpdate, _uid: str = Depends(verify_token)):
    """Update user profile. Manually enforces ownership."""
    if user_id != _uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        res = supabase.table("users").update(updates).eq("supabase_id", _uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        return build_profile(res.data[0])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Routes: computer vision / ROM ─────────────────────────────────────────────

@api_router.get("/video_feed")
def video_feed():
    """MJPEG stream with live pose overlay and ROM readout."""
    return StreamingResponse(
        _generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@api_router.post("/start-scan")
def start_scan():
    """Reset and begin a new ROM recording session."""
    scanner_state["is_scanning"] = True
    scanner_state["joint_data"] = _fresh_joint_data()
    return {"status": "recording_started"}


@api_router.post("/analyze-range")
def analyze_range(payload: AnalyzeRangeRequest, _uid: str = Depends(verify_token)):
    """Stop scan, run ML classification, and save to Supabase bypassing RLS."""
    scanner_state["is_scanning"] = False

    joint_key = _joint_for_muscle(payload.muscle)
    jd = scanner_state["joint_data"][joint_key]
    history = jd["history"]
    
    # Defaults in case of short data
    final_angle = jd["max_angle"] if jd["max_angle"] > 0 else 90
    if payload.previous_rom is not None:
        previous_rom = float(payload.previous_rom)
    else:
        previous_rom = float(final_angle)

    # 🧠 1. EXTRACT THE 6 KINEMATIC FEATURES
    if len(history) >= 3:
        arr = np.array(history)
        peak_rom = float(np.max(arr))
        min_rom = float(np.min(arr))
        avg_rom = float(np.mean(arr))
        
        velocities = np.abs(np.diff(arr))
        avg_vel = float(np.mean(velocities))
        jitter = float(np.std(velocities))
        
        # 🔥 THE NEW 6TH FEATURE
        accelerations = np.abs(np.diff(velocities))
        avg_accel = float(np.mean(accelerations)) if len(accelerations) > 0 else 0.0
    else:
        # Failsafe for empty or ultra-short scans
        peak_rom = float(final_angle)
        min_rom, avg_rom = peak_rom, peak_rom
        avg_vel, jitter, avg_accel = 0.0, 0.0, 0.0

    peak_delta = float(peak_rom) - previous_rom

    # 🧠 2. RUN XGBOOST PREDICTION (Calibrated to 60% Threshold)
    try:
        features = [[peak_rom, min_rom, avg_rom, avg_vel, jitter, avg_accel]]
        
        # Get % confidence that patient is Healthy (Class 1)
        healthy_probability = clinical_model.predict_proba(features)[0][1]
        
        # J.A.R.V.I.S. Clinical Rule: Lowered to 20%
        CLINICAL_THRESHOLD = 0.20
        total_range = peak_rom - min_rom
        ml_status = "HEALTHY" if healthy_probability >= CLINICAL_THRESHOLD else "RESTRICTED"
        
        # 🟢 NEW: FUNCTIONAL ARC & VELOCITY BYPASS
        # 1. Arc Check (at least 60 deg)
        # 2. Velocity Floor (at least 0.8 deg/frame for confidence)
        is_improving = peak_delta > 8
        is_guarded = avg_vel < 0.8
        
        if (total_range < 60 or is_guarded) and ml_status == "HEALTHY" and not is_improving:
            ml_status = "RESTRICTED"
            reason = "Arc < 60°" if total_range < 60 else f"Velocity < 0.8 ({avg_vel:.2f})"
            print(f"⚠️ Functional Quality Check Failed ({reason}). Downgrading.")

        # 🟡 IMPROVING REFINEMENT
        if ml_status == "RESTRICTED":
            significant_growth = (peak_rom > 100 or peak_delta > 5)
            movement_quality = (jitter < 1.0 and avg_vel > 0.8)
            
            if significant_growth or movement_quality:
                ml_status = "IMPROVING"
        
        emoji = "🟢" if ml_status == "HEALTHY" else ("🟡" if ml_status == "IMPROVING" else "🔴")
        print(f"🧠 ML Confidence: {healthy_probability*100:.1f}% -> Status: {ml_status}")
    except Exception as e:
        print(f"XGBOOST ERROR: {e}")
        prediction = 0
        ml_status = "UNKNOWN"
        emoji = "⚪"

    try:
        # Qualitative analysis of flexion vs extension
        struggle_type = "consistent"
        if peak_rom < 160: struggle_type = "extension struggle (cannot straighten)"
        elif min_rom > 60: struggle_type = "flexion struggle (cannot bend/move up)"
        
        prompt = (
            f"You are a Senior Clinical Physical Therapist analyzing a {payload.muscle} scan:\n"
            f"--- KINEMATIC DATA ---\n"
            f"- Arc: {min_rom:.1f}° to {peak_rom:.1f}° (Range: {total_range:.1f}°)\n"
            f"- Velocity: {avg_vel:.2f} (Speed) | Jitter: {jitter:.2f} (Guarding)\n"
            f"- Struggle Detect: {struggle_type}\n"
            f"- ML Status: {ml_status}\n\n"
            f"Clinical Verdict:\n"
            f"1. Explain why they were labeled {ml_status} (specifically address the {avg_vel:.2f} velocity if it is low).\n"
            f"2. Suggest 2 'speed and control' exercises if velocity is low, or 'range' exercises if ROM is low."
        )
        ai_msg = llm.generate_content(prompt).text
    except Exception as e:
        print(f"GEMINI ERROR: {e}")
        ai_msg = f"{emoji} CLINICAL VERDICT: {ml_status}\nVelocity: {avg_vel:.2f} | Jitter: {jitter:.2f}. Suggested: Wall slides and light stretching."

    # Save to Supabase mobility_scans (Robust insertion with fallback)
    try:
        data = {
            "supabase_user_id": _uid,
            "muscle": payload.muscle,
            "joint_key": joint_key,
            "max_rom": int(round(peak_rom)),
            "min_rom": round(min_rom, 2),
            "average_rom": int(round(avg_rom)),
            "previous_rom": int(round(previous_rom)),
            "peak_delta": int(round(peak_delta)),
            "velocity": round(avg_vel, 2),
            "jitter": round(jitter, 2),
            "acceleration": round(avg_accel, 2),
            "ml_classification": int(prediction),
            "ml_status": ml_status,
            "ai_message": ai_msg,
        }
        try:
            supabase.table("mobility_scans").insert(data).execute()
        except Exception as e:
            if "column" in str(e).lower():
                print("⚠️ New columns not found, retrying with basic columns...")
                basic_data = {k: v for k, v in data.items() if k not in ["min_rom", "velocity", "jitter", "acceleration"]}
                supabase.table("mobility_scans").insert(basic_data).execute()
            else:
                raise e
    except Exception as exc:
        print(f"SUPABASE ERROR (analyze-range): {exc}")

    return {
        "status": "success",
        "muscle": payload.muscle,
        "joint_key": joint_key,
        "angle": round(peak_rom, 2),
        "average_angle": round(avg_rom, 2),
        "peak_delta": round(peak_delta, 2),
        "velocity": round(avg_vel, 2),
        "jitter": round(jitter, 2),
        "acceleration": round(avg_accel, 2),
        "ml_status": ml_status,
        "message": ai_msg,
        "data_points": len(history),
        "raw_data": history,
    }


@api_router.post("/analyze-video")
async def analyze_video(
    video: UploadFile = File(...),
    muscle: str = Form(default="Unknown"),
    previous_rom: Optional[float] = Form(default=None),
    _uid: str = Depends(verify_token),
):
    """Analyze video as the authenticated user bypassing RLS."""
    suffix = Path(video.filename).suffix if video.filename else ".mp4"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await video.read())
            tmp_path = tmp.name

        joint_data = _fresh_joint_data()
        cap = cv.VideoCapture(tmp_path)
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret: break
            
            # Process EVERY frame for maximum precision on rapid movements
            # (conf=0.35 and half=True keep this efficient)
            results = pose_model(frame, conf=0.35, verbose=False, half=True)
            try:
                if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
                    kps = results[0].keypoints.xy[0].cpu().numpy()
                    if len(kps) > 16:
                        for j_name, (i1, i2, i3) in JOINTS_MAP.items():
                            pt1, pt2, pt3 = kps[i1], kps[i2], kps[i3]
                            if pt1[0] != 0 and pt2[0] != 0 and pt3[0] != 0:
                                angle = int(_calculate_angle(pt1, pt2, pt3))
                                jd = joint_data[j_name]
                                jd["max_angle"] = max(jd["max_angle"], angle)
                                jd["history"].append(angle)
            except Exception: pass
            frame_idx += 1
        cap.release()
    finally:
        if tmp_path and os.path.exists(tmp_path): os.unlink(tmp_path)

    joint_key = _joint_for_muscle(muscle)
    jd = joint_data[joint_key]
    history = jd["history"]
    
    # Defaults in case of short data
    final_angle = jd["max_angle"] if jd["max_angle"] > 0 else 90
    prev_rom = previous_rom if previous_rom is not None else float(final_angle)

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
        # Failsafe for short video scans
        peak_rom = float(final_angle)
        min_rom, avg_rom = peak_rom, peak_rom
        avg_vel, jitter, avg_accel = 0.0, 0.0, 0.0

    peak_delta = peak_rom - prev_rom

    # 🧠 2. RUN XGBOOST PREDICTION 
    try:
        features = [[peak_rom, min_rom, avg_rom, avg_vel, jitter, avg_accel]]
        
        # J.A.R.V.I.S. Clinical Rule: Lowered to 20%
        CLINICAL_THRESHOLD = 0.20
        # Get % confidence that patient is Healthy (Class 1)
        healthy_probability = clinical_model.predict_proba(features)[0][1]
        
        total_range = peak_rom - min_rom
        ml_status = "HEALTHY" if healthy_probability >= CLINICAL_THRESHOLD else "RESTRICTED"
        
        is_guarded = avg_vel < 0.8
        if (total_range < 60 or is_guarded) and ml_status == "HEALTHY" and peak_delta < 8:
            ml_status = "RESTRICTED"
            print(f"⚠️ Functional Quality Check Failed (Vel: {avg_vel:.2f}). Downgrading.")

        # 🟡 IMPROVING REFINEMENT
        if ml_status == "RESTRICTED":
            significant_growth = (peak_rom > 100 or peak_delta > 5)
            movement_quality = (jitter < 1.0 and avg_vel > 0.8)
            if significant_growth or movement_quality:
                ml_status = "IMPROVING"
        
        emoji = "🟢" if ml_status == "HEALTHY" else ("🟡" if ml_status == "IMPROVING" else "🔴")
    except Exception:
        prediction, ml_status, emoji = 0, "UNKNOWN", "⚪"

    try:
        struggle_type = "consistent"
        if peak_rom < 160: struggle_type = "extension struggle (cannot straighten)"
        elif min_rom > 60: struggle_type = "flexion struggle (cannot bend/move up)"

        prompt = (
            f"You are a Senior Clinical Physical Therapist reviewing a {muscle} video:\n"
            f"--- CLINICAL DATA ---\n"
            f"- Actionable ROM: {min_rom:.1f}° to {peak_rom:.1f}° (Range: {total_range:.1f}°)\n"
            f"- Quality Metrics: Velocity {avg_vel:.2f} | Jitter {jitter:.2f}\n"
            f"- Identified Struggle: {struggle_type}\n"
            f"--- TASK ---\n"
            f"Provide analysis for {ml_status} result. Specifically address the velocity of {avg_vel:.2f} (if it's below 1.0, it's guarded movement). Recommend 2 exercises for speed and control."
        )
        ai_msg = llm.generate_content(prompt).text
    except Exception:
        ai_msg = f"Report: {ml_status}. ROM {peak_rom:.1f}°. Velocity {avg_vel:.2f}. Suggested: Isometrics and controlled ROM work."

    # Save to mobility_scans (Robust insertion with fallback)
    try:
        data = {
            "supabase_user_id": _uid,
            "muscle": muscle,
            "joint_key": joint_key,
            "max_rom": int(round(peak_rom)),
            "min_rom": round(min_rom, 2),
            "average_rom": int(round(avg_rom)),
            "previous_rom": int(round(prev_rom)),
            "peak_delta": int(round(peak_delta)),
            "velocity": round(avg_vel, 2),
            "jitter": round(jitter, 2),
            "acceleration": round(avg_accel, 2),
            "ml_classification": int(prediction),
            "ml_status": ml_status,
            "ai_message": ai_msg,
        }
        try:
            supabase.table("mobility_scans").insert(data).execute()
        except Exception as e:
            if "column" in str(e).lower():
                print("⚠️ New columns not found, retrying with basic columns...")
                basic_data = {k: v for k, v in data.items() if k not in ["min_rom", "velocity", "jitter", "acceleration"]}
                supabase.table("mobility_scans").insert(basic_data).execute()
            else:
                raise e
    except Exception as exc:
        print(f"SUPABASE ERROR (analyze-video): {exc}")

    return {
        "status": "success",
        "muscle": muscle,
        "joint_key": joint_key,
        "angle": round(peak_rom, 2),
        "average_angle": round(avg_rom, 2),
        "peak_delta": round(peak_delta, 2),
        "ml_status": ml_status,
        "message": ai_msg,
        "data_points": len(history),
    }


# ── Routes: exercises (Supabase) ──────────────────────────────────────────────

@api_router.get("/users/{user_id}/exercises/today")
def get_today_exercises(user_id: str, _uid: str = Depends(verify_token)):
    """Fetch today's exercises for the authenticated user."""
    if user_id != _uid and user_id != "me":
        raise HTTPException(status_code=403, detail="Forbidden")

    today = date.today().isoformat()
    try:
        res = supabase.table("exercises").select("*").eq("user_id", _uid).eq("scheduled_date", today).order("created_at").execute()
        return res.data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@api_router.patch("/users/{user_id}/exercises/{exercise_id}/complete")
def toggle_exercise(user_id: str, exercise_id: str, _uid: str = Depends(verify_token)):
    """Toggle completion status of an exercise. Verifies owner via Manual Query."""
    try:
        # First verify ownership
        check = supabase.table("exercises").select("completed").eq("id", exercise_id).eq("user_id", _uid).single().execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Exercise not found or unauthorized")
        
        new_val = not check.data["completed"]
        completed_at = datetime.utcnow().isoformat() if new_val else None
        
        supabase.table("exercises").update({"completed": new_val, "completed_at": completed_at}).eq("id", exercise_id).eq("user_id", _uid).execute()
        return {"completed": new_val}
    except Exception as exc:
        if isinstance(exc, HTTPException): raise exc
        raise HTTPException(status_code=400, detail=str(exc))


@api_router.get("/users/{user_id}/exercises/schedule")
def get_exercise_schedule(user_id: str, _uid: str = Depends(verify_token)):
    """Fetch the full exercise schedule for the authenticated user bypassing RLS."""
    if user_id != _uid and user_id != "me":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    from_date = date.today().isoformat()
    try:
        res = supabase.table("exercises").select("*").eq("user_id", _uid).gte("scheduled_date", from_date).order("scheduled_date").execute()
        grouped: dict = defaultdict(list)
        for ex in res.data:
            grouped[ex["scheduled_date"]].append(ex)
        sections = []
        for d_str, exs in sorted(grouped.items()):
            d = date.fromisoformat(d_str)
            sections.append({
                "day_abbr": d.strftime("%a"),
                "day_num": str(d.day),
                "month": d.strftime("%b"),
                "exercises": exs,
            })
        return sections
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Routes: checkins (Supabase) ───────────────────────────────────────────────

@api_router.post("/users/{user_id}/checkins", status_code=201)
def create_checkin(user_id: str, payload: CheckinCreate, _uid: str = Depends(verify_token)):
    """Create a new pain/symptom check-in for the authenticated user bypassing RLS."""
    if user_id != _uid and user_id != "me":
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        res = supabase.table("checkins").insert({
            "user_id": _uid,
            "pain_level": payload.pain_level,
            "symptoms": payload.symptoms,
        }).execute()
        return res.data[0]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Routes: stats & metrics (Supabase) ────────────────────────────────────────

@api_router.get("/users/{user_id}/stats")
def get_stats(user_id: str, _uid: str = Depends(verify_token)):
    """Compute recovery stats (streak, mobility trend) for the authenticated user bypassing RLS."""
    if user_id != _uid and user_id != "me":
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        # Streak calculation
        rows = supabase.table("exercises").select("scheduled_date,completed").eq("user_id", _uid).order("scheduled_date", desc=True).execute()
        day_done: dict[str, bool] = {}
        for ex in rows.data:
            day_done.setdefault(ex["scheduled_date"], False)
            if ex["completed"]:
                day_done[ex["scheduled_date"]] = True

        streak = 0
        check = date.today()
        # Sort keys to ensure we start from most recent
        for d_str in sorted(day_done, reverse=True):
            d = date.fromisoformat(d_str)
            if d == check and day_done[d_str]:
                streak += 1
                check = d - timedelta(days=1)
            elif d == check:
                break

        # Metrics for trend deltas
        metrics = supabase.table("recovery_metrics").select("*").eq("user_id", _uid).order("recorded_at", desc=True).limit(2).execute()
        mobility_index = 0
        mobility_change = 0
        pain_reduction = 0
        pain_change = 0
        if metrics.data:
            latest = metrics.data[0]
            mobility_index = int(latest.get("mobility_score", 0))
            pain_reduction = int(100 - latest.get("pain_score", 0))
            if len(metrics.data) > 1:
                prev = metrics.data[1]
                mobility_change = int(latest.get("mobility_score", 0) - prev.get("mobility_score", 0))
                pain_change = int(prev.get("pain_score", 0) - latest.get("pain_score", 0))

        return {
            "streak_days": streak,
            "streak_change": 1 if streak > 0 else 0,
            "mobility_index": mobility_index,
            "mobility_change": mobility_change,
            "pain_reduction": pain_reduction,
            "pain_change": pain_change,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@api_router.get("/users/{user_id}/metrics/history")
def get_metrics_history(user_id: str, _uid: str = Depends(verify_token)):
    """Fetch history of recovery metrics for the authenticated user bypassing RLS."""
    if user_id != _uid and user_id != "me":
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        res = supabase.table("recovery_metrics").select("*").eq("user_id", _uid).order("recorded_at").execute()
        return [
            {
                "week": r.get("week_label", "Week"),
                "pain": r.get("pain_score", 0),
                "mobility": r.get("mobility_score", 0),
                "strength": r.get("strength_score", 0),
            }
            for r in res.data
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Routes: injury markers (Supabase injury_logs) ─────────────────────────────

@api_router.get("/users/{user_id}/injury-markers")
def get_injury_markers(user_id: str, _uid: str = Depends(verify_token)):
    """Return all body-diagram markers for the authenticated user bypassing RLS."""
    if user_id != _uid and user_id != "me":
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        res = supabase.table("injury_logs").select("*").eq("supabase_user_id", _uid).execute()
        return res.data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@api_router.put("/users/{user_id}/injury-markers", status_code=200)
def save_injury_markers(
    user_id: str,
    markers: list[InjuryMarkerCreate],
    _uid: str = Depends(verify_token),
):
    """Replace all body-diagram markers for the authenticated user bypassing RLS."""
    if user_id != _uid and user_id != "me":
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        # Delete existing then insert the full current set
        supabase.table("injury_logs").delete().eq("supabase_user_id", _uid).execute()
        if markers:
            rows = [
                {
                    "supabase_user_id": _uid,
                    "slug": m.slug,
                    "side": m.side,
                    "status": m.status,
                    "how_it_happened": m.how_it_happened,
                    "date_of_injury": m.date_of_injury,
                    "doctor_diagnosis": m.doctor_diagnosis,
                    "initial_symptoms": m.initial_symptoms,
                }
                for m in markers
            ]
            supabase.table("injury_logs").insert(rows).execute()
        return {"saved": len(markers)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Routes: PT finder proxies ─────────────────────────────────────────────────

_ssl_ctx = ssl.create_default_context(cafile=certifi.where())

def _http_get(url: str, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as resp:
        return _json.loads(resp.read())


@api_router.get("/pt-search")
def pt_search(zip: str, limit: int = 20):
    """Proxy the NPPES NPI registry for Physical Therapists near a zip code."""
    if not zip.isdigit() or len(zip) != 5:
        raise HTTPException(status_code=400, detail="Invalid zip code")
    params = urllib.parse.urlencode({
        "taxonomy_description": "Physical Therapist",
        "postal_code": zip,
        "limit": min(limit, 20),
        "version": "2.1",
    })
    data = _http_get(f"https://npiregistry.cms.hhs.gov/api/?{params}")
    return data.get("results", [])


@api_router.get("/geocode")
def geocode(address: str):
    """Proxy Nominatim geocoding — keeps rate-limit compliance server-side."""
    params = urllib.parse.urlencode({
        "q": address,
        "format": "json",
        "limit": 1,
        "countrycodes": "us",
    })
    results = _http_get(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={"User-Agent": "ReboundRecoveryApp/1.0 (hackhealth2026)"},
    )
    if results:
        return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}
    return None


class GeocodeBatchRequest(BaseModel):
    addresses: list[str]


@api_router.post("/transcribe-injury")
async def transcribe_injury(audio: UploadFile = File(...)):
    """
    Accept a voice recording, use Gemini to transcribe and extract injury
    form fields. Returns JSON matching the injury log form fields.
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received")

    content_type = audio.content_type or "audio/m4a"
    suffix = ".m4a"
    if "wav" in content_type:
        suffix = ".wav"
    elif "webm" in content_type:
        suffix = ".webm"
    elif "ogg" in content_type:
        suffix = ".ogg"

    tmp_path = None
    uploaded_file = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        uploaded_file = genai.upload_file(tmp_path, mime_type=content_type)

        prompt = (
            "Listen to this audio recording of someone describing their injury. "
            "Extract the information and return ONLY a valid JSON object with these exact keys:\n"
            '{"how_it_happened": "description of how the injury occurred", '
            '"date_of_injury": "date in MM/DD/YYYY format, or empty string if not mentioned", '
            '"doctor_diagnosis": "any medical diagnosis mentioned, or empty string", '
            '"initial_symptoms": "symptoms like swelling, pain, limited motion, or empty string", '
            '"status": "one of: pain, moderate, or recovering"}\n'
            "Use 'pain' for active pain, 'moderate' for moderate discomfort, 'recovering' for improving. "
            "Return ONLY the JSON object. No markdown, no explanation, no code fences."
        )

        response = llm.generate_content([uploaded_file, prompt])
        raw = response.text.strip()
        # Strip markdown code fences if Gemini wraps the JSON
        raw = re.sub(r'^```[a-z]*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw).strip()

        form_data = _json.loads(raw)
        return form_data

    except _json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse AI response as JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if uploaded_file:
            try:
                genai.delete_file(uploaded_file.name)
            except Exception:
                pass


@api_router.post("/geocode/batch")
def geocode_batch(payload: GeocodeBatchRequest):
    """
    Geocode multiple addresses in one request.
    Handles Nominatim's 1 req/sec rate limit server-side.
    Returns a list parallel to the input — null where geocoding failed.
    """
    out: list[dict | None] = []
    for i, address in enumerate(payload.addresses):
        if i > 0:
            time.sleep(1.1)  # Nominatim rate limit
        try:
            params = urllib.parse.urlencode({
                "q": address,
                "format": "json",
                "limit": 1,
                "countrycodes": "us",
            })
            results = _http_get(
                f"https://nominatim.openstreetmap.org/search?{params}",
                headers={"User-Agent": "ReboundRecoveryApp/1.0 (hackhealth2026)"},
            )
            if results:
                out.append({"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])})
            else:
                out.append(None)
        except Exception:
            out.append(None)
    return out


app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)