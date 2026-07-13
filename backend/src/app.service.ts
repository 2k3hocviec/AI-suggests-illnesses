import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      name: 'Medical Consultation Backend',
      version: '0.1.0',
      status: 'ready',
    };
  }
}
