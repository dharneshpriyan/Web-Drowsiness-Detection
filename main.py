import atexit
import base64
import json
import os
import re
import threading
import time
import webbrowser
from collections import deque
from pathlib import Path
from urllib.parse import quote
from flask import redirect

import cv2
import mediapipe as mp
import numpy as np
import requests
from flask import (
    Flask,
    Response,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)


BASE_DIR = Path(__file__).resolve().parent
ASSETS_DIR = BASE_DIR / "assets"
SCREENSHOTS_DIR = BASE_DIR / "screenshots"
APP_DATA_DIR = BASE_DIR / "data"
DOWNLOAD_DIR = BASE_DIR / "download"
APP_DATA_DIR.mkdir(parents=True, exist_ok=True)


def resource_path(relative_path: str) -> str:
    return str(BASE_DIR / relative_path)


def driver_data_file() -> Path:
    return APP_DATA_DIR / "driver_data.json"


def alert_config_file() -> Path:
    return APP_DATA_DIR / "alert_config.json"


def camera_config_file() -> Path:
    return APP_DATA_DIR / "camera_config.json"


def users_file() -> Path:
    return APP_DATA_DIR / "users.json"


def admin_settings_file() -> Path:
    return APP_DATA_DIR / "admin_settings.json"


def analytics_log_file() -> Path:
    return APP_DATA_DIR / "analytics_log.json"


def load_json(path: Path, default_data):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default_data
    return default_data


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=4), encoding="utf-8")


def normalize_whatsapp_number(number: str) -> str:
    return re.sub(r"\D", "", number or "")


def get_whatsapp_cloud_config():
    return {
        "access_token": os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip(),
        "phone_number_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip(),
        "graph_version": os.getenv("WHATSAPP_GRAPH_VERSION", "v22.0").strip(),
    }


def default_admin_settings():
    return {
        "ear_threshold": 0.23,
        "mar_threshold": 0.65,
        "head_threshold": 20,
        "eye_drowsy_seconds": 1.5,
        "alarm_delay": 0.5,
        "theme": "oceanic",
        "auto_start_monitor": False,
        "show_landmarks": True,
        "whatsapp_alert_repeat_count": 3,
        "enable_background_animation": True,
    }


def load_admin_settings():
    settings = default_admin_settings()
    settings.update(load_json(admin_settings_file(), {}))
    return settings


def save_admin_settings(data):
    merged = default_admin_settings()
    merged.update(data)
    save_json(admin_settings_file(), merged)


def append_analytics_event(event):
    events = load_json(analytics_log_file(), [])
    if not isinstance(events, list):
        events = []
    events.append(event)
    events = events[-250:]
    save_json(analytics_log_file(), events)


