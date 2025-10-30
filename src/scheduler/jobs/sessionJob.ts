import { MessageService } from '../../services/messageService';
import { Client } from 'discord.js';

const messageService = new MessageService();

export const sessionJob = (client: Client, channelId: string) => {
    const channel = client.channels.cache.get(channelId);

    if (!channel || !channel.isText()) return;

    const sendMessage = () => {
        messageService.sendMessage(channel, 'This is a scheduled message at 4:15.');
        setTimeout(() => {
            messageService.deleteMessage(channel);
            scheduleNextSession();
        }, 60000); // Wait for 1 minute before deleting
    };

    const scheduleNextSession = () => {
        const now = new Date();
        const nextSession = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 15);
        if (now > nextSession) {
            nextSession.setDate(nextSession.getDate() + 1); // Schedule for the next day if already past
        }
        const timeUntilNextSession = nextSession.getTime() - now.getTime();
        setTimeout(sendMessage, timeUntilNextSession);
    };

    scheduleNextSession();
};