
const getLocalISODate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Fixed normalizeDate - avoids timezone issues
const normalizeDate = (dateStr) => {
    if (!dateStr) return '';

    // Already in correct YYYY-MM-DD format (with or without leading zeros)
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

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
        const parts = dateStr.split('/');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Fallback: use UTC to avoid timezone shift
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
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

    const normalizedLastLogin = normalizeDate(lastLogin || '');
    console.log(`Stats Last Login (Normalized): ${normalizedLastLogin}`);
    console.log(`Stats Current Streak: ${currentStreak}`);

    if (!normalizedLastLogin) {
        console.log("Result: !lastLogin -> Start 1");
        return { ...stats, streak: 1, lastLoginDate: today };
    }

    if (normalizedLastLogin === today) {
        console.log("Result: Login is Today -> Keep Streak");
        return stats;
    }

    // Calculate days since last login
    const lastLoginDateObj = new Date(normalizedLastLogin);
    const todayDateObj = new Date(today);
    const diffTime = Math.abs(todayDateObj.getTime() - lastLoginDateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    console.log(`Diff Days: ${diffDays}`);

    if (diffDays === 1) {
        console.log("Result: diffDays === 1 -> Increment");
        const newStreak = currentStreak + 1;
        return { ...stats, streak: newStreak, lastLoginDate: today };
    }

    if (diffDays > 1) {
        if (currentStreak > 1 && diffDays <= 2) {
            console.log("Result: diffDays <= 2 and streak > 1 -> Maintain Streak (Rescue)");
            return { ...stats, streak: currentStreak, lastLoginDate: today };
        }
        console.log("Result: Gap too large -> Reset to 1");
        return { ...stats, streak: 1, lastLoginDate: today };
    }

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

// Case 4: Login day before yesterday (should rescue, keep 15)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-02-05" }, mockToday);

// Case 5: Gap too large (should reset to 1)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-02-01" }, mockToday);

// Case 6: Date format with slashes (Brazilian)
checkAndUpdateStreak({ streak: 15, lastLoginDate: "07/02/2024" }, mockToday);

// Case 7: Date format YYYY/MM/DD
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024/02/07" }, mockToday);

// Case 8: Date format without leading zeros
checkAndUpdateStreak({ streak: 15, lastLoginDate: "2024-2-7" }, mockToday);
