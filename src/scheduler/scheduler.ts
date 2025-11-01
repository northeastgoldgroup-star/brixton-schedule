import { Client, GatewayIntentBits, TextChannel, Message, User } from 'discord.js';
import { CONFIG } from '../config';
import cron from 'node-cron';

export class Scheduler {
    private client: Client;
    private channel!: TextChannel;
    private currentSessionMessage: Message | null = null;
    private sessionReactors: Set<string> = new Set();

    constructor(client: Client) {
        this.client = client;
    }

    private getSessionTime(): string {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();

        // Weekend logic
        if (day === 0 || day === 6) {
            return hour < 17 ? "15:00" : "20:00";
        }

        // Weekday logic
        return "20:00";
    }

    private isValidTime(time: string): boolean {
        const timeRegex = /^([01]?[0-9]|2[0-3]):?[0-5][0-9]$/; // supports "2000" or "20:00"
        return timeRegex.test(time);
    }

    private formatTime(timeString: string): string {
        // Convert "2000" to "20:00"
        if (/^[0-9]{4}$/.test(timeString)) {
            return `${timeString.slice(0, 2)}:${timeString.slice(2)}`;
        }
        return timeString;
    }

    public async start(): Promise<void> {
        console.log('Scheduler started');

        if (!this.client.isReady()) {
            await new Promise<void>((resolve) => {
                this.client.once('ready', () => resolve());
            });
        }

        const channelId = CONFIG.CHANNEL_ID;
        if (!channelId) throw new Error('CHANNEL_ID is not defined in config.');

        const fetchedChannel = await this.client.channels.fetch(channelId);
        if (!fetchedChannel || !fetchedChannel.isTextBased()) {
            throw new Error('Invalid CHANNEL_ID or channel is not text-based.');
        }

        this.channel = fetchedChannel as TextChannel;
        this.setupCommandHandler();
    }

    private setupCommandHandler() {
        this.client.on('messageCreate', async (message: Message) => {
            if (message.author.bot) return;

            const args = message.content.trim().split(/\s+/);
            const command = args[0].toLowerCase();

            switch (command) {
                case '!announce': {
                    if (args.length < 3) {
                        return this.tempReply(message, 'Usage: `!announce @host time (e.g. 2000)`');
                    }
                    const host = message.mentions.users.first();
                    const time = args[2];
                    if (!host || !this.isValidTime(time)) {
                        return this.tempReply(message, 'Invalid host mention or time format (use HHMM or HH:MM)');
                    }
                    await this.handleAnnounceCommand(message, host, this.formatTime(time));
                    break;
                }

                case '!startsession':
                    await this.handleStartSessionCommand(message);
                    break;

                case '!ssudm':
                    if (args.length < 2) return this.tempReply(message, 'Usage: `!ssudm <message_link>`');
                    await this.handleSSUDMCommand(message, args[1]);
                    break;

                case '!test':
                    await this.handleTestCommand(message);
                    break;
            }
        });
    }

    private async tempReply(message: Message, content: string) {
        const reply = await message.reply(content);
        setTimeout(() => reply.delete().catch(() => {}), 5000);
    }

    private createAnnouncementMessage(time: string, hostId: string, includeEveryone = true) {
        return {
            content: `**<:Brixton:1140792087604891799> | Session**\n> Host: <@${hostId}>\n> Time: ${time}\n${includeEveryone ? '> Ping: @everyone' : ''}\n\n> Public Service Executives, please announce to your staff and join 10 minutes early to brief and allocate vehicles.\n\nConfirm your attendance by reacting with ✅.`,
        };
    }

    private async deleteCurrentSession() {
        if (this.currentSessionMessage) {
            try {
                await this.currentSessionMessage.delete();
            } catch {}
            this.currentSessionMessage = null;
            this.sessionReactors.clear();
        }
    }

