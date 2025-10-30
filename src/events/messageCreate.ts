import { Message } from 'discord.js';
import { Client } from 'discord.js';
import { MessageService } from '../services/messageService';
import { Scheduler } from '../scheduler/scheduler';

const messageService = new MessageService();
const scheduler = new Scheduler();

export const messageCreateHandler = async (client: Client, message: Message) => {
    if (message.author.bot) return;

    // Example command handling
    if (message.content === '!start') {
        await scheduler.scheduleJob('sessionJob', '0 15 16 * * *', async () => {
            const sentMessage = await messageService.sendMessage(message.channel.id, 'This is a scheduled message.');
            setTimeout(async () => {
                await messageService.deleteMessage(sentMessage.channel.id, sentMessage.id);
                await messageService.sendMessage(message.channel.id, 'The scheduled message has been deleted.');
            }, 60000); // Wait for 1 minute before deleting
        });
    }
};