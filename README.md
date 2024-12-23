# SillyTavern-DiscordRichPresence-Server

Plugin for the SillyTavern server using Discord RPC.

## What is this?

Set your rich presence in Discord to the "SillyTavern" app. If you want to show your active chat character, you need to install a UI extension. Otherwise, a random [funny quote](https://github.com/SillyTavern/SillyTavern-DiscordRichPresence-Server/blob/main/src/index.ts#L7) will be shown.

Link to companion extension:

<https://github.com/SillyTavern/SillyTavern-DiscordRichPresence-UI>

![Example](https://github.com/Cohee1207/SillyTavern-DiscordRichPresence-Server/assets/18619528/d07ba303-d93b-491b-a0b4-da55ccebfb57)

## Prerequisites

* Node.JS (latest stable preferred)
* SillyTavern (latest staging preferred)
* Discord
* Git

## How to install?

1. **Before you begin, make sure you set a config `enableServerPlugins` to `true` in the config.yaml file of SillyTavern.**

2. Open a terminal in your SillyTavern directory, then run the following:

```sh
cd plugins
git clone https://github.com/SillyTavern/SillyTavern-DiscordRichPresence-Server
```

3. Restart the SillyTavern server.

## How to build yourself?

*Not needed unless you want to make changes or contribute!*

Clone this repository and run the following:

```sh
npm install
npm run build
```

This will create a plugin file (index.js) with everything needed bundled.

## License

AGPL-3.0