    private async handleAnnounceCommand(message: Message, host: User, time: string) {
        try {
            await this.deleteCurrentSession();
            const msg = await this.channel.send(this.createAnnouncementMessage(time, host.id));
            await msg.react('✅');
            this.currentSessionMessage = msg;
            await message.delete().catch(() => {});

            // track reactions
            const collector = msg.createReactionCollector({ filter: (r, u) => !u.bot && r.emoji.name === '✅' });
            collector.on('collect', (_, user) => this.sessionReactors.add(user.id));
        } catch (error) {
            console.error('Error in announce command:', error);
        }
    }

    private async handleStartSessionCommand(message: Message) {
        try {
            await this.sendSessionReminders();
            await this.channel.send({
                content: `@everyone The session has now started — join here: https://www.roblox.com/games/113438623811968/Brixton-South-London`,
            });
            await message.delete().catch(() => {});
        } catch (error) {
            console.error('Error in start session command:', error);
        }
    }

    private async handleSSUDMCommand(invokingMessage: Message, messageLink: string) {
        try {
            const parts = messageLink.replace(/\/+$/, '').split('/');
            const messageId = parts.pop();
            const channelId = parts.pop();

            if (!channelId || !messageId) return this.tempReply(invokingMessage, 'Invalid message link.');

            const fetchedChannel = await this.client.channels.fetch(channelId).catch(() => null);
            if (!fetchedChannel || !fetchedChannel.isTextBased()) return this.tempReply(invokingMessage, 'Could not access that channel.');

            const targetMessage = await (fetchedChannel as TextChannel).messages.fetch(messageId).catch(() => null);
            if (!targetMessage) return this.tempReply(invokingMessage, 'Message not found.');

            const reaction = targetMessage.reactions.cache.get('✅') || targetMessage.reactions.cache.find(r => r.emoji.name === '✅');
            if (!reaction) return this.tempReply(invokingMessage, 'No ✅ reactions found on that message.');

            const users = await reaction.users.fetch();
            const recipients = users.filter(u => !u.bot);
            if (!recipients.size) return this.tempReply(invokingMessage, 'No non-bot users reacted to that message.');

            const gameLink = 'https://www.roblox.com/games/113438623811968/Brixton-South-London';
            let successCount = 0;

            for (const [, user] of recipients) {
                try {
                    await user.send({
                        content: `**Brixton Session | Reminder**\n\n<@${user.id}> you reacted ✅ to a session in Brixton. We're now starting! Join below:\n${gameLink}`,
                    });
                    successCount++;
                } catch (err) {
                    console.error(`Failed to DM ${user.id}:`, err);
                }
            }

            await invokingMessage.delete().catch(() => {});
            const confirm = await (invokingMessage.channel as TextChannel).send(`Sent DMs to ${successCount} user(s).`);
            setTimeout(() => confirm.delete().catch(() => {}), 7000);
        } catch (error) {
            console.error('Error in !ssudm:', error);
            this.tempReply(invokingMessage, 'An error occurred while sending DMs.');
        }
    }

    private async sendSessionReminders() {
        const gameLink = 'https://www.roblox.com/games/113438623811968/Brixton-South-London';
        for (const userId of this.sessionReactors) {
            try {
                const user = await this.client.users.fetch(userId);
                await user.send({
                    content: `**Brixton Session | Reminder**\n\n<@${userId}> you reacted ✅ to a session earlier. The session is now starting — join below:\n${gameLink}`,
                });
            } catch (error) {
                console.error(`Failed to send DM to user ${userId}:`, error);
            }
        }
    }

    private async handleTestCommand(message: Message) {
        try {
            const sentMessage = await this.channel.send(this.createAnnouncementMessage('20:00', message.author.id, false));
            await sentMessage.react('✅');
            setTimeout(async () => {
                await sentMessage.delete().catch(() => {});
            }, 5 * 60 * 1000);
            await message.delete().catch(() => {});
        } catch (error) {
            console.error('Error in test command:', error);
        }
    }
}
