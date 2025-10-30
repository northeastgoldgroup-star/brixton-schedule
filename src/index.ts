import { Client, GatewayIntentBits } from 'discord.js';
import { CONFIG } from './config';
import { Scheduler } from './scheduler/scheduler';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.once('ready', () => {
    console.log('Bot is ready!');
    const scheduler = new Scheduler(client);
    scheduler.start();
});

client.login(CONFIG.DISCORD_TOKEN);