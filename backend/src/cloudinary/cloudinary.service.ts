import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CloudinaryService {
  private readonly isConfigured: boolean;
  private readonly folder: string;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('cloudinary.cloudName');
    const apiKey = this.config.get<string>('cloudinary.apiKey');
    const apiSecret = this.config.get<string>('cloudinary.apiSecret');

    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);
    this.folder =
      this.config.get<string>('cloudinary.folder') ?? 'healthai/doctors';

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  async uploadDoctorImage(file: Express.Multer.File) {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Cloudinary chưa được cấu hình trên server',
      );
    }

    return new Promise<{ secureUrl: string; publicId: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: this.folder,
            resource_type: 'image',
            public_id: `doctor-${randomUUID()}`,
            overwrite: false,
          },
          (error, result) => {
            if (error || !result) {
              reject(
                new ServiceUnavailableException(
                  'Không thể tải ảnh lên Cloudinary',
                ),
              );
              return;
            }

            resolve({
              secureUrl: result.secure_url,
              publicId: result.public_id,
            });
          },
        );

        uploadStream.end(file.buffer);
      },
    );
  }
}
