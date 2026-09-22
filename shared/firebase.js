// ============================================
// 🔥 FIREBASE WRAPPER
// ============================================
import { FIREBASE_CONFIG, FIREBASE_VERSION } from '../config/firebase-config.js';
import { GAME_CONFIG } from '../config/game-config.js';

// --- Firestore ---
const { initializeApp } = await import(
    `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`
);
const fb = await import(
    `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`
);

// --- Realtime Database ---
const rtdbModule = await import(
    `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-database.js`
);

const app = initializeApp(FIREBASE_CONFIG);
export const db = fb.getFirestore(app);
export const rtdb = rtdbModule.getDatabase(app);

// --- Firestore functions ---
export const {
    doc, setDoc, getDoc, updateDoc, deleteDoc,
    onSnapshot, collection, query, where, getDocs,
} = fb;

// --- Realtime DB functions ---
export const {
    ref: rtdbRef,
    set: rtdbSet,
    remove: rtdbRemove,
    onDisconnect: rtdbOnDisconnect,
    onValue: rtdbOnValue,
    push: rtdbPush,
    query: rtdbQuery,
    limitToLast: rtdbLimitToLast,
} = rtdbModule;

// ============================================
// 📦 ROOM API
// ============================================
const ROOMS_COLLECTION = 'rooms';

export const RoomAPI = {
    async get(code) {
        const snap = await getDoc(doc(db, ROOMS_COLLECTION, code));
        return snap.exists() ? snap.data() : null;
    },

    async create(code, hostPlayer) {
        const now = Date.now();
        const roomData = {
            code,
            hostId: hostPlayer.uid,
            status: 'waiting',
            players: [hostPlayer],
            winner: null,
            createdAt: now,
            lastActivity: now,
            expiresAt: now + GAME_CONFIG.ROOM_MAX_LIFETIME_MS,
        };
        await setDoc(doc(db, ROOMS_COLLECTION, code), roomData);
        return roomData;
    },

    async update(code, updates) {
        await updateDoc(doc(db, ROOMS_COLLECTION, code), {
            ...updates,
            lastActivity: Date.now(),
        });
    },

    async delete(code) {
        await deleteDoc(doc(db, ROOMS_COLLECTION, code));
    },

    listen(code, callback) {
        return onSnapshot(doc(db, ROOMS_COLLECTION, code), (snap) => {
            callback(snap.exists() ? snap.data() : null);
        });
    },
};

// ============================================
// 👤 PRESENCE API
// ============================================
export const PresenceAPI = {
    async goOnline(roomCode, player) {
        const presenceRef = rtdbRef(rtdb, `rooms/${roomCode}/presence/${player.uid}`);
        await rtdbSet(presenceRef, {
            name: player.name,
            joinedAt: Date.now(),
        });
        await rtdbOnDisconnect(presenceRef).remove();
        console.log('🟢 Online:', player.name);
    },

    async goOffline(roomCode, uid) {
        const presenceRef = rtdbRef(rtdb, `rooms/${roomCode}/presence/${uid}`);
        await rtdbRemove(presenceRef);
        console.log('🔴 Offline:', uid);
    },

    listenOnlinePlayers(roomCode, callback) {
        const presenceRef = rtdbRef(rtdb, `rooms/${roomCode}/presence`);
        return rtdbOnValue(presenceRef, (snapshot) => {
            const data = snapshot.val() || {};
            callback(Object.keys(data));
        });
    },

    async clearRoom(roomCode) {
        const presenceRef = rtdbRef(rtdb, `rooms/${roomCode}/presence`);
        await rtdbRemove(presenceRef);
        console.log('🧹 ล้าง presence:', roomCode);
    },
};

// ============================================
// 💬 CHAT API
// ============================================
export const ChatAPI = {
    async sendMessage(roomCode, player, text) {
        if (!roomCode || !text.trim()) return;

        const messagesRef = rtdbRef(rtdb, `rooms/${roomCode}/messages`);
        const newMsgRef = rtdbPush(messagesRef);

        await rtdbSet(newMsgRef, {
            uid: player.uid,
            name: player.name,
            text: text.trim().slice(0, 100),
            timestamp: Date.now(),
            type: 'user',
        });
    },

    async sendSystemMessage(roomCode, text) {
        if (!roomCode || !text.trim()) return;

        const messagesRef = rtdbRef(rtdb, `rooms/${roomCode}/messages`);
        const newMsgRef = rtdbPush(messagesRef);

        await rtdbSet(newMsgRef, {
            text: text.trim(),
            timestamp: Date.now(),
            type: 'system',
        });
    },

    listenMessages(roomCode, callback) {
        const messagesRef = rtdbRef(rtdb, `rooms/${roomCode}/messages`);
        const q = rtdbQuery(messagesRef, rtdbLimitToLast(20));

        return rtdbOnValue(q, (snapshot) => {
            const data = snapshot.val() || {};
            const messages = Object.values(data);
            callback(messages);
        });
    },

    async clearMessages(roomCode) {
        const messagesRef = rtdbRef(rtdb, `rooms/${roomCode}/messages`);
        await rtdbRemove(messagesRef);
        console.log('🧹 ล้าง chat:', roomCode);
    },
};