class DetectorEngine:
    def __init__(self):
        self.LEFT_EYE = [33, 160, 158, 133, 153, 144]
        self.RIGHT_EYE = [362, 385, 387, 263, 373, 380]
        self.MOUTH = [13, 14, 78, 308]

        self.NOSE = 1
        self.CHIN = 152
        self.LEFT_FACE = 234
        self.RIGHT_FACE = 454

        self.EAR_THRESH = 0.23
        self.MAR_THRESH = 0.65
        self.HEAD_THRESH = 20
        self.FRAME_LIMIT = 20
        self.ALARM_DELAY = 0.5
        self.EYE_DROWSY_SECONDS = 1.5

        self.cap = None
        self.prev = time.time()
        self.camera_ready = False
        self.last_error = ""
        self.reset_runtime_state()
        self.apply_admin_settings(load_admin_settings())

        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7,
        )

    def reset_runtime_state(self):
        self.drowsy_event_count = 0
        self.previous_drowsy_state = False
        self.whatsapp_alert_sent = False
        self.ear_buffer = deque(maxlen=10)
        self.mar_buffer = deque(maxlen=10)
        self.ear_history = deque(maxlen=60)
        self.mar_history = deque(maxlen=60)
        self.attention_history = deque(maxlen=60)
        self.eye_closed_frames = 0
        self.head_frames = 0
        self.eye_closed_started_at = None
        self.attention_score = 100
        self.ear_avg = 0.0
        self.mar_avg = 0.0
        self.yaw = 0.0
        self.status = "ACTIVE"
        self.alert_active = False
        self.blink_state = False
        self.blink_timer = time.time()
        self.alert_start_time = None
        self.fps = 0
        self.prev = time.time()
        self.current_event_logged = False

    def apply_admin_settings(self, settings):
        self.EAR_THRESH = float(settings.get("ear_threshold", 0.23))
        self.MAR_THRESH = float(settings.get("mar_threshold", 0.65))
        self.HEAD_THRESH = float(settings.get("head_threshold", 20))
        self.EYE_DROWSY_SECONDS = float(settings.get("eye_drowsy_seconds", 1.5))
        self.ALARM_DELAY = float(settings.get("alarm_delay", 0.5))
        self.show_landmarks = bool(settings.get("show_landmarks", True))

    def send_whatsapp_alert(self):
        alert_data = load_json(
            alert_config_file(),
            {"enabled": True, "owner_whatsapp": ""},
        )
        if not alert_data.get("enabled", True):
            return False

        user = getattr(self, 'current_user', {})
        number = normalize_whatsapp_number(alert_data.get("owner_whatsapp", "").strip())
        if not number:
            return False

        timestamp = time.strftime("%d-%m-%Y %I:%M:%S %p")
        message = (
            "ALERT: Driver drowsiness detected 3 times.\n\n"
            f"Time: {timestamp}\n"
            f"Driver Name: {user.get('name', '')}\n"
            f"Driver Mobile: {user.get('mobile', '')}\n"
            f"Driver Age: {user.get('age', '')}\n"
            f"Attention Score: {self.attention_score}%\n"
        )

        if self._send_whatsapp_cloud_message(number, message):
            return True

        url = f"https://api.whatsapp.com/send?phone={number}&text={quote(message)}"
        return webbrowser.open(url)

    def _send_whatsapp_cloud_message(self, number, message):
        config = get_whatsapp_cloud_config()
        if not config["access_token"] or not config["phone_number_id"]:
            return False

        endpoint = (
            f"https://graph.facebook.com/"
            f"{config['graph_version']}/{config['phone_number_id']}/messages"
        )
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": number,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": message,
            },
        }
        headers = {
            "Authorization": f"Bearer {config['access_token']}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(endpoint, json=payload, headers=headers, timeout=10)
            return response.ok
        except requests.RequestException:
            return False

    def start(self):
        self.stop()
        self.reset_runtime_state()
        camera_data = load_json(
            camera_config_file(),
            {"camera_source": "0", "last_external_camera_source": ""},
        )
        source = str(camera_data.get("camera_source", "0")).strip()
        source_value = int(source) if source.isdigit() else source
        attempts = [source_value]

        if isinstance(source_value, int):
            attempts.extend(
                [
                    (source_value, cv2.CAP_DSHOW),
                    (source_value, cv2.CAP_MSMF),
                ]
            )

        self.cap = None
        self.camera_ready = False
        self.last_error = "Unable to open the selected camera source."

        for attempt in attempts:
            cap = (
                cv2.VideoCapture(*attempt)
                if isinstance(attempt, tuple)
                else cv2.VideoCapture(attempt)
            )
            if cap is not None and cap.isOpened():
                self.cap = cap
                self.camera_ready = True
                self.last_error = ""
                break
            if cap is not None:
                cap.release()

        if self.cap is not None:
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        else:
            self.status = "NO CAMERA"

        self.prev = time.time()

    def stop(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.camera_ready = False
        self.last_error = ""

    def distance(self, a, b):
        return np.linalg.norm(a - b)

    def compute_EAR(self, lm, eye):
        v1 = self.distance(lm[eye[1]], lm[eye[5]])
        v2 = self.distance(lm[eye[2]], lm[eye[4]])
        h = self.distance(lm[eye[0]], lm[eye[3]])
        if h == 0:
            return 0.0
        return (v1 + v2) / (2 * h)

    def compute_MAR(self, lm):
        v = self.distance(lm[self.MOUTH[0]], lm[self.MOUTH[1]])
        h = self.distance(lm[self.MOUTH[2]], lm[self.MOUTH[3]])
        if h == 0:
            return 0.0
        return v / h

    def head_pose(self, frame, lm):
        try:
            size = frame.shape
            image_pts = np.array(
                [
                    lm[self.NOSE],
                    lm[self.CHIN],
                    lm[self.LEFT_FACE],
                    lm[self.RIGHT_FACE],
                ],
                dtype="double",
            )
            model_pts = np.array(
                [
                    (0, 0, 0),
                    (0, -330, -65),
                    (-225, 170, -135),
                    (225, 170, -135),
                ],
                dtype="double",
            )

            focal = size[1]
            center = (size[1] / 2, size[0] / 2)
            cam_matrix = np.array(
                [
                    [focal, 0, center[0]],
                    [0, focal, center[1]],
                    [0, 0, 1],
                ],
                dtype="double",
            )
            dist_coeffs = np.zeros((4, 1))

            success, rot_vec, _ = cv2.solvePnP(
                model_pts,
                image_pts,
                cam_matrix,
                dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE,
            )
            if not success:
                return 0, 0, 0

            rmat, _ = cv2.Rodrigues(rot_vec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
            pitch, yaw, roll = angles
            return pitch, yaw, roll
        except Exception:
            return 0, 0, 0

    def _draw_overlay_elements(self, frame, lm):
        if self.alert_active:
            if time.time() - self.blink_timer > 0.5:
                self.blink_state = not self.blink_state
                self.blink_timer = time.time()

            if self.blink_state:
                cv2.putText(
                    frame,
                    "!! DROWSINESS ALERT !!",
                    (frame.shape[1] // 2 - 190, frame.shape[0] // 2),
                    cv2.FONT_HERSHEY_DUPLEX,
                    1.0,
                    (0, 0, 255),
                    3,
                    cv2.LINE_AA,
                )

        cv2.rectangle(
            frame,
            (0, 0),
            (frame.shape[1] - 1, frame.shape[0] - 1),
            (0, 255, 150),
            2,
        )

        if self.show_landmarks:
            for point in self.LEFT_EYE + self.RIGHT_EYE:
                cv2.circle(frame, tuple(lm[point]), 1, (255, 255, 0), -1)

    def process_frame(self, frame, from_browser=False):
        if frame is None:
            return None

        current = time.time()
        time_diff = current - self.prev
        self.fps = 1 / time_diff if time_diff > 0 else 0
        self.prev = current

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.face_mesh.process(rgb)
        if from_browser:
            self.camera_ready = True
            self.last_error = ""

        self.status = "ACTIVE"
        self.alert_active = False

        if result.multi_face_landmarks:
            face = result.multi_face_landmarks[0]
            h, w, _ = frame.shape
            lm = np.array([(int(p.x * w), int(p.y * h)) for p in face.landmark])

            ear = (
                self.compute_EAR(lm, self.LEFT_EYE)
                + self.compute_EAR(lm, self.RIGHT_EYE)
            ) / 2
            mar = self.compute_MAR(lm)

            self.ear_buffer.append(ear)
            self.mar_buffer.append(mar)
            self.ear_avg = float(np.mean(self.ear_buffer)) if self.ear_buffer else 0.0
            self.mar_avg = float(np.mean(self.mar_buffer)) if self.mar_buffer else 0.0

            _, self.yaw, _ = self.head_pose(frame, lm)

            if self.ear_avg < self.EAR_THRESH:
                if self.eye_closed_started_at is None:
                    self.eye_closed_started_at = current
                self.eye_closed_frames += 1
            else:
                self.eye_closed_started_at = None
                self.eye_closed_frames = 0

            self.head_frames = (
                self.head_frames + 1 if abs(self.yaw) > self.HEAD_THRESH else 0
            )

            self.attention_score = 100
            self.attention_score -= min(40, self.eye_closed_frames * 2)
            self.attention_score -= min(30, self.head_frames * 2)
            if self.mar_avg > self.MAR_THRESH:
                self.attention_score -= 30
            self.attention_score = max(0, self.attention_score)

            self.ear_history.append(self.ear_avg)
            self.mar_history.append(self.mar_avg)
            self.attention_history.append(self.attention_score)

            eye_closed_duration = (
                current - self.eye_closed_started_at
                if self.eye_closed_started_at is not None
                else 0.0
            )

            if eye_closed_duration >= self.EYE_DROWSY_SECONDS:
                self.status = "DROWSY"
                self.alert_active = True
            elif self.mar_avg > self.MAR_THRESH:
                self.status = "YAWNING"
            elif self.head_frames > self.FRAME_LIMIT:
                self.status = "DISTRACTED"

            if self.status != "ACTIVE":
                if self.alert_start_time is None:
                    self.alert_start_time = time.time()
                if time.time() - self.alert_start_time < self.ALARM_DELAY:
                    self.alert_active = False
            else:
                self.alert_start_time = None

            self._draw_overlay_elements(frame, lm)

        current_drowsy_state = self.status == "DROWSY"
        if current_drowsy_state and not self.previous_drowsy_state:
            self.drowsy_event_count += 1
            self.log_detection_event()
            if self.drowsy_event_count >= 3 and not self.whatsapp_alert_sent:
                self.send_whatsapp_alert()
                self.whatsapp_alert_sent = True

        self.previous_drowsy_state = current_drowsy_state
        return frame

    def log_detection_event(self):
        user = getattr(self, "current_user", {})
        append_analytics_event(
            {
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "status": self.status,
                "driver_name": user.get("name", "") or "Unknown",
                "driver_mobile": user.get("mobile", "") or "",
                "driver_age": user.get("age", "") or "",
                "attention_score": int(self.attention_score),
                "ear": round(self.ear_avg, 3),
                "mar": round(self.mar_avg, 3),
                "yaw": round(float(self.yaw), 2),
            }
        )

    def get_frame(self):
        if self.cap is None:
            return None

        ret, frame = self.cap.read()
        if not ret:
            return None

        return self.process_frame(frame)


app = Flask(__name__)
app.secret_key = "web-drowsiness-detection"
ADMIN_USERNAME = "sparrow"
ADMIN_PASSWORD = "4321"

TEAM_MEMBERS = [
    "Bharath R",
    "Subalakshmi J",
    "Ushamalini K",
    "Dharnesh Priyan J",
]

engine_lock = threading.Lock()
engine = None
monitor_running = False
latest_metrics = {
    "status": "ACTIVE",
    "fps": 0,
    "ear": 0.0,
    "mar": 0.0,
    "attention_score": 100,
    "driver_name": "Not Set",
    "alert_active": False,
    "camera_ready": False,
    "camera_error": "",
    "updated_at": 0.0,
}


@app.context_processor
def inject_navigation():
    admin_settings = load_admin_settings()
    return {
        "team_members": TEAM_MEMBERS,
        "active_theme": admin_settings.get("theme", "oceanic"),
        "is_admin": bool(session.get("is_admin")),
    }


def get_engine():
    global engine
    if engine is None:
        engine = DetectorEngine()
    return engine


def load_driver_data():
    return load_json(driver_data_file(), {"name": "", "mobile": "", "age": ""})


def load_alert_data():
    return load_json(alert_config_file(), {"enabled": True, "owner_whatsapp": ""})


def load_camera_data():
    return load_json(
        camera_config_file(),
        {"camera_source": "0", "last_external_camera_source": ""},
    )


def load_users_data():
    return load_json(users_file(), {})


def build_user_summary():
    users = load_users_data()
    if not isinstance(users, dict):
        users = {}

    normalized_users = []
    for user in users.values():
        if isinstance(user, dict):
            normalized_users.append(
                {
                    "name": str(user.get("name", "")).strip() or "Unknown",
                    "mobile": str(user.get("mobile", "")).strip() or "-",
                    "age": str(user.get("age", "")).strip() or "-",
                }
            )

    return {
        "total_users": len(normalized_users),
        "recent_users": list(reversed(normalized_users[-5:])),
    }


def load_analytics_events():
    events = load_json(analytics_log_file(), [])
    return events if isinstance(events, list) else []


def is_admin_authenticated():
    return bool(session.get("is_admin"))


def update_metrics_snapshot(detector):
    global latest_metrics
    user = getattr(detector, 'current_user', {})
    latest_metrics = {
        "status": detector.status,
        "fps": int(detector.fps),
        "ear": round(detector.ear_avg, 2),
        "mar": round(detector.mar_avg, 2),
        "attention_score": int(detector.attention_score),
        "driver_name": user.get("name", "").strip() or "Not Set",
        "alert_active": bool(detector.alert_active),
        "camera_ready": bool(detector.camera_ready),
        "camera_error": detector.last_error,
        "updated_at": time.time(),
    }


def start_monitor():
    global monitor_running
    with engine_lock:
        if monitor_running:
            return
        detector = get_engine()
        detector.current_user = session.get("user", {})
        detector.stop()
        detector.reset_runtime_state()
        detector.apply_admin_settings(load_admin_settings())
        detector.camera_ready = False
        detector.last_error = "Waiting for browser camera permission and frames."
        update_metrics_snapshot(detector)
        monitor_running = True


def stop_monitor():
    global monitor_running
    with engine_lock:
        if engine is not None:
            engine.stop()
        monitor_running = False
        latest_metrics.update(
            {
                "status": "ACTIVE",
                "fps": 0,
                "ear": 0.0,
                "mar": 0.0,
                "attention_score": 100,
                "alert_active": False,
                "camera_ready": False,
                "camera_error": "",
                "updated_at": time.time(),
            }
        )


@atexit.register
def shutdown_engine():
    stop_monitor()


@app.route("/")
def index():
    if "user" not in session:
        return redirect(url_for("login"))
    camera_data = load_camera_data()
    alert_data = load_alert_data()
    camera_source = str(camera_data.get("camera_source", "0")).strip()
    is_laptop_camera = camera_source == "0"
    external_source = (
        camera_data.get("last_external_camera_source", "").strip()
        if is_laptop_camera
        else camera_source
    )
    return render_template(
        "index.html",
        page_title="Home",
        active_page="home",
        camera_data=camera_data,
        alert_data=alert_data,
        is_laptop_camera=is_laptop_camera,
        external_source=external_source,
    )


@app.get("/about")
def about():
    return render_template("about.html", page_title="About", active_page="about")


@app.get("/features")
def features():
    return render_template(
        "features.html",
        page_title="Features",
        active_page="features",
    )


@app.get("/system")
def system():
    return render_template("system.html", page_title="System", active_page="system")


@app.get("/download")
def download_page():
    return render_template("download.html", page_title="Download", active_page="download")


@app.get("/signup")
def signup():
    return render_template("signup.html", page_title="Sign Up", active_page="signup")


@app.post("/signup")
def signup_post():
    name = request.form.get("name", "").strip()
    mobile = request.form.get("mobile", "").strip()
    age = request.form.get("age", "").strip()

    if not name or not mobile or not age:
        flash("All fields are required.", "error")
        return redirect(url_for("signup"))

    users = load_users_data()
    if mobile in users:
        flash("Mobile number already registered.", "error")
        return redirect(url_for("signup"))

    users[mobile] = {"name": name, "mobile": mobile, "age": age}
    save_json(users_file(), users)
    flash("Registration successful. Please log in.", "success")
    return redirect(url_for("login"))


@app.get("/login")
def login():
    return render_template("login.html", page_title="Log In", active_page="login")


@app.post("/login")
def login_post():
    name = request.form.get("name", "").strip()
    mobile = request.form.get("mobile", "").strip()

    if not name or not mobile:
        flash("Name and mobile are required.", "error")
        return redirect(url_for("login"))

    users = load_users_data()
    if mobile not in users or users[mobile]["name"] != name:
        flash("Invalid credentials. Check your driver name and mobile number.", "error")
        return redirect(url_for("login"))

    session["user"] = users[mobile]
    return redirect(url_for("index"))


@app.post("/logout")
def logout():
    session.pop("user", None)
    session.pop("is_admin", None)
    return redirect(url_for("index"))


@app.get("/admin/login")
def admin_login():
    return render_template("admin_login.html", page_title="Admin Login", active_page="admin")


@app.post("/admin/login")
def admin_login_post():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()

    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        flash("Invalid admin credentials.", "error")
        return redirect(url_for("admin_login"))

    session["is_admin"] = True
    flash("Admin login successful.", "success")
    return redirect(url_for("admin_dashboard"))


@app.get("/admin")
def admin_dashboard():
    if not is_admin_authenticated():
        return redirect(url_for("admin_login"))

    settings = load_admin_settings()
    events = load_analytics_events()
    user_summary = build_user_summary()
    recent_events = list(reversed(events[-10:]))

    status_counts = {"DROWSY": 0, "YAWNING": 0, "DISTRACTED": 0}
    for event in events:
        status = event.get("status")
        if status in status_counts:
            status_counts[status] += 1

    return render_template(
        "admin_dashboard.html",
        page_title="Admin Panel",
        active_page="admin",
        admin_settings=settings,
        analytics_events=recent_events,
        analytics_chart=events[-20:],
        status_counts=status_counts,
        user_summary=user_summary,
    )


@app.post("/admin/settings")
def save_admin_detection_settings():
    if not is_admin_authenticated():
        return redirect(url_for("admin_login"))

    settings = {
        "ear_threshold": max(0.1, min(0.5, float(request.form.get("ear_threshold", 0.23)))),
        "mar_threshold": max(0.3, min(1.2, float(request.form.get("mar_threshold", 0.65)))),
        "head_threshold": max(5.0, min(45.0, float(request.form.get("head_threshold", 20)))),
        "eye_drowsy_seconds": max(0.5, min(5.0, float(request.form.get("eye_drowsy_seconds", 1.5)))),
        "alarm_delay": max(0.0, min(3.0, float(request.form.get("alarm_delay", 0.5)))),
        "whatsapp_alert_repeat_count": max(1, min(10, int(request.form.get("whatsapp_alert_repeat_count", 3)))),
        "theme": request.form.get("theme", "oceanic").strip() or "oceanic",
        "auto_start_monitor": request.form.get("auto_start_monitor") == "on",
        "show_landmarks": request.form.get("show_landmarks") == "on",
        "enable_background_animation": request.form.get("enable_background_animation") == "on",
    }
    save_admin_settings(settings)
    if engine is not None:
        engine.apply_admin_settings(settings)
    flash("Admin settings updated.", "success")
    return redirect(url_for("admin_dashboard"))


@app.post("/admin/analytics/reset")
def reset_admin_analytics():
    if not is_admin_authenticated():
        return redirect(url_for("admin_login"))

    save_json(analytics_log_file(), [])
    flash("Analytics history cleared.", "success")
    return redirect(url_for("admin_dashboard"))


@app.get("/admin/analytics/export")
def export_admin_analytics():
    if not is_admin_authenticated():
        return redirect(url_for("admin_login"))

    export_payload = {
        "exported_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "settings": load_admin_settings(),
        "summary": {
            "users": build_user_summary()["total_users"],
            "events": len(load_analytics_events()),
        },
        "events": load_analytics_events(),
    }
    return Response(
        json.dumps(export_payload, indent=2),
        mimetype="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="admin_analytics_export.json"',
        },
    )



@app.post("/settings/whatsapp")
def save_whatsapp_settings():
    enabled = request.form.get("enabled", "on") == "on"
    number = normalize_whatsapp_number(request.form.get("owner_whatsapp", "").strip())
    if enabled and len(number) < 10:
        flash("Enter the WhatsApp number with country code, for example: 919876543210", "error")
        return redirect(url_for("index") + "#whatsapp-alert")

    save_json(
        alert_config_file(),
        {"enabled": enabled, "owner_whatsapp": number},
    )
    flash("WhatsApp alert settings saved.", "success")
    return redirect(url_for("index"))


@app.post("/settings/camera")
def save_camera_settings():
    camera_mode = request.form.get("camera_mode", "laptop")
    last_external = request.form.get("external_source", "").strip()
    if camera_mode == "external" and not last_external:
        flash("Enter the external camera URL before saving.", "error")
        return redirect(url_for("index") + "#camera-settings")

    save_json(
        camera_config_file(),
        {
            "camera_source": "0" if camera_mode == "laptop" else last_external,
            "last_external_camera_source": last_external,
        },
    )
    flash("Camera source saved.", "success")
    return redirect(url_for("index"))


@app.get("/monitor")
def monitor():
    if "user" not in session:
        return redirect(url_for("login"))
    return render_template(
        "monitor.html",
        page_title="Live Monitor",
        active_page="monitor",
    )


@app.post("/api/monitor/start")
def api_start_monitor():
    start_monitor()
    return jsonify({"ok": True})


@app.post("/api/monitor/stop")
def api_stop_monitor():
    stop_monitor()
    return jsonify({"ok": True})


@app.get("/api/status")
def api_status():
    return jsonify(latest_metrics)


@app.post("/api/frame")
def api_frame():
    if not monitor_running:
        start_monitor()

    with engine_lock:
        detector = get_engine()
        detector.current_user = session.get("user", {})

        frame_file = request.files.get("frame")
        if frame_file is None:
            return jsonify({"ok": False, "error": "Missing frame payload."}), 400

        raw_bytes = frame_file.read()
        np_buffer = np.frombuffer(raw_bytes, dtype=np.uint8)
        frame = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"ok": False, "error": "Invalid frame data."}), 400

        processed = detector.process_frame(frame, from_browser=True)
        if processed is None:
            return jsonify({"ok": False, "error": "Unable to process frame."}), 500

        update_metrics_snapshot(detector)
        ok, buffer = cv2.imencode(".jpg", processed, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ok:
            return jsonify({"ok": False, "error": "Unable to encode processed frame."}), 500

        return jsonify(
            {
                "ok": True,
                "frame": base64.b64encode(buffer.tobytes()).decode("ascii"),
                **latest_metrics,
            }
        )


def generate_frames():
    start_monitor()
    while True:
        with engine_lock:
            if not monitor_running:
                break

            detector = get_engine()
            frame = detector.get_frame()
            if frame is None:
                time.sleep(0.1)
                continue

            update_metrics_snapshot(detector)
            ok, buffer = cv2.imencode(".jpg", frame)
            if not ok:
                continue
            payload = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + payload + b"\r\n"
        )


@app.get("/video_feed")
def video_feed():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/screenshots/<path:filename>")
def serve_screenshots(filename):
    return send_from_directory(SCREENSHOTS_DIR, filename)


@app.get("/download/windows")
def download_windows_installer():
    windows_dir = DOWNLOAD_DIR / "windows"
    return send_from_directory(
        windows_dir,
        "AI_Drowsiness_Detection_Setup.exe",
        as_attachment=True,
    )






if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False, threaded=True)
    
