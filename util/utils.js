const { delay } = require("./constants.js");

// retry tous les 5 mins

const MAX_ATTEMPTS = 3;

module.exports.retryAfter5min = async (fn) => {
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
        attempt++;
        try {
            await fn();
            return;
        } catch (err) {
            if (err.status === 429) {
                console.log('retry ! ', err);
                // att 5 min
                await delay(300000);
            } else if (err.code === 'NO_NAME') {
                console.log(`nom introuvable, retry (${attempt}/${MAX_ATTEMPTS}) : ${err.message}`);
                if (attempt < MAX_ATTEMPTS) {
                    await delay(300000);
                }
            } else if (err.status === 403) {
                console.log('forbidden ..', err.status);
                break;
            } else {
                break;
            }
        }
    }

    if (attempt >= MAX_ATTEMPTS) {
        console.log(`abandon après ${MAX_ATTEMPTS} tentatives`);
    }
}