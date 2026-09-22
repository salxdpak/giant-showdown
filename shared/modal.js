// ============================================
// 🪟 MODAL SYSTEM — แทน alert() / confirm()
// ============================================

let modalContainer = null;
let currentResolve = null;

// ============================================
// ⭐ สร้าง container ครั้งแรก
// ============================================
function ensureContainer() {
    if (modalContainer) return;

    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-root';
    modalContainer.innerHTML = `
        <div class="modal-backdrop" id="modal-backdrop">
            <div class="modal-box" id="modal-box">
                <div class="modal-corner tl"></div>
                <div class="modal-corner tr"></div>
                <div class="modal-corner bl"></div>
                <div class="modal-corner br"></div>
                <div class="modal-icon" id="modal-icon">⚠️</div>
                <div class="modal-message" id="modal-message"></div>
                <div class="modal-actions" id="modal-actions"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);
}

// ============================================
// ⭐ Modal API
// ============================================
export const Modal = {

    alert(message, options = {}) {
        ensureContainer();
        const { title = 'แจ้งเตือน', icon = '⚠️', okText = 'ตกลง' } = options;

        return new Promise((resolve) => {
            currentResolve = resolve;
            showModal({
                icon,
                title,
                message,
                buttons: [
                    {
                        text: okText,
                        variant: 'primary',
                        onClick: () => {
                            hideModal();
                            resolve(true);
                        },
                    },
                ],
            });
        });
    },

    confirm(message, options = {}) {
        ensureContainer();
        const {
            title = 'ยืนยัน',
            icon = '❓',
            okText = 'ตกลง',
            cancelText = 'ยกเลิก',
            variant = 'primary',
        } = options;

        return new Promise((resolve) => {
            currentResolve = resolve;
            showModal({
                icon,
                title,
                message,
                buttons: [
                    {
                        text: cancelText,
                        variant: 'ghost',
                        onClick: () => {
                            hideModal();
                            resolve(false);
                        },
                    },
                    {
                        text: okText,
                        variant,
                        onClick: () => {
                            hideModal();
                            resolve(true);
                        },
                    },
                ],
            });
        });
    },

    toast(message, options = {}) {
        const { duration = 2000, icon = '✓' } = options;

        const toast = document.createElement('div');
        toast.className = 'modal-toast';
        toast.innerHTML = `<span class="modal-toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
};

// ============================================
// ⭐ แสดง modal
// ============================================
function showModal({ icon, title, message, buttons }) {
    const iconEl = document.getElementById('modal-icon');
    const messageEl = document.getElementById('modal-message');
    const actionsEl = document.getElementById('modal-actions');
    const backdrop = document.getElementById('modal-backdrop');

    iconEl.textContent = icon;
    messageEl.innerHTML = `
        <div class="modal-title">${escapeHtml(title)}</div>
        <div class="modal-text">${escapeHtml(message)}</div>
    `;

    actionsEl.innerHTML = '';
    buttons.forEach(btn => {
        const b = document.createElement('button');
        b.className = `modal-btn modal-btn--${btn.variant}`;
        b.textContent = btn.text;
        b.addEventListener('click', btn.onClick);
        actionsEl.appendChild(b);
    });

    backdrop.classList.add('active');

    backdrop.onclick = (e) => {
        if (e.target === backdrop && currentResolve && buttons.length === 1) {
            hideModal();
            currentResolve(true);
        }
    };

    document.addEventListener('keydown', handleEscape);
}

function hideModal() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('active');
    currentResolve = null;
    document.removeEventListener('keydown', handleEscape);
}

function handleEscape(e) {
    if (e.key === 'Escape') {
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop && backdrop.classList.contains('active')) {
            const buttons = document.querySelectorAll('#modal-actions .modal-btn');
            hideModal();
            if (currentResolve) currentResolve(buttons.length === 1);
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}