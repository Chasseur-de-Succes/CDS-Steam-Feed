const { delay } = require("./constants.js");

// retry tous les 5 mins

module.exports.retryAfter5min = async (fn) => {
    while (true) {
        try {
            await fn();
            break;  // 'return' would work here as well
        } catch (err) {
            if (err.status === 429) {
                console.log('retry ! ', err);
                // att 5 min
                await delay(300000);
            } else if (err.status === 403) {
                console.log('forbidden ..', err.status);
                // console.log(err);
                break; 
            } else {
                break; 
            }
        }
    }
}