// ============================================
// 🛠 UTILS
// ============================================
import { GAME_CONFIG } from '../config/game-config.js';

/**
 * สุ่มรหัสห้อง
 */
export function generateRoomCode() {
    const { ROOM_CODE_LENGTH, ROOM_CODE_CHARS } = GAME_CONFIG;
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
    }
    return code;
}

/**
 * สลับหน้าจอ
 */
export function switchScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(name + '-screen').classList.add('active');
}