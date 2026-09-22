// ============================================
// 🎮 GAMEPLAY - Flow หลัก
// ============================================
import { GAME_CONFIG, UI_TEXT } from '../config/game-config.js';
import {
    RoomAPI, PresenceAPI, ChatAPI, GameAPI, GameLogAPI, TypingAPI
} from '../shared/firebase.js';
import { PresenceManager } from '../shared/presence.js';
import { state, StateManager } from '../shared/state.js';
import { switchScreen } from '../shared/utils.js';
import { LobbyActions } from '../lobby/lobby.js';
import { Modal } from '../shared/modal.js';
import {
    determineWinner,
    calculateHearts,
    checkGameOver,
} from './gameplay-logic.js';
import {
    renderGame,
    renderShowdown,
    renderGameChat,
    renderEventLog,
    getSelectedCardIndex,
    resetSelection,
    setTypingUsers,
} from './gameplay-ui.js';

// ============================================
// ⭐ Module State
// ============================================
let lastShowdownResult = null;
let isProcessingShowdown = false;
let isAfterShowdown = false;
let unsubscribeGameChat = null;
let unsubscribeGameLog = null;
let unsubscribeTyping = null;

let thrownLoggedAt = 0;
let newRoundLoggedAt = 0;

// ⭐ Typing state
let myTypingState = false;

function isHost() {
    return state.isHost === true;
}

// ============================================
// Gameplay Actions
// ============================================
export const GameplayActions = {

    async startGame() {
        try {
            const room = await RoomAPI.get(state.roomCode);
            if (!room) throw new Error('ROOM_NOT_FOUND');
            if (room.players.length < GAME_CONFIG.MIN_PLAYERS) {
                await Modal.alert(UI_TEXT.ERR.NEED_MORE_PLAYERS, {
                    icon: '👥',
                    title: 'ผู้เล่นไม่พอ',
                });
                return;
            }

            console.log('🎮 [startGame] เริ่มเกม...');

            LobbyActions.stopListening();
            await GameAPI.startGame(state.roomCode);

            if (isHost()) {
                await GameLogAPI.addLog(state.roomCode, '🎮 เกมเริ่ม! แจกไพ่คนละ 2 ใบ');
            }

            startGameListener();

        } catch (err) {
            console.error('Start game error:', err);
            await Modal.alert('เริ่มเกมไม่สำเร็จ: ' + err.message, {
                icon: '❌',
                title: 'เกิดข้อผิดพลาด',
            });
        }
    },

    async throwCard() {
        try {
            const cardIndex = getSelectedCardIndex();
            if (cardIndex === null) {
                await Modal.alert('กรุณาเลือกการ์ดก่อนทิ้ง', {
                    icon: '🃏',
                    title: 'ยังไม่ได้เลือกการ์ด',
                });
                return;
            }

            const me = state.players.find(p => p.uid === state.myUid);

            await GameAPI.throwCard(state.roomCode, state.myUid, cardIndex);
            resetSelection();

            if (me) {
                await GameLogAPI.addLog(state.roomCode, `🎴 ${me.name} ทิ้งไพ่`);
            }

            if (isHost()) {
                const now = Date.now();
                if (now - thrownLoggedAt > 3000) {
                    const room = await RoomAPI.get(state.roomCode);
                    if (room && room.phase === 'decide') {
                        thrownLoggedAt = now;
                        await GameLogAPI.addLog(
                            state.roomCode,
                            '✅ ทุกคนทิ้งครบ → เข้าสู่ขั้นตัดสินใจ'
                        );
                    }
                }
            }

        } catch (err) {
            console.error('Throw error:', err);
            await Modal.alert('ทิ้งไม่สำเร็จ: ' + err.message, {
                icon: '❌',
                title: 'เกิดข้อผิดพลาด',
            });
        }
    },

    async decide(decision) {
        try {
            const me = state.players.find(p => p.uid === state.myUid);

            await GameAPI.decide(state.roomCode, state.myUid, decision);

            if (me) {
                const emoji = decision === 'fight' ? '⚔️' : '🏳️';
                await GameLogAPI.addLog(
                    state.roomCode,
                    `${emoji} ${me.name} เลือก ${decision.toUpperCase()}`
                );
            }

        } catch (err) {
            console.error('Decide error:', err);
            await Modal.alert('ตัดสินใจไม่สำเร็จ: ' + err.message, {
                icon: '❌',
                title: 'เกิดข้อผิดพลาด',
            });
        }
    },

    async processShowdown() {
        try {
            if (!isHost()) return;

            const room = await RoomAPI.get(state.roomCode);
            if (!room || room.phase !== 'showdown') return;
            if (room.showdownResult) return;

            console.log('⚙️ [processShowdown] กำลังคำนวณ...');

            const { winnerUid } = determineWinner(room.players);
            const updatedPlayers = calculateHearts(room.players, winnerUid);
            const { gameOver, winner } = checkGameOver(updatedPlayers);

            await RoomAPI.update(state.roomCode, {
                players: updatedPlayers,
                showdownResult: {
                    winnerUid,
                    calculatedAt: Date.now(),
                },
                status: gameOver ? 'finished' : 'playing',
                winner: gameOver && winner ? winner.uid : null,
            });

            if (winnerUid) {
                const winnerName = room.players.find(p => p.uid === winnerUid)?.name;
                await GameLogAPI.addLog(state.roomCode, `🏆 ${winnerName} ชนะรอบนี้`);
            } else {
                await GameLogAPI.addLog(state.roomCode, `🤷 ไม่มีผู้ชนะรอบนี้`);
            }

        } catch (err) {
            console.error('❌ [processShowdown]:', err);
        }
    },

    async afterShowdown() {
        if (isAfterShowdown) return;
        isAfterShowdown = true;

        try {
            if (!isHost()) {
                isAfterShowdown = false;
                return;
            }

            const room = await RoomAPI.get(state.roomCode);
            if (!room) {
                isAfterShowdown = false;
                return;
            }

            if (room.status === 'finished') {
                const winner = room.players.find(p => p.uid === room.winner);
                document.getElementById('winner-name').textContent =
                    winner ? winner.name : 'ไม่มีผู้ชนะ';

                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById('result-screen').classList.add('active');
                isAfterShowdown = false;
                return;
            }

            await GameAPI.startNewRound(state.roomCode);

            const now = Date.now();
            if (now - newRoundLoggedAt > 3000) {
                newRoundLoggedAt = now;
                await GameLogAPI.addLog(state.roomCode, `🔁 รอบใหม่เริ่ม`);
            }

            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('game-screen').classList.add('active');

            lastShowdownResult = null;
            isProcessingShowdown = false;
            isAfterShowdown = false;

        } catch (err) {
            console.error('❌ [afterShowdown]:', err);
            isAfterShowdown = false;
        }
    },

    // ⭐ เรียกจาก input event ของ game chat
    async handleTyping() {
        const input = document.getElementById('game-chat-input');
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

    backToHome() {
        PresenceManager.stop();
        LobbyActions.stopListening();

        if (unsubscribeGameChat) {
            unsubscribeGameChat();
            unsubscribeGameChat = null;
        }
        if (unsubscribeGameLog) {
            unsubscribeGameLog();
            unsubscribeGameLog = null;
        }
        if (unsubscribeTyping) {
            unsubscribeTyping();
            unsubscribeTyping = null;
        }

        // reset typing
        myTypingState = false;
        setTypingUsers([]);

        StateManager.reset();
        switchScreen('home');
        console.log('🏠 กลับหน้าแรก');
    },
};

// ============================================
// ⭐ GAME STATE LISTENER
// ============================================
export function startGameListener() {
    if (state.unsubscribeRoom) state.unsubscribeRoom();

    console.log('👂 [startGameListener] เริ่มฟัง');

    if (unsubscribeGameChat) unsubscribeGameChat();
    unsubscribeGameChat = ChatAPI.listenMessages(state.roomCode, (messages) => {
        renderGameChat(messages, state.myUid);
    });

    if (unsubscribeGameLog) unsubscribeGameLog();
    unsubscribeGameLog = GameLogAPI.listenLogs(state.roomCode, (logs) => {
        renderEventLog(logs);
    });

    // ⭐ Typing listener
    if (unsubscribeTyping) unsubscribeTyping();
    unsubscribeTyping = TypingAPI.listenTyping(state.roomCode, (users) => {
        setTypingUsers(users);
    });

    state.unsubscribeRoom = RoomAPI.listen(state.roomCode, async (room) => {
        if (!room) return;

        state.players = room.players;
        state.status = room.status;

        const me = room.players.find(p => p.uid === state.myUid);
        if (me) state.myReady = me.isReady || false;

        if (room.status === 'finished') {
            const winner = room.players.find(p => p.uid === room.winner);
            document.getElementById('winner-name').textContent =
                winner ? winner.name : 'ไม่มีผู้ชนะ';

            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('result-screen').classList.add('active');

            if (isHost()) {
                setTimeout(() => {
                    LobbyActions.scheduleRoomDelete(state.roomCode);
                }, 5000);
            }
            return;
        }

        if (room.status !== 'playing') return;

        if (room.phase === 'showdown') {
            if (!room.showdownResult) {
                if (!isProcessingShowdown) {
                    isProcessingShowdown = true;
                    await GameplayActions.processShowdown();
                    isProcessingShowdown = false;
                }
                return;
            }

            if (lastShowdownResult !== room.showdownResult.calculatedAt) {
                lastShowdownResult = room.showdownResult.calculatedAt;

                const showdownPlayers = room.players
                    .filter(p => p.isAlive && p.hearts > 0)
                    .map(p => ({
                        uid: p.uid,
                        name: p.name,
                        handCard: p.handCard,
                        thrownCard: p.thrownCard,
                        hearts: p.hearts,
                        isFolded: p.decision === 'fold',
                    }));

                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById('showdown-screen').classList.add('active');

                renderShowdown({
                    players: showdownPlayers,
                    winnerUid: room.showdownResult.winnerUid,
                }, () => {
                    GameplayActions.afterShowdown();
                });
            }
            return;
        }

        const gameScreen = document.getElementById('game-screen');

        if (!gameScreen.classList.contains('active')) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            gameScreen.classList.add('active');
        }

        const myHand = await GameAPI.getMyHand(state.roomCode, state.myUid);

        renderGame({
            myUid: state.myUid,
            currentTurn: room.currentTurn,
            phase: room.phase,
            players: room.players.map(p => ({
                ...p,
                cardCount: p.handSize || 0,
            })),
            discardPile: room.discardPile.map(d => d.card),
            myHand,
        });
    });
}