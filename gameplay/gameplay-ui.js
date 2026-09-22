// ============================================
// 🎮 GAMEPLAY UI
// ============================================
import { GAME_CONFIG } from '../config/game-config.js';

let showdownTimeouts = [];
let selectedCardIndex = null;

let typingUsers = [];

export function setTypingUsers(users) {
    typingUsers = users || [];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ⭐ RENDER CARD
// ============================================
export function renderCard(card, options = {}) {
    const { dimmed, isBack, winner, clickable, selected, onClick } = options;

    if (isBack) {
        const el = document.createElement('div');
        el.className = 'game-card back';
        return el;
    }

    const el = document.createElement('div');
    el.className = 'game-card';
    el.classList.add(card.isStar ? 'star' : 'black');
    if (dimmed) el.classList.add('dimmed');
    if (winner) el.classList.add('winner');
    if (selected) el.classList.add('selected');
    if (clickable) {
        el.classList.add('clickable');
        el.addEventListener('click', onClick);
    }

    el.innerHTML = `
        <div class="card-rank">${card.rank}</div>
        ${card.isStar ? '<div class="card-star">★</div>' : ''}
        <div class="card-center">${card.rank}</div>
    `;

    return el;
}

// ============================================
// ⭐ RENDER GAME
// ============================================
export function renderGame(data) {
    const {
        players = [],
        discardPile = [],
        myHand = [],
        myUid = 'me',
        currentTurn = null,
        phase = 'discard',
    } = data;

    const discardEl = document.getElementById('discard-pile');
    discardEl.innerHTML = '';
    discardPile.forEach(item => {
        const uid = item.uid || null;
        const card = item.card || item;

        const slot = document.createElement('div');
        slot.className = 'discard-slot';
        slot.appendChild(renderCard(card));

        const owner = players.find(p => p.uid === uid);
        if (owner) {
            const nameEl = document.createElement('div');
            nameEl.className = 'discard-owner';
            nameEl.textContent = owner.name;
            slot.appendChild(nameEl);
        }

        discardEl.appendChild(slot);
    });

    const handEl = document.getElementById('hand-cards');
    handEl.innerHTML = '';
    const isMyTurn = currentTurn === myUid;
    const canThrow = phase === 'discard' && isMyTurn;

    if (!canThrow) selectedCardIndex = null;
    if (selectedCardIndex !== null && selectedCardIndex >= myHand.length) {
        selectedCardIndex = null;
    }

    myHand.forEach((card, index) => {
        handEl.appendChild(renderCard(card, {
            dimmed: card.thrown,
            clickable: canThrow,
            selected: index === selectedCardIndex,
            onClick: canThrow ? () => handleCardClick(index, myHand.length) : null,
        }));
    });

    // ⭐ Player panels
    const panelsEl = document.getElementById('player-panels');
    panelsEl.innerHTML = '';
    players.forEach(p => {
        panelsEl.appendChild(renderPlayerPanel(p, p.uid === myUid, p.uid === currentTurn));
    });

    const actionArea = document.getElementById('action-area');
    const fightBtn = document.getElementById('btn-fight');
    const foldBtn = document.getElementById('btn-fold');
    const discardBtn = document.getElementById('btn-discard');
    const discardText = discardBtn?.querySelector('.game-btn__text');

    if (phase === 'discard') {
        actionArea.style.display = 'flex';
        fightBtn.style.display = 'none';
        foldBtn.style.display = 'none';
        discardBtn.style.display = 'block';

        if (isMyTurn) {
            discardBtn.disabled = selectedCardIndex === null;
            if (discardText) discardText.textContent = 'DISCARD';
        } else {
            discardBtn.disabled = true;
            if (discardText) discardText.textContent = 'รอ...';
        }
    } else if (phase === 'decide') {
        actionArea.style.display = 'flex';
        fightBtn.style.display = 'block';
        foldBtn.style.display = 'block';
        discardBtn.style.display = 'none';

        const canDecide = isMyTurn;
        fightBtn.disabled = !canDecide;
        foldBtn.disabled = !canDecide;
    } else {
        actionArea.style.display = 'none';
    }
}

// ============================================
// ⭐ HANDLE CARD CLICK
// ============================================
function handleCardClick(index, handLength) {
    if (index < 0 || index >= handLength) return;

    selectedCardIndex = (selectedCardIndex === index) ? null : index;

    const cards = document.querySelectorAll('#hand-cards .game-card');
    cards.forEach((el, i) => {
        el.classList.toggle('selected', i === selectedCardIndex);
    });

    const discardBtn = document.getElementById('btn-discard');
    if (discardBtn) {
        discardBtn.disabled = selectedCardIndex === null;
    }
}

export function getSelectedCardIndex() {
    return selectedCardIndex;
}

export function resetSelection() {
    selectedCardIndex = null;
}

// ============================================
// ⭐ RENDER PLAYER PANEL
// ============================================
export function renderPlayerPanel(player, isMe = false, isActive = false) {
    const div = document.createElement('div');
    div.className = 'player-panel';
    if (isMe) div.classList.add('is-me');
    if (isActive) div.classList.add('is-active');
    if (player.decision === 'fold' || !player.isAlive || player.hearts <= 0) {
        div.classList.add('is-folded');
    }

    // ⭐ Avatar + typing badge (สร้างใหม่ทุกครั้ง — gameplay panel rebuild บ่อยอยู่แล้ว)
    const avatarEl = document.createElement('div');
    avatarEl.className = 'panel-avatar';

    if (player.avatarId) {
        const img = document.createElement('img');
        img.src = `${GAME_CONFIG.AVATAR_PATH}${player.avatarId}.png`;
        img.alt = player.name;
        avatarEl.appendChild(img);
    } else {
        avatarEl.textContent = player.name.charAt(0).toUpperCase();
    }

    // ⭐ Typing badge
    const isTyping = typingUsers.some(t => t.uid === player.uid);
    const badge = document.createElement('img');
    badge.className = 'typing-badge' + (isTyping ? ' show' : '');
    badge.src = './assets/avatars/ingame asset/chating badge.svg';
    badge.alt = 'typing';
    avatarEl.appendChild(badge);

    const infoEl = document.createElement('div');
    infoEl.className = 'panel-info';
    infoEl.innerHTML = `
        <div class="panel-name">${player.name}${isMe ? ' (คุณ)' : ''}</div>
        <div class="panel-hearts">❤ ${player.hearts} / 10</div>
    `;

    const cardsEl = document.createElement('div');
    cardsEl.className = 'panel-cards';
    for (let i = 0; i < (player.handSize || 0); i++) {
        const back = document.createElement('div');
        back.className = 'panel-card';
        cardsEl.appendChild(back);
    }

    div.appendChild(avatarEl);
    div.appendChild(infoEl);
    div.appendChild(cardsEl);
    return div;
}

// ============================================
// ⭐ RENDER SHOWDOWN
// ============================================
export function renderShowdown(data, onComplete) {
    showdownTimeouts.forEach(id => clearTimeout(id));
    showdownTimeouts = [];

    const { players = [], winnerUid = null } = data;

    const cardsEl = document.getElementById('showdown-cards');
    cardsEl.innerHTML = '';
    const resultEl = document.getElementById('showdown-result');
    resultEl.innerHTML = '';

    const seen = new Set();
    const uniquePlayers = players.filter(p => {
        if (seen.has(p.uid)) return false;
        seen.add(p.uid);
        return true;
    });

    uniquePlayers.forEach((player, index) => {
        const id = setTimeout(() => {
            const item = document.createElement('div');
            item.className = 'showdown-item';

            const cardEl = renderCard(player.handCard, {
                winner: player.uid === winnerUid,
                dimmed: player.isFolded,
            });

            const nameEl = document.createElement('div');
            nameEl.className = 'showdown-player-name';
            nameEl.textContent = player.name;

            const statusEl = document.createElement('div');
            statusEl.className = 'showdown-player-status';

            if (player.isFolded) {
                statusEl.classList.add('folded');
                statusEl.textContent = 'FOLD -1❤';
            } else if (player.uid === winnerUid) {
                statusEl.classList.add('winner');
                statusEl.textContent = 'WINNER';
            } else {
                statusEl.classList.add('loser');
                statusEl.textContent = 'LOSE -2❤';
            }

            item.appendChild(cardEl);
            item.appendChild(nameEl);
            item.appendChild(statusEl);
            cardsEl.appendChild(item);
        }, index * 1500);

        showdownTimeouts.push(id);
    });

    const totalTime = uniquePlayers.length * 1500 + 500;

    const resultTimeout = setTimeout(() => {
        const winner = uniquePlayers.find(p => p.uid === winnerUid);
        resultEl.innerHTML = winner
            ? `<div class="result-winner">🏆 ${winner.name}</div>
               <div class="result-hearts">❤ ${winner.hearts} หัวใจคงเหลือ</div>`
            : `<div class="result-winner">🤷 ไม่มีผู้ชนะ</div>`;

        const callbackTimeout = setTimeout(() => {
            if (onComplete) onComplete();
        }, 5000);

        showdownTimeouts.push(callbackTimeout);
    }, totalTime);

    showdownTimeouts.push(resultTimeout);
}

// ============================================
// ⭐ RENDER GAME CHAT
// ============================================
export function renderGameChat(messages, myUid) {
    const container = document.getElementById('game-chat-messages');
    if (!container) return;

    container.innerHTML = '';

    messages.forEach((msg) => {
        const div = document.createElement('div');

        if (msg.type === 'system') {
            div.className = 'chat-message system';
            const colors = ['green', 'blue', 'pink', 'yellow'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            div.innerHTML = `<span class="dot ${color}"></span>${escapeHtml(msg.text)}`;
        } else {
            div.className = 'chat-message user';
            if (msg.uid === myUid) div.classList.add('is-me');
            div.innerHTML = `<span class="sender">${escapeHtml(msg.name)}:</span> ${escapeHtml(msg.text)}`;
        }

        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
}

// ============================================
// ⭐ RENDER EVENT LOG
// ============================================
export function renderEventLog(logs) {
    const container = document.getElementById('game-log-messages');
    if (!container) return;

    container.innerHTML = '';

    logs.forEach((log) => {
        const div = document.createElement('div');
        div.className = 'chat-message system';

        const time = new Date(log.timestamp).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
        });

        div.innerHTML = `<span class="dot yellow"></span>[${time}] ${escapeHtml(log.text)}`;
        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
}