import { 
    Client, 
    TextChannel, 
    Message, 
    User,
    ApplicationCommandType,
    CommandInteraction,
    SlashCommandBuilder,
    ChatInputCommandInteraction
} from 'discord.js';
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

private updatePresence() {
    if (!this.client.isReady()) return;
    
    const guild = this.client.guilds.cache.first();
    if (!guild) return;

    const memberCount = guild.memberCount;
    
    this.client.user?.setPresence({
        status: 'dnd',
        activities: [{
            name: `${memberCount} members`,
            type: 3 // 3 is "WATCHING"
        }]
    });
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
    
    // Initial presence update
    this.updatePresence();
    
    // Update presence every 5 minutes
    setInterval(() => this.updatePresence(), 5 * 60 * 1000);
}

public async registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('announce')
            .setDescription('Announce a new session')
            .addUserOption(option => 
                option
                    .setName('host')
                    .setDescription('The session host')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('time')
                    .setDescription('Session time (format: HHMM or HH:MM)')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('startsession')
            .setDescription('Start the session and send reminders'),
        new SlashCommandBuilder()
            .setName('test')
            .setDescription('Test the announcement format'),
    ];

    try {
        console.log('Started refreshing application (/) commands.');
        await this.client.application?.commands.set(commands);
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}


    private setupCommandHandler() {
this.client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
        const roles = (interaction.member as any)?.roles;
        const hasAdminRole = Array.isArray(roles)
            ? roles.includes(CONFIG.ADMIN_ROLE_ID)
            : !!roles?.cache?.has?.(CONFIG.ADMIN_ROLE_ID);
        if (!hasAdminRole) {
            await interaction.reply({ 
                content: '❌ You do not have permission to use this command.', 
                ephemeral: true 
            });
            return;
        }

        try {
            switch (interaction.commandName) {
                case 'announce': {
                    if (!interaction.isCommand()) return; // Ensure it's a command interaction
            const host = interaction.options.getUser('host', true);
                    const time = interaction.options.getString('time', true);
                    
                    if (!this.isValidTime(time)) {
                        await interaction.reply({ 
                            content: 'Invalid time format (use HHMM or HH:MM)', 
                            ephemeral: true 
                        });
                        return;
                    }
                    
                    await interaction.deferReply({ ephemeral: true });
                    await this.handleAnnounceCommand(interaction, host, this.formatTime(time));
                    await interaction.editReply({ content: 'Session announced!' });
                    break;
                }

                case 'startsession':
                    await interaction.deferReply({ ephemeral: true });
                    await this.handleStartSessionCommand(interaction);
                    await interaction.editReply({ content: 'Session started and reminders sent!' });
                    break;

                case 'test':
                    await interaction.deferReply({ ephemeral: true });
                    await this.handleTestCommand(interaction);
                    await interaction.editReply({ content: 'Test message sent!' });
                    break;
            }
        } catch (error) {
            console.error(`Error handling command ${interaction.commandName}:`, error);
            await interaction.reply({ 
                content: 'An error occurred while processing the command.', 
                ephemeral: true 
            }).catch(() => {});
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

 private async handleAnnounceCommand(interaction: CommandInteraction, host: User, time: string) {
    try {
        await this.deleteCurrentSession();
        const msg = await this.channel.send(this.createAnnouncementMessage(time, host.id));
        await msg.react('✅');
        this.currentSessionMessage = msg;

        const collector = msg.createReactionCollector({ 
            filter: (r, u) => !u.bot && r.emoji.name === '✅' 
        });
        collector.on('collect', (_, user) => this.sessionReactors.add(user.id));
    } catch (error) {
        console.error('Error in announce command:', error);
        throw error;
    }
}

private async handleStartSessionCommand(interaction: ChatInputCommandInteraction) {
    try {
        // 1️⃣ Tell the user it's starting
        await interaction.editReply({ content: 'Starting session... sending reminders.' });

        // 2️⃣ DM all users who reacted ✅
        const gameLink = 'https://www.roblox.com/games/113438623811968/Brixton-South-London';
        let successCount = 0;
        let failCount = 0;

        if (this.sessionReactors.size === 0) {
            await interaction.editReply({ content: '⚠️ No users have reacted ✅ to the session announcement.' });
        } else {
            for (const userId of this.sessionReactors) {
                try {
                    const user = await this.client.users.fetch(userId);
                    await user.send({
                        content: `**Brixton Session | Reminder**\n\n<@${userId}> you reacted ✅ to a session earlier. The session is now starting — join below:\n${gameLink}`,
                    });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to DM ${userId}:`, error);
                    failCount++;
                }
            }

            await interaction.followUp({
                content: `✅ Sent DM reminders to **${successCount}** users (${failCount} failed).`,
                ephemeral: true,
            });
        }

        // 3️⃣ Announce session start in the channel
        await this.channel.send({
            content: `@everyone The session has now started — join here: ${gameLink}`,
        });
    } catch (error) {
        console.error('Error in start session command:', error);
        await interaction.followUp({
            content: '❌ An error occurred while starting the session.',
            ephemeral: true,
        }).catch(() => {});
    }
}

private async handleTestCommand(interaction: CommandInteraction) {
    try {
        const sentMessage = await this.channel.send(
            this.createAnnouncementMessage('20:00', interaction.user.id, false)
        );
        await sentMessage.react('✅');
        setTimeout(async () => {
            await sentMessage.delete().catch(() => {});
        }, 5 * 60 * 1000);
    } catch (error) {
        console.error('Error in test command:', error);
        throw error;
    }
}
}