/**
 * Combo XP — run: node test-playable-xp.js
 */
function practiceComboMultiplier(streak) {
    if (streak < 3) return 1;
    if (streak < 5) return 1.5;
    if (streak < 10) return 2;
    return 3;
}
function practiceComboXp(streakAfterCorrect) {
    return Math.round(10 * practiceComboMultiplier(streakAfterCorrect));
}

function practiceHalfXp(streakAfterCorrect) {
    return Math.round(practiceComboXp(streakAfterCorrect) / 2);
}

let failed = 0;
function assert(cond, label) {
    if (!cond) { failed += 1; console.error('FAIL', label); }
    else console.log('ok  ', label);
}

assert(practiceComboXp(1) === 10, 'first hit 10');
assert(practiceComboXp(3) === 15, 'combo 3 → 15');
assert(practiceComboXp(5) === 20, 'combo 5 → 20');
assert(practiceComboXp(10) === 30, 'combo 10 → 30');
assert(practiceHalfXp(1) === 5, 'meio certo first hit 5');
assert(practiceHalfXp(3) === 8, 'meio certo combo 3 → 8');
assert(practiceHalfXp(5) === 10, 'meio certo combo 5 → 10');

if (failed) { console.error(failed, 'failed'); process.exit(1); }
console.log('\nall playable-xp checks passed');
