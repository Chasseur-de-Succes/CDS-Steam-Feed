const TAGS = {
    MULTI: { id: 1, description: "Multi-player" },
    COOP: { id: 9, description: "Co-op" },
    ACHIEVEMENTS: { id: 22, description: "Steam Achievements" },
};

// attends ms milliseconds
const delay = ms => new Promise(res => setTimeout(res, ms));

exports.TAGS = TAGS;
exports.delay = delay;
