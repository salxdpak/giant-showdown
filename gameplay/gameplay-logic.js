// ============================================
// 🧠 GAMEPLAY LOGIC
// ============================================
// Ranking Priority:
// 1. ล้มยักษ์ (1 vs 20)
//    - 1 ดาว vs 20 ดาว → 1 ดาว ชนะ
//    - 1 ดาว vs 20 ธรรมดา → 1 ดาว ชนะ
//    - 1 ธรรมดา vs 20 ธรรมดา → 1 ธรรมดา ชนะ
//    - 1 ธรรมดา vs 20 ดาว → 20 ดาว ชนะ
// 2. ดาว (rank เท่ากัน)
//    - 20 ดาว vs 20 ธรรมดา → 20 ดาว ชนะ
//    - 1 ดาว vs 1 ธรรมดา → 1 ดาว ชนะ
// 3. ตัวเลข (rank มากกว่า ชนะ)
//    - 2-19 ชนะ 1 ดาว, 1 ธรรมดา
// ============================================

export function compareCards(cardA, cardB) {
    if (!cardA || !cardB) return 0;

    const { rank: rA, isStar: sA } = cardA;
    const { rank: rB, isStar: sB } = cardB;

    // ⭐ ล้มยักษ์
    if (rA === 1 && sA && rB === 20) return 1;
    if (rB === 1 && sB && rA === 20) return -1;

    if (rA === 1 && !sA && rB === 20 && !sB) return 1;
    if (rB === 1 && !sB && rA === 20 && !sA) return -1;

    // ⭐ rank เท่ากัน → เทียบดาว
    if (rA === rB) {
        if (sA && !sB) return 1;
        if (!sA && sB) return -1;
        return 0;
    }

    // ⭐ ตัวเลข
    return rA > rB ? 1 : -1;
}

// ============================================
// ⭐ DETERMINE WINNER — ใช้ handCard
// ============================================
export function determineWinner(players) {
    // ⭐ กรองเฉพาะคนที่ fight + มี handCard
    const fighters = players.filter(p =>
        p.isAlive &&
        p.hearts > 0 &&
        p.decision === 'fight' &&
        p.handCard                    // ⭐ ใช้ handCard ไม่ใช่ thrownCard
    );

    if (fighters.length === 0) {
        return { winnerUid: null, reason: 'no-fighters' };
    }

    if (fighters.length === 1) {
        return { winnerUid: fighters[0].uid, reason: 'only-fighter' };
    }

    let winner = fighters[0];

    for (let i = 1; i < fighters.length; i++) {
        const challenger = fighters[i];
        const result = compareCards(challenger.handCard, winner.handCard);   // ⭐ handCard
        if (result === 1) {
            winner = challenger;
        }
    }

    return { winnerUid: winner.uid, reason: 'card-rank' };
}

// ============================================
// ⭐ CALCULATE HEARTS
// ============================================
export function calculateHearts(players, winnerUid) {
    return players.map(p => {
        if (!p.isAlive || p.hearts <= 0) return p;

        let heartLoss = 0;

        if (p.decision === 'fold') {
            heartLoss = 1;
        } else if (p.decision === 'fight') {
            if (p.uid === winnerUid) {
                heartLoss = 0;
            } else {
                heartLoss = 2;
            }
        }

        const newHearts = Math.max(0, p.hearts - heartLoss);
        const isAlive = newHearts > 0;

        return {
            ...p,
            hearts: newHearts,
            isAlive,
        };
    });
}

// ============================================
// ⭐ CHECK GAME OVER
// ============================================
export function checkGameOver(players) {
    const alive = players.filter(p => p.isAlive && p.hearts > 0);

    if (alive.length <= 1) {
        return { gameOver: true, winner: alive[0] || null };
    }

    return { gameOver: false, winner: null };
}