import { config } from 'dotenv';
config();

const token = process.env.DISCORD_TOKEN; // Token from Railway Env Variable
const channelId = process.env.CHANNEL_ID; // Channel ID from Railway Env Variable
const ADMINrOLE = process.env.ADMIN_ROLE_ID; // Role ID from Railway Env Variable

if (!token) {
    throw new Error('DISCORD_TOKEN is not defined in environment variables');
}

if (!channelId) {
    throw new Error('CHANNEL_ID is not defined in environment variables');
}

export const CONFIG = {
    DISCORD_TOKEN: token,
    CHANNEL_ID: channelId,
    ADMIN_ROLE_ID: '1393785669922459718'
};