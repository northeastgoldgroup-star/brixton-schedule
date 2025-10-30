import { Client } from 'discord.js';
import { config } from '../config';
import { sessionJob } from '../scheduler/jobs/sessionJob';

const client = new Client();

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    sessionJob(client);
});

export default client;