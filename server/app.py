import json
import os
import pickle
from dotenv import load_dotenv
load_dotenv()
import threading
import time
import uuid
import warnings
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from supabase import create_client, Client

import cv2 as cv
import numpy as np
import google as genai
import jwt as pyjwt
from fastapi import Depends, FastAPI, Header, HTTPException
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

# ── Paths ─────────────────────────────────────────────────────────────────────

SERVER_DIR = os.path.dirname(__file__)
CV_DIR     = os.path.join(SERVER_DIR, "Computer_vision")
DB_FILE    = os.path.join(SERVER_DIR, "db.json")

# ── Load CV models ────────────────────────────────────────────────────────────

with open(os.path.join(CV_DIR, "clinical_ai_model.pkl"), "rb") as f:
    clinical_model = pickle.load(f)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
llm = genai.GenerativeModel("gemini-pro")

# ── Supabase ──────────────────────────────────────────────────────────────────

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


def verify_token(authorization: str = Header(default="")) -> str:
    """Verify Supabase JWT and return the user's UUID (sub claim)."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = pyjwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return str(payload["sub"])
    except pyjwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

pose_model = YOLO(os.path.join(CV_DIR, "yolov8m-pose.pt"))
try:
    pose_model.to("mps")
    print("Hardware Acceleration Enabled: Apple Silicon GPU (MPS)")
except Exception:
    print("MPS not available, falling back to CPU.")

# ── Joint map (from pt_tracker.py) ───────────────────────────────────────────

JOINTS_MAP: dict[str, tuple[int, int, int]] = {
    "L_elbow":    (5, 7, 9),
    "R_elbow":    (6, 8, 10),
    "L_shoulder": (11, 5, 7),
    "R_shoulder": (12, 6, 8),
    "L_hip":      (5, 11, 13),
    "R_hip":      (6, 12, 14),
    "L_knee":     (11, 13, 15),
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

        results = pose_model(frame, conf=0.5, verbose=False, half=True)
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


# ── User DB helpers ───────────────────────────────────────────────────────────

def load_db() -> dict:
    if not os.path.exists(DB_FILE):
        return {"users": {}}
    with open(DB_FILE) as f:
        return json.load(f)


def save_db(data: dict):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=2)


def compute_recovery_day(injury_date_str: str) -> int:
    try:
        return max(0, (date.today() - date.fromisoformat(injury_date_str)).days)
    except Exception:
        return 0


def build_profile(raw: dict) -> "UserProfile":
    return UserProfile(**raw, recovery_day=compute_recovery_day(raw["injury_date"]))


# ── Pydantic models ───────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    id: Optional[str] = None   # Supabase user.id — if omitted a UUID is generated
    name: str
    sport: str
    injury_description: str
    injury_date: str
    doctor_diagnosis: Optional[str] = ""
    pt_name: Optional[str] = ""


class UserProfile(UserCreate):
    id: str
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


# ── Routes: general ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "rebound-api"}


# ── Routes: users ─────────────────────────────────────────────────────────────

@app.post("/users", response_model=UserProfile, status_code=201)
def create_user(payload: UserCreate):
    db = load_db()
    user_id = payload.id or str(uuid.uuid4())
    data = {k: v for k, v in payload.model_dump().items() if k != "id"}
    raw = {"id": user_id, "created_at": datetime.utcnow().isoformat(), **data}
    db["users"][user_id] = raw
    save_db(db)
    return build_profile(raw)


@app.get("/users/{user_id}", response_model=UserProfile)
def get_user(user_id: str):
    db = load_db()
    raw = db["users"].get(user_id)
    if not raw:
        raise HTTPException(status_code=404, detail="User not found")
    return build_profile(raw)


@app.patch("/users/{user_id}", response_model=UserProfile)
def update_user(user_id: str, payload: UserUpdate):
    db = load_db()
    raw = db["users"].get(user_id)
    if not raw:
        raise HTTPException(status_code=404, detail="User not found")
    raw.update({k: v for k, v in payload.model_dump().items() if v is not None})
    db["users"][user_id] = raw
    save_db(db)
    return build_profile(raw)


# ── Routes: computer vision / ROM ─────────────────────────────────────────────

@app.get("/video_feed")
def video_feed():
    """MJPEG stream with live pose overlay and ROM readout."""
    return StreamingResponse(
        _generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.post("/start-scan")
def start_scan():
    """Reset and begin a new ROM recording session."""
    scanner_state["is_scanning"] = True
    scanner_state["joint_data"] = _fresh_joint_data()
    return {"status": "recording_started"}


@app.post("/analyze-range")
def analyze_range(payload: AnalyzeRangeRequest):
    """
    Stop the scan, run ML classification, generate Gemini AI report,
    and save the session JSON to Computer_vision/.
    """
    scanner_state["is_scanning"] = False

    joint_key = _joint_for_muscle(payload.muscle)
    jd = scanner_state["joint_data"][joint_key]
    history = jd["history"]
    final_angle = jd["max_angle"] if jd["max_angle"] > 0 else 90
    previous_rom = payload.previous_rom if payload.previous_rom is not None else float(final_angle)
    peak_delta = final_angle - previous_rom
    average_angle = int(sum(history) / len(history)) if history else final_angle

    prediction = clinical_model.predict([[previous_rom, final_angle]])[0]
    ml_status = {2: "HEALTHY", 1: "IMPROVING"}.get(int(prediction), "RESTRICTED")
    emoji    = {2: "🟢",       1: "🟡"      }.get(int(prediction), "🔴")

    try:
        prompt = (
            f"AI Assistant report for {payload.muscle}. "
            f"Prev Peak: {previous_rom}°, Current Peak: {final_angle}°, "
            f"Average Sustained ROM: {average_angle}°, ML Status: {ml_status}. "
            f"Suggest protocol."
        )
        ai_msg = llm.generate_content(prompt).text
    except Exception:
        ai_msg = f"{emoji} AI CLINICAL ASSISTANT: {ml_status}\nSuggested Protocol: Review data manually."

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"patient_data_{payload.muscle}_{timestamp_str}.json"
    session_data = {
        "timestamp": str(datetime.now()),
        "muscle": payload.muscle,
        "joint_key": joint_key,
        "max_rom": final_angle,
        "average_rom": average_angle,
        "previous_rom": previous_rom,
        "peak_delta": peak_delta,
        "ml_classification": int(prediction),
        "raw_angle_data": history,
    }
    with open(os.path.join(CV_DIR, filename), "w") as f:
        json.dump(session_data, f, indent=4)

    return {
        "status": "success",
        "muscle": payload.muscle,
        "joint_key": joint_key,
        "angle": final_angle,
        "average_angle": average_angle,
        "peak_delta": peak_delta,
        "ml_status": ml_status,
        "message": ai_msg,
        "data_points": len(history),
        "filename": filename,
        "raw_data": history,
    }


# ── Routes: exercises (Supabase) ──────────────────────────────────────────────

@app.get("/users/{user_id}/exercises/today")
def get_today_exercises(user_id: str, _uid: str = Depends(verify_token)):
    today = date.today().isoformat()
    res = (
        supabase.table("exercises")
        .select("*")
        .eq("user_id", user_id)
        .eq("scheduled_date", today)
        .order("created_at")
        .execute()
    )
    return res.data


@app.patch("/users/{user_id}/exercises/{exercise_id}/complete")
def toggle_exercise(user_id: str, exercise_id: str, _uid: str = Depends(verify_token)):
    res = (
        supabase.table("exercises")
        .select("completed")
        .eq("id", exercise_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Exercise not found")
    new_val = not res.data["completed"]
    completed_at = datetime.utcnow().isoformat() if new_val else None
    supabase.table("exercises").update(
        {"completed": new_val, "completed_at": completed_at}
    ).eq("id", exercise_id).execute()
    return {"completed": new_val}


@app.get("/users/{user_id}/exercises/schedule")
def get_exercise_schedule(user_id: str, _uid: str = Depends(verify_token)):
    from_date = date.today().isoformat()
    res = (
        supabase.table("exercises")
        .select("*")
        .eq("user_id", user_id)
        .gte("scheduled_date", from_date)
        .order("scheduled_date")
        .execute()
    )
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


# ── Routes: checkins (Supabase) ───────────────────────────────────────────────

@app.post("/users/{user_id}/checkins", status_code=201)
def create_checkin(user_id: str, payload: CheckinCreate, _uid: str = Depends(verify_token)):
    row = {
        "user_id": user_id,
        "pain_level": payload.pain_level,
        "symptoms": payload.symptoms,
    }
    res = supabase.table("checkins").insert(row).execute()
    return res.data[0]


# ── Routes: stats & metrics (Supabase) ────────────────────────────────────────

@app.get("/users/{user_id}/stats")
def get_stats(user_id: str, _uid: str = Depends(verify_token)):
    # Streak: count consecutive days (from today backwards) with ≥1 completed exercise
    rows = (
        supabase.table("exercises")
        .select("scheduled_date,completed")
        .eq("user_id", user_id)
        .order("scheduled_date", desc=True)
        .execute()
    )
    day_done: dict[str, bool] = {}
    for ex in rows.data:
        day_done.setdefault(ex["scheduled_date"], False)
        if ex["completed"]:
            day_done[ex["scheduled_date"]] = True

    streak = 0
    check = date.today()
    for d_str in sorted(day_done, reverse=True):
        d = date.fromisoformat(d_str)
        if d == check and day_done[d_str]:
            streak += 1
            check = d - timedelta(days=1)
        elif d == check:
            break

    # Latest two metric records for trend deltas
    metrics = (
        supabase.table("recovery_metrics")
        .select("*")
        .eq("user_id", user_id)
        .order("recorded_at", desc=True)
        .limit(2)
        .execute()
    )
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
            mobility_change = int(
                latest.get("mobility_score", 0) - prev.get("mobility_score", 0)
            )
            pain_change = int(
                prev.get("pain_score", 0) - latest.get("pain_score", 0)
            )

    return {
        "streak_days": streak,
        "streak_change": 1,
        "mobility_index": mobility_index,
        "mobility_change": mobility_change,
        "pain_reduction": pain_reduction,
        "pain_change": pain_change,
    }


@app.get("/users/{user_id}/metrics/history")
def get_metrics_history(user_id: str, _uid: str = Depends(verify_token)):
    res = (
        supabase.table("recovery_metrics")
        .select("*")
        .eq("user_id", user_id)
        .order("recorded_at")
        .execute()
    )
    return [
        {
            "week": r["week_label"],
            "pain": r["pain_score"],
            "mobility": r["mobility_score"],
            "strength": r["strength_score"],
        }
        for r in res.data
    ]
