const rpc = require('discord-rpc');
const fs = require('fs');
const path = require('path');

const MODULE = '[SillyTavern-DiscordRichPresence-Server]';
const states = [
    'Constructing a waifu army',
    'Spreading sillyness',
    'Mass producing catgirls',
    'Roleplaying with a toaster',
    'Caffeinated and chaotic',
    'Existential AI therapy',
    'Seraphina my beloved',
    // Add more states here
];

async function init() {
    const client = new rpc.Client({ transport: 'ipc' });
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    console.log(MODULE, 'Plugin loaded!');

    client.login({ clientId: config.ClientID }).catch(console.error);

    client.on('ready', () => {
        console.log(MODULE, 'Discord Rich Presence is ready!');
        client.setActivity({
            details: config.Details,
            state: states[Math.floor(Math.random() * states.length)],
            buttons: [{
                label: config.Button1,
                url: config.Url1,
            },
            {
                label: config.Button2,
                url: config.Url2,
            },
            ],
            largeImageKey: config.LargeImage,
            largeImageText: config.LargeImageText,
        }, process.pid);
    });
}

module.exports = {
    init,
};
