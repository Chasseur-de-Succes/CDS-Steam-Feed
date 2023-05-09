// attends ms milliseconds
const delay = ms => new Promise(res => setTimeout(res, ms));

exports.delay = delay;