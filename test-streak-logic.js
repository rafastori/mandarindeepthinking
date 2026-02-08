
const getLocalISODate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDate = (dateStr) => {
    if (!dateStr) return '';

    // Check for DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }

    // Check for YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        return dateStr.replace(/\//g, '-');
    }

    // Standard parsing fallback
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return dateStr;
};

const checkAndUpdateStreak = (stats, currentDateMock) => {
    const today = getLocalISODate(currentDateMock);
    const lastLogin = stats.lastLoginDate;
    const currentStreak = stats.streak || 0;

    console.log(`\n--- Test Case ---`);
    console.log(`Current Date (Simulated): ${today}`);
    console.log(`Stats Last Login (Raw): ${lastLogin}`);

    // Normalize
    const normalizedLastLogin = normalizeDate(lastLogin || '');
    console.log(`Stats Last Login (Normalized): ${normalizedLastLogin}`);

    // If no last login date, start new streak
    if (!normalizedLastLogin) {
        console.log("Result: !lastLogin -> Start 1");
        return { ...stats, streak: 1, lastLoginDate: today };
    }

    // If last login was today, keep current streak
    if (normalizedLastLogin === today) {
        console.log("Result: Login is Today -> Keep Streak");
        return stats;
    }

    // Calculate days since last login
    const lastLoginDateObj = new Date(normalizedLastLogin);
    // Fix timezone offset for test script consistency with app logic
    // In app we did new Date(normalized), here we do same.

    const todayDateObj = new Date(today);
    const diffTime = Math.abs(todayDateObj.getTime() - lastLoginDateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    console.log(`Diff Days: ${diffDays} (Time diff: ${diffTime}ms)`);

    // If last login was yesterday, increment streak
    if (diffDays === 1) {
        console.log("Result: diffDays === 1 -> Increment");
        const newStreak = currentStreak + 1;
        return { ...stats, streak: newStreak, lastLoginDate: today };
    }

    // If last login was more than 1 day ago, streak is broken
    // BUT: if streak was manually set in Firebase (streak > 1), 
    // we need to check if the streak is still valid
    if (diffDays > 1) {
        // If streak was manually set to a value > 1, 
        // it means the user wants to keep that streak
        // Only reset if the streak is 1 (new streak) or if the gap is too large
        if (currentStreak > 1 && diffDays <= 2) {
            console.log("Result: diffDays <= 2 and streak > 1 -> Maintain Streak (Rescue)");
            // Small gap, keep the streak but don't increment
            return { ...stats, streak: currentStreak, lastLoginDate: today };
        }
        console.log("Result: Gap too large -> Reset to 1");
        // Streak broken - reset to 1
        return { ...stats, streak: 1, lastLoginDate: today };
    }

    // Fallback - should not reach here
    return { ...stats, streak: 1, lastLoginDate: today };
};

// Simulate Today as 2024-02-07
const mockToday = new Date("2024-02-07T12:00:00");

// Case 1: First login ever
checkAndUpdateStreak({ streak: 0, lastLoginDate: undefined }, mockToday);

// Case 2: Login same day (should keep 15)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-02-07" }, mockToday);

// Case 3: Login yesterday (should increment to 16)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-02-06" }, mockToday);

// Case 4: Login day before yesterday (should reset to 1)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-02-05" }, mockToday);

// Case 5: Login future?
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-02-08" }, mockToday);

// Case 6: Date format mismatch (e.g. user typed 2024-2-7)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-2-7" }, mockToday);

// Case 7: Date format mismatch slash (e.g. user typed 2024/02/07)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024/02/07" }, mockToday);
