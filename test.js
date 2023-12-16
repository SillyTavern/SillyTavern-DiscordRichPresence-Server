async function tryLoad() {
    const module = require('./index.js');
    await module.init();
}

tryLoad();
