import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserGender } from '@prisma/client';
import { AdministrativeUnitsService } from '../administrative-units/administrative-units.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';

const doctorSelect = {
  id: true,
  userId: true,
  fullName: true,
  academicTitle: true,
  experienceYears: true,
  description: true,
  phoneNumber: true,
  email: true,
  workplace: true,
  streetAddress: true,
  address: true,
  city: true,
  provinceCode: true,
  communeCode: true,
  workingTime: true,
  imageUrl: true,
  rating: true,
  consultationType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  specialty: {
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      gender: true,
      dateOfBirth: true,
    },
  },
} satisfies Prisma.DoctorSelect;

type DoctorRecord = Prisma.DoctorGetPayload<{
  select: typeof doctorSelect;
}>;

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly administrativeUnits: AdministrativeUnitsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async findPublicById(id: number) {
    const doctor = await this.prisma.doctor.findFirst({
      where: {
        id,
        status: 'ACTIVE',
      },
      select: doctorSelect,
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    return this.toView(doctor);
  }

  async findMyProfile(userId: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: doctorSelect,
    });

    if (!doctor) {
      throw new NotFoundException('Tài khoản chưa có hồ sơ bác sĩ');
    }

    return this.toView(doctor);
  }

  async updateMyProfile(
    userId: number,
    dto: UpdateDoctorProfileDto,
    image?: Express.Multer.File,
  ) {
    const currentDoctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: doctorSelect,
    });

    if (!currentDoctor) {
      throw new NotFoundException('Tài khoản chưa có hồ sơ bác sĩ');
    }

    const address = await this.resolveAddress(dto, currentDoctor);
    const uploadedImage = image
      ? await this.cloudinary.uploadDoctorImage(image)
      : null;
    const consultationType = dto.consultationType
      ? [...new Set(dto.consultationType)]
      : currentDoctor.consultationType;
    const fullName = dto.fullName?.trim() || currentDoctor.fullName;
    const phoneNumber =
      dto.phoneNumber === undefined
        ? currentDoctor.phoneNumber
        : dto.phoneNumber.trim() || null;

    const updatedDoctor = await this.prisma.$transaction(async (transaction) => {
      if (currentDoctor.userId) {
        await transaction.user.update({
          where: { id: currentDoctor.userId },
          data: {
            fullName,
            phoneNumber,
            streetAddress: address.streetAddress,
            address: address.address,
            provinceCode: address.provinceCode,
            communeCode: address.communeCode,
          },
        });
      }

      return transaction.doctor.update({
        where: { id: currentDoctor.id },
        data: {
          fullName,
          academicTitle: this.optionalText(
            dto.academicTitle,
            currentDoctor.academicTitle,
          ),
          experienceYears: dto.experienceYears ?? currentDoctor.experienceYears,
          workplace: this.optionalText(dto.workplace, currentDoctor.workplace),
          phoneNumber,
          streetAddress: address.streetAddress,
          address: address.address,
          city: address.city,
          provinceCode: address.provinceCode,
          communeCode: address.communeCode,
          workingTime: this.optionalText(
            dto.workingTime,
            currentDoctor.workingTime,
          ),
          description: this.optionalText(
            dto.description,
            currentDoctor.description,
          ),
          consultationType,
          ...(uploadedImage?.secureUrl
            ? { imageUrl: uploadedImage.secureUrl }
            : {}),
        },
        select: doctorSelect,
      });
    });

    return this.toView(updatedDoctor);
  }

  private async resolveAddress(
    dto: UpdateDoctorProfileDto,
    currentDoctor: DoctorRecord,
  ) {
    const hasAddressChange =
      dto.streetAddress !== undefined ||
      dto.provinceCode !== undefined ||
      dto.communeCode !== undefined;

    if (!hasAddressChange) {
      return {
        streetAddress: currentDoctor.streetAddress,
        address: currentDoctor.address,
        city: currentDoctor.city,
        provinceCode: currentDoctor.provinceCode,
        communeCode: currentDoctor.communeCode,
      };
    }

    const streetAddress = dto.streetAddress?.trim() || currentDoctor.streetAddress;
    const provinceCode = dto.provinceCode ?? currentDoctor.provinceCode;
    const communeCode = dto.communeCode ?? currentDoctor.communeCode;

    if (!streetAddress || !provinceCode || !communeCode) {
      throw new BadRequestException(
        'Vui lòng nhập đầy đủ địa chỉ đường, tỉnh/thành và xã/phường',
      );
    }

    const [provinces, communes] = await Promise.all([
      this.administrativeUnits.listProvinces(),
      this.administrativeUnits.listCommunes(provinceCode),
    ]);
    const province = provinces.find((item) => item.code === provinceCode);
    const commune = communes.find((item) => item.code === communeCode);

    if (!province || !commune || commune.provinceCode !== province.code) {
      throw new BadRequestException('Địa chỉ hành chính không hợp lệ');
    }

    return {
      streetAddress,
      address: `${streetAddress}, ${commune.name}, ${province.name}`,
      city: province.name,
      provinceCode: province.code,
      communeCode: commune.code,
    };
  }

  private optionalText(value: string | undefined, fallback: string | null) {
    return value === undefined ? fallback : value.trim() || null;
  }

  private toView(doctor: DoctorRecord) {
    return {
      id: doctor.id,
      fullName: doctor.fullName,
      academicTitle: doctor.academicTitle,
      experienceYears: doctor.experienceYears,
      description: doctor.description,
      phoneNumber: doctor.phoneNumber,
      email: doctor.email ?? doctor.user?.email ?? null,
      workplace: doctor.workplace,
      streetAddress: doctor.streetAddress,
      address: doctor.address,
      city: doctor.city,
      provinceCode: doctor.provinceCode,
      communeCode: doctor.communeCode,
      workingTime: doctor.workingTime,
      imageUrl: doctor.imageUrl,
      rating: doctor.rating?.toString() ?? null,
      consultationType: doctor.consultationType,
      status: doctor.status,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
      specialty: doctor.specialty,
      user: doctor.user
        ? {
            gender: doctor.user.gender as UserGender,
            dateOfBirth: doctor.user.dateOfBirth,
          }
        : null,
    };
  }
}
