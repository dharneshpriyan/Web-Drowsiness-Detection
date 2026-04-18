# Web Drowsiness Detection

A web-based driver monitoring system that detects drowsiness, yawning, and distraction in real time using computer vision.

The app captures frames from the browser camera, processes them on the Python backend, and shows a live monitoring dashboard with status updates, attention scoring, alerts, driver login, and operator settings.

## Features

- Real-time drowsiness detection using MediaPipe Face Mesh
- Eye Aspect Ratio (EAR) monitoring
- Mouth Aspect Ratio (MAR) based yawn detection
- Head-pose based distraction detection
- Live browser dashboard with processed video preview
- Driver registration and login
- Camera source and alert configuration
- WhatsApp Cloud API support with manual fallback
- Responsive web UI for desktop and mobile browsers

## Tech Stack

- Python
- Flask
- OpenCV
- MediaPipe
- NumPy
- Requests
- HTML
- CSS
- JavaScript

## Project Structure

```text
Web Drowsiness Detection/
|-- assets/                # Static project assets
|-- data/                  # Runtime JSON storage
|-- download/              # Downloadable desktop build files
|-- screenshots/           # Project screenshots
|-- static/                # CSS and JavaScript
|-- templates/             # Flask HTML templates
|-- main.py                # Main Flask application
|-- requirements.txt       # Python dependencies
|-- README.md              # Project documentation
`-- license.txt            # Project license
```

## Detection Logic

The backend evaluates multiple facial signals for each processed frame:

- EAR for prolonged eye closure
- MAR for yawning detection
- Head-pose deviation for distraction detection
- A composite attention score for simplified operator feedback

The drowsiness state is triggered when eye closure persists for approximately `1.5` seconds by default. Thresholds and timing can be adjusted from the admin settings.

## WhatsApp Alerts

The project supports two alert behaviors.

### 1. Automatic send

If WhatsApp Cloud API environment variables are configured, the backend attempts to send alerts automatically without opening WhatsApp manually.

Required environment variables:

```powershell
$env:WHATSAPP_ACCESS_TOKEN="your_meta_access_token"
$env:WHATSAPP_PHONE_NUMBER_ID="your_whatsapp_phone_number_id"
$env:WHATSAPP_GRAPH_VERSION="v22.0"
```

The destination phone number is still taken from the app's WhatsApp alert settings screen.

### 2. Manual fallback

If Cloud API credentials are not configured, the application falls back to opening a prefilled WhatsApp message link in the browser.

## Installation

### 1. Create and activate a virtual environment

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### 2. Install dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Run the application

```powershell
python main.py
```

### 4. Open in the browser

```text
http://127.0.0.1:5000
```

## Usage Flow

1. Sign up a driver account.
2. Log in to the dashboard.
3. Configure camera and WhatsApp settings if needed.
4. Start live monitoring.
5. Allow browser camera access.
6. Watch live status, EAR, yawn score, and attention score.

## Mobile Browser Notes

- The interface is responsive and now adapts better to phone screens.
- On mobile, browser camera access usually requires `https://` or `localhost`.
- If you open the site on your phone using plain `http://<pc-ip>:5000`, many browsers will block the camera even if the same app works on desktop.
- For best mobile results, open the site in a modern Chrome, Edge, or Safari browser.

## Notes

- Browser camera access must be allowed for live monitoring.
- Automatic WhatsApp sending requires valid WhatsApp Cloud API credentials.
- Without Cloud API credentials, the app uses a manual WhatsApp deep-link fallback.
- Runtime settings and user data are stored in the `data/` folder as JSON files.

## License

This project is distributed under the MIT License. See [license.txt](license.txt) for details.
