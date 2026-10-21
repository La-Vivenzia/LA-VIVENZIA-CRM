import { type SendMailOptions } from 'nodemailer';

import { SmtpDriver } from 'src/engine/core-modules/email/drivers/smtp.driver';

describe('SmtpDriver', () => {
  let driver: SmtpDriver;
  let mockSendMail: jest.Mock;

  beforeEach(() => {
    mockSendMail = jest.fn();
    driver = new SmtpDriver({ host: 'smtp.example.com', port: 587 });
    (driver as unknown as { transport: { sendMail: jest.Mock } }).transport = {
      sendMail: mockSendMail,
    };
  });

  it('should successfully send email and resolve', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'test-msg-id' });

    const sendMailOptions: SendMailOptions = {
      to: 'test@example.com',
      from: 'noreply@example.com',
      subject: 'Test Subject',
      text: 'Test Body',
    };

    await expect(driver.send(sendMailOptions)).resolves.toBeUndefined();
    expect(mockSendMail).toHaveBeenCalledWith(sendMailOptions);
  });

  it('should throw when sendMail fails so message queue can retry', async () => {
    const error = new Error('SMTP connection failed');
    mockSendMail.mockRejectedValueOnce(error);

    const sendMailOptions: SendMailOptions = {
      to: 'test@example.com',
      from: 'noreply@example.com',
      subject: 'Test Subject',
      text: 'Test Body',
    };

    await expect(driver.send(sendMailOptions)).rejects.toThrow(
      'SMTP connection failed',
    );
    expect(mockSendMail).toHaveBeenCalledWith(sendMailOptions);
  });
});
