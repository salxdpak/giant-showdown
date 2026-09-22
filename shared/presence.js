// ============================================
// 👤 PRESENCE MANAGER - จัดการผู้เล่นผี
// ============================================
import { RoomAPI, PresenceAPI } from './firebase.js';
import { state, StateManager } from './state.js';
import { switchScreen } from './utils.js';

export const PresenceManager = {

    // Listener ของ presence
    unsubscribePresence: null,

    // ============================================
    // เริ่มติดตาม presence
    // ============================================
    start(roomCode) {
        this.stop();  // กันซ้ำ

        this.unsubscribePresence = PresenceAPI.listenOnlinePlayers(
            roomCode,
            (onlineUids) => this.onPresenceChange(onlineUids)
        );

        console.log('👁 เริ่มติดตาม presence');
    },

    // ============================================
    // หยุดติดตาม
    // ============================================
    stop() {
        if (this.unsubscribePresence) {
            this.unsubscribePresence();
            this.unsubscribePresence = null;
            console.log('👁 หยุดติดตาม presence');
        }
    },

    // ============================================
    // เมื่อมีคน online/offline เปลี่ยน
    // ============================================
    async onPresenceChange(onlineUids) {
        if (!state.roomCode) return;
        if (onlineUids.length === 0) return;  // ห้องว่าง? ข้าม

        // ตรวจหาผู้เล่นผี (หายไปจาก Realtime DB)
        const ghostPlayers = state.players.filter(
            p => !onlineUids.includes(p.uid)
        );

        if (ghostPlayers.length === 0) return;

        console.log('👻 พบผู้เล่นผี:', ghostPlayers.map(p => p.name));

        // ⭐ เช็คว่า host ยังอยู่ไหม
        const currentHost = state.players.find(p => p.isHost);
        const hostIsGhost = currentHost
            ? ghostPlayers.some(p => p.uid === currentHost.uid)
            : false;

        // ---------- กรณีที่ 1: เราเป็น host ----------
        if (state.isHost) {
            console.log('🎯 เราเป็น host — ลบผู้เล่นผี');
            await this.removeGhostPlayers(ghostPlayers);
            return;
        }

        // ---------- กรณีที่ 2: host ยังอยู่ (แต่เราไม่ใช่ host) ----------
        if (!hostIsGhost) {
            console.log('⏳ รอ host ลบ...');
            return;
        }

        // ---------- กรณีที่ 3: host หาย → คนแรกทำหน้าที่แทน ----------
        console.log('⚠️ host หาย — หาคนลบแทน');

        // เรียง uid → คนแรกสุดทำหน้าที่แทน
        const onlineUidsSorted = [...onlineUids].sort();
        const shouldIHandle = onlineUidsSorted[0] === state.myUid;

        if (!shouldIHandle) {
            console.log('⏳ รอ', onlineUidsSorted[0], 'ลบ');
            return;
        }

        console.log('🎯 เราเป็นคนแรก — ลบผู้เล่นผี (รวม host)');
        await this.removeGhostPlayers(ghostPlayers);
    },

    // ============================================
    // ลบผู้เล่นผีออกจาก Firestore
    // ============================================
    async removeGhostPlayers(ghostPlayers) {
        try {
            const room = await RoomAPI.get(state.roomCode);
            if (!room) return;

            const ghostUids = ghostPlayers.map(p => p.uid);
            const remaining = room.players.filter(p => !ghostUids.includes(p.uid));

            // ถ้าไม่มีใครเหลือ → ลบห้อง
            if (remaining.length === 0) {
                await RoomAPI.delete(state.roomCode);
                await PresenceAPI.clearRoom(state.roomCode);
                console.log('🗑️ ลบห้อง (ไม่มีใครเหลือ)');
                return;
            }

            // ⭐ ถ้า host หาย → คนแรกเป็น host ใหม่
            const hostStillAlive = remaining.some(p => p.uid === room.hostId);
            const newHostId = hostStillAlive ? room.hostId : remaining[0].uid;

            const updatedPlayers = remaining.map(p => ({
                ...p,
                isHost: p.uid === newHostId,
            }));

            await RoomAPI.update(state.roomCode, {
                players: updatedPlayers,
                hostId: newHostId,
            });

            console.log('🧹 ลบผู้เล่นผี — เหลือ', remaining.length, 'คน');
            if (!hostStillAlive) {
                console.log('👑 host ใหม่:', remaining[0].name);
            }
        } catch (err) {
            console.error('⚠️ ลบผู้เล่นผีไม่สำเร็จ:', err);
        }
    },
};