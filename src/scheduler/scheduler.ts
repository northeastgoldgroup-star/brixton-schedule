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

        // Weekend logic (Saturday = 6, Sunday = 0)
        if (day === 0 || day === 6) {
            return hour < 17 ? "15:00" : "20:00";
        }
        
        // Weekday logic (Monday-Friday)
        return "20:00";
    }

    private isValidTime(time: string): boolean {
        const timeRegex = /^([01]?[0-9]|2[0-3])[0-5][0-9]$/;
        return timeRegex.test(time);
    }

    private formatTime(timeString: string): string {
        // Convert "2000" to "20:00"
        if (timeString.length === 4) {
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
        if (!channelId) {
            throw new Error('CHANNEL_ID is not defined in config.');
        }
        const fetchedChannel = await this.client.channels.fetch(channelId);
        if (!fetchedChannel || !fetchedChannel.isTextBased()) {
            throw new Error('Invalid SESSION_CHANNEL_ID or channel is not text-based.');
        }

        this.channel = fetchedChannel as TextChannel;
        this.setupCommandHandler();
        this.setupScheduler();
    }

    private setupCommandHandler() {
        this.client.on('messageCreate', async (message: Message) => {
            if (message.author.bot) return;

            const args = message.content.trim().split(/\s+/);
            const command = args[0].toLowerCase();

            if (command === '!test') {
                await this.handleTestCommand(message);
            } else if (command === '!session') {
                const timeArg = args[1];
                if (timeArg && this.isValidTime(timeArg)) {
                    await this.handleSessionCommand(message, this.formatTime(timeArg));
                } else {
                    await this.handleSessionCommand(message, this.getSessionTime());
                }
            } else if (command === '!ssudm') {
                const link = args[1];
                if (!link) {
                    await message.reply('Usage: `!ssudm <message-link>`').then(m => setTimeout(() => m.delete().catch(()=>{}), 5000)).catch(()=>{});
                    return;
                }
                await this.handleSSUDMCommand(message, link);
            }
        });
    }

       private async handleSSUDMCommand(invokingMessage: Message, messageLink: string) {
        try {
            // expected formats:
            // https://discord.com/channels/<guildId>/<channelId>/<messageId>
            // https://discordapp.com/channels/<guildId>/<channelId>/<messageId>
            const parts = messageLink.replace(/\/+$/, '').split('/');
            const messageId = parts.pop();
            const channelId = parts.pop();

            if (!channelId || !messageId) {
                await invokingMessage.reply('Invalid message link.').then(m => setTimeout(() => m.delete().catch(()=>{}), 5000)).catch(()=>{});
                return;
            }

            const fetchedChannel = await this.client.channels.fetch(channelId).catch(() => null);
            if (!fetchedChannel || !fetchedChannel.isTextBased()) {
                await invokingMessage.reply('Could not access that channel.').then(m => setTimeout(() => m.delete().catch(()=>{}), 5000)).catch(()=>{});
                return;
            }

            const targetMessage = await (fetchedChannel as TextChannel).messages.fetch(messageId).catch(() => null);
            if (!targetMessage) {
                await invokingMessage.reply('Message not found.').then(m => setTimeout(() => m.delete().catch(()=>{}), 5000)).catch(()=>{});
                return;
            }

            // find ✅ reaction
            const reaction = targetMessage.reactions.cache.get('✅') || targetMessage.reactions.cache.find(r => r.emoji?.name === '✅');
            if (!reaction) {
                await invokingMessage.reply('No ✅ reactions found on that message.').then(m => setTimeout(() => m.delete().catch(()=>{}), 5000)).catch(()=>{});
                return;
            }

            const users = await reaction.users.fetch();
            const recipients = users.filter(u => !u.bot);
            if (!recipients.size) {
                await invokingMessage.reply('No non-bot users reacted to that message.').then(m => setTimeout(() => m.delete().catch(()=>{}), 5000)).catch(()=>{});
                return;
            }

            const gameLink = 'https://www.roblox.com/games/113438623811968/Brixton-South-London';
            let successCount = 0;

            for (const [, user] of recipients) {
                try {
                    await user.send({
                        content: `**Brixton Session | Reminder**\n\n<@${user.id}>. You reacted with :white_check_mark: to a session in Brixton. This is your DM to remind you, we're now starting! See you soon, join below:\n${gameLink}`
                    });
                    successCount++;
                } catch (err) {
                    // ignore failed DMs
                    console.error(`Failed to DM ${user.id}:`, err);
                }
            }

            // delete invoking command for cleanliness
            await invokingMessage.delete().catch(()=>{});

            // Optionally log/send a short confirmation to the channel where command was used (send then delete)
            const confirm = await (invokingMessage.channel as TextChannel).send(`Sent DMs to ${successCount} user(s).`);
            setTimeout(() => confirm.delete().catch(()=>{}), 7000);
        } catch (error) {
            console.error('Error in !ssudm:', error);
            await invokingMessage.reply('An error occurred while sending DMs.').then(m => setTimeout(() => m.delete().catch(()=>{}), 5000)).catch(()=>{});
        }
    }

    private setupScheduler() {
        // Daily reset at 00:00
        cron.schedule('0 0 * * *', async () => {
            await this.deleteCurrentSession();
            const nextSessionTime = this.getSessionTime();
            await this.sendSessionMessage(nextSessionTime);
        });

        // Weekend afternoon session at 15:00
        cron.schedule('0 15 * * 0,6', async () => {
            await this.deleteCurrentSession();
            await this.sendSessionMessage("15:00");
        });

        // Evening session at 20:00
        cron.schedule('0 20 * * *', async () => {
            await this.sendSessionReminders();
            const day = new Date().getDay();
            if (day === 0 || day === 6) {
                await this.deleteCurrentSession();
                await this.sendSessionMessage("20:00");
            }
        });
    }

    private createMessage(time: string, includeEveryone = true) {
        return {
            content: `**<:Brixton:1140792087604891799> | Late Session**\n> Host: <@${this.client.user?.id}>\n> Time: ${time}\n${includeEveryone ? '> Ping: @everyone' : ''}\n\n> Public Service Executives, please announce to your staff and join 10 minutes early to brief and allocate vehicles.\n\nConfirm your attendance by reacting with ✅.`,
        };
    }

    private async sendSessionMessage(time: string, includeEveryone = true) {
        const message = await this.channel.send(this.createMessage(time, includeEveryone));
        await message.react('✅');

        this.currentSessionMessage = message;
        this.sessionReactors.clear();

        const collector = message.createReactionCollector({
            filter: (reaction, user) => reaction.emoji.name === '✅' && !user.bot,
        });

        collector.on('collect', (_reaction, user) => {
            this.sessionReactors.add(user.id);
        });

        collector.on('remove', (_reaction, user) => {
            this.sessionReactors.delete(user.id);
        });
    }

    private async deleteCurrentSession() {
        if (this.currentSessionMessage) {
            await this.currentSessionMessage.delete().catch(() => {});
            this.currentSessionMessage = null;
            this.sessionReactors.clear();
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
            const sentMessage = await this.channel.send(this.createMessage('20:00', false));
            await sentMessage.react('✅');
            setTimeout(async () => {
                await sentMessage.delete().catch(() => {});
            }, 5 * 60 * 1000);
            await message.delete().catch(() => {});
        } catch (error) {
            console.error('Error in test command:', error);
        }
    }

private async handleSessionCommand(message: Message, time: string) {
    try {
        await this.deleteCurrentSession();
        await this.sendSessionMessage(time);
        await message.delete().catch(() => {});

        // Schedule the session start notification
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const sessionTime = new Date(now);
        sessionTime.setHours(hours, minutes, 0);

        // If the time has already passed today, don't schedule
        if (sessionTime > now) {
            const delay = sessionTime.getTime() - now.getTime();
            setTimeout(async () => {
                await this.sendSessionReminders();
                await this.channel.send({
                    content: `@everyone The session has now started, You can join us here: https://www.roblox.com/games/113438623811968/Brixton-South-London`
                });
            }, delay);
        }
    } catch (error) {
        console.error('Error in session command:', error);
    }
}
}