/**
 * Notification Service Boundary Interface (Phase 9 Foundation)
 */
export interface INotificationService {
  sendSmsNotification(phoneNumber: string, message: string): Promise<boolean>;
}

export class NotificationService implements INotificationService {
  async sendSmsNotification(_phoneNumber: string, _message: string): Promise<boolean> {
    // Stub for Phase 9 notification dispatch
    return true;
  }
}
