export const pingCommand = {
    name: 'ping',
    description: 'Responds with Pong!',
    execute(interaction) {
        interaction.reply('Pong!');
    },
};