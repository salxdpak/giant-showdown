// ============================================
// 🎮 GAMEPLAY - Flow หลัก
// ============================================
import { GAME_CONFIG, UI_TEXT } from '../config/game-config.js';
import {
    RoomAPI, PresenceAPI, ChatAPI, GameAPI, GameLogAPI
} from '../shared/firebase.js';
import { PresenceManager } from '../shared/presence.js';
import { state, StateManager } from '../shared/state.js';
import { switchScreen } from '../shared/utils.js';
import { LobbyActions } from '../lobby/lobby.js';
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
} from './gameplay-ui.js';

// ============================================
// ⭐ Module State
// ============================================
let lastShowdownResult = null;
let isProcessingShowdown = false;
let isAfterShowdown = false;
let unsubscribeGameChat = null;
let unsubscribeGameLog = null;

// ============================================
// Gameplay Actions
// ============================================
export const GameplayActions = {

    async startGame() {
        try {
            const room = await RoomAPI.get(state.roomCode);
            if (!room) throw new Error('ROOM_NOT_FOUND');
            if (room.players.length < GAME_CONFIG.MIN_PLAYERS) {
                return alert(UI_TEXT.ERR.NEED_MORE_PLAYERS);
            }

            console.log('🎮 [startGame] เริ่มเกม...');

            LobbyActions.stopListening();
            await GameAPI.startGame(state.roomCode);
            await GameLogAPI.addLog(state.roomCode, '🎮 เกมเริ่ม! แจกไพ่คนละ 2 ใบ');
            startGameListener();

            console.log('🎮 [startGame] เสร็จ');

        } catch (err) {
            console.error('Start game error:', err);
            alert('เริ่มเกมไม่สำเร็จ: ' + err.message);
        }
    },

    async throwCard() {
        try {
            const cardIndex = getSelectedCardIndex();
            if (cardIndex === null) {
                alert('กรุณาเลือกการ์ดก่อน');
                return;
            }

            const me = state.players.find(p => p.uid === state.myUid);

            console.log('🎴 [throwCard] index:', cardIndex);
            await GameAPI.throwCard(state.roomCode, state.myUid, cardIndex);
            resetSelection();

            if (me) {
                await GameLogAPI.addLog(state.roomCode, `🎴 ${me.name} ทิ้งไพ่`);
            }

        } catch (err) {
            console.error('Throw error:', err);
            alert('ทิ้งไม่สำเร็จ: ' + err.message);
        }
    },

    async decide(decision) {
        try {
            const me = state.players.find(p => p.uid === state.myUid);

            console.log('⚔️ [decide]', decision);
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
            alert('ตัดสินใจไม่สำเร็จ: ' + err.message);
        }
    },

    async processShowdown() {
        try {
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

            console.log('✅ [processShowdown] เสร็จ');

        } catch (err) {
            console.error('❌ [processShowdown]:', err);
        }
    },

    async afterShowdown() {
        if (isAfterShowdown) return;
        isAfterShowdown = true;

        try {
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
            await GameLogAPI.addLog(state.roomCode, `🔁 รอบใหม่เริ่ม`);

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

    // ⭐ Listen Chat
    if (unsubscribeGameChat) unsubscribeGameChat();
    unsubscribeGameChat = ChatAPI.listenMessages(state.roomCode, (messages) => {
        renderGameChat(messages, state.myUid);
    });

    // ⭐ Listen Log
    if (unsubscribeGameLog) unsubscribeGameLog();
    unsubscribeGameLog = GameLogAPI.listenLogs(state.roomCode, (logs) => {
        renderEventLog(logs);
    });

    // ⭐ Room listener
    state.unsubscribeRoom = RoomAPI.listen(state.roomCode, async (room) => {
        if (!room) return;

        state.players = room.players;
        state.status = room.status;

        const me = room.players.find(p => p.uid === state.myUid);
        if (me) state.myReady = me.isReady || false;

        // --- Game Finished ---
        if (room.status === 'finished') {
            const winner = room.players.find(p => p.uid === room.winner);
            document.getElementById('winner-name').textContent =
                winner ? winner.name : 'ไม่มีผู้ชนะ';

            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('result-screen').classList.add('active');

            setTimeout(() => {
                LobbyActions.scheduleRoomDelete(state.roomCode);
            }, 5000);
            return;
        }

        if (room.status !== 'playing') return;

        // --- Showdown Phase ---
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

        // --- Discard / Decide ---
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