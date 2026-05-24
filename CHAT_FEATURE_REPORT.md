# In-Call Chat Feature — Implementation Report

**Project:** Apna Video Call (WebRTC)  
**Date:** May 24, 2026  
**Status:** Implemented (frontend + backend)

---

## 1. Executive summary

A real-time **text chat** feature was added to the video call screen. Users in the same room can send and receive messages over the existing Socket.IO connection while on a call. Chat history is kept in server memory for the duration of the room and is replayed when a user joins late.

| Area | Status |
|------|--------|
| Backend (Socket.IO) | Complete |
| Frontend (React UI) | Complete |
| Persistence (database) | Not implemented (in-memory only) |
| File / image sharing | Not in scope |

---

## 2. Problem statement

Previously, the server had unused `chat-message` logic from an older `join-call` flow, and the frontend had **no chat UI**. Users could only communicate via audio/video. This implementation delivers a working end-to-end chat experience aligned with the current `join-room` architecture.

---

## 3. Architecture overview

```
┌─────────────────┐         Socket.IO          ┌─────────────────┐
│  WebRTCCall.jsx │ ◄──────────────────────────► │ socketmanager.js│
│  + CallChat.jsx │                              │  (Node server)  │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │  join-room { roomId, userName }                │  roomMessages[roomId]
         │  chat-message { text }                         │  (in-memory store)
         │  ◄ chat-history / chat-message / chat-error   │
         └────────────────────────────────────────────────┘
```

- **Transport:** Socket.IO (same connection as WebRTC signaling).
- **Scope:** Per room (max 2 participants).
- **Storage:** In-memory on the server; cleared when the room has zero connected sockets.

---

## 4. Backend implementation

**File:** `webrtcserver/src/controller/socketmanager.js`

### 4.1 Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join-room` | Client → Server | `{ roomId, userName }` or `roomId` string | Join room; sets `socket.data.roomId` and `socket.data.userName` |
| `chat-history` | Server → Client | `Message[]` | Sent to joiner if room already has messages |
| `chat-message` | Client → Server | `{ text: string }` | Send a message |
| `chat-message` | Server → Client | `Message` | Broadcast to everyone in the room |
| `chat-error` | Server → Client | `{ message: string }` | Validation / state errors |

### 4.2 Message object shape

```json
{
  "id": "socketId-timestamp",
  "text": "Hello!",
  "senderId": "abc123",
  "senderName": "Ankit",
  "timestamp": 1716566400000
}
```

### 4.3 Validation rules

- User must have joined a room (`socket.data.roomId`).
- Message text is trimmed; empty messages are rejected.
- Maximum length: **500 characters**.
- Maximum stored messages per room: **100** (older messages dropped).

### 4.4 Room lifecycle

- Messages are stored in `roomMessages[roomId]`.
- On `join-room`, existing history is sent via `chat-history`.
- On `disconnect`, if no sockets remain in the room, history is deleted.

---

## 5. Frontend implementation

### 5.1 Files added / modified

| File | Role |
|------|------|
| `frontend/src/components/CallChat.jsx` | Chat panel UI and socket listeners |
| `frontend/src/styles/call-chat.css` | Chat layout and styling |
| `frontend/src/pages/WebRTCCall.jsx` | Integrates chat; passes socket + `join-room` with `userName` |

### 5.2 UI features

- Side panel on desktop (right of video grid).
- Collapsible panel; floating “Chat” button when collapsed.
- Message bubbles: **You** vs **other participant** (by `senderId`).
- Timestamps on each message.
- Input + **Send** button; **Enter** submits via form.
- Inline error display for `chat-error` events.
- Disabled state until socket is connected.

### 5.3 User flow

1. User enters a call → socket connects → `join-room` with `userName` from localStorage.
2. Chat panel becomes active (`enabled={isConnected}`).
3. User types a message → `chat-message` emitted.
4. Server broadcasts → both clients append to the message list.
5. Late joiner receives `chat-history` then live `chat-message` events.

---

## 6. Integration with video call

Chat shares the **same Socket.IO connection** as WebRTC signaling (`offer`, `answer`, `ice-candidate`, `user-joined`). No second connection is required.

`join-room` now sends:

```javascript
socket.emit('join-room', { roomId, userName: name });
```

The server also passes `userName` on `offer` events so the remote video label can show the host’s name.

---

## 7. Testing guide

### 7.1 Local testing

1. Start backend: `cd webrtcserver && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Open two browser windows (or normal + incognito).
4. Log in as two users (or same user twice for a quick test).
5. Join the **same room ID** from both windows.
6. Send messages from each side; confirm:
   - Messages appear on both sides.
   - “You” vs other name styling is correct.
   - Late joiner sees prior messages in the room.

### 7.2 Production (Render)

Redeploy **both** services after pulling latest code:

- API: `https://webrtc-nn8s.onrender.com`
- Frontend: `https://webrtc-1-fzsr.onrender.com`

Ensure `VITE_SOCKET_URL` points to the API URL and rebuild the frontend.

### 7.3 Test cases

| # | Test | Expected |
|---|------|----------|
| 1 | Send normal text | Appears for sender and receiver |
| 2 | Send empty / spaces only | Server emits `chat-error` |
| 3 | Send 501+ characters | Server rejects with `chat-error` |
| 4 | Guest joins after messages sent | Guest receives `chat-history` |
| 5 | Both users leave room | New joiners do not see old messages |
| 6 | Chat while video connected | No impact on WebRTC stream |

---

## 8. Limitations and future work

| Limitation | Possible improvement |
|------------|---------------------|
| Messages lost on server restart | Store in MongoDB (`Message` model) |
| No typing indicators | Emit `typing-start` / `typing-stop` |
| No read receipts | Track `readBy` per message |
| No moderation | Profanity filter, report, admin mute |
| In-memory only | Redis for multi-instance Render deploys |
| Max 2 users per room | Unchanged; chat is room-scoped |

---

## 9. Deployment checklist

- [ ] Push code to GitHub (`webrtc` repo)
- [ ] Redeploy `webrtc-nn8s` (API)
- [ ] Redeploy `webrtc-1-fzsr` (frontend) with cache clear
- [ ] Verify `MONGO_URL` still set (auth; unrelated to chat)
- [ ] Test chat with two browsers on production URLs

---

## 10. File change summary

```
webrtcserver/src/controller/socketmanager.js   — chat handlers + history
frontend/src/components/CallChat.jsx           — new chat component
frontend/src/styles/call-chat.css                — new styles
frontend/src/pages/WebRTCCall.jsx                — chat integration
CHAT_FEATURE_REPORT.md                           — this document
```

---

## 11. Conclusion

The in-call chat feature is **fully wired** on both frontend and backend. It uses Socket.IO room broadcasting, validates input, replays history for late joiners, and provides a dedicated UI panel during video calls. For production scale or message persistence, follow the improvements listed in Section 8.
