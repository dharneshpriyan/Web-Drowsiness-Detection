(() => {
    const topbar = document.getElementById("topbar");
    let lastScrollY = window.scrollY;

    const syncTopbar = () => {
        if (!topbar) {
            return;
        }

        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > lastScrollY;
        topbar.classList.toggle("topbar-scrolled", currentScrollY > 18);
        topbar.classList.toggle("topbar-hidden", scrollingDown && currentScrollY > 140);
        lastScrollY = currentScrollY;
    };

    syncTopbar();
    window.addEventListener("scroll", syncTopbar, { passive: true });

    document.querySelectorAll("[data-switch-root]").forEach((root) => {
        const inputId = root.getAttribute("data-input-id");
        const targetInput = inputId ? document.getElementById(inputId) : null;
        const buttons = Array.from(root.querySelectorAll("[data-switch-value]"));

        const setActive = (value) => {
            if (targetInput) {
                targetInput.value = value;
            }
            buttons.forEach((button) => {
                button.classList.toggle("active", button.getAttribute("data-switch-value") === value);
            });
        };

        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                setActive(button.getAttribute("data-switch-value"));
            });
        });

        if (targetInput) {
            setActive(targetInput.value);
        }
    });

    const cameraModeInput = document.getElementById("cameraModeInput");
    const externalSourceWrap = document.getElementById("externalSourceWrap");
    if (cameraModeInput && externalSourceWrap) {
        const syncCameraMode = () => {
            externalSourceWrap.classList.toggle("is-hidden", cameraModeInput.value !== "external");
        };
        syncCameraMode();
        cameraModeInput.addEventListener("change", syncCameraMode);
        document.querySelectorAll('[data-switch-root][data-input-id="cameraModeInput"] [data-switch-value]').forEach((button) => {
            button.addEventListener("click", syncCameraMode);
        });
    }

    const settingsBackdrop = document.getElementById("settingsModalBackdrop");
    const settingsPanels = Array.from(document.querySelectorAll("[data-settings-panel]"));
    const settingsButtons = Array.from(document.querySelectorAll("[data-settings-target]"));
    const settingsCloseButtons = Array.from(document.querySelectorAll("[data-settings-close]"));
    const body = document.body;

    const openSettingsPanel = (panelId) => {
        if (!settingsBackdrop) {
            return;
        }

        settingsBackdrop.hidden = false;
        body.style.overflow = "hidden";
        settingsPanels.forEach((panel) => {
            panel.classList.toggle("is-hidden", panel.getAttribute("data-settings-panel") !== panelId);
        });
        settingsButtons.forEach((button) => {
            button.classList.toggle("active", button.getAttribute("data-settings-target") === panelId);
        });
    };

    const closeSettingsPanel = () => {
        if (!settingsBackdrop) {
            return;
        }

        settingsBackdrop.hidden = true;
        body.style.overflow = "";
        settingsPanels.forEach((panel) => {
            panel.classList.add("is-hidden");
        });
        settingsButtons.forEach((button) => {
            button.classList.remove("active");
        });
    };

    settingsButtons.forEach((button) => {
        button.addEventListener("click", () => {
            openSettingsPanel(button.getAttribute("data-settings-target"));
        });
    });

    settingsCloseButtons.forEach((button) => {
        button.addEventListener("click", closeSettingsPanel);
    });

    if (settingsBackdrop) {
        settingsBackdrop.addEventListener("click", (event) => {
            if (event.target === settingsBackdrop) {
                closeSettingsPanel();
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && settingsBackdrop && !settingsBackdrop.hidden) {
            closeSettingsPanel();
        }
    });

    if (window.location.hash === "#camera-settings") {
        openSettingsPanel("camera-settings");
    } else if (window.location.hash === "#whatsapp-alert") {
        openSettingsPanel("whatsapp-alert");
    }

    const overlay = document.getElementById("loadingOverlay");
    const fill = document.getElementById("loadingFill");
    const percent = document.getElementById("loadingPercent");
    const status = document.getElementById("loadingStatus");
    const loadingSteps = [
        "Preparing modules...",
        "Loading premium launcher UI...",
        "Starting camera configuration...",
        "Initializing face mesh engine...",
        "Preparing live monitoring page..."
    ];

    document.querySelectorAll("[data-loading-target]").forEach((button) => {
        button.addEventListener("click", (event) => {
            const target = button.dataset.loadingTarget || button.getAttribute("href");
            if (!target) {
                return;
            }

            if (!overlay) {
                window.location.assign(target);
                return;
            }

            event.preventDefault();
            overlay.hidden = false;

            let value = 0;
            let stepIndex = 0;

            const timer = setInterval(() => {
                value = Math.min(value + 5, 100);
                stepIndex = Math.min(stepIndex + 1, loadingSteps.length - 1);

                if (fill) {
                    fill.style.width = `${value}%`;
                }
                if (percent) {
                    percent.textContent = `${value}%`;
                }
                if (status) {
                    status.textContent = loadingSteps[stepIndex];
                }

                if (value >= 100) {
                    clearInterval(timer);
                    window.location.assign(target);
                }
            }, 120);

            // Fallback so the page never gets stuck on the loading screen.
            window.setTimeout(() => {
                window.location.assign(target);
            }, 2600);
        });
    });

    if (window.adminAnalytics) {
        const adminCanvas = document.getElementById("analyticsChart");
        if (adminCanvas) {
            const ctx = adminCanvas.getContext("2d");
            const events = Array.isArray(window.adminAnalytics) ? window.adminAnalytics : [];
            const points = events.map((event, index) => ({
                x: index,
                y: Number(event.attention_score || 0),
                label: event.timestamp || "",
            }));

            const renderAdminChart = () => {
                const dpr = window.devicePixelRatio || 1;
                const width = adminCanvas.clientWidth || 640;
                const height = 190;
                adminCanvas.width = width * dpr;
                adminCanvas.height = height * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, width, height);

                ctx.strokeStyle = "rgba(255,255,255,0.08)";
                ctx.lineWidth = 1;
                [24, 70, 116, 162].forEach((y) => {
                    ctx.beginPath();
                    ctx.moveTo(20, y);
                    ctx.lineTo(width - 20, y);
                    ctx.stroke();
                });

                if (points.length < 2) {
                    ctx.fillStyle = "rgba(220,232,245,0.8)";
                    ctx.font = "14px Segoe UI";
                    ctx.fillText("Analytics graph will appear after events are recorded.", 24, 98);
                    return;
                }

                const minY = 0;
                const maxY = 100;
                const chartLeft = 24;
                const chartRight = width - 24;
                const chartTop = 18;
                const chartBottom = height - 26;
                const chartWidth = chartRight - chartLeft;
                const chartHeight = chartBottom - chartTop;

                const normalized = points.map((point, index) => {
                    const x = chartLeft + (index / (points.length - 1)) * chartWidth;
                    const y = chartBottom - ((point.y - minY) / (maxY - minY)) * chartHeight;
                    return { ...point, x, y };
                });

                const gradient = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
                gradient.addColorStop(0, "rgba(25, 212, 255, 0.28)");
                gradient.addColorStop(1, "rgba(25, 212, 255, 0.02)");

                ctx.beginPath();
                ctx.moveTo(normalized[0].x, chartBottom);
                normalized.forEach((point) => ctx.lineTo(point.x, point.y));
                ctx.lineTo(normalized[normalized.length - 1].x, chartBottom);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();

                ctx.beginPath();
                normalized.forEach((point, index) => {
                    if (index === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                });
                ctx.strokeStyle = "#43d3ff";
                ctx.lineWidth = 3;
                ctx.stroke();

                normalized.forEach((point) => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = "#ffd268";
                    ctx.fill();
                });
            };

            renderAdminChart();
            window.addEventListener("resize", renderAdminChart);
        }
    }

    if (!window.monitorConfig) {
        return;
    }

    const statusValue = document.getElementById("statusValue");
    const driverValue = document.getElementById("driverValue");
    const attentionValue = document.getElementById("attentionValue");
    const fpsValue = document.getElementById("fpsValue");
    const earValue = document.getElementById("earValue");
    const marValue = document.getElementById("marValue");
    const alarmAudio = document.getElementById("alarmAudio");
    const videoAlert = document.getElementById("videoAlert");
    const statusBadge = document.getElementById("statusBadge");
    const attentionFill = document.getElementById("attentionFill");
    const statusLine = document.getElementById("statusLine");
    const stateLabel = document.getElementById("stateLabel");
    const stateDescription = document.getElementById("stateDescription");
    const attentionBand = document.getElementById("attentionBand");
    const monitorClock = document.getElementById("monitorClock");
    const fullscreenBtn = document.getElementById("fullscreenBtn");
    const monitorStage = document.getElementById("monitorStage");
    const videoFeed = document.getElementById("videoFeed");
    const cameraSource = document.getElementById("cameraSource");
    const cameraBanner = document.getElementById("cameraBanner");
    const cameraBannerTitle = document.getElementById("cameraBannerTitle");
    const cameraBannerMessage = document.getElementById("cameraBannerMessage");
    const startCameraBtn = document.getElementById("startCameraBtn");
    const frameCapture = document.getElementById("frameCapture");
    const frameContext = frameCapture ? frameCapture.getContext("2d", { willReadFrequently: false }) : null;
    let browserStream = null;
    let frameLoopTimer = null;
    let frameRequestInFlight = false;
    let adaptiveCaptureWidth = 960;
    let adaptiveDelay = 90;
    let smoothedRoundTrip = 0;
    let lastCanvasWidth = 0;
    let lastCanvasHeight = 0;
    let startingCamera = false;

    if (frameContext) {
        frameContext.imageSmoothingEnabled = true;
        frameContext.imageSmoothingQuality = "high";
    }

    const getFullscreenElement = () => (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
    );

    const syncFullscreenLabel = () => {
        if (!fullscreenBtn) {
            return;
        }
        fullscreenBtn.textContent = getFullscreenElement() ? "Exit Fullscreen" : "Enter Fullscreen";
    };

    if (fullscreenBtn && monitorStage) {
        fullscreenBtn.addEventListener("click", async () => {
            try {
                if (getFullscreenElement()) {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                } else {
                    if (monitorStage.requestFullscreen) {
                        await monitorStage.requestFullscreen();
                    } else if (monitorStage.webkitRequestFullscreen) {
                        monitorStage.webkitRequestFullscreen();
                    } else if (monitorStage.msRequestFullscreen) {
                        monitorStage.msRequestFullscreen();
                    }
                }
            } catch (error) {
                console.error(error);
            }
            syncFullscreenLabel();
        });

        document.addEventListener("fullscreenchange", syncFullscreenLabel);
        document.addEventListener("webkitfullscreenchange", syncFullscreenLabel);
        document.addEventListener("msfullscreenchange", syncFullscreenLabel);
        syncFullscreenLabel();
    }

    const updateClock = () => {
        if (!monitorClock) {
            return;
        }
        const now = new Date();
        monitorClock.textContent = now.toLocaleTimeString();
    };

    const isMobileViewport = () => window.matchMedia("(max-width: 760px)").matches;

    const isSecureOrigin = () => (
        window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    );

    const setCameraBanner = (title, message, showButton = true) => {
        if (!cameraBanner) {
            return;
        }
        cameraBanner.hidden = false;
        cameraBanner.style.display = "grid";
        if (cameraBannerTitle) {
            cameraBannerTitle.textContent = title;
        }
        if (cameraBannerMessage) {
            cameraBannerMessage.textContent = message;
        }
        if (startCameraBtn) {
            startCameraBtn.hidden = !showButton;
            startCameraBtn.disabled = startingCamera;
            startCameraBtn.textContent = startingCamera ? "Starting..." : "Start Camera";
        }
    };

    const hideCameraBanner = () => {
        if (cameraBanner) {
            cameraBanner.hidden = true;
            cameraBanner.style.display = "none";
        }
    };

    const isBrowserCameraActive = () => {
        if (!browserStream) {
            return false;
        }
        const activeTracks = browserStream.getVideoTracks().filter((track) => track.readyState === "live");
        return activeTracks.length > 0 && cameraSource && cameraSource.readyState >= 2;
    };

    const getAttentionMeta = (score) => {
        if (score >= 80) {
            return {
                label: "Excellent",
                color: "linear-gradient(90deg, #8cffb6, #7ce5ff)",
            };
        }
        if (score >= 60) {
            return {
                label: "Good",
                color: "linear-gradient(90deg, #7ce5ff, #5ea0ff)",
            };
        }
        if (score >= 40) {
            return {
                label: "Warning",
                color: "linear-gradient(90deg, #ffd37a, #ffb35e)",
            };
        }
        return {
            label: "Critical",
            color: "linear-gradient(90deg, #ff8798, #ff4f68)",
        };
    };

    const getStateCopy = (status) => {
        if (status === "NO CAMERA") {
            return {
                label: "Camera Not Available",
                description: "The selected camera source could not be opened. Check the source and make sure no other app is using the camera.",
            };
        }
        if (status === "DROWSY") {
            return {
                label: "Drowsiness Alert",
                description: "Eyes appear closed for extended frames. Alarm logic is active.",
            };
        }
        if (status === "YAWNING") {
            return {
                label: "Yawn Detected",
                description: "Mouth aspect ratio crossed the configured threshold.",
            };
        }
        if (status === "DISTRACTED") {
            return {
                label: "Head Distracted",
                description: "Head pose suggests the driver is looking away from the road.",
            };
        }
        return {
            label: "Monitoring Stable",
            description: "The detector is tracking face landmarks and awaiting abnormal behavior.",
        };
    };

    const applyMonitorData = (data) => {
        if (data.camera_ready || isBrowserCameraActive()) {
            hideCameraBanner();
        }

        statusValue.textContent = data.status;
        driverValue.textContent = data.driver_name;
        attentionValue.textContent = `${data.attention_score}%`;
        fpsValue.textContent = data.fps;
        earValue.textContent = Number(data.ear || 0).toFixed(2);
        marValue.textContent = Number(data.mar || 0).toFixed(2);
        if (statusLine) {
            statusLine.textContent = `STATUS: ${data.status}`;
            statusLine.style.color =
                data.status === "DROWSY" ? "#FF3B3B" :
                data.status === "YAWNING" ? "#FFA726" :
                data.status === "DISTRACTED" ? "#FF60FF" : "#00FF78";
        }
        if (statusBadge) {
            statusBadge.textContent = data.status;
            statusBadge.className = `status-badge ${String(data.status).toLowerCase()}`;
        }
        if (attentionFill) {
            const meta = getAttentionMeta(data.attention_score);
            attentionFill.style.width = `${Math.max(0, Math.min(100, data.attention_score))}%`;
            attentionFill.style.background = meta.color;
            if (attentionBand) {
                attentionBand.textContent = meta.label;
            }
        }
        if (stateLabel || stateDescription) {
            const state = getStateCopy(data.status);
            if (stateLabel) {
                stateLabel.textContent = state.label;
            }
            if (stateDescription) {
                stateDescription.textContent = data.camera_error || state.description;
            }
        }

        const isAlert = data.alert_active || data.status === "DROWSY";
        videoAlert.classList.toggle("active", isAlert);

        if (isAlert) {
            alarmAudio.play().catch(() => {});
        } else {
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
        }
    };

    const loadInitialStatus = async () => {
        try {
            const response = await fetch(window.monitorConfig.statusUrl, { cache: "no-store" });
            const data = await response.json();
            applyMonitorData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const stopBrowserStream = (preserveStartingState = false) => {
        if (frameLoopTimer) {
            window.clearTimeout(frameLoopTimer);
            frameLoopTimer = null;
        }
        if (browserStream) {
            browserStream.getTracks().forEach((track) => track.stop());
            browserStream = null;
        }
        if (!preserveStartingState) {
            startingCamera = false;
            if (startCameraBtn) {
                startCameraBtn.disabled = false;
                startCameraBtn.textContent = "Start Camera";
            }
        }
    };

    const queueNextFrame = (delay = adaptiveDelay) => {
        frameLoopTimer = window.setTimeout(sendFrameToBackend, delay);
    };

    const tuneCaptureProfile = (roundTripMs) => {
        smoothedRoundTrip = smoothedRoundTrip === 0
            ? roundTripMs
            : (smoothedRoundTrip * 0.72) + (roundTripMs * 0.28);

        if (smoothedRoundTrip > 260 && adaptiveCaptureWidth > 720) {
            adaptiveCaptureWidth = Math.max(720, adaptiveCaptureWidth - 80);
        } else if (smoothedRoundTrip < 150 && adaptiveCaptureWidth < 960) {
            adaptiveCaptureWidth = Math.min(960, adaptiveCaptureWidth + 80);
        }

        adaptiveDelay = Math.max(55, Math.min(135, Math.round(smoothedRoundTrip * 0.35)));
    };

    const sendFrameToBackend = async () => {
        if (!cameraSource || !frameCapture || !frameContext) {
            return;
        }
        if (frameRequestInFlight || !browserStream || cameraSource.readyState < 2) {
            queueNextFrame(90);
            return;
        }

        const sourceWidth = cameraSource.videoWidth || 1280;
        const sourceHeight = cameraSource.videoHeight || 720;
        const renderWidth = Math.min(sourceWidth, adaptiveCaptureWidth);
        const renderHeight = Math.max(480, Math.round((sourceHeight / sourceWidth) * renderWidth));

        if (renderWidth !== lastCanvasWidth || renderHeight !== lastCanvasHeight) {
            frameCapture.width = renderWidth;
            frameCapture.height = renderHeight;
            lastCanvasWidth = renderWidth;
            lastCanvasHeight = renderHeight;
        }

        frameContext.drawImage(cameraSource, 0, 0, renderWidth, renderHeight);

        frameRequestInFlight = true;
        const requestStartedAt = performance.now();
        frameCapture.toBlob(async (blob) => {
            if (!blob) {
                frameRequestInFlight = false;
                queueNextFrame(110);
                return;
            }

            const formData = new FormData();
            formData.append("frame", blob, "frame.jpg");

            try {
                const response = await fetch(window.monitorConfig.frameUrl, {
                    method: "POST",
                    body: formData,
                    cache: "no-store",
                });
                const data = await response.json();
                tuneCaptureProfile(performance.now() - requestStartedAt);
                if (data.ok) {
                    hideCameraBanner();
                    if (videoFeed) {
                        videoFeed.src = `data:image/jpeg;base64,${data.frame}`;
                    }
                    applyMonitorData(data);
                } else if (stateDescription) {
                    stateDescription.textContent = data.error || "Unable to process camera frames.";
                }
            } catch (error) {
                console.error(error);
                tuneCaptureProfile(320);
                if (stateDescription) {
                    stateDescription.textContent = "Connection lost while sending frames for detection.";
                }
            } finally {
                frameRequestInFlight = false;
                queueNextFrame();
            }
        }, "image/jpeg", 0.88);
    };

    const buildCameraProfiles = () => {
        const mobile = isMobileViewport();
        const baseProfiles = mobile
            ? [
                {
                    audio: false,
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 960 },
                        height: { ideal: 540 },
                        frameRate: { ideal: 20, max: 24 },
                    },
                },
                {
                    audio: false,
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 15, max: 20 },
                    },
                },
            ]
            : [
                {
                    audio: false,
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 24, max: 30 },
                    },
                },
            ];

        baseProfiles.push(
            { audio: false, video: { facingMode: { ideal: "user" } } },
            { audio: false, video: true },
        );

        return baseProfiles;
    };

    const startBrowserCamera = async () => {
        if (startingCamera) {
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (stateLabel) {
                stateLabel.textContent = "Camera Unsupported";
            }
            if (stateDescription) {
                stateDescription.textContent = "This browser does not support live camera access for the monitor page.";
            }
            setCameraBanner(
                "Browser Camera Unsupported",
                "Open the site in a modern Chrome, Edge, or Safari browser to use live monitoring.",
                false,
            );
            return;
        }

        if (!isSecureOrigin()) {
            if (stateLabel) {
                stateLabel.textContent = "HTTPS Required";
            }
            if (stateDescription) {
                stateDescription.textContent = "Mobile browsers require HTTPS or localhost before allowing camera access.";
            }
            setCameraBanner(
                "Secure Connection Required",
                "Open this site using HTTPS on your phone. Mobile browsers usually block camera access on plain HTTP network URLs.",
                false,
            );
            return;
        }

        startingCamera = true;
        setCameraBanner("Starting Camera", "Requesting camera access from the browser...", true);

        try {
            await fetch(window.monitorConfig.startUrl, { method: "POST" });
            stopBrowserStream(true);

            let stream = null;
            let lastError = null;
            const profiles = buildCameraProfiles();

            for (const constraints of profiles) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    break;
                } catch (error) {
                    lastError = error;
                }
            }

            if (!stream) {
                throw lastError || new Error("Unable to access camera.");
            }

            browserStream = stream;
            cameraSource.srcObject = browserStream;
            await cameraSource.play();
            hideCameraBanner();
            queueNextFrame(isMobileViewport() ? 110 : 80);
        } catch (error) {
            console.error(error);
            if (stateLabel) {
                stateLabel.textContent = "Camera Permission Needed";
            }
            if (stateDescription) {
                stateDescription.textContent = "Allow browser camera access so detection can start on the web version.";
            }
            setCameraBanner(
                "Camera Permission Needed",
                "Allow camera access and try again. If you are on a phone, make sure the page is opened over HTTPS.",
                true,
            );
        } finally {
            startingCamera = false;
            if (startCameraBtn) {
                startCameraBtn.disabled = false;
                startCameraBtn.textContent = "Start Camera";
            }
        }
    };

    if (startCameraBtn) {
        startCameraBtn.addEventListener("click", startBrowserCamera);
    }

    updateClock();
    setInterval(updateClock, 1000);
    loadInitialStatus();
    startBrowserCamera();

    window.addEventListener("beforeunload", () => {
        stopBrowserStream();
        navigator.sendBeacon(window.monitorConfig.stopUrl);
    });
})();