// ============================================
// 📋 GAME LOG API — Event Log ในเกม
// ============================================
export const GameLogAPI = {
    async addLog(roomCode, text) {
        if (!roomCode || !text) return;

        const logsRef = rtdbRef(rtdb, `rooms/${roomCode}/logs`);
        const newLogRef = rtdbPush(logsRef);

        await rtdbSet(newLogRef, {
            text: text.trim(),
            timestamp: Date.now(),
        });
    },

    listenLogs(roomCode, callback) {
        const logsRef = rtdbRef(rtdb, `rooms/${roomCode}/logs`);
        const q = rtdbQuery(logsRef, rtdbLimitToLast(50));

        return rtdbOnValue(q, (snapshot) => {
            const data = snapshot.val() || {};
            const logs = Object.values(data);
            callback(logs);
        });
    },

    async clearLogs(roomCode) {
        const logsRef = rtdbRef(rtdb, `rooms/${roomCode}/logs`);
        await rtdbRemove(logsRef);
        console.log('🧹 ล้าง log:', roomCode);
    },
};

// ============================================
// 🎮 GAME API
// ============================================
export const GameAPI = {

    createDeck() {
        const deck = [];
        for (let i = 1; i <= 20; i++) {
            deck.push({ rank: i, isStar: false });
        }
        deck.push({ rank: 1, isStar: true });
        deck.push({ rank: 20, isStar: true });
        return deck;
    },

    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    async startGame(roomCode) {
        const room = await RoomAPI.get(roomCode);
        if (!room) throw new Error('ROOM_NOT_FOUND');

        let deck = this.createDeck();
        deck = this.shuffle(deck);

        const hands = {};
        const players = room.players.map(p => {
            const hand = [deck.pop(), deck.pop()];
            hands[p.uid] = hand;

            return {
                ...p,
                hearts: 10,
                isAlive: true,
                handSize: 2,
                thrownCard: null,
                handCard: null,
                decision: null,
                hasThrown: false,
                hasDecided: false,
            };
        });

        for (const uid in hands) {
            await setDoc(doc(db, 'rooms', roomCode, 'hands', uid), {
                cards: hands[uid],
            });
        }

        await RoomAPI.update(roomCode, {
            status: 'playing',
            phase: 'discard',
            round: 1,
            players,
            deck,
            discardPile: [],
            turnOrder: players.map(p => p.uid),
            currentTurnIndex: 0,
            currentTurn: players[0].uid,
            showdownResult: null,
            winner: null,
        });

        console.log('🎮 เกมเริ่ม:', roomCode);
    },

    async getMyHand(roomCode, uid) {
        const snap = await getDoc(doc(db, 'rooms', roomCode, 'hands', uid));
        return snap.exists() ? snap.data().cards : [];
    },

    async throwCard(roomCode, uid, cardIndex) {
        const room = await RoomAPI.get(roomCode);
        if (!room) throw new Error('ROOM_NOT_FOUND');
        if (room.phase !== 'discard') throw new Error('WRONG_PHASE');
        if (room.currentTurn !== uid) throw new Error('NOT_YOUR_TURN');

        const handSnap = await getDoc(doc(db, 'rooms', roomCode, 'hands', uid));
        if (!handSnap.exists()) throw new Error('HAND_NOT_FOUND');
        const hand = handSnap.data().cards;

        if (cardIndex < 0 || cardIndex >= hand.length) throw new Error('INVALID_CARD');

        const thrownCard = hand[cardIndex];
        const newHand = hand.filter((_, i) => i !== cardIndex);
        const handCard = newHand[0] || null;

        await setDoc(doc(db, 'rooms', roomCode, 'hands', uid), {
            cards: newHand,
        });

        const updatedPlayers = room.players.map(p => {
            if (p.uid === uid) {
                return {
                    ...p,
                    thrownCard,
                    handCard,
                    handSize: newHand.length,
                    hasThrown: true,
                };
            }
            return p;
        });

        const newDiscardPile = [...room.discardPile, { uid, card: thrownCard }];
        const allThrown = updatedPlayers.every(p => p.hasThrown);

        let updateData = {
            players: updatedPlayers,
            discardPile: newDiscardPile,
        };

        if (allThrown) {
            updateData.phase = 'decide';
            updateData.currentTurnIndex = 0;
            updateData.currentTurn = room.turnOrder[0];
            await ChatAPI.sendSystemMessage(roomCode, `✅ ทุกคนทิ้งครบ → เข้าสู่ขั้นตัดสินใจ`);
        } else {
            updateData.currentTurnIndex = room.currentTurnIndex + 1;
            updateData.currentTurn = room.turnOrder[updateData.currentTurnIndex];
        }

        await RoomAPI.update(roomCode, updateData);

        // ⭐ ไม่ส่ง system message (ใช้ GameLogAPI แทน)

    },

    async decide(roomCode, uid, decision) {
        const room = await RoomAPI.get(roomCode);
        if (!room) throw new Error('ROOM_NOT_FOUND');
        if (room.phase !== 'decide') throw new Error('WRONG_PHASE');
        if (room.currentTurn !== uid) throw new Error('NOT_YOUR_TURN');
        if (!['fight', 'fold'].includes(decision)) throw new Error('INVALID_DECISION');

        const updatedPlayers = room.players.map(p => {
            if (p.uid === uid) {
                return { ...p, decision, hasDecided: true };
            }
            return p;
        });

        const allDecided = updatedPlayers.every(p => p.hasDecided);
        let updateData = { players: updatedPlayers };

        if (allDecided) {
            updateData.phase = 'showdown';
        } else {
            let nextIndex = room.currentTurnIndex + 1;
            while (nextIndex < room.turnOrder.length) {
                const nextUid = room.turnOrder[nextIndex];
                const nextPlayer = updatedPlayers.find(p => p.uid === nextUid);
                if (nextPlayer && !nextPlayer.hasDecided) break;
                nextIndex++;
            }

            if (nextIndex >= room.turnOrder.length) {
                updateData.phase = 'showdown';
            } else {
                updateData.currentTurnIndex = nextIndex;
                updateData.currentTurn = room.turnOrder[nextIndex];
            }
        }

        await RoomAPI.update(roomCode, updateData);

        // ⭐ ไม่ส่ง system message

    },

    async startNewRound(roomCode) {
        const room = await RoomAPI.get(roomCode);
        if (!room) throw new Error('ROOM_NOT_FOUND');

        const alivePlayers = room.players.filter(p => p.hearts > 0 && p.isAlive);

        if (alivePlayers.length <= 1) {
            const winner = alivePlayers[0];
            await RoomAPI.update(roomCode, {
                status: 'finished',
                winner: winner ? winner.uid : null,
            });
            return { finished: true, winner };
        }

        let deck = this.createDeck();
        deck = this.shuffle(deck);

        const hands = {};
        const updatedPlayers = room.players.map(p => {
            if (!p.isAlive || p.hearts <= 0) {
                return { ...p, hasThrown: true, hasDecided: true, decision: 'fold' };
            }

            const hand = [deck.pop(), deck.pop()];
            hands[p.uid] = hand;

            return {
                ...p,
                handSize: 2,
                thrownCard: null,
                handCard: null,
                decision: null,
                hasThrown: false,
                hasDecided: false,
            };
        });

        for (const uid in hands) {
            await setDoc(doc(db, 'rooms', roomCode, 'hands', uid), {
                cards: hands[uid],
            });
        }

        const aliveUids = updatedPlayers
            .filter(p => p.isAlive && p.hearts > 0)
            .map(p => p.uid);

        await RoomAPI.update(roomCode, {
            phase: 'discard',
            round: room.round + 1,
            players: updatedPlayers,
            deck,
            discardPile: [],
            turnOrder: aliveUids,
            currentTurnIndex: 0,
            currentTurn: aliveUids[0],
            showdownResult: null,
        });

        return { finished: false };
    },
};

