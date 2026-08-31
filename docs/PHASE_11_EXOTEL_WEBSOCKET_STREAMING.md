# SWASTHYASETU — PHASE 11 REAL-TIME EXOTEL WEBSOCKET STREAMING
## Production-Grade Bidirectional Voice Streaming Gateway

---

### 1. Architecture Overview

The Phase 11 Real-Time Streaming Gateway provides full-duplex conversational audio streaming between the **Exotel Stream Applet**, **Fastify WebSocket Gateway**, **Sarvam AI (STT & TTS)**, and the **SwasthyaSetu Deterministic Healthcare Brain**.

```
 +-----------------------------------------------------------------------------------------------+
 |                                  EXOTEL CLOUD TELEPHONY PLATFORM                              |
 |                                                                                               |
 |   [ PSTN Caller ] ──► [ Exotel Flow: Call Start ──► Greeting Applet ──► Stream Applet ]       |
 +---------------------------------------------------+-------------------------------------------+
                                                     |
                                                     | WSS (Encrypted WebSocket Stream)
                                                     v
 +-----------------------------------------------------------------------------------------------+
 |                          SWASTHYASETU FASTIFY WEBSOCKET GATEWAY                               |
 |                                                                                               |
 |   Endpoint: GET /api/v1/voice/stream (ws://localhost:8000 / wss://<tunnel-domain>)            |
 |                                                                                               |
 |   1. Exotel Event Protocol Parser (connected, start, media, stop, mark)                       |
 |   2. G.711 μ-law (PCMU) <-> 16-bit Linear PCM Transcoder (Lookup-table optimized)            |
 |   3. Speech Turn Buffering & Energy-Based Voice Activity Detection (VAD)                      |
 |   4. Maximum Call Duration (300s) & Turn Limit (10 Turns) Cost Guard                          |
 +-----------------------+-----------------------------------------------+-----------------------+
                         |                                               ^
                         | 8kHz Audio Buffer                             | 8kHz Telephony Chunks
                         v                                               | (160B μ-law Frames)
 +-------------------------------+---------------+               +-------+-----------------------+
 |                     SARVAM AI                 |               |               SARVAM AI       |
 |                                               |               |                               |
 |   Model: saaras:v3                            |               |   Model: bulbul:v3            |
 |   Endpoint: POST /speech-to-text              |               |   Endpoint: POST /text-to-speech
 |   Output: Indic/English Transcript            |               |   Input: Plain-text AI Reply  |
 +-------------------------------+---------------+               +-------+-----------------------+
                                 |                                       ^
                                 | Recognized User Transcript            | Spoken Assistant Response
                                 v                                       |
 +-----------------------------------------------------------------------+-----------------------+
 |                     VOICE GATEWAY & AUTHORITATIVE HEALTHCARE BRAIN                            |
 |                                                                                               |
 |   1. Privacy-First Identity Gate (Unverified vs Verified Ration Card Digits)                  |
 |   2. Single Source of Truth: EligibilityService (PM-JAY 70+, JSY Maternal Parity)             |
 |   3. AssistanceService (Doorstep ASHA Visit Tasks & Progress Tracking)                        |
 |   4. Medical Emergency Boundary (Immediate 108 / 102 Ambulance Routing)                       |
 |   5. Audit Logs: n8n Workflow Automation Events                                               |
 +-----------------------------------------------------------------------------------------------+
```

---

### 2. WebSocket Endpoint Specifications

| Environment | Protocol | URL Pattern |
| :--- | :--- | :--- |
| **Local Development** | `ws://` | `ws://localhost:8000/api/v1/voice/stream` |
| **Local EPHEMERAL/Test** | `ws://` | `ws://127.0.0.1:<ephemeral-port>/api/v1/voice/stream` |
| **Production / Live Tunnel** | `wss://` | `wss://<public-tunnel-domain>/api/v1/voice/stream` |

> [!IMPORTANT]
> Exotel Cloud Telephony operates over public networks and **cannot** reach `ws://localhost:8000`. For live PSTN calls, a secure reverse tunnel (such as `cloudflared` or `ngrok`) terminating at `wss://` is strictly required.

---

### 3. Exotel Stream Protocol & Event Lifecycle

The streaming gateway implements the full Exotel Stream Applet message protocol:

#### Inbound Events (Exotel $\longrightarrow$ SwasthyaSetu)
1. **`connected`**: Handshake acknowledgment.
   ```json
   { "event": "connected", "protocol": "Call", "version": "1.0.0" }
   ```
2. **`start`**: Session binding. Contains `streamSid`, `callSid`, `mediaFormat`, and optional `customParameters` (such as `language` or `callerPhone`).
   ```json
   {
     "event": "start",
     "sequenceNumber": "1",
     "streamSid": "stream_abc123",
     "start": {
       "streamSid": "stream_abc123",
       "callSid": "call_xyz789",
       "tracks": ["inbound"],
       "mediaFormat": {
         "encoding": "audio/x-mulaw",
         "sampleRate": 8000,
         "channels": 1
       },
       "customParameters": {
         "language": "hi-IN",
         "callerPhone": "+919876543210"
       }
     }
   }
   ```
3. **`media`**: Telephony audio frame containing base64-encoded μ-law audio.
   ```json
   {
     "event": "media",
     "sequenceNumber": "2",
     "streamSid": "stream_abc123",
     "media": {
       "track": "inbound",
       "chunk": "1",
       "timestamp": "1788185800000",
       "payload": "<base64_encoded_audio>"
     }
   }
   ```
4. **`stop`**: Caller hangup or flow termination.
   ```json
   {
     "event": "stop",
     "sequenceNumber": "3",
     "streamSid": "stream_abc123",
     "stop": { "callSid": "call_xyz789" }
   }
   ```
5. **`mark`**: Playback synchronization signal.

#### Outbound Events (SwasthyaSetu $\longrightarrow$ Exotel)
1. **`media`**: Telephony audio response frames (chunked into 20ms / 160-byte μ-law frames).
   ```json
   {
     "event": "media",
     "streamSid": "stream_abc123",
     "media": { "payload": "<base64_encoded_mulaw_chunk>" }
   }
   ```
2. **`mark`**: Signaled after streaming all response audio frames for a conversational turn.
   ```json
   {
     "event": "mark",
     "streamSid": "stream_abc123",
     "mark": { "name": "turn_1" }
   }
   ```
3. **`clear`**: Clears any queued audio on Exotel's buffer if a barge-in interruption occurs.

---

### 4. Audio Processing & Codec Transcoding

Telephony audio undergoes mathematically verified transformations:

1. **Inbound Transcoding**:
   $$\text{Exotel Base64} \longrightarrow \text{μ-law (PCMU 8kHz)} \longrightarrow \text{Linear 16-bit PCM} \longrightarrow \text{VAD Energy Filter}$$
   - Energy threshold: $\text{RMS} > 300$ qualifies as voice activity.
   - Silence threshold: $45 \text{ consecutive silent chunks } (\approx 900\text{ms})$ triggers turn boundary.
   - Max turn window: $350 \text{ chunks } (\approx 7\text{s})$ prevents unbounded accumulation.
2. **WAV Synthesis**:
   - Assembled PCM buffer is wrapped in a standard 44-byte RIFF/WAV header ($8000\text{Hz}$, 16-bit, mono) and sent via multipart POST to Sarvam STT (`saaras:v3`).
3. **Outbound Transcoding**:
   $$\text{Sarvam TTS (bulbul:v3 WAV)} \longrightarrow \text{Extract Raw PCM} \longrightarrow \text{Linear to μ-law} \longrightarrow \text{160B Frame Chunks} \longrightarrow \text{WebSocket}$$

---

### 5. Session & Caller Identity Association

- **Inbound Calls**: `callSid` is mapped to an authoritative `VoiceSession`. If initialized from the PSTN helpline, `HouseholdRepository` is queried by the caller's phone number, defaulting to `UNVERIFIED` state.
- **Web-Initiated Calls**: Pre-authenticated via JWT token (`citizenUid` / `ashaUid`), initialized as `VERIFIED`.
- **Privacy Boundary**: Unverified callers can access public scheme descriptions. Personal eligibility, family member details, or ASHA visit tasks require verifying the **last 4 digits of the household Ration Card**.

---

### 6. Environment Configuration

All credentials remain strictly **server-side only** in `backend/.env`:

```env
# Telephony Credentials (SERVER-SIDE ONLY)
EXOTEL_ACCOUNT_SID=sabotage1
EXOTEL_API_KEY=<server-secret>
EXOTEL_API_TOKEN=<server-secret>
EXOTEL_BASE_URL=https://api.exotel.com
EXOTEL_VIRTUAL_NUMBER=08047283240
EXOTEL_CALLER_ID=08047283240

# Sarvam Indic AI (SERVER-SIDE ONLY)
SARVAM_API_KEY=<server-secret>
SARVAM_BASE_URL=https://api.sarvam.ai
SARVAM_MODEL=saaras:v3
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_TTS_SPEAKER=roopa

# Voice Controls & Safety Guardrails
VOICE_ENABLED=true
VOICE_PROVIDER_MODE=real
VOICE_MAX_TURNS=10
VOICE_MAX_CALL_DURATION_SEC=300
```

---

### 7. Step-by-Step Testing & Verification Procedure

#### Step 1: Automated Unit & Integration Tests
```bash
# Run dedicated WebSocket test suite (19 test cases)
npx vitest run tests/exotel-websocket-stream.test.ts

# Run complete backend test suite (40 test files, 362 test cases)
npm test --prefix backend
```

#### Step 2: Live Exotel PSTN Call Test with Ingress Tunnel
1. **Start Backend**:
   ```bash
   npm run dev --prefix backend
   ```
2. **Start Ingress Tunnel**:
   ```bash
   # Option A: Cloudflare Tunnel
   cloudflared tunnel --url http://localhost:8000

   # Option B: ngrok
   ngrok http 8000
   ```
3. **Configure Exotel Applet**:
   - In Exotel Flow Designer $\longrightarrow$ **Stream Applet** $\longrightarrow$ **Where do you want to send the audio stream?**
   - Enter: `wss://<your-tunnel-domain>/api/v1/voice/stream`
4. **Dial Helpline**:
   - Call `08047283240` from your mobile phone.
   - Speak after the greeting: *"Mujhe Ayushman Bharat scheme ke baare mein jankari chahiye."*
   - Observe live STT transcription $\to$ AI response synthesis $\to$ audio playback on the phone line!
