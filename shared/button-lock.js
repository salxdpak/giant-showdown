// ============================================
// 🔒 BUTTON LOCK v2 — กันสแปม + กันค้างถาวร
// ============================================
//
// ⭐ หลักการ:
// - ใช้ class "btn-locked" เท่านั้น — ไม่แตะ btn.disabled
// - เก็บ state ไว้ที่ btn.dataset.lockedAt (เวลา timestamp)
// - มี safety timeout 5 วิ — กันค้างถาวร
// - กันปุ่มที่ถูก disable อยู่แล้ว (เช่นยังไม่ถึงตา) → ไม่ทำอะไร
// ============================================

const LOCK_CLASS = 'btn-locked';
const SAFETY_TIMEOUT_MS = 3000;  // ⭐ ถ้าล็อกเกิน 3 วิ → ปลดอัตโนมัติ

// ============================================
// ⭐ เช็คว่าปุ่มถูกล็อกอยู่ไหม
// ============================================
export function isLocked(buttonOrId) {
    const btn = typeof buttonOrId === 'string'
        ? document.getElementById(buttonOrId)
        : buttonOrId;
    if (!btn) return false;

    // ⭐ เช็ค safety timeout ก่อน
    const lockedAt = Number(btn.dataset.lockedAt || 0);
    if (lockedAt && Date.now() - lockedAt > SAFETY_TIMEOUT_MS) {
        forceUnlock(btn);
        return false;
    }

    return btn.classList.contains(LOCK_CLASS);
}

// ============================================
// ⭐ ล็อกปุ่ม — คืน { unlock } หรือ null ถ้าล็อกไม่ได้
// ============================================
export function lockButton(buttonOrId, options = {}) {
    const btn = typeof buttonOrId === 'string'
        ? document.getElementById(buttonOrId)
        : buttonOrId;

    if (!btn) return null;

    // ⭐ ถ้าถูก disable อยู่ → ปฏิเสธ (เช่นยังไม่ถึงตา / ยังไม่พร้อม)
    if (btn.disabled) return null;

    // ⭐ ถ้าถูกล็อกอยู่แล้ว (และไม่เกิน safety timeout) → ปฏิเสธ
    if (isLocked(btn)) return null;

    // ⭐ กันซ้ำอีกชั้น: ถ้ามี timeout ค้างอยู่ → clear
    if (btn._lockTimeout) {
        clearTimeout(btn._lockTimeout);
        btn._lockTimeout = null;
    }

    // ⭐ ล็อก
    btn.classList.add(LOCK_CLASS);
    btn.dataset.lockedAt = String(Date.now());
    btn.setAttribute('aria-disabled', 'true');
    btn.blur();   // เอาโฟกัสออก กัน Enter/Space

    const { minDuration = 0 } = options;
    const startTime = Date.now();

    // ⭐ Safety timeout — บังคับปลดถ้าค้างเกิน 5 วิ
    btn._lockTimeout = setTimeout(() => {
        console.warn('⚠️ Button lock safety timeout:', btn.id || btn.className);
        forceUnlock(btn);
    }, SAFETY_TIMEOUT_MS);

    return {
        unlock: () => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, minDuration - elapsed);

            setTimeout(() => {
                forceUnlock(btn);
            }, remaining);
        }
    };
}

// ============================================
// ⭐ บังคับปลดล็อก — ไม่สนใจ state ปัจจุบัน
// ============================================
function forceUnlock(btn) {
    if (!btn) return;

    if (btn._lockTimeout) {
        clearTimeout(btn._lockTimeout);
        btn._lockTimeout = null;
    }

    btn.classList.remove(LOCK_CLASS);
    delete btn.dataset.lockedAt;
    btn.removeAttribute('aria-disabled');
    // ⭐ ไม่แตะ btn.disabled — ปล่อยให้ renderGame/renderLobby จัดการ
}

// ============================================
// ⭐ Wrapper: ครอบ async function
// ============================================
export function withLock(buttonOrId, asyncFn, options = {}) {
    return async (...args) => {
        const lock = lockButton(buttonOrId, options);
        if (!lock) return;   // ถูกล็อกอยู่ / ถูก disable → ข้าม

        try {
            await asyncFn(...args);
        } catch (err) {
            console.error('withLock error:', err);
        } finally {
            lock.unlock();
        }
    };
}

// ============================================
// ⭐ Global cleanup — เรียกตอนเปลี่ยนหน้าจอ (optional)
// ============================================
export function unlockAll() {
    document.querySelectorAll('.' + LOCK_CLASS).forEach(forceUnlock);
}