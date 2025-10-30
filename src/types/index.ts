export type MessageType = {
    id: string;
    content: string;
    timestamp: Date;
};

export type JobType = {
    id: string;
    scheduleTime: Date;
    execute: () => Promise<void>;
};