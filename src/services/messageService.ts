export class MessageService {
    private channel: any;

    constructor(channel: any) {
        this.channel = channel;
    }

    async sendMessage(content: string) {
        const message = await this.channel.send(content);
        return message;
    }

    async deleteMessage(messageId: string) {
        const message = await this.channel.messages.fetch(messageId);
        if (message) {
            await message.delete();
        }
    }
}