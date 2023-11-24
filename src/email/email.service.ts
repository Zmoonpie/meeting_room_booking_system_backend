import { Injectable } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  transporter: Transporter;

  constructor() {
    this.transporter = createTransport({
      host: 'smtp.163.com',
      port: 465,
      secure: true,
      auth: {
        user: 'moonp1e@163.com',
        pass: ''
      }
    });
  }

  async sendEmail({ to, subject, html }) {
    await this.transporter.sendMail({
      from: {
        name: '会议室预定系统',
        address: 'moonp1e@163.com'
      },
      to,
      subject,
      html
    });
  }
}
