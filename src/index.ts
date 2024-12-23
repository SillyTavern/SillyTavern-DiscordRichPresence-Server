import chalk from 'chalk';
import rpc from 'discord-rpc';
import { Router } from 'express';
import config from './config.json';

const MODULE = '[SillyTavern-DiscordRichPresence-Server]';
const states = [
    'Constructing a waifu army',
    'Spreading the silliness',
    'Mass producing catgirls',
    'Roleplaying with a toaster',
    'Caffeinated and chaotic',
    'Existential AI therapy',
    'Seraphina my beloved',
    // Add more states here
];

let client: rpc.Client;

async function exit() {
    if (client) {
        try {
            console.log(chalk.green(MODULE), 'Shutting down Discord connection');
            await Promise.race([
                client.destroy(),
                new Promise(resolve => setTimeout(resolve, 1000)),
            ]);
        } catch {
            // Ignore
        }
    }
}

/**
 * Initializes the plugin
 */
async function init(router: Router) {
    let connected = false;
    console.log(chalk.green(MODULE), 'Plugin loaded!');
    await connectToDiscord();

    router && router.post('/update', (req, res) => {
        const name = req.query.name;
        if (name) {
            console.log(chalk.green(MODULE), 'Updating Discord Rich Presence to', chalk.blue(name));
            const state = `Chatting with ${name}`;
            setActivity(state);
            res.status(200).send('OK');
        } else {
            console.log(chalk.green(MODULE), 'Resetting Discord Rich Presence');
            setActivity();
            res.status(204).send();
        }
    });

    async function connectToDiscord() {
        client = new rpc.Client({ transport: 'ipc' });

        client.once('ready', () => {
            console.log(chalk.green(MODULE), 'Discord Rich Presence is ready!');
            setActivity();
        });

        client.on('connected', () => {
            connected = true;
        });

        client.on('disconnected', () => {
            console.log(chalk.yellow(MODULE), 'Client disconnected!');
            connected = false;
        });

        await client.login({ clientId: config.ClientID }).catch(console.error);
    }

    async function setActivity(state?: string) {
        try {
            // Try to connect if not connected.
            if (!connected) {
                await connectToDiscord();
            }

            // Still nothing? Avast!
            if (!connected) {
                console.error(chalk.yellow(MODULE), 'Not connected to a client');
                return;
            }

            state = state || states[Math.floor(Math.random() * states.length)];
            await client.setActivity({
                details: config.Details,
                state: state,
                buttons: [
                    {
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
        } catch {
            console.error(chalk.yellow(MODULE), 'Failed to set activity');
        }
    }
}

export default {
    init,
    exit,
    info: {
        id: 'discord',
        name: 'Discord Rich Presence',
        description: 'Set your rich presence in Discord to the "SillyTavern" app.',
    },
};
