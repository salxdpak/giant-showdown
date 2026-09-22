// ============================================
// 📦 SHARED STATE
// ============================================

export const state = {
    // ตัวเอง
    myUid: 'u_' + Math.random().toString(36).substring(2, 10),
    myName: '',

    // ห้อง
    roomCode: null,
    isHost: false,
    players: [],
    status: 'waiting',
    winner: null,

    // Listener
    unsubscribeRoom: null,

    // ⭐ Ready
    myReady: false,
};

export const StateManager = {
    reset() {
        state.roomCode = null;
        state.isHost = false;
        state.players = [];
        state.status = 'waiting';
        state.winner = null;
        state.myReady = false;   // ⭐ reset
    },

    getMe() {
        return state.players.find(p => p.uid === state.myUid);
    },

    getHost() {
        return state.players.find(p => p.isHost);
    },

    // ⭐ เช็คว่าทุกคนพร้อมไหม
    isEveryoneReady() {
        if (state.players.length < 2) return false;
        return state.players.every(p => p.isReady === true);
    },

    // ⭐ นับจำนวนคนพร้อม
    countReady() {
        return state.players.filter(p => p.isReady === true).length;
    },
};