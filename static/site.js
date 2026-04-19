(() => {
    const topbar = document.getElementById("topbar");
    const mobileNavToggle = document.getElementById("mobileNavToggle");
    const siteNav = document.getElementById("siteNav");
    let lastScrollY = window.scrollY;
    const mobileNavMedia = window.matchMedia("(max-width: 760px)");

    const setMobileNavState = (open) => {
        if (!topbar || !mobileNavToggle || !siteNav) {
            return;
        }

        const isOpen = Boolean(open) && mobileNavMedia.matches;
        topbar.classList.toggle("mobile-nav-open", isOpen);
        mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
        mobileNavToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    };

    const syncTopbar = () => {
        if (!topbar) {
            return;
        }

        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > lastScrollY;
        topbar.classList.toggle("topbar-scrolled", currentScrollY > 18);
        topbar.classList.toggle("topbar-hidden", scrollingDown && currentScrollY > 140 && !topbar.classList.contains("mobile-nav-open"));
        lastScrollY = currentScrollY;
    };

    syncTopbar();
    window.addEventListener("scroll", syncTopbar, { passive: true });

    if (mobileNavToggle && topbar && siteNav) {
        mobileNavToggle.addEventListener("click", () => {
            setMobileNavState(!topbar.classList.contains("mobile-nav-open"));
        });

        siteNav.querySelectorAll("a, button").forEach((item) => {
            item.addEventListener("click", () => {
                setMobileNavState(false);
            });
        });

        document.addEventListener("click", (event) => {
            if (!mobileNavMedia.matches || !topbar.classList.contains("mobile-nav-open")) {
                return;
            }

            if (!topbar.contains(event.target)) {
                setMobileNavState(false);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && topbar.classList.contains("mobile-nav-open")) {
                setMobileNavState(false);
            }
        });

        const handleMobileNavViewport = (event) => {
            if (!event.matches) {
                setMobileNavState(false);
            }
        };

        if (typeof mobileNavMedia.addEventListener === "function") {
            mobileNavMedia.addEventListener("change", handleMobileNavViewport);
        } else if (typeof mobileNavMedia.addListener === "function") {
            mobileNavMedia.addListener(handleMobileNavViewport);
        }
    }

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
    const monitorUsesBrowserCamera = window.monitorConfig.cameraMode !== "external";
    let browserStream = null;
    let frameLoopTimer = null;
    let statusPollTimer = null;
    let frameRequestInFlight = false;
    let adaptiveCaptureWidth = 460;
    let adaptiveDelay = 110;
    let smoothedRoundTrip = 0;
    let lastCanvasWidth = 0;
    let lastCanvasHeight = 0;
    let lastWhatsappAlertEventCount = 0;
    let startingCamera = false;
    let mobileFullscreenFallback = false;
    let audioUnlocked = false;

    if (frameContext) {
        frameContext.imageSmoothingEnabled = true;
        frameContext.imageSmoothingQuality = "high";
    }

    const getFullscreenElement = () => (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
    );

    const isFullscreenActive = () => Boolean(getFullscreenElement() || mobileFullscreenFallback);

    const setMobileFullscreenFallback = (enabled) => {
        mobileFullscreenFallback = enabled;
        document.body.classList.toggle("monitor-mobile-fullscreen", enabled);
        if (monitorStage) {
            monitorStage.classList.toggle("monitor-video-mobile-fullscreen", enabled);
        }
    };

    const lockLandscapeOrientation = async () => {
        if (!isMobileViewport() || !screen.orientation || !screen.orientation.lock) {
            return;
        }
        try {
            await screen.orientation.lock("landscape");
        } catch (error) {
            console.error(error);
        }
    };

    const unlockOrientation = () => {
        if (!screen.orientation || !screen.orientation.unlock) {
            return;
        }
        try {
            screen.orientation.unlock();
        } catch (error) {
            console.error(error);
        }
    };

    const setCameraPreviewMode = (showRawPreview) => {
        if (!cameraSource || !videoFeed) {
            return;
        }
        cameraSource.classList.toggle("preview-active", showRawPreview);
        cameraSource.hidden = !showRawPreview;
        videoFeed.classList.toggle("preview-hidden", showRawPreview);
        videoFeed.hidden = false;
    };

    const waitForCameraFrame = async (timeoutMs = 4000) => {
        if (!cameraSource) {
            return;
        }
        if (cameraSource.readyState >= 2 && cameraSource.videoWidth > 0 && cameraSource.videoHeight > 0) {
            return;
        }

        await new Promise((resolve, reject) => {
            let settled = false;
            const handleReady = () => {
                if (settled || cameraSource.readyState < 2 || cameraSource.videoWidth === 0) {
                    return;
                }
                settled = true;
                window.clearTimeout(timeoutId);
                cameraSource.removeEventListener("loadedmetadata", handleReady);
                cameraSource.removeEventListener("canplay", handleReady);
                resolve();
            };

            const timeoutId = window.setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                cameraSource.removeEventListener("loadedmetadata", handleReady);
                cameraSource.removeEventListener("canplay", handleReady);
                reject(new Error("Timed out while waiting for the camera preview."));
            }, timeoutMs);

            cameraSource.addEventListener("loadedmetadata", handleReady);
            cameraSource.addEventListener("canplay", handleReady);
        });
    };

    const requestMonitorFullscreen = async () => {
        if (!monitorStage) {
            return false;
        }

        if (monitorStage.requestFullscreen) {
            await monitorStage.requestFullscreen();
            return true;
        }
        if (monitorStage.webkitRequestFullscreen) {
            monitorStage.webkitRequestFullscreen();
            return true;
        }
        if (monitorStage.msRequestFullscreen) {
            monitorStage.msRequestFullscreen();
            return true;
        }
        if (cameraSource && cameraSource.webkitEnterFullscreen) {
            cameraSource.webkitEnterFullscreen();
            return true;
        }
        return false;
    };

    const exitMonitorFullscreen = async () => {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
            return true;
        }
        if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
            return true;
        }
        if (document.msExitFullscreen) {
            document.msExitFullscreen();
            return true;
        }
        return false;
    };

    const syncFullscreenLabel = () => {
        if (!fullscreenBtn) {
            return;
        }
        fullscreenBtn.textContent = isFullscreenActive() ? "Exit Fullscreen" : "Enter Fullscreen";
    };

    if (fullscreenBtn && monitorStage) {
        fullscreenBtn.addEventListener("click", async () => {
            try {
                if (isMobileViewport()) {
                    if (mobileFullscreenFallback) {
                        setMobileFullscreenFallback(false);
                        unlockOrientation();
                    } else {
                        setMobileFullscreenFallback(true);
                        await lockLandscapeOrientation();
                    }
                } else if (mobileFullscreenFallback) {
                    setMobileFullscreenFallback(false);
                } else if (getFullscreenElement()) {
                    const exited = await exitMonitorFullscreen();
                    if (!exited && isMobileViewport()) {
                        setMobileFullscreenFallback(false);
                    }
                } else {
                    let entered = false;
                    try {
                        entered = await requestMonitorFullscreen();
                    } catch (error) {
                        console.error(error);
                    }
                    if (!entered && isMobileViewport()) {
                        setMobileFullscreenFallback(true);
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

    const unlockAlarmAudio = async () => {
        if (!alarmAudio || audioUnlocked) {
            return true;
        }

        try {
            alarmAudio.volume = 1;
            alarmAudio.muted = false;
            const playPromise = alarmAudio.play();
            if (playPromise && typeof playPromise.then === "function") {
                await playPromise;
            }
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
            audioUnlocked = true;
            return true;
        } catch (error) {
            return false;
        }
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
        if (data.camera_ready || (monitorUsesBrowserCamera && isBrowserCameraActive())) {
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
            if (audioUnlocked) {
                alarmAudio.play().catch(() => {});
            }
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

    const startStatusPolling = () => {
        if (statusPollTimer) {
            window.clearInterval(statusPollTimer);
        }
        statusPollTimer = window.setInterval(loadInitialStatus, 1000);
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
        setCameraPreviewMode(false);
        if (cameraSource) {
            cameraSource.srcObject = null;
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

    const handleWhatsappAlert = (alertPayload) => {
        if (!alertPayload || !alertPayload.url) {
            return;
        }

        const eventCount = Number(alertPayload.event_count || 0);
        if (eventCount > 0 && eventCount <= lastWhatsappAlertEventCount) {
            return;
        }
        lastWhatsappAlertEventCount = eventCount;

        const popup = window.open(alertPayload.url, "_blank", "noopener,noreferrer");
        if (!popup) {
            window.location.href = alertPayload.url;
        }
    };

    const tuneCaptureProfile = (roundTripMs) => {
        smoothedRoundTrip = smoothedRoundTrip === 0
            ? roundTripMs
            : (smoothedRoundTrip * 0.72) + (roundTripMs * 0.28);

        if (smoothedRoundTrip > 250 && adaptiveCaptureWidth > 360) {
            adaptiveCaptureWidth = Math.max(360, adaptiveCaptureWidth - 40);
        } else if (smoothedRoundTrip < 120 && adaptiveCaptureWidth < 560) {
            adaptiveCaptureWidth = Math.min(560, adaptiveCaptureWidth + 40);
        }

        adaptiveDelay = Math.max(80, Math.min(170, Math.round(smoothedRoundTrip * 0.42)));
    };

    const sendFrameToBackend = async () => {
        if (!cameraSource || !frameCapture || !frameContext) {
            return;
        }
        if (!monitorUsesBrowserCamera) {
            return;
        }
        if (frameRequestInFlight || !browserStream || cameraSource.readyState < 2) {
            queueNextFrame(70);
            return;
        }

        const sourceWidth = cameraSource.videoWidth || 960;
        const sourceHeight = cameraSource.videoHeight || 540;
        const renderWidth = Math.min(sourceWidth, adaptiveCaptureWidth);
        const renderHeight = Math.max(220, Math.round((sourceHeight / sourceWidth) * renderWidth));

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
                queueNextFrame(85);
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
                const responseText = await response.text();
                let data = null;

                try {
                    data = responseText ? JSON.parse(responseText) : null;
                } catch (parseError) {
                    data = {
                        ok: false,
                        error: responseText || "The server returned an invalid response while processing camera frames.",
                    };
                }

                tuneCaptureProfile(performance.now() - requestStartedAt);
                if (response.ok && data && data.ok) {
                    hideCameraBanner();
                    setCameraPreviewMode(true);
                    applyMonitorData(data);
                    handleWhatsappAlert(data.whatsapp_alert);
                } else {
                    const errorMessage = (data && data.error)
                        ? data.error
                        : "Unable to process camera frames.";
                    if (stateLabel) {
                        stateLabel.textContent = "Backend Processing Error";
                    }
                    if (stateDescription) {
                        stateDescription.textContent = errorMessage;
                    }
                    setCameraBanner(
                        "Detection Backend Error",
                        errorMessage,
                        true,
                    );
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
        }, "image/jpeg", 0.5);
    };

    const buildCameraProfiles = () => {
        const mobile = isMobileViewport();
        const baseProfiles = mobile
            ? [
                {
                    audio: false,
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 480 },
                        height: { ideal: 360 },
                        frameRate: { ideal: 15, max: 18 },
                    },
                },
                {
                    audio: false,
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 360 },
                        height: { ideal: 270 },
                        frameRate: { ideal: 12, max: 15 },
                    },
                },
                {
                    audio: false,
                    video: {
                        facingMode: "user",
                    },
                },
            ]
            : [
                {
                    audio: false,
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 18, max: 24 },
                    },
                },
            ];

        if (!mobile) {
            baseProfiles.push(
                { audio: false, video: { facingMode: { ideal: "user" } } },
                { audio: false, video: true },
            );
        }

        return baseProfiles;
    };

    const startExternalCameraStream = async () => {
        startingCamera = true;
        setCameraBanner("Starting External Camera", "Connecting to the saved camera stream...", true);

        try {
            await unlockAlarmAudio();
            const response = await fetch(window.monitorConfig.startUrl, {
                method: "POST",
                cache: "no-store",
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data || !data.ok) {
                throw new Error((data && data.error) || "Unable to start the external camera stream.");
            }

            stopBrowserStream(true);
            setCameraPreviewMode(false);
            if (videoFeed) {
                videoFeed.src = `${window.monitorConfig.videoFeedUrl}?t=${Date.now()}`;
            }
            hideCameraBanner();
            await loadInitialStatus();
        } catch (error) {
            console.error(error);
            if (stateLabel) {
                stateLabel.textContent = "External Camera Error";
            }
            if (stateDescription) {
                stateDescription.textContent = error.message || "Unable to connect to the external stream.";
            }
            setCameraBanner(
                "External Camera Error",
                "Check the stream URL in camera settings and confirm the camera feed is reachable from this computer.",
                true,
            );
        } finally {
            startingCamera = false;
            if (startCameraBtn) {
                startCameraBtn.disabled = false;
                startCameraBtn.textContent = monitorUsesBrowserCamera ? "Start Camera" : "Reconnect Stream";
            }
        }
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
            await unlockAlarmAudio();
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
            cameraSource.muted = true;
            cameraSource.autoplay = true;
            cameraSource.setAttribute("playsinline", "true");
            cameraSource.setAttribute("webkit-playsinline", "true");
            await cameraSource.play();
            await waitForCameraFrame();
            setCameraPreviewMode(true);
            hideCameraBanner();
            queueNextFrame(isMobileViewport() ? 90 : 70);
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
        startCameraBtn.addEventListener("click", async () => {
            await unlockAlarmAudio();
            if (monitorUsesBrowserCamera) {
                startBrowserCamera();
            } else {
                startExternalCameraStream();
            }
        });
    }

    ["click", "touchstart"].forEach((eventName) => {
        document.addEventListener(eventName, () => {
            unlockAlarmAudio();
        }, { passive: true, once: true });
    });

    updateClock();
    setInterval(updateClock, 1000);
    loadInitialStatus();
    startStatusPolling();
    if (monitorUsesBrowserCamera) {
        startBrowserCamera();
    } else {
        setCameraPreviewMode(false);
        if (startCameraBtn) {
            startCameraBtn.textContent = "Reconnect Stream";
        }
        startExternalCameraStream();
    }

    window.addEventListener("beforeunload", () => {
        unlockOrientation();
        stopBrowserStream();
        if (statusPollTimer) {
            window.clearInterval(statusPollTimer);
            statusPollTimer = null;
        }
        navigator.sendBeacon(window.monitorConfig.stopUrl);
    });
})();
