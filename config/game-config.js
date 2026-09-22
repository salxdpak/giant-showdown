// ============================================
// 🎮 GAME CONFIG - กติกาทั้งหมด
// ============================================
export const GAME_CONFIG = {
    // --- ผู้เล่น ---
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 4,

    // --- รหัสห้อง ---
    ROOM_CODE_LENGTH: 4,
    ROOM_CODE_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',

    // --- อายุห้อง ---
    ROOM_MAX_LIFETIME_MS: 60 * 60 * 1000,   // 1 ชั่วโมง
    ROOM_CLEANUP_MS: 10 * 60 * 1000,        // 10 นาที

    // --- สถานะห้อง ---
    ROOM_STATUS: {
        WAITING: 'waiting',
        PLAYING: 'playing',
        FINISHED: 'finished',
    },

    // --- Avatar ---
    AVATAR_PATH: './assets/avatars/',
    AVATARS: ['1', '2', '3', '4', '5', '6', '7', '8'],
};

// ============================================
// 📝 UI TEXT - ข้อความทั้งหมด
// ============================================
export const UI_TEXT = {
    GAME_TITLE: 'DISCARD YOUR CARD',

    HOME: {
        NAME_LABEL: 'ชื่อผู้เล่น',
        NAME_PLACEHOLDER: 'ใส่ชื่อของคุณ...',
        BTN_CREATE: 'สร้างห้องใหม่',
        BTN_JOIN: 'เข้าห้อง',
        DIVIDER: 'หรือ',
        ROOM_CODE_LABEL: 'รหัสห้อง',
        ROOM_CODE_PLACEHOLDER: 'เช่น ABCD',
    },

    AVATAR: {
        TITLE: 'เลือก Avatar ของคุณ',
        SUBTITLE: 'Avatar ที่มีคนใช้แล้วจะถูกหรี่',
        BTN_CONFIRM: 'ยืนยัน',
        BTN_CANCEL: 'ย้อนกลับ',
    },

    LOBBY: {
        ROOM_LABEL: 'ห้อง:',
        BTN_COPY: 'คัดลอกรหัส',
        WAITING: 'รอผู้เล่น...',
        SLOT_EMPTY: 'ว่าง',
        HOST_BADGE: '(host)',
        YOU_SUFFIX: ' (คุณ)',
        BTN_START: 'เริ่มเกม (Start)',
        BTN_START_DISABLED: 'รอผู้เล่นพร้อม',
        BTN_LEAVE: 'ออกจากห้อง',

        // ⭐ Ready
        BTN_READY: 'พร้อม (Ready)',
        BTN_UNREADY: 'ยกเลิกพร้อม',
    },

    GAMEPLAY: {
        WINNER_TITLE: '🏆 ผู้ชนะคือ',
        BTN_BACK: 'กลับไปหน้าแรก',
    },

    ERR: {
        NEED_NAME: 'กรุณาใส่ชื่อก่อนครับ',
        NEED_CODE: 'กรุณาใส่รหัสห้อง',
        INVALID_CODE: 'รหัสห้องต้องเป็นตัวอักษร 4 ตัว',
        NAME_DUPLICATE: 'ชื่อนี้มีคนใช้แล้ว',
        ROOM_FULL: 'ห้องเต็มแล้ว (สูงสุด 4 คน)',
        ROOM_NOT_FOUND: 'ไม่พบห้องนี้',
        CANNOT_CREATE: 'ไม่สามารถสร้างห้องได้ กรุณาลองใหม่',
        ROOM_CLOSED: 'ห้องถูกปิด',
        NEED_MORE_PLAYERS: 'ต้องมีผู้เล่นอย่างน้อย 2 คน',
        NEED_AVATAR: 'กรุณาเลือก Avatar ก่อน',
        AVATAR_TAKEN: 'Avatar นี้มีคนใช้แล้ว กรุณาเลือกใหม่',
    },
};