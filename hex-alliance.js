/*
  Hex Alliance, based on a TemplateMo template
  https://templatemo.com/tm-630-helix-drift
*/

(function() {
    "use strict";

    /* every load, including reload, starts at the top */
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    window.scrollTo(0, 0);
    window.addEventListener("pageshow", function() {
        window.scrollTo(0, 0);
    });

    /* ------------------------------------------------------------------ data */
    /* content now lives in the markup, this script only reads it */

    var STEP = 0.34; /* radians per plate along the coil axis */
    var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ------------------------------------------------------------- elements */
    var stage = document.getElementById("stage");
    var capEl = document.getElementById("caption");
    var capNo = document.getElementById("capNo");
    var capTitle = document.getElementById("capTitle");
    var capDesc = document.getElementById("capDesc");
    var capMeta = document.getElementById("capMeta");
    var scrub = document.getElementById("scrub");
    var scrubFill = document.getElementById("scrubFill");
    var ticksBox = document.getElementById("ticks");
    var thumb = document.getElementById("thumb");
    var scrubLab = document.getElementById("scrubLabel");

    /* ------------------------------------------------------------ build DOM */
    var plates = [];
    var ticks = [];

    function fallback(i) {
        var a = "%23DDE7F2",
            b = "%2396B1D0";
        return "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>" +
            "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
            "<stop offset='0' stop-color='" + a + "'/><stop offset='1' stop-color='" + b + "'/>" +
            "</linearGradient></defs><rect width='640' height='400' fill='url(%23g)'/>" +
            "<text x='40' y='340' font-family='Georgia,serif' font-size='120' fill='rgba(255,255,255,.72)'>" +
            (i < 9 ? "0" + (i + 1) : (i + 1)) + "</text></svg>\")";
    }

    var PLATES = [];
    var nodes = stage.querySelectorAll(".plate");
    var N = nodes.length;

    Array.prototype.forEach.call(nodes, function(el, i) {
        var no = (i < 9 ? "0" + (i + 1) : "" + (i + 1));
        var info = el.querySelector(".plate-info");
        var h = info ? info.querySelector("h2") : null;
        var pp = info ? info.querySelector("p") : null;

        var p = {
            t: h ? h.textContent.trim() : "Plate " + no,
            d: pp ? pp.textContent.trim() : "",
            role: el.dataset.role || "",
            color: el.style.getPropertyValue("--branch-color")
        };
        PLATES.push(p);

        var m = el.querySelector(".plate-media");
        var tag = el.querySelector(".plate-no");
        if (tag && !tag.textContent.trim()) tag.textContent = no + " / 0" + nodes.length;
        el.setAttribute("aria-label", p.t);
        el.dataset.i = i;

        plates.push({
            el: el,
            media: m,
            data: p
        });

        /* no img tags anywhere, so the native ghost drag can never fire */
        var src = el.dataset.img;
        if (src) {
            var pre = new Image();
            pre.onload = function() {
                m.style.backgroundImage = "url('" + pre.src + "')";
            };
            pre.onerror = function() {
                m.style.backgroundImage = fallback(i);
            };
            pre.src = src;
        } else {
            m.style.backgroundImage = fallback(i);
        }

        var tk = document.createElement("i");
        tk.className = "tick";
        tk.style.left = (i / (nodes.length - 1) * 100) + "%";
        ticksBox.appendChild(tk);
        ticks.push(tk);
    });

    /* --------------------------------------------------------------- state */
    var pos = 0,
        target = 0,
        raf = 0,
        running = false;
    var settled = -1;
    var RX = 600,
        RY = 54,
        COIL = 0.9,
        FALL = 0.52;

    function readVars() {
        var cs = getComputedStyle(document.documentElement);
        /* parseFloat("0") is falsy, so || would silently replace a legitimate 0
           with the fallback, which made coil rise 0 snap back to 54 */
        function num(name, fb) {
            var v = parseFloat(cs.getPropertyValue(name));
            return isNaN(v) ? fb : v;
        }
        RX = num("--rx", 600);
        RY = num("--ry", 54);
        COIL = num("--coil", 0.9);
        FALL = num("--fall", 0.52);
    }
    readVars();

    var range = 5;

    function readRange() {
        range = window.innerWidth < 900 ? 3 : 5;
    }
    readRange();

    /* --------------------------------------------------------------- render */
    function render() {
        var i, p, d, a, th, x, y, rotY, rotZ, sc, op, sat, bl, near = 999,
            nearI = 0;

        for (i = 0; i < N; i++) {
            p = plates[i];
            d = ((i - pos + N / 2 + N * 2) % N) - N / 2;
            a = Math.abs(d);

            if (a > range + 0.5) {
                if (p.el.style.display !== "none") p.el.style.display = "none";
                continue;
            }
            if (p.el.style.display === "none") p.el.style.display = "";

            if (a < near) {
                near = a;
                nearI = i;
            }

            th = d * STEP;
            x = Math.sin(th) * RX;
            y = -Math.sin(d * COIL) * RY;
            rotY = -th * 57.2958 * 0.85;
            rotZ = d * 1.4;

            sc = Math.max(0.36, 1 / (1 + FALL * Math.pow(a, 1.15)));
            op = Math.max(0.14, 1 - 0.34 * a);
            sat = 0.28 + 0.72 / (1 + 0.9 * a);
            bl = (a < 1.6 || window.innerWidth < 900) ? 0 : Math.min(2.2, (a - 1.6) * 1.1);

            p.el.style.transform =
                "translate(-50%,-50%) translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0) rotateY(" +
                rotY.toFixed(2) + "deg) rotateZ(" + rotZ.toFixed(2) + "deg) scale(" + sc.toFixed(4) + ")";
            p.el.style.opacity = op.toFixed(3);

            /* restacking a 3D-transformed layer mid-composite flickers, so write only on change */
            var zi = Math.round(1000 - a * 10);
            if (zi !== p.zi) {
                p.el.style.zIndex = zi;
                p.zi = zi;
            }

            p.media.style.filter = "saturate(" + sat.toFixed(3) + ")" + (bl ? " blur(" + bl.toFixed(2) + "px)" : "");
            p.el.classList.toggle("is-centre", a < 0.5);
        }

        paintScrub();
        if (nearI !== settled) setCaption(nearI);
    }

    function loop() {
        pos += (target - pos) * 0.14;
        if (Math.abs(target - pos) < 0.0004) {
            pos = target;
            running = false;
            render();
            return;
        }
        render();
        raf = requestAnimationFrame(loop);
    }

    function kick() {
        /* keep pos and target from drifting far from the ring */
        if (target > N * 2 || target < -N * 2) {
            var k = Math.round(target / N) * N;
            target -= k;
            pos -= k;
        }
        if (REDUCED) {
            pos = target;
            render();
            return;
        }
        if (!running) {
            running = true;
            raf = requestAnimationFrame(loop);
        }
    }

    /* -------------------------------------------------------------- caption */
    var swapTimer = 0;

    function setCaption(i) {
        settled = i;
        var p = PLATES[i];
        clearTimeout(swapTimer);
        capEl.classList.add("swap");
        swapTimer = setTimeout(function() {
            capNo.textContent = (i < 9 ? "0" + (i + 1) : (i + 1));
            capTitle.textContent = p.t;
            capDesc.textContent = p.d;
            capMeta.textContent = p.role;
            capEl.style.setProperty("--branch-color", p.color);
            capEl.classList.remove("swap");
        }, REDUCED ? 0 : 160);

        scrub.setAttribute("aria-valuenow", i + 1);
        scrub.setAttribute("aria-valuetext", (i + 1) + " trên " + N + ", " + p.t);
        scrubLab.textContent = (i < 9 ? "0" + (i + 1) : (i + 1)) + " / 0" + N;
        for (var k = 0; k < N; k++) ticks[k].classList.toggle("on", k === i);
    }

    /* ---------------------------------------------------------------- scrub */
    function ringPos() {
        return ((pos % N) + N) % N; /* 0 .. N, the last unit is the wrap gap */
    }

    function paintScrub() {
        var v = ringPos(),
            frac;
        /* Plates map across the track, then the wrap segment sweeps the thumb
           back to the start instead of parking it at the far right. */
        if (v <= N - 1) frac = v / (N - 1);
        else frac = 1 - (v - (N - 1));
        frac = Math.max(0, Math.min(1, frac));
        var w = scrub.clientWidth;
        scrubFill.style.width = (frac * 100) + "%";
        thumb.style.left = (frac * w) + "px";
    }

    function scrubTo(clientX) {
        var r = scrub.getBoundingClientRect();
        var frac = (clientX - r.left) / r.width;
        frac = Math.max(0, Math.min(1, frac));
        var want = frac * (N - 1);
        var base = Math.round((pos - want) / N) * N; /* nearest equivalent turn */
        target = want + base;
        kick();
    }

    var scrubbing = false;

    function endScrub(e) {
        if (!scrubbing) return;
        scrubbing = false;
        try {
            if (e && e.pointerId !== undefined) scrub.releasePointerCapture(e.pointerId);
        } catch (err) {}
        target = Math.round(target);
        kick();
    }
    scrub.addEventListener("pointerdown", function(e) {
        touchPause();
        scrubbing = true;
        try {
            scrub.setPointerCapture(e.pointerId);
        } catch (err) {}
        scrubTo(e.clientX);
        e.preventDefault();
    });
    scrub.addEventListener("pointermove", function(e) {
        if (scrubbing) scrubTo(e.clientX);
    });
    scrub.addEventListener("pointerup", endScrub);
    scrub.addEventListener("pointercancel", endScrub);
    scrub.addEventListener("lostpointercapture", endScrub);
    window.addEventListener("pointerup", endScrub);
    window.addEventListener("blur", endScrub);
    scrub.addEventListener("dragstart", function(e) {
        e.preventDefault();
    });
    scrub.addEventListener("keydown", function(e) {
        var k = e.key;
        if (k === "ArrowLeft" || k === "ArrowDown") {
            target = Math.round(target) - 1;
            kick();
            e.preventDefault();
        } else if (k === "ArrowRight" || k === "ArrowUp") {
            target = Math.round(target) + 1;
            kick();
            e.preventDefault();
        } else if (k === "Home") {
            target = 0;
            pos = ((pos % N) + N) % N;
            kick();
            e.preventDefault();
        } else if (k === "End") {
            target = N - 1;
            kick();
            e.preventDefault();
        }
    });

    /* ------------------------------------------------------------ stage drag */
    var down = false,
        startX = 0,
        startT = 0,
        lastX = 0,
        lastT = 0,
        vel = 0,
        moved = false;

    function plateWidth() {
        return plates[0].el.offsetWidth || 400;
    }

    function onDown(e) {
        touchPause();
        down = true;
        moved = false;
        startX = lastX = e.clientX;
        startT = target;
        lastT = performance.now();
        vel = 0;
        stage.classList.add("grabbing");
        try {
            stage.setPointerCapture(e.pointerId);
        } catch (err) {}
    }

    function onMove(e) {
        if (!down) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        target = startT - dx / (plateWidth() * 0.62);
        var now = performance.now(),
            dt = now - lastT;
        if (dt > 0) {
            vel = (e.clientX - lastX) / dt;
            lastX = e.clientX;
            lastT = now;
        }
        kick();
    }

    function onUp(e) {
        if (!down) return;
        down = false;
        stage.classList.remove("grabbing");
        try {
            if (e && e.pointerId !== undefined) stage.releasePointerCapture(e.pointerId);
        } catch (err) {}
        var flick = -vel * 0.34;
        flick = Math.max(-2.2, Math.min(2.2, flick));
        target = Math.round(target + flick);
        kick();
    }
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("lostpointercapture", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointerup", scheduleResume);
    window.addEventListener("blur", onUp);
    stage.addEventListener("dragstart", function(e) {
        e.preventDefault();
    });

    var wheelOn = true,
        wheelInvert = false,
        wheelSens = 1,
        wheelSnap = 170;

    stage.addEventListener("wheel", function(e) {
        if (!wheelOn) return;
        var raw = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.0032 * wheelSens;
        if (wheelInvert) raw = -raw;
        raw = Math.max(-0.9, Math.min(0.9, raw));
        target += raw;
        kick();
        clearTimeout(stage._wt);
        stage._wt = setTimeout(function() {
            target = Math.round(target);
            kick();
        }, wheelSnap);
        e.preventDefault();
    }, {
        passive: false
    });

    /* -------------------------------------------------------- plate actions */
    plates.forEach(function(p, i) {
        p.el.addEventListener("click", function() {
            if (moved) return;
            var d = ((i - pos + N / 2 + N * 2) % N) - N / 2;
            if (Math.abs(d) < 0.5) {
                p.el.classList.add("press");
                setTimeout(function() {
                    p.el.classList.remove("press");
                }, 140);
                return;
            }
            target = Math.round(pos + d);
            kick();
        });
        p.el.addEventListener("keydown", function(e) {
            if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
            e.preventDefault();
            var d = ((i - pos + N / 2 + N * 2) % N) - N / 2;
            if (Math.abs(d) < 0.5) {
                p.el.classList.add("press");
                setTimeout(function() {
                    p.el.classList.remove("press");
                }, 140);
            } else {
                target = Math.round(pos + d);
                kick();
            }
        });
        p.el.addEventListener("focus", function() {
            var d = ((i - pos + N / 2 + N * 2) % N) - N / 2;
            if (Math.abs(d) > 0.5) {
                target = Math.round(pos + d);
                kick();
            }
        });
    });

    document.addEventListener("keydown", function(e) {
        if (document.body.classList.contains("lock-entry")) return;
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        if (e.key === "ArrowLeft") {
            target = Math.round(target) - 1;
            kick();
        } else if (e.key === "ArrowRight") {
            target = Math.round(target) + 1;
            kick();
        }
    });

    /* ------------------------------------------------- transport, autoplay */
    var tpBtn = document.getElementById("tpBtn");
    var tpFill = document.getElementById("tpFill");
    var tpVal = document.getElementById("tpVal");
    var tpMinus = document.getElementById("tpMinus");
    var tpPlus = document.getElementById("tpPlus");

    var DUR_MIN = 1,
        DUR_MAX = 9;
    var dur = 2,
        playing = false,
        tStart = 0,
        tRaf = 0;

    function tick(now) {
        if (!playing) return;
        var f = (now - tStart) / (dur * 1000);
        if (f >= 1) {
            tStart = now;
            f = 0;
            target = Math.round(target) + 1;
            kick();
        }
        tpFill.style.width = (f * 100).toFixed(2) + "%";
        tRaf = requestAnimationFrame(tick);
    }

    var resumeLater = false, idleTimer = 0;
    function touchPause() {
        clearTimeout(idleTimer);
        if (playing) {
            setPlay(false);
            resumeLater = true;
        }
    }
    function scheduleResume() {
        clearTimeout(idleTimer);
        if (!resumeLater) return;
        idleTimer = setTimeout(function() {
            if (resumeLater) {
                resumeLater = false;
                setPlay(true);
            }
        }, 4000);
    }

    function setPlay(on) {
        playing = on;
        tpBtn.classList.toggle("playing", on);
        tpBtn.setAttribute("aria-pressed", on ? "true" : "false");
        tpBtn.setAttribute("aria-label", on ? "Tạm dừng tự chuyển" : "Bật tự chuyển");
        cancelAnimationFrame(tRaf);
        if (on) {
            tStart = performance.now();
            tRaf = requestAnimationFrame(tick);
        } else tpFill.style.width = "0%";
    }

    function setDur(v) {
        dur = Math.max(DUR_MIN, Math.min(DUR_MAX, v));
        tpVal.textContent = dur + "s";
        tpMinus.disabled = dur <= DUR_MIN;
        tpPlus.disabled = dur >= DUR_MAX;
        if (playing) tStart = performance.now(); /* restart the run, never jump mid-fill */
        else tpFill.style.width = "0%";
    }

    tpBtn.addEventListener("click", function() {
        resumeLater = false;
        clearTimeout(idleTimer);
        setPlay(!playing);
    });
    tpMinus.addEventListener("click", function() {
        setDur(dur - 1);
    });
    tpPlus.addEventListener("click", function() {
        setDur(dur + 1);
    });

    document.addEventListener("visibilitychange", function() {
        if (!playing) return;
        if (document.hidden) {
            cancelAnimationFrame(tRaf);
        } else {
            tStart = performance.now();
            tRaf = requestAnimationFrame(tick);
        }
    });

    setDur(2);
    /* winds on load, change to setPlay(false) to start paused.
       REDUCED is honoured here so auto advancing motion never starts
       for someone who asked the OS for reduced motion */
    var entryLocked = !!document.getElementById("enterOverlay");
    if (entryLocked) document.body.classList.add("lock-entry");
    setPlay(entryLocked ? false : !REDUCED);

    /* -------------------------------------------------------- coil control */
    var fab = document.getElementById("fab");
    var panel = document.getElementById("panel");
    var closeBtn = document.getElementById("close");
    var sRx = document.getElementById("sRx"),
        sRy = document.getElementById("sRy"),
        sFall = document.getElementById("sFall");
    var vRx = document.getElementById("vRx"),
        vRy = document.getElementById("vRy"),
        vFall = document.getElementById("vFall");
    var stateEl = document.getElementById("state");
    var musicToggle = document.getElementById("musicToggle");
    var musicStatus = document.getElementById("musicStatus");
    var musicVolume = document.getElementById("musicVolume");
    var musicVolumeValue = document.getElementById("musicVolumeValue");
    var musicPlayer = null;
    var musicEnabled = true;
    var musicIsPlaying = false;
    var lastNonZeroVolume = parseInt(musicVolume.value, 10);

    var duckFactor = 1;
    var duckTimer = null;

    function guideVolume() {
        return parseInt(musicVolume.value, 10) / 100;
    }

    /* Loudness-matched: voice file ~ -15 LUFS, music file -14 LUFS trimmed to ~ -19 LUFS (x0.55).
       Both follow the same slider, so the voice stays ~4 LU above the music and ~10 LU while ducked. */
    var MUSIC_TRIM = 0.55;

    function effectiveMusicVolume() {
        return Math.round(parseInt(musicVolume.value, 10) * duckFactor * MUSIC_TRIM);
    }

    function duckMusicTo(target) {
        clearInterval(duckTimer);
        duckTimer = setInterval(function() {
            var diff = target - duckFactor;
            if (Math.abs(diff) < 0.02) {
                duckFactor = target;
                clearInterval(duckTimer);
            } else {
                duckFactor += diff * 0.2;
            }
            if (musicPlayer && musicPlayer.setVolume) musicPlayer.setVolume(effectiveMusicVolume());
        }, 60);
    }

    /* floating notes only appear 4s after the visitor's first touch of the page */
    var notesReady = false;
    ["pointerdown", "keydown", "touchstart"].forEach(function(name) {
        function arm() {
            ["pointerdown", "keydown", "touchstart"].forEach(function(n) {
                document.removeEventListener(n, arm, true);
            });
            setTimeout(function() {
                notesReady = true;
                updateMusicVisual();
            }, 4000);
        }
        document.addEventListener(name, arm, true);
    });

    function updateMusicVisual() {
        document.body.classList.toggle("music-playing",
            notesReady && musicEnabled && musicIsPlaying && parseInt(musicVolume.value, 10) > 0);
    }

    function setMusicEnabled(enabled) {
        if (enabled && parseInt(musicVolume.value, 10) === 0) {
            musicVolume.value = lastNonZeroVolume || 55;
            musicVolumeValue.textContent = musicVolume.value + "%";
            fill(musicVolume);
        }
        musicEnabled = enabled;
        musicToggle.textContent = enabled ? "Âm thanh: Bật" : "Âm thanh: Tắt";
        musicToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
        updateMusicVisual();

        if (!musicPlayer) {
            musicStatus.textContent = enabled ? "Đang tải nhạc nền..." : "Âm thanh đã tắt";
            return;
        }

        musicPlayer.setVolume(effectiveMusicVolume());
        if (enabled) {
            musicPlayer.unMute();
            musicPlayer.playVideo();
            musicStatus.textContent = "Đang bật âm thanh...";
        } else {
            musicPlayer.mute();
            musicStatus.textContent = "Âm thanh đã tắt";
        }
    }

    var userStarted = false;
    var enterOverlay = document.getElementById("enterOverlay");
    if (enterOverlay) {
        enterOverlay.addEventListener("click", function() {
            userStarted = true;
            enterOverlay.hidden = true;
            document.body.classList.remove("lock-entry");
            if (entryLocked) {
                entryLocked = false;
                setPlay(!REDUCED);
            }
            if (musicPlayer && musicEnabled) {
                musicPlayer.setVolume(effectiveMusicVolume());
                musicPlayer.unMute();
                musicPlayer.playVideo();
                musicStatus.textContent = "Nhạc nền đang phát";
            }
        });
    }

    musicToggle.addEventListener("click", function() {
        setMusicEnabled(!musicEnabled);
    });

    musicVolumeValue.textContent = musicVolume.value + "%";
    fill(musicVolume);
    musicVolume.addEventListener("input", function() {
        var volume = parseInt(musicVolume.value, 10);
        musicVolumeValue.textContent = volume + "%";
        fill(musicVolume);
        if (volume > 0) lastNonZeroVolume = volume;
        if (musicPlayer && musicPlayer.setVolume) {
            musicPlayer.setVolume(effectiveMusicVolume());
            if (musicEnabled && volume > 0 && musicPlayer.isMuted && musicPlayer.isMuted() && userStarted) {
                musicPlayer.unMute();
                musicPlayer.playVideo();
            }
        }
        updateMusicVisual();
        if (guideAudio) guideAudio.volume = guideVolume();
        var row = musicVolume.parentNode;
        row.classList.toggle("is-muted", volume === 0);
        row.classList.toggle("is-low", volume > 0 && volume < 40);
    });

    function stepVolume(delta) {
        var v = Math.max(0, Math.min(100, parseInt(musicVolume.value, 10) + delta));
        musicVolume.value = v;
        musicVolume.dispatchEvent(new Event("input"));
    }
    document.getElementById("volDown").addEventListener("click", function() { stepVolume(-10); });
    document.getElementById("volUp").addEventListener("click", function() { stepVolume(10); });
    document.getElementById("volMute").addEventListener("click", function() {
        if (parseInt(musicVolume.value, 10) === 0) {
            musicVolume.value = lastNonZeroVolume || 70;
        } else {
            musicVolume.value = 0;
        }
        musicVolume.dispatchEvent(new Event("input"));
    });
    musicVolume.dispatchEvent(new Event("input"));

    var gestureEvents = ["pointerdown", "keydown", "touchstart", "wheel"];
    var gestureArmed = false;

    function onFirstGesture(event) {
        if (event.target && event.target.id === "musicToggle") return;
        gestureEvents.forEach(function(name) {
            window.removeEventListener(name, onFirstGesture, true);
        });
        gestureArmed = false;
        if (!musicPlayer || !musicEnabled) return;
        musicPlayer.setVolume(effectiveMusicVolume());
        musicPlayer.unMute();
        musicPlayer.playVideo();
        musicStatus.textContent = "Nhạc nền đang phát";
    }

    function awaitFirstGesture() {
        if (gestureArmed) return;
        gestureArmed = true;
        musicStatus.textContent = "Chạm vào trang để bật tiếng nhạc nền.";
        gestureEvents.forEach(function(name) {
            window.addEventListener(name, onFirstGesture, true);
        });
    }

    function initializeMusicPlayer() {
        var bgAudio = document.getElementById("bgMusic");
        bgAudio.loop = true;
        bgAudio.preload = "auto";
        musicPlayer = {
            setVolume: function(v) {
                bgAudio.volume = Math.max(0, Math.min(1, v / 100));
            },
            mute: function() {
                bgAudio.muted = true;
            },
            unMute: function() {
                bgAudio.muted = false;
            },
            isMuted: function() {
                return bgAudio.muted;
            },
            playVideo: function() {
                var started = bgAudio.play();
                if (started && started.catch) started.catch(function() {
                    awaitFirstGesture();
                });
            },
            pauseVideo: function() {
                bgAudio.pause();
            }
        };
        bgAudio.addEventListener("playing", function() {
            musicIsPlaying = true;
            updateMusicVisual();
            if (musicEnabled) musicStatus.textContent = "Nhạc nền đang phát";
        });
        bgAudio.addEventListener("pause", function() {
            musicIsPlaying = false;
            updateMusicVisual();
        });
        bgAudio.addEventListener("error", function() {
            musicIsPlaying = false;
            updateMusicVisual();
            musicStatus.textContent = "Chưa có file audio/music.mp3.";
            musicToggle.disabled = true;
        });

        musicPlayer.setVolume(effectiveMusicVolume());
        if (musicEnabled && userStarted) {
            musicPlayer.unMute();
            musicPlayer.playVideo();
        } else if (musicEnabled) {
            musicPlayer.mute();
            musicPlayer.playVideo();
            awaitFirstGesture();
        } else {
            musicPlayer.mute();
        }
    }

    initializeMusicPlayer();
    var guideStart = document.getElementById("guideStart");
    var guidePause = document.getElementById("guidePause");
    var guideResume = document.getElementById("guideResume");
    var guideStatus = document.getElementById("guideStatus");
    var guideAudio = document.getElementById("guideAudio");

    function setGuideState(state, message) {
        guideStart.hidden = state !== "idle";
        guidePause.hidden = state !== "playing";
        guideResume.hidden = state !== "paused";
        guideStatus.textContent = message;
    }

    function playGuide() {
        guideAudio.volume = guideVolume();
        var playback = guideAudio.play();
        if (playback && typeof playback.catch === "function") {
            playback.catch(function() {
                setGuideState("idle", "Không phát được file hal-guide.wav.");
            });
        }
    }

    guideStart.addEventListener("click", function() {
        guideAudio.currentTime = 0;
        playGuide();
    });
    guidePause.addEventListener("click", function() {
        guideAudio.pause();
    });
    guideResume.addEventListener("click", playGuide);
    guideAudio.addEventListener("playing", function() {
        setGuideState("playing", "Đang giới thiệu HAL...");
        duckMusicTo(0.5);
    });
    guideAudio.addEventListener("pause", function() {
        duckMusicTo(1);
        if (guideAudio.ended) return;
        setGuideState("paused", "Đã tạm dừng. Chọn Đọc tiếp để tiếp tục.");
    });
    guideAudio.addEventListener("ended", function() {
        setGuideState("idle", "Đã đọc xong. Chọn Đọc để nghe lại.");
        duckMusicTo(1);
    });
    guideAudio.addEventListener("error", function() {
        setGuideState("idle", "Không tải được file hal-guide.wav.");
        duckMusicTo(1);
    });

    /* leaving the tab pauses voice and music together; returning resumes both */
    var guideWasPlaying = false;
    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            guideWasPlaying = !guideAudio.paused && !guideAudio.ended;
            if (guideWasPlaying) guideAudio.pause();
            if (musicPlayer && musicPlayer.pauseVideo) musicPlayer.pauseVideo();
        } else {
            if (musicPlayer && musicEnabled && userStarted && musicPlayer.playVideo) musicPlayer.playVideo();
            if (guideWasPlaying) playGuide();
            guideWasPlaying = false;
        }
    });

    function fill(el) {
        var v = (el.value - el.min) / (el.max - el.min) * 100;
        el.style.setProperty("--fill", v + "%");
    }

    function coilName(ry) {
        if (ry <= 18) return "Dạng phẳng";
        if (ry <= 44) return "Dạng thoải";
        if (ry <= 68) return "Dạng tiêu chuẩn";
        return "Dạng xoắn";
    }

    function applyVars() {
        document.documentElement.style.setProperty("--rx", sRx.value);
        document.documentElement.style.setProperty("--ry", sRy.value);
        document.documentElement.style.setProperty("--fall", sFall.value);
        vRx.textContent = sRx.value;
        vRy.textContent = sRy.value;
        vFall.textContent = parseFloat(sFall.value).toFixed(2);
        stateEl.textContent = coilName(parseFloat(sRy.value));
        readVars();
        render();
    }
    [sRx, sRy, sFall].forEach(function(el) {
        fill(el);
        el.addEventListener("input", function() {
            fill(el);
            applyVars();
        });
    });

    var wheelToggle = document.getElementById("wheelToggle"),
        wheelInvertToggle = document.getElementById("wheelInvert"),
        sWheel = document.getElementById("sWheel"),
        vWheel = document.getElementById("vWheel"),
        sWheelSnap = document.getElementById("sWheelSnap"),
        vWheelSnap = document.getElementById("vWheelSnap");

    function syncToggle(btn, on, label) {
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = label + (on ? "Bật" : "Tắt");
    }
    wheelToggle.addEventListener("click", function() {
        wheelOn = !wheelOn;
        syncToggle(wheelToggle, wheelOn, "Lăn chuột: ");
    });
    wheelInvertToggle.addEventListener("click", function() {
        wheelInvert = !wheelInvert;
        syncToggle(wheelInvertToggle, wheelInvert, "Đảo chiều: ");
    });
    sWheel.addEventListener("input", function() {
        wheelSens = parseFloat(sWheel.value);
        vWheel.textContent = wheelSens.toFixed(1) + "x";
        fill(sWheel);
    });
    sWheelSnap.addEventListener("input", function() {
        wheelSnap = parseInt(sWheelSnap.value, 10);
        vWheelSnap.textContent = wheelSnap + "ms";
        fill(sWheelSnap);
    });
    fill(sWheel);
    fill(sWheelSnap);

    function setControl(open, focusIn) {
        panel.classList.toggle("open", open);
        fab.classList.toggle("gone", open);
        document.body.classList.toggle("sheet-open", open);
        fab.setAttribute("aria-expanded", open ? "true" : "false");
        if (open && focusIn) sRx.focus();
        if (!open && focusIn) fab.focus();
    }
    fab.addEventListener("click", function() {
        setControl(true, true);
    });
    closeBtn.addEventListener("click", function() {
        setControl(false, true);
    });
    setControl(false, false);

    /* ---------------------------------------------------------- drawer, esc */
    var burger = document.getElementById("burger"),
        drawer = document.getElementById("drawer");

    function setDrawer(open) {
        drawer.classList.toggle("open", open);
        document.body.classList.toggle("lock", open);
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        burger.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
    }
    burger.addEventListener("click", function() {
        setDrawer(!drawer.classList.contains("open"));
    });
    drawer.addEventListener("click", function(e) {
        if (e.target.tagName === "A") setDrawer(false);
    });

    document.addEventListener("keydown", function(e) {
        if (e.key !== "Escape") return;
        if (drawer.classList.contains("open")) setDrawer(false);
        else if (panel.classList.contains("open")) setControl(false, true);
    });

    /* ---------------------------------------------------------- reveal, fit */
    var io = new IntersectionObserver(function(ents) {
        ents.forEach(function(en) {
            if (en.isIntersecting) {
                en.target.classList.add("in");
                io.unobserve(en.target);
            }
        });
    }, {
        threshold: .15
    });
    var rvs = document.querySelectorAll(".rv");
    for (var r = 0; r < rvs.length; r++) io.observe(rvs[r]);
    setTimeout(function() {
        for (var r2 = 0; r2 < rvs.length; r2++) rvs[r2].classList.add("in");
    }, 3000);

    /* controls fade after 5s without touch, scroll or key, and return on any interaction */
    var idleT = 0;
    function wake() {
        document.body.classList.remove("idle");
        clearTimeout(idleT);
        idleT = setTimeout(function() {
            document.body.classList.add("idle");
        }, 5000);
    }
    ["pointerdown", "pointermove", "touchstart", "touchmove", "scroll", "wheel", "keydown"].forEach(function(n) {
        window.addEventListener(n, wake, { passive: true, capture: true });
    });
    wake();
    var rt = 0;
    window.addEventListener("resize", function() {
        clearTimeout(rt);
        rt = setTimeout(function() {
            readVars();
            readRange();
            render();
        }, 120);
    });

    /* ------------------------------------------------------------------ go */
    setCaption(0);
    render();
})();
