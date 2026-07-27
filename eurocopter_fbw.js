// ==UserScript==
// @name         GeoFS EC-135 FBW (Angle Mode)
// @namespace    https://github.com/cyberterm
// @version      2026-07-24
// @description  Self-centering FBW System for GeoFS Helicopters
// @author       cyberterm
// @match        *://*.geo-fs.com/*
// @include      *://*.geo-fs.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ----------------------------------------
    // 1. CONFIGURATION
    // ----------------------------------------
    const FBW_CONFIG = {
        pitchSensitivity: 20,     // Max target pitch angle in degrees
        Kp_pitch: 0.02,           // Auto-leveling strength (Spring)
        Kd_pitch: 0.4,            // Dampening strength (Shock Absorber)

        rollSensitivity: 20,      // Max target roll angle in degrees
        Kp_roll: 0.02,
        Kd_roll: 0.4,

        yawDampThreshold: 0.5,
        yawDampStrength: 0.5
    };

    // State Tracking
    let lastHeading = 0;
    let lastPitch = 0;
    let lastRoll = 0;
    let animationFrameId;
    let fbwActive = false; // Starts disarmed

    // ----------------------------------------
    // 2. CORE MATH & PHYSICS
    // ----------------------------------------
    function updateSAS() {
        if (!fbwActive) return;

        try {
            // Read Current States (|| 0 prevents NaN crashes)
            let currentHeading = geofs.animation.values.heading360 || 0;
            let currentPitch = geofs.animation.values.atilt || 0;
            let currentRoll = geofs.animation.values.aroll || 0;

            let pitchInput = geofs.animation.values.pitch || 0;
            let rollInput = geofs.animation.values.roll || 0;
            let yawInput = geofs.animation.values.yaw || 0;

            if (lastHeading === 0 && lastPitch === 0 && lastRoll === 0) {
                lastHeading = currentHeading;
                lastPitch = currentPitch;
                lastRoll = currentRoll;
            }

            // YAW DAMPER
            let rotationDelta = lastHeading - currentHeading;
            if (rotationDelta > 180) rotationDelta -= 360;
            if (rotationDelta < -180) rotationDelta += 360;

            if (Math.abs(rotationDelta) <= FBW_CONFIG.yawDampThreshold) {
                geofs.animation.values.fbwYaw = yawInput + (rotationDelta * FBW_CONFIG.yawDampStrength);
            } else {
                geofs.animation.values.fbwYaw = yawInput;
            }

            // PITCH & ROLL FBW (Angle Mode / Attitude Hold)
            let pitchTarget = FBW_CONFIG.pitchSensitivity * -pitchInput;
            let pitchError = pitchTarget - currentPitch;
            let pitchRate = currentPitch - lastPitch;
            geofs.animation.values.fbwPitch = -((pitchError * FBW_CONFIG.Kp_pitch) - (pitchRate * FBW_CONFIG.Kd_pitch));

            let rollTarget = FBW_CONFIG.rollSensitivity * -rollInput;
            let rollError = rollTarget - currentRoll;
            let rollRate = currentRoll - lastRoll;
            geofs.animation.values.fbwRoll = -((rollError * FBW_CONFIG.Kp_roll) - (rollRate * FBW_CONFIG.Kd_roll));

            // Save states
            lastHeading = currentHeading;
            lastPitch = currentPitch;
            lastRoll = currentRoll;

        } catch (error) {
            // Silently catch errors
        }
    }

    function flightLoop() {
        if (window.geofs && geofs.animation && geofs.animation.values) {
            updateSAS();
        }
        animationFrameId = requestAnimationFrame(flightLoop);
    }

    // ----------------------------------------
    // 3. AIRCRAFT PART HOOKING
    // ----------------------------------------
    function hookSAS() {
        const parts = geofs.aircraft.instance.parts;
        if (parts.tailrotor && parts.tailrotor.animations[2]) parts.tailrotor.animations[2].value = "fbwYaw";

        // Pitch (Index 0)
        if (parts.cyclicLeft && parts.cyclicLeft.animations[0]) parts.cyclicLeft.animations[0].value = "fbwPitch";
        if (parts.cyclicRight && parts.cyclicRight.animations[0]) parts.cyclicRight.animations[0].value = "fbwPitch";
        if (parts.cyclicRotorNegative && parts.cyclicRotorNegative.animations[0]) parts.cyclicRotorNegative.animations[0].value = "fbwPitch";
        if (parts.cyclicRotorPositive && parts.cyclicRotorPositive.animations[0]) parts.cyclicRotorPositive.animations[0].value = "fbwPitch";

        // Roll (Index 1)
        if (parts.cyclicLeft && parts.cyclicLeft.animations[1]) parts.cyclicLeft.animations[1].value = "fbwRoll";
        if (parts.cyclicRight && parts.cyclicRight.animations[1]) parts.cyclicRight.animations[1].value = "fbwRoll";
        if (parts.cyclicRotorNegative && parts.cyclicRotorNegative.animations[1]) parts.cyclicRotorNegative.animations[1].value = "fbwRoll";
        if (parts.cyclicRotorPositive && parts.cyclicRotorPositive.animations[1]) parts.cyclicRotorPositive.animations[1].value = "fbwRoll";
    }

    function unhookSAS() {
        const parts = geofs.aircraft.instance.parts;
        if (parts.tailrotor && parts.tailrotor.animations[2]) parts.tailrotor.animations[2].value = "yaw";

        // Pitch
        if (parts.cyclicLeft && parts.cyclicLeft.animations[0]) parts.cyclicLeft.animations[0].value = "pitch";
        if (parts.cyclicRight && parts.cyclicRight.animations[0]) parts.cyclicRight.animations[0].value = "pitch";
        if (parts.cyclicRotorNegative && parts.cyclicRotorNegative.animations[0]) parts.cyclicRotorNegative.animations[0].value = "pitch";
        if (parts.cyclicRotorPositive && parts.cyclicRotorPositive.animations[0]) parts.cyclicRotorPositive.animations[0].value = "pitch";

        // Roll
        if (parts.cyclicLeft && parts.cyclicLeft.animations[1]) parts.cyclicLeft.animations[1].value = "roll";
        if (parts.cyclicRight && parts.cyclicRight.animations[1]) parts.cyclicRight.animations[1].value = "roll";
        if (parts.cyclicRotorNegative && parts.cyclicRotorNegative.animations[1]) parts.cyclicRotorNegative.animations[1].value = "roll";
        if (parts.cyclicRotorPositive && parts.cyclicRotorPositive.animations[1]) parts.cyclicRotorPositive.animations[1].value = "roll";
    }

    // ----------------------------------------
    // 4. INITIALIZATION
    // ----------------------------------------
    console.log("SAS Script waiting for GeoFS aircraft to load...");
    let waitForReady = setInterval(function() {
        if (typeof geofs !== 'undefined' && geofs.aircraft && geofs.aircraft.instance && geofs.aircraft.instance.parts) {
            clearInterval(waitForReady);
            console.log("GeoFS Aircraft loaded. System ready (Disarmed).");

            animationFrameId = requestAnimationFrame(flightLoop);

            // Keyboard Toggle
            document.addEventListener("keydown", function(event) {
                if (event.key === "CapsLock" && document.activeElement.tagName !== "INPUT") {
                    fbwActive = !fbwActive;

                    if (fbwActive) {
                        lastHeading = 0;
                        lastPitch = 0;
                        lastRoll = 0;
                        hookSAS();
                        console.log("FBW: ENGAGED");
                    } else {
                        unhookSAS();
                        console.log("FBW: DISCONNECTED");
                    }
                }
            });
        }
    }, 1000); // Checks every 1 second

})();