// ============================================
// 🧹 CLEANUP API
// ============================================
export const CleanupAPI = {
    async cleanupIdleRooms(timeoutMs) {
        try {
            const cutoff = Date.now() - timeoutMs;
            const q = query(
                collection(db, ROOMS_COLLECTION),
                where('lastActivity', '<', cutoff)
            );
            const snapshot = await getDocs(q);
            for (const roomDoc of snapshot.docs) {
                await deleteDoc(doc(db, ROOMS_COLLECTION, roomDoc.id));
                console.log('🧹 ลบห้องไม่มีกิจกรรม:', roomDoc.id);
            }
        } catch (err) {
            console.error('⚠️ Cleanup idle error:', err);
        }
    },

    async cleanupExpiredRooms() {
        try {
            const now = Date.now();
            const q = query(
                collection(db, ROOMS_COLLECTION),
                where('expiresAt', '<', now)
            );
            const snapshot = await getDocs(q);

            let count = 0;
            for (const roomDoc of snapshot.docs) {
                await deleteDoc(doc(db, ROOMS_COLLECTION, roomDoc.id));
                console.log('🧹 ลบห้องหมดอายุ:', roomDoc.id);
                count++;
            }
            if (count > 0) console.log(`🧹 ลบ ${count} ห้องที่หมดอายุ`);
        } catch (err) {
            console.error('⚠️ Cleanup expired error:', err);
        }
    },
};

console.log('🔥 Firebase initialized:', FIREBASE_CONFIG.projectId);