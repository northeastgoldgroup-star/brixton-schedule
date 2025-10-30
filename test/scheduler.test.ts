import { Scheduler } from '../src/scheduler/scheduler';
import { jest } from '@jest/globals';

describe('Scheduler', () => {
    let scheduler: Scheduler;
    const mockSendMessage = jest.fn();
    const mockDeleteMessage = jest.fn();

    beforeEach(() => {
        scheduler = new Scheduler();
        scheduler.sendMessage = mockSendMessage;
        scheduler.deleteMessage = mockDeleteMessage;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should send a message at 4:15 and delete it at 4:16', async () => {
        jest.useFakeTimers('modern');
        const now = new Date();
        now.setHours(16, 15, 0, 0); // Set time to 4:15 PM
        jest.setSystemTime(now);

        scheduler.scheduleJob();

        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String)); // Check if a message was sent

        jest.advanceTimersByTime(60000); // Fast forward to 4:16 PM

        expect(mockDeleteMessage).toHaveBeenCalledTimes(1);
        expect(mockDeleteMessage).toHaveBeenCalledWith(expect.any(String)); // Check if the message was deleted

        jest.useRealTimers();
    });

    test('should schedule the next job after deletion', async () => {
        jest.useFakeTimers('modern');
        const now = new Date();
        now.setHours(16, 15, 0, 0);
        jest.setSystemTime(now);

        scheduler.scheduleJob();
        jest.advanceTimersByTime(60000); // Fast forward to 4:16 PM
        scheduler.deleteMessage();

        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        expect(mockDeleteMessage).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(86400000); // Fast forward to the next day at 4:15 PM

        expect(mockSendMessage).toHaveBeenCalledTimes(2); // Check if the next message was sent

        jest.useRealTimers();
    });
});