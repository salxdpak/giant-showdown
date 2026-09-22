// ============================================
// 🚀 APP - Entry Point
// ============================================
import { GAME_CONFIG, UI_TEXT } from './config/game-config.js';
import { CleanupAPI, ChatAPI } from './shared/firebase.js';
import { state } from './shared/state.js';
import { LobbyActions, AvatarActions, ChatActions, ReadyActions } from './lobby/lobby.js';
import { GameplayActions, startGameListener } from './gameplay/gameplay.js';

window.GameplayActions = GameplayActions;
window.startGameListener = startGameListener;

// ============================================
// ⭐ Helper
// ============================================
function setBtnText(id, text) {
    const el = document.querySelector(`#${id} .game-btn__text`);
    if (el) el.textContent = text;
}

// ============================================
// APPLY UI TEXT
// ============================================
function applyUIText() {
    document.getElementById('game-title').textContent = UI_TEXT.GAME_TITLE;
    document.getElementById('player-name').placeholder = UI_TEXT.HOME.NAME_PLACEHOLDER;
    document.getElementById('room-code-input').placeholder = UI_TEXT.HOME.ROOM_CODE_PLACEHOLDER;

    setBtnText('btn-create-room', UI_TEXT.HOME.BTN_CREATE);
    setBtnText('btn-join-room', UI_TEXT.HOME.BTN_JOIN);

    document.getElementById('avatar-title').textContent = UI_TEXT.AVATAR.TITLE;
    document.getElementById('avatar-subtitle').textContent = UI_TEXT.AVATAR.SUBTITLE;
    setBtnText('btn-avatar-confirm', UI_TEXT.AVATAR.BTN_CONFIRM);
    setBtnText('btn-avatar-cancel', UI_TEXT.AVATAR.BTN_CANCEL);

    document.getElementById('btn-copy-code').textContent = UI_TEXT.LOBBY.BTN_COPY;
    setBtnText('btn-start', UI_TEXT.LOBBY.BTN_START);
    setBtnText('btn-leave', UI_TEXT.LOBBY.BTN_LEAVE);
    setBtnText('btn-ready', UI_TEXT.LOBBY.BTN_READY);

    document.getElementById('winner-title').textContent = UI_TEXT.GAMEPLAY.WINNER_TITLE;
    setBtnText('btn-back-home', UI_TEXT.GAMEPLAY.BTN_BACK);
}

// ============================================
// NAME COUNTER
// ============================================
function setupNameCounter() {
    const input = document.getElementById('player-name');
    const counter = document.getElementById('name-counter');
    const max = 10;

    input.addEventListener('input', () => {
        const len = input.value.length;
        counter.textContent = `${len}/${max}`;
        if (len >= max) counter.classList.add('full');
        else counter.classList.remove('full');
    });

    counter.textContent = `0/${max}`;
}

// ============================================
// ⭐ GAMEPLAY CHAT SEND
// ============================================
async function sendGameChat() {
    const input = document.getElementById('game-chat-input');
    const text = input.value.trim();
    if (!text) return;

    const me = state.players.find(p => p.uid === state.myUid);
    if (!me) return;

    try {
        await ChatAPI.sendMessage(state.roomCode, me, text);
    } catch (err) {
        console.error('Chat send error:', err);
    }

    input.value = '';
    input.focus();
}

// ============================================
// BIND EVENTS
// ============================================
function bindEvents() {
    // --- Home ---
    document.getElementById('btn-create-room')
        .addEventListener('click', () => LobbyActions.createRoom());

    document.getElementById('btn-join-room')
        .addEventListener('click', () => LobbyActions.joinRoom());

    // --- Avatar Picker ---
    document.getElementById('btn-avatar-confirm')
        .addEventListener('click', () => AvatarActions.confirm());

    document.getElementById('btn-avatar-cancel')
        .addEventListener('click', () => AvatarActions.cancel());

    // --- Lobby ---
    document.getElementById('btn-leave')
        .addEventListener('click', () => LobbyActions.leaveRoom());

    document.getElementById('btn-start')
        .addEventListener('click', () => GameplayActions.startGame());

    document.getElementById('btn-ready')
        .addEventListener('click', () => ReadyActions.toggle());

    document.getElementById('btn-copy-code')
        .addEventListener('click', async () => {
            const btn = document.getElementById('btn-copy-code');
            try {
                await navigator.clipboard.writeText(state.roomCode);
            } catch (err) { return; }
            const originalText = UI_TEXT.LOBBY.BTN_COPY;
            btn.textContent = 'คัดลอกแล้ว ✓';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 2000);
        });

    // --- Lobby Chat ---
    document.getElementById('btn-chat-send')
        .addEventListener('click', () => ChatActions.send());

    document.getElementById('chat-input')
        .addEventListener('keypress', (e) => {
            if (e.key === 'Enter') ChatActions.send();
        });

    // ⭐ Gameplay Chat
    document.getElementById('btn-game-chat-send')
        .addEventListener('click', sendGameChat);

    document.getElementById('game-chat-input')
        .addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendGameChat();
        });

    // --- Gameplay Actions ---
    document.getElementById('btn-discard')
        .addEventListener('click', () => GameplayActions.throwCard());

    document.getElementById('btn-fight')
        .addEventListener('click', () => GameplayActions.decide('fight'));

    document.getElementById('btn-fold')
        .addEventListener('click', () => GameplayActions.decide('fold'));

    document.getElementById('btn-back-home')
        .addEventListener('click', () => GameplayActions.backToHome());
}

// ============================================
// AUTO CLEANUP
// ============================================
function startCleanupTimers() {
    setInterval(() => {
        CleanupAPI.cleanupIdleRooms(GAME_CONFIG.ROOM_CLEANUP_MS);
    }, 60 * 1000);

    setInterval(() => {
        CleanupAPI.cleanupExpiredRooms();
    }, 5 * 60 * 1000);

    CleanupAPI.cleanupExpiredRooms();
}

// ============================================
// INIT
// ============================================
applyUIText();
bindEvents();
setupNameCounter();
startCleanupTimers();

console.log('🎮 Ready. UID:', state.myUid);