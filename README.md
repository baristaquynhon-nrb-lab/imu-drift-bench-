# ΔS–CPL Reflex Loop v2.5 — Mobile Reflex PWA

**Author:** Nguyen Ngoc Thi — SEE-R OS / ΔS-Field Laboratory  
**Device Target:** Samsung S24 (Android 14, Chrome 120+)  
**Version:** v2.5 — Auto-Speak Reflex PWA (Vietnamese Voice)

---

## 🌐 Overview
This PWA enables **real-time reflex simulation** based on the ΔS–CPL (Condition–Phenomenon Law) framework.  
It integrates camera + microphone sensors on Samsung S24 to generate **neuro-reflex actions** (NRB format) in real-time.

---

## ⚙️ Features
- 📸 Camera reflex detection (head motion, optical flow, or landmark)
- 🎤 Voice wake-word: **“Này Delta”**
- 🔊 Auto-speak reflex using **Vietnamese female TTS**
- 🧠 Logs ΔS / NRB reflex data to **LocalStorage**
- 📄 Exports reflex history to **CSV** for later review
- 💡 Works offline as **Progressive Web App (PWA)**

---

## 📁 Files
| File | Description |
|------|--------------|
| `mobile_reflex_v2_5.html` | Main PWA Reflex Interface |
| `manifest.json` | PWA configuration |
| `serviceWorker.js` | Offline caching & background reflex sync |
| `ΔS_Reflex_Log.csv` | Example exported log file |

---

## 🚀 How to Run
1. Open the repository on GitHub Pages or local server (e.g., Termux / `http-server`).
2. Allow **camera + microphone** access.
3. Say **“Này Delta”** to activate reflex mode.
4. Observe visual + voice feedback in real time.

---

## 🧩 Development Notes
- Built with **HTML5, TypeScript, Web Speech API, MediaPipe**
- Follows **W3C Open Standard APIs** (no commercial SDK)
- Designed for **AI Reflex Research (ΔS–CPL / NRB Laboratory)**

---

## 📜 License
Open standard license (non-commercial academic use).  
© 2025 Nguyen Ngoc Thi — SEE-R OS / ΔS-Field Laboratory
