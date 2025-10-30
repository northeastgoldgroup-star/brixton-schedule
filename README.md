# Discord Scheduler Bot

This project is a Discord bot that automatically sends a message in a specified channel at 4:15 PM, deletes it at 4:16 PM, and schedules the next message for the following session.

## Features

- Scheduled messaging at specific times.
- Automatic deletion of messages.
- Simple command handling (e.g., ping command).

## Project Structure

```
discord-scheduler-bot
├── src
│   ├── index.ts                # Entry point of the bot
│   ├── bot.ts                  # Main bot logic and configuration
│   ├── scheduler
│   │   ├── scheduler.ts        # Manages scheduled tasks
│   │   └── jobs
│   │       └── sessionJob.ts   # Sends and deletes scheduled messages
│   ├── commands
│   │   └── ping.ts             # Command handler for ping command
│   ├── events
│   │   ├── ready.ts            # Event handler for bot readiness
│   │   └── messageCreate.ts     # Event handler for incoming messages
│   ├── services
│   │   └── messageService.ts    # Methods for sending and deleting messages
│   ├── config
│   │   └── index.ts            # Configuration settings
│   └── types
│       └── index.ts            # Custom types and interfaces
├── test
│   └── scheduler.test.ts        # Unit tests for scheduler functionality
├── .env.example                 # Example environment variables
├── package.json                 # npm configuration file
├── tsconfig.json                # TypeScript configuration file
└── README.md                    # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd discord-scheduler-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file and fill in your Discord bot token and channel ID.

4. Run the bot:
   ```
   npm start
   ```

## Usage

- The bot will automatically send a message at 4:15 PM and delete it at 4:16 PM.
- You can test the ping command by sending `!ping` in the Discord channel, and the bot will respond with "Pong!". 

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.