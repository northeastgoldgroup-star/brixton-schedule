import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config';
import { Scheduler } from './scheduler/scheduler';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const scheduler = new Scheduler();

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}`);
    scheduler.start();
});

client.login(config.DISCORD_TOKEN);