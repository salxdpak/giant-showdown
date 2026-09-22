// ============================================
// 🚪 LOBBY
// ============================================
import { GAME_CONFIG, UI_TEXT } from '../config/game-config.js';
import { RoomAPI, PresenceAPI, ChatAPI, TypingAPI } from '../shared/firebase.js';
import { PresenceManager } from '../shared/presence.js';
import { state, StateManager } from '../shared/state.js';
import { generateRoomCode, switchScreen } from '../shared/utils.js';
import { Modal } from '../shared/modal.js';

const avatarPicker = {
    selectedAvatar: null,
    takenAvatars: [],
    pendingAction: null,
    pendingData: null,
};

let unsubscribeChat = null;
let unsubscribeTyping = null;

let typingUsers = [];
let myTypingState = false;

export const LobbyActions = {

    async createRoom() {
        const name = document.getElementById('player-name').value.trim();
        if (!name) {
            await Modal.alert(UI_TEXT.ERR.NEED_NAME, {
                icon: '✏️',
                title: 'ยังไม่ได้ใส่ชื่อ',
            });
            return;
        }

        state.myName = name;
        avatarPicker.pendingAction = 'create';
        avatarPicker.pendingData = { name };

        await openAvatarPicker();
    },

    async joinRoom() {
        const name = document.getElementById('player-name').value.trim();
        const code = document.getElementById('room-code-input').value.trim().toUpperCase();

        if (!name) {
            await Modal.alert(UI_TEXT.ERR.NEED_NAME, { icon: '✏️', title: 'ยังไม่ได้ใส่ชื่อ' });
            return;
        }
        if (!code) {
            await Modal.alert(UI_TEXT.ERR.NEED_CODE, { icon: '🔢', title: 'ยังไม่ได้ใส่รหัสห้อง' });
            return;
        }
        if (code.length !== GAME_CONFIG.ROOM_CODE_LENGTH) {
            await Modal.alert(UI_TEXT.ERR.INVALID_CODE, { icon: '🔢', title: 'รหัสห้องไม่ถูกต้อง' });
            return;
        }

        const room = await RoomAPI.get(code);
        if (!room) {
            await Modal.alert(UI_TEXT.ERR.ROOM_NOT_FOUND, { icon: '🔍', title: 'ไม่พบห้อง' });
            return;
        }
        if (room.players.length >= GAME_CONFIG.MAX_PLAYERS) {
            await Modal.alert(UI_TEXT.ERR.ROOM_FULL, { icon: '🚫', title: 'ห้องเต็ม' });
            return;
        }
        if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            await Modal.alert(UI_TEXT.ERR.NAME_DUPLICATE, { icon: '👤', title: 'ชื่อซ้ำ' });
            return;
        }

        state.myName = name;
        avatarPicker.pendingAction = 'join';
        avatarPicker.pendingData = { name, code };

        await openAvatarPicker(code);
    },

    async confirmAvatar() {
        const avatarId = avatarPicker.selectedAvatar;
        if (!avatarId) {
            await Modal.alert(UI_TEXT.ERR.NEED_AVATAR, { icon: '🎭', title: 'ยังไม่ได้เลือก Avatar' });
            return;
        }

        const action = avatarPicker.pendingAction;
        const data = avatarPicker.pendingData;

        const stillAvailable = await isAvatarAvailable(data.code, avatarId);
        if (!stillAvailable) {
            await Modal.alert(UI_TEXT.ERR.AVATAR_TAKEN, { icon: '🎭', title: 'Avatar ถูกใช้แล้ว' });
            return;
        }

        closeAvatarPicker();

        if (action === 'create') {
            await this._doCreateRoom(data.name, avatarId);
        } else if (action === 'join') {
            await this._doJoinRoom(data.name, data.code, avatarId);
        }
    },

    cancelAvatar() {
        closeAvatarPicker();
        switchScreen('home');
    },

    async _doCreateRoom(name, avatarId) {
        const btn = document.getElementById('btn-create-room');
        btn.disabled = true;

        try {
            let code;
            let attempts = 0;
            do {
                code = generateRoomCode();
                attempts++;
                if (attempts > 20) {
                    await Modal.alert(UI_TEXT.ERR.CANNOT_CREATE, { icon: '❌', title: 'สร้างห้องไม่สำเร็จ' });
                    return;
                }
            } while (await RoomAPI.get(code));

            state.roomCode = code;
            state.isHost = true;

            const hostPlayer = {
                uid: state.myUid,
                name,
                isHost: true,
                avatarId,
                isReady: true,
            };
            state.players = [hostPlayer];
            state.myReady = true;

            await RoomAPI.create(code, hostPlayer);
            await PresenceAPI.goOnline(code, hostPlayer);
            PresenceManager.start(code);

            await ChatAPI.sendSystemMessage(code, `${name} created the room`);

            this.startListening();
            switchScreen('lobby');
            console.log('✅ สร้างห้อง:', code);

        } catch (err) {
            console.error(err);
            await Modal.alert('สร้างห้องไม่สำเร็จ: ' + err.message, { icon: '❌', title: 'เกิดข้อผิดพลาด' });
        } finally {
            btn.disabled = false;
        }
    },

    async _doJoinRoom(name, code, avatarId) {
        const btn = document.getElementById('btn-join-room');
        btn.disabled = true;

        try {
            const room = await RoomAPI.get(code);
            if (!room) {
                await Modal.alert(UI_TEXT.ERR.ROOM_NOT_FOUND, { icon: '🔍', title: 'ไม่พบห้อง' });
                return;
            }
            if (room.players.length >= GAME_CONFIG.MAX_PLAYERS) {
                await Modal.alert(UI_TEXT.ERR.ROOM_FULL, { icon: '🚫', title: 'ห้องเต็ม' });
                return;
            }
            if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                await Modal.alert(UI_TEXT.ERR.NAME_DUPLICATE, { icon: '👤', title: 'ชื่อซ้ำ' });
                return;
            }
            if (room.players.some(p => p.avatarId === avatarId)) {
                await Modal.alert(UI_TEXT.ERR.AVATAR_TAKEN, { icon: '🎭', title: 'Avatar ถูกใช้แล้ว' });
                return;
            }

            const me = {
                uid: state.myUid,
                name,
                isHost: false,
                avatarId,
                isReady: false,
            };
            await RoomAPI.update(code, { players: [...room.players, me] });

            state.roomCode = code;
            state.isHost = false;
            state.myReady = false;

            await PresenceAPI.goOnline(code, me);
            PresenceManager.start(code);

            await ChatAPI.sendSystemMessage(code, `${name} joined the room`);

            this.startListening();
            switchScreen('lobby');
            console.log('🔗 เข้าห้อง:', code);

        } catch (err) {
            console.error(err);
            await Modal.alert('เข้าห้องไม่สำเร็จ: ' + err.message, { icon: '❌', title: 'เกิดข้อผิดพลาด' });
        } finally {
            btn.disabled = false;
        }
    },

    async toggleReady() {
        const me = state.players.find(p => p.uid === state.myUid);
        if (!me) return;

        if (state.isHost) {
            console.log('👑 Host พร้อมอัตโนมัติ — toggle ไม่ได้');
            return;
        }

        const newReady = !me.isReady;
        state.myReady = newReady;

        try {
            const room = await RoomAPI.get(state.roomCode);
            if (!room) return;

            const updatedPlayers = room.players.map(p => {
                if (p.uid === state.myUid) {
                    return { ...p, isReady: newReady };
                }
                return p;
            });

            await RoomAPI.update(state.roomCode, { players: updatedPlayers });

        } catch (err) {
            console.error('Toggle ready error:', err);
        }
    },

    async leaveRoom() {
        const ok = await Modal.confirm('คุณต้องการออกจากห้องนี้ใช่ไหม?', {
            icon: '🚪',
            title: 'ออกจากห้อง',
            okText: 'ออก',
            cancelText: 'ยกเลิก',
            variant: 'danger',
        });
        if (!ok) return;

        const roomCode = state.roomCode;
        const myUid = state.myUid;

        try {
            const room = await RoomAPI.get(roomCode);
            if (!room) return;

            const me = room.players.find(p => p.uid === myUid);
            const remaining = room.players.filter(p => p.uid !== myUid);

            if (me && remaining.length > 0) {
                await ChatAPI.sendSystemMessage(roomCode, `${me.name} left the room`);
            }

            if (remaining.length === 0) {
                await RoomAPI.delete(roomCode);
                await PresenceAPI.clearRoom(roomCode);
                await ChatAPI.clearMessages(roomCode);
                await TypingAPI.clearTyping(roomCode);
            } else {
                const newHostId = room.hostId === myUid
                    ? remaining[0].uid
                    : room.hostId;

                const updatedPlayers = remaining.map(p => ({
                    ...p,
                    isHost: p.uid === newHostId,
                    isReady: p.uid === newHostId ? true : p.isReady,
                }));

                await RoomAPI.update(roomCode, {
                    players: updatedPlayers,
                    hostId: newHostId,
                });

                if (room.hostId === myUid) {
                    const newHost = updatedPlayers.find(p => p.uid === newHostId);
                    if (newHost) {
                        await ChatAPI.sendSystemMessage(
                            roomCode,
                            `${newHost.name} is now the host`
                        );
                    }
                }
            }
        } catch (err) {
            console.error('Leave room error:', err);
        }

        await PresenceAPI.goOffline(roomCode, myUid);
        await TypingAPI.setTyping(roomCode, { uid: myUid }, false);
        PresenceManager.stop();
        this.stopListening();

        StateManager.reset();
        switchScreen('home');
    },

    scheduleRoomDelete(roomCode) {
        if (!roomCode) return;

        setTimeout(async () => {
            try {
                await PresenceAPI.clearRoom(roomCode);
                await ChatAPI.clearMessages(roomCode);
                await TypingAPI.clearTyping(roomCode);
                await RoomAPI.delete(roomCode);
            } catch (err) {
                console.log('ℹ️ ลบห้องไม่สำเร็จ:', err.message);
            }
        }, 3000);
    },

    startListening() {
        if (state.unsubscribeRoom) state.unsubscribeRoom();

        state.unsubscribeRoom = RoomAPI.listen(state.roomCode, async (room) => {
            if (!room) {
                if (state.status === GAME_CONFIG.ROOM_STATUS.FINISHED) {
                    return;
                }

                await Modal.alert(UI_TEXT.ERR.ROOM_CLOSED, {
                    icon: '🚪',
                    title: 'ห้องถูกปิด',
                });
                this.stopListening();
                PresenceManager.stop();
                StateManager.reset();
                switchScreen('home');
                return;
            }

            state.players = room.players;
            state.isHost = room.hostId === state.myUid;
            state.status = room.status;
            state.winner = room.winner;

            const me = room.players.find(p => p.uid === state.myUid);
            if (me) state.myReady = me.isReady || false;

            if (room.status === GAME_CONFIG.ROOM_STATUS.FINISHED) {
                this.stopListening();
                PresenceManager.stop();
                this.scheduleRoomDelete(state.roomCode);

                window.dispatchEvent(new CustomEvent('game:finished', {
                    detail: { winnerUid: room.winner }
                }));
                return;
            }

            if (room.status === 'playing') {
                this.stopListening();
                window.startGameListener?.();
                return;
            }

            renderLobby();
        });

        if (unsubscribeChat) unsubscribeChat();
        unsubscribeChat = ChatAPI.listenMessages(state.roomCode, (messages) => {
            renderChat(messages);
        });

        if (unsubscribeTyping) unsubscribeTyping();
        unsubscribeTyping = TypingAPI.listenTyping(state.roomCode, (users) => {
            typingUsers = users;
            renderLobby();
        });
    },

    stopListening() {
        if (state.unsubscribeRoom) {
            state.unsubscribeRoom();
            state.unsubscribeRoom = null;
        }
        if (unsubscribeChat) {
            unsubscribeChat();
            unsubscribeChat = null;
        }
        if (unsubscribeTyping) {
            unsubscribeTyping();
            unsubscribeTyping = null;
        }
        typingUsers = [];
    },

    async handleTyping() {
        const input = document.getElementById('chat-input');
        if (!input) return;

        const isTyping = input.value.length > 0;

        if (isTyping === myTypingState) return;
        myTypingState = isTyping;

        const me = state.players.find(p => p.uid === state.myUid);
        if (!me) return;

        try {
            await TypingAPI.setTyping(state.roomCode, me, isTyping);
        } catch (err) {
            console.error('Typing error:', err);
        }
    },
};

// ============================================
// AVATAR PICKER
// ============================================
async function openAvatarPicker(roomCode = null) {
    avatarPicker.takenAvatars = await getTakenAvatars(roomCode);
    avatarPicker.selectedAvatar = null;

    renderAvatarGrid();
    document.getElementById('btn-avatar-confirm').disabled = true;

    switchScreen('avatar');
}

function closeAvatarPicker() {
    avatarPicker.selectedAvatar = null;
    avatarPicker.takenAvatars = [];
    avatarPicker.pendingAction = null;
    avatarPicker.pendingData = null;
}

async function getTakenAvatars(roomCode) {
    if (!roomCode) return [];
    const room = await RoomAPI.get(roomCode);
    if (!room) return [];
    return room.players.filter(p => p.avatarId).map(p => p.avatarId);
}

async function isAvatarAvailable(roomCode, avatarId) {
    if (!roomCode) return true;
    const taken = await getTakenAvatars(roomCode);
    return !taken.includes(avatarId);
}

function renderAvatarGrid() {
    const grid = document.getElementById('avatar-grid');
    grid.innerHTML = '';

    GAME_CONFIG.AVATARS.forEach((avatarId) => {
        const isTaken = avatarPicker.takenAvatars.includes(avatarId);

        const div = document.createElement('div');
        div.className = 'avatar-option';
        div.dataset.avatarId = avatarId;

        if (isTaken) div.classList.add('taken');

        const img = document.createElement('img');
        img.src = `${GAME_CONFIG.AVATAR_PATH}${avatarId}.png`;
        img.alt = `Avatar ${avatarId}`;
        img.onerror = () => { img.style.background = '#444'; img.alt = '?'; };
        div.appendChild(img);

        if (isTaken) {
            const x = document.createElement('span');
            x.className = 'avatar-option-x';
            x.textContent = '✗';
            div.appendChild(x);
        } else {
            div.addEventListener('click', () => selectAvatar(avatarId));
        }

        grid.appendChild(div);
    });
}

function selectAvatar(avatarId) {
    avatarPicker.selectedAvatar = avatarId;

    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
        if (el.dataset.avatarId === avatarId) {
            el.classList.add('selected');
        }
    });

    document.getElementById('btn-avatar-confirm').disabled = false;
}

// ============================================
// CHAT
// ============================================
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const me = state.players.find(p => p.uid === state.myUid);
    if (!me) return;

    await ChatAPI.sendMessage(state.roomCode, me, text);

    input.value = '';
    input.focus();

    if (myTypingState) {
        myTypingState = false;
        try {
            await TypingAPI.setTyping(state.roomCode, me, false);
        } catch (err) { /* ignore */ }
    }
}

function renderChat(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    messages.forEach((msg) => {
        const div = document.createElement('div');

        if (msg.type === 'system') {
            div.className = 'chat-message system';
            const colors = ['green', 'blue', 'pink', 'yellow'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            div.innerHTML = `<span class="dot ${color}"></span>${escapeHtml(msg.text)}`;
        } else {
            div.className = 'chat-message user';
            if (msg.uid === state.myUid) div.classList.add('is-me');
            div.innerHTML = `<span class="sender">${escapeHtml(msg.name)}:</span> ${escapeHtml(msg.text)}`;
        }

        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// RENDER LOBBY
// ============================================
export function renderLobby() {
    document.getElementById('display-room-code').textContent = state.roomCode;
    document.getElementById('player-count').textContent =
        `${state.players.length}/${GAME_CONFIG.MAX_PLAYERS}`;

    const startBtn = document.getElementById('btn-start');
    if (state.isHost) {
        startBtn.style.display = 'block';
        const everyoneReady = StateManager.isEveryoneReady();
        startBtn.disabled = !everyoneReady;

        const readyCount = StateManager.countReady();
        const totalCount = state.players.length;

        const startText = startBtn.querySelector('.game-btn__text');
        if (everyoneReady) {
            if (startText) startText.textContent = UI_TEXT.LOBBY.BTN_START;
        } else {
            if (startText) startText.textContent = `${UI_TEXT.LOBBY.BTN_START_DISABLED} (${readyCount}/${totalCount})`;
        }
    } else {
        startBtn.style.display = 'none';
    }

    const readyBtn = document.getElementById('btn-ready');
    if (readyBtn) {
        if (state.isHost) {
            readyBtn.style.display = 'none';
        } else {
            readyBtn.style.display = 'block';
            const readyText = readyBtn.querySelector('.game-btn__text');
            if (state.myReady) {
                if (readyText) readyText.textContent = UI_TEXT.LOBBY.BTN_UNREADY;
                readyBtn.classList.add('is-ready');
            } else {
                if (readyText) readyText.textContent = UI_TEXT.LOBBY.BTN_READY;
                readyBtn.classList.remove('is-ready');
            }
        }
    }

    const slots = document.querySelectorAll('.player-slot');

    // ⭐ Step 1: Reset ทุก slot (แต่เก็บ badge ไว้)
    slots.forEach(slot => {
        slot.classList.remove('occupied', 'is-me', 'is-host', 'is-ready');

        const avatarEl = slot.querySelector('.avatar');

        // ⭐ ลบเฉพาะ element ที่ไม่ใช่ badge
        avatarEl.querySelectorAll(':scope > *:not(.typing-badge)').forEach(el => el.remove());

        // ⭐ ซ่อน badge ไว้ก่อน (จะเปิดใน Step 2 ถ้าจำเป็น)
        const badge = avatarEl.querySelector('.typing-badge');
        if (badge) badge.classList.remove('show');

        // ⭐ ซ่อน avatar ไว้ก่อน
        avatarEl.style.display = 'none';

        slot.querySelector('.player-name').textContent = UI_TEXT.LOBBY.SLOT_EMPTY;

        const oldBanner = slot.querySelector('.ready-banner');
        if (oldBanner) oldBanner.remove();
    });

    const previousUids = renderLobby._previousUids || [];
    const currentUids = state.players.map(p => p.uid);

    // ⭐ Step 2: Fill players
    state.players.forEach((player, index) => {
        if (index >= GAME_CONFIG.MAX_PLAYERS) return;
        const slot = slots[index];
        slot.classList.add('occupied');

        if (player.isReady) {
            slot.classList.add('is-ready');
        }

        const avatarEl = slot.querySelector('.avatar');
        avatarEl.style.display = 'flex';

        const isNewPlayer = !previousUids.includes(player.uid);

        // ⭐ สร้าง border
        const borderDiv = document.createElement('div');
        borderDiv.className = 'avatar-border';
        avatarEl.insertBefore(borderDiv, avatarEl.firstChild);

        // ⭐ สร้าง img หรือ placeholder
        if (player.avatarId) {
            const img = document.createElement('img');
            img.src = `${GAME_CONFIG.AVATAR_PATH}${player.avatarId}.png`;
            img.alt = player.name;
            // ⭐ แทรกก่อน badge
            const badge = avatarEl.querySelector('.typing-badge');
            if (badge) {
                avatarEl.insertBefore(img, badge);
            } else {
                avatarEl.appendChild(img);
            }

            if (isNewPlayer) {
                avatarEl.classList.add('is-new');
            }
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'avatar-placeholder';
            placeholder.textContent = '?';
            const badge = avatarEl.querySelector('.typing-badge');
            if (badge) {
                avatarEl.insertBefore(placeholder, badge);
            } else {
                avatarEl.appendChild(placeholder);
            }
        }

        // ⭐ ชื่อ
        let nameText = player.name;
        if (player.uid === state.myUid) {
            slot.classList.add('is-me');
            nameText += UI_TEXT.LOBBY.YOU_SUFFIX;
        }

        const nameEl = slot.querySelector('.player-name');
        nameEl.textContent = nameText;

        // ⭐ Crown (host)
        if (player.isHost) {
            slot.classList.add('is-host');
            const crownImg = document.createElement('img');
            crownImg.className = 'host-crown';
            crownImg.src = './assets/avatars/ingame asset/crown.svg';
            crownImg.alt = 'host';
            nameEl.prepend(crownImg);
        }

        // ⭐ Typing badge — toggle class (ไม่ลบ element)
        const badge = avatarEl.querySelector('.typing-badge');
        if (badge) {
            const isTyping = typingUsers.some(t => t.uid === player.uid);
            badge.classList.toggle('show', isTyping);
        }

        // ⭐ Ready banner
        const banner = document.createElement('div');
        banner.className = 'ready-banner';
        if (player.isReady) {
            banner.classList.add('ready');
            banner.textContent = 'READY';
        } else {
            banner.classList.add('not-ready');
            banner.textContent = 'NOT READY';
        }
        slot.appendChild(banner);
    });

    renderLobby._previousUids = currentUids;
}

// ============================================
// EXPORTS
// ============================================
export const AvatarActions = {
    confirm: () => LobbyActions.confirmAvatar(),
    cancel: () => LobbyActions.cancelAvatar(),
};

export const ChatActions = {
    send: () => sendChatMessage(),
    handleTyping: () => LobbyActions.handleTyping(),
};

export const ReadyActions = {
    toggle: () => LobbyActions.toggleReady(),
};