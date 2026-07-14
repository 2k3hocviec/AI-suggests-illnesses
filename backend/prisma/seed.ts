import {
  ConsultationType,
  PrismaClient,
  UserGender,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const specialties = [
  ['GENERAL_MEDICINE', 'Nội tổng quát', 'Triệu chứng chưa xác định rõ hoặc cần đánh giá tổng quát.'],
  ['CARDIOLOGY', 'Tim mạch', 'Đau ngực, hồi hộp, tim đập nhanh và các vấn đề tim mạch.'],
  ['RESPIRATORY', 'Hô hấp', 'Ho, khó thở, đau khi hít vào và các vấn đề đường thở.'],
  ['PEDIATRICS', 'Nhi khoa', 'Các triệu chứng ở trẻ em.'],
  ['DERMATOLOGY', 'Da liễu', 'Phát ban, ngứa, nổi mề đay và các vấn đề da.'],
  ['NEUROLOGY', 'Nội Thần kinh', 'Đau đầu, chóng mặt, tê tay chân và các vấn đề thần kinh.'],
  ['ENT', 'Tai Mũi Họng', 'Đau tai, ù tai, đau họng và các vấn đề tai mũi họng.'],
  ['OB_GYN', 'Sản phụ khoa', 'Đau vùng chậu, rối loạn kinh nguyệt và các vấn đề sản phụ khoa.'],
  ['ORTHOPEDICS', 'Cơ xương khớp', 'Đau xương, đau khớp, hạn chế vận động.'],
  ['OPHTHALMOLOGY', 'Mắt', 'Đau mắt, đỏ mắt, nhìn mờ và các vấn đề về mắt.'],
  ['GASTROENTEROLOGY', 'Tiêu hóa', 'Đau bụng, tiêu chảy, buồn nôn và các vấn đề tiêu hóa.'],
  ['DENTISTRY', 'Răng Hàm Mặt', 'Đau răng, sưng nướu và các vấn đề răng miệng.'],
  ['UROLOGY', 'Tiết niệu', 'Tiểu buốt, tiểu rắt, đau vùng thận và các vấn đề tiết niệu.'],
  ['ENDOCRINOLOGY', 'Nội tiết', 'Các vấn đề nội tiết và chuyển hóa.'],
  ['PSYCHIATRY', 'Tâm thần', 'Lo âu, mất ngủ, căng thẳng và sức khỏe tinh thần.'],
  ['ONCOLOGY', 'Ung bướu', 'Dấu hiệu cần tầm soát hoặc đánh giá ung bướu.'],
  ['EMERGENCY', 'Cấp cứu', 'Dấu hiệu cần được đánh giá khẩn cấp.'],
] as const;

const symptoms = [
  ['dau dau', 'Đau đầu', 'Cảm giác đau hoặc nặng đầu.'],
  ['chong mat', 'Chóng mặt', 'Cảm giác mất thăng bằng hoặc quay cuồng.'],
  ['te tay chan', 'Tê tay chân', 'Tê bì hoặc giảm cảm giác ở tay chân.'],
  ['mat ngu', 'Mất ngủ', 'Khó ngủ hoặc ngủ không sâu.'],
  ['dau nguc', 'Đau ngực', 'Đau hoặc tức vùng ngực.'],
  ['hoi hop', 'Hồi hộp', 'Cảm giác tim đập mạnh hoặc bất thường.'],
  ['tim dap nhanh', 'Tim đập nhanh', 'Nhịp tim nhanh hơn bình thường.'],
  ['kho tho', 'Khó thở', 'Cảm giác hụt hơi hoặc khó hít thở.'],
  ['ho', 'Ho', 'Phản xạ ho do kích thích đường thở.'],
  ['ho co dom', 'Ho có đờm', 'Ho kèm đờm.'],
  ['dau khi hit vao', 'Đau khi hít vào', 'Đau ngực tăng khi hít sâu.'],
  ['dau bung', 'Đau bụng', 'Đau hoặc khó chịu vùng bụng.'],
  ['tieu chay', 'Tiêu chảy', 'Đi ngoài phân lỏng nhiều lần.'],
  ['buon non', 'Buồn nôn', 'Cảm giác muốn nôn.'],
  ['tao bon', 'Táo bón', 'Đi ngoài khó hoặc ít hơn bình thường.'],
  ['phat ban', 'Phát ban', 'Vùng da đỏ hoặc nổi nốt.'],
  ['ngua', 'Ngứa', 'Cảm giác ngứa trên da.'],
  ['noi me day', 'Nổi mề đay', 'Mảng đỏ phù và ngứa trên da.'],
  ['dau khop', 'Đau khớp', 'Đau tại các khớp.'],
  ['dau lung duoi', 'Đau lưng dưới', 'Đau vùng thắt lưng.'],
  ['han che van dong', 'Hạn chế vận động', 'Khó cử động hoặc giảm tầm vận động.'],
  ['dau mat', 'Đau mắt', 'Đau hoặc khó chịu ở mắt.'],
  ['do mat', 'Đỏ mắt', 'Mắt đỏ hoặc sung huyết.'],
  ['nhin mo', 'Nhìn mờ', 'Thị lực mờ hoặc giảm rõ nét.'],
  ['dau tai', 'Đau tai', 'Đau trong hoặc quanh tai.'],
  ['u tai', 'Ù tai', 'Nghe tiếng ù hoặc ve trong tai.'],
  ['dau hong', 'Đau họng', 'Đau rát họng khi nuốt hoặc nói.'],
  ['tieu buot', 'Tiểu buốt', 'Đau rát khi đi tiểu.'],
  ['tieu rat', 'Tiểu rắt', 'Đi tiểu nhiều lần, mỗi lần ít.'],
  ['dau vung than', 'Đau vùng thận', 'Đau hai bên hông lưng hoặc vùng thận.'],
  ['dau vung chau', 'Đau vùng chậu', 'Đau vùng bụng dưới hoặc chậu.'],
  ['roi loan kinh nguyet', 'Rối loạn kinh nguyệt', 'Kinh nguyệt không đều hoặc bất thường.'],
  ['sot', 'Sốt', 'Thân nhiệt tăng cao.'],
  ['sot cao', 'Sốt cao', 'Sốt mức độ cao.'],
  ['met moi', 'Mệt mỏi', 'Cảm giác thiếu năng lượng.'],
  ['dau rang', 'Đau răng', 'Đau tại răng hoặc hàm.'],
  ['sung nuou', 'Sưng nướu', 'Nướu sưng đỏ hoặc đau.'],
  ['giam can khong ro nguyen nhan', 'Giảm cân không rõ nguyên nhân', 'Sụt cân không chủ ý.'],
  ['noi hach', 'Nổi hạch', 'Hạch sưng hoặc to bất thường.'],
  ['khat nhieu', 'Khát nhiều', 'Khát nước quá mức bình thường.'],
  ['sut can', 'Sụt cân', 'Giảm cân đáng kể.'],
  ['lo au', 'Lo âu', 'Căng thẳng hoặc lo lắng kéo dài.'],
  ['cang thang', 'Căng thẳng', 'Stress hoặc áp lực tinh thần.'],
  ['mat nuoc', 'Mất nước', 'Dấu hiệu thiếu nước trong cơ thể.'],
  ['mat y thuc', 'Mất ý thức', 'Không tỉnh táo hoặc ngất.'],
  ['co giat', 'Co giật', 'Cơ thể co giật hoặc động kinh.'],
  ['moi tim tai', 'Môi tím tái', 'Môi hoặc da tím tái.'],
  ['tho rut lom long nguc', 'Thở rút lõm lồng ngực', 'Dấu hiệu khó thở nặng ở trẻ em.'],
] as const;

const doctors = [
  {
    email: 'bs.minh.cardio@example.com',
    fullName: 'Bác sĩ Trần Minh',
    academicTitle: 'Bác sĩ Chuyên khoa II',
    specialtyCode: 'CARDIOLOGY',
    experienceYears: 14,
    workplace: 'Bệnh viện Tim Mạch ABC',
    address: 'Quận 1, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000001',
    workingTime: 'Mon-Fri 08:00-17:00',
    consultationType: [ConsultationType.OFFLINE, ConsultationType.ONLINE],
    rating: '4.8',
    symptoms: [
      ['dau nguc', '0.95'],
      ['hoi hop', '0.9'],
      ['tim dap nhanh', '0.92'],
      ['kho tho', '0.7'],
    ],
  },
  {
    email: 'bs.lan.neuro@example.com',
    fullName: 'Bác sĩ Nguyễn Lan',
    academicTitle: 'Thạc sĩ Bác sĩ',
    specialtyCode: 'NEUROLOGY',
    experienceYears: 11,
    workplace: 'Phòng khám Thần Kinh An Tâm',
    address: 'Quận 3, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000002',
    workingTime: 'Mon-Sat 09:00-18:00',
    consultationType: [ConsultationType.OFFLINE],
    rating: '4.7',
    symptoms: [
      ['dau dau', '0.95'],
      ['chong mat', '0.9'],
      ['te tay chan', '0.86'],
      ['mat ngu', '0.65'],
    ],
  },
  {
    email: 'bs.huy.resp@example.com',
    fullName: 'Bác sĩ Lê Quang Huy',
    academicTitle: 'Bác sĩ Chuyên khoa I',
    specialtyCode: 'RESPIRATORY',
    experienceYears: 9,
    workplace: 'Bệnh viện Phổi Thành Phố',
    address: 'Quận Bình Thạnh, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000003',
    workingTime: 'Tue-Sat 08:00-16:00',
    consultationType: [ConsultationType.OFFLINE, ConsultationType.ONLINE],
    rating: '4.6',
    symptoms: [
      ['ho', '0.9'],
      ['ho co dom', '0.88'],
      ['kho tho', '0.9'],
      ['dau khi hit vao', '0.82'],
    ],
  },
  {
    email: 'bs.anh.gastro@example.com',
    fullName: 'Bác sĩ Phạm Hoài Anh',
    academicTitle: 'Bác sĩ Chuyên khoa II',
    specialtyCode: 'GASTROENTEROLOGY',
    experienceYears: 13,
    workplace: 'Trung tâm Tiêu Hóa ABC',
    address: 'Quận 5, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000004',
    workingTime: 'Mon-Fri 07:30-16:30',
    consultationType: [ConsultationType.OFFLINE, ConsultationType.ONLINE],
    rating: '4.9',
    symptoms: [
      ['dau bung', '0.94'],
      ['tieu chay', '0.88'],
      ['buon non', '0.86'],
      ['tao bon', '0.8'],
    ],
  },
  {
    email: 'bs.thao.derm@example.com',
    fullName: 'Bác sĩ Đỗ Minh Thảo',
    academicTitle: 'Bác sĩ Da liễu',
    specialtyCode: 'DERMATOLOGY',
    experienceYears: 8,
    workplace: 'Phòng khám Da Liễu Thảo Minh',
    address: 'Quận 10, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000005',
    workingTime: 'Mon-Sun 09:00-20:00',
    consultationType: [ConsultationType.OFFLINE, ConsultationType.ONLINE],
    rating: '4.5',
    symptoms: [
      ['phat ban', '0.9'],
      ['ngua', '0.9'],
      ['noi me day', '0.86'],
    ],
  },
  {
    email: 'bs.khoa.ortho@example.com',
    fullName: 'Bác sĩ Võ Đăng Khoa',
    academicTitle: 'Bác sĩ Cơ xương khớp',
    specialtyCode: 'ORTHOPEDICS',
    experienceYears: 16,
    workplace: 'Bệnh viện Chấn Thương Chỉnh Hình',
    address: 'Quận Tân Bình, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000006',
    workingTime: 'Mon-Fri 08:00-17:00',
    consultationType: [ConsultationType.OFFLINE],
    rating: '4.7',
    symptoms: [
      ['dau khop', '0.92'],
      ['dau lung duoi', '0.88'],
      ['han che van dong', '0.85'],
    ],
  },
  {
    email: 'bs.nhi.peds@example.com',
    fullName: 'Bác sĩ Hoàng Yến Nhi',
    academicTitle: 'Bác sĩ Nhi khoa',
    specialtyCode: 'PEDIATRICS',
    experienceYears: 10,
    workplace: 'Bệnh viện Nhi Đồng',
    address: 'Quận 11, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000007',
    workingTime: 'Mon-Sat 08:00-17:00',
    consultationType: [ConsultationType.OFFLINE, ConsultationType.ONLINE],
    rating: '4.8',
    symptoms: [
      ['sot', '0.75'],
      ['sot cao', '0.82'],
      ['ho', '0.7'],
      ['tho rut lom long nguc', '0.92'],
    ],
  },
  {
    email: 'bs.my.ent@example.com',
    fullName: 'Bác sĩ Trương Trà My',
    academicTitle: 'Bác sĩ Tai Mũi Họng',
    specialtyCode: 'ENT',
    experienceYears: 7,
    workplace: 'Phòng khám Tai Mũi Họng Mỹ Anh',
    address: 'Quận Phú Nhuận, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000008',
    workingTime: 'Mon-Sat 09:00-18:00',
    consultationType: [ConsultationType.OFFLINE],
    rating: '4.4',
    symptoms: [
      ['dau tai', '0.9'],
      ['u tai', '0.86'],
      ['dau hong', '0.88'],
    ],
  },
  {
    email: 'bs.ha.eye@example.com',
    fullName: 'Bác sĩ Đặng Ngọc Hà',
    academicTitle: 'Bác sĩ Nhãn khoa',
    specialtyCode: 'OPHTHALMOLOGY',
    experienceYears: 12,
    workplace: 'Bệnh viện Mắt Sài Gòn',
    address: 'Quận 1, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000009',
    workingTime: 'Mon-Fri 08:00-16:30',
    consultationType: [ConsultationType.OFFLINE, ConsultationType.ONLINE],
    rating: '4.6',
    symptoms: [
      ['dau mat', '0.9'],
      ['do mat', '0.86'],
      ['nhin mo', '0.9'],
    ],
  },
  {
    email: 'bs.trang.obgyn@example.com',
    fullName: 'Bác sĩ Mai Thu Trang',
    academicTitle: 'Bác sĩ Sản phụ khoa',
    specialtyCode: 'OB_GYN',
    experienceYears: 15,
    workplace: 'Bệnh viện Phụ Sản ABC',
    address: 'Quận 7, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000010',
    workingTime: 'Mon-Fri 08:00-17:00',
    consultationType: [ConsultationType.OFFLINE],
    rating: '4.8',
    symptoms: [
      ['dau vung chau', '0.9'],
      ['roi loan kinh nguyet', '0.92'],
      ['buon non', '0.55'],
    ],
  },
  {
    email: 'bs.tuan.uro@example.com',
    fullName: 'Bác sĩ Bùi Anh Tuấn',
    academicTitle: 'Bác sĩ Tiết niệu',
    specialtyCode: 'UROLOGY',
    experienceYears: 10,
    workplace: 'Bệnh viện Đại Học Y Dược',
    address: 'Quận 5, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000011',
    workingTime: 'Mon-Fri 08:00-17:00',
    consultationType: [ConsultationType.OFFLINE],
    rating: '4.5',
    symptoms: [
      ['tieu buot', '0.92'],
      ['tieu rat', '0.9'],
      ['dau vung than', '0.88'],
    ],
  },
  {
    email: 'bs.son.endocrine@example.com',
    fullName: 'Bác sĩ Ngô Thanh Sơn',
    academicTitle: 'Bác sĩ Nội tiết',
    specialtyCode: 'ENDOCRINOLOGY',
    experienceYears: 12,
    workplace: 'Trung tâm Nội tiết Thành Phố',
    address: 'Quận 3, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000012',
    workingTime: 'Mon-Fri 08:00-16:00',
    consultationType: [ConsultationType.OFFLINE, ConsultationType.ONLINE],
    rating: '4.5',
    symptoms: [
      ['khat nhieu', '0.86'],
      ['sut can', '0.75'],
      ['met moi', '0.65'],
    ],
  },
  {
    email: 'bs.an.psy@example.com',
    fullName: 'Bác sĩ Phan Bảo An',
    academicTitle: 'Bác sĩ Tâm thần',
    specialtyCode: 'PSYCHIATRY',
    experienceYears: 9,
    workplace: 'Phòng khám Sức khỏe Tinh thần An Nhiên',
    address: 'Quận 2, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000013',
    workingTime: 'Mon-Sat 10:00-19:00',
    consultationType: [ConsultationType.ONLINE, ConsultationType.OFFLINE],
    rating: '4.7',
    symptoms: [
      ['lo au', '0.92'],
      ['cang thang', '0.88'],
      ['mat ngu', '0.84'],
    ],
  },
  {
    email: 'bs.vu.oncology@example.com',
    fullName: 'Bác sĩ Đặng Quốc Vũ',
    academicTitle: 'Bác sĩ Ung bướu',
    specialtyCode: 'ONCOLOGY',
    experienceYears: 18,
    workplace: 'Bệnh viện Ung Bướu',
    address: 'Quận Bình Thạnh, TP.HCM',
    city: 'HoChiMinh',
    phoneNumber: '0901000014',
    workingTime: 'Mon-Fri 08:00-16:00',
    consultationType: [ConsultationType.OFFLINE],
    rating: '4.6',
    symptoms: [
      ['giam can khong ro nguyen nhan', '0.82'],
      ['noi hach', '0.86'],
      ['met moi', '0.55'],
    ],
  },
] as const;

const doctorLocations = [
  {
    city: 'DaNang',
    cityLabel: 'Đà Nẵng',
    districts: ['Hải Châu', 'Thanh Khê', 'Sơn Trà'],
  },
  {
    city: 'HaNoi',
    cityLabel: 'Hà Nội',
    districts: ['Ba Đình', 'Cầu Giấy', 'Đống Đa'],
  },
  {
    city: 'Hue',
    cityLabel: 'Huế',
    districts: ['Phú Hội', 'Vỹ Dạ', 'Thuận Hóa'],
  },
  {
    city: 'HoChiMinh',
    cityLabel: 'TP.HCM',
    districts: ['Quận 1', 'Quận 3', 'Quận 7'],
  },
] as const;

const specialtyDoctorProfiles = [
  {
    code: 'GENERAL_MEDICINE',
    label: 'Nội tổng quát',
    symptoms: [
      ['sot', '0.88'],
      ['met moi', '0.84'],
      ['sot cao', '0.78'],
    ],
  },
  {
    code: 'CARDIOLOGY',
    label: 'Tim mạch',
    symptoms: [
      ['dau nguc', '0.95'],
      ['hoi hop', '0.9'],
      ['tim dap nhanh', '0.88'],
    ],
  },
  {
    code: 'RESPIRATORY',
    label: 'Hô hấp',
    symptoms: [
      ['ho', '0.9'],
      ['ho co dom', '0.9'],
      ['kho tho', '0.86'],
    ],
  },
  {
    code: 'PEDIATRICS',
    label: 'Nhi khoa',
    symptoms: [
      ['sot', '0.78'],
      ['sot cao', '0.84'],
      ['tho rut lom long nguc', '0.9'],
    ],
  },
  {
    code: 'DERMATOLOGY',
    label: 'Da liễu',
    symptoms: [
      ['phat ban', '0.9'],
      ['ngua', '0.88'],
      ['noi me day', '0.86'],
    ],
  },
  {
    code: 'NEUROLOGY',
    label: 'Nội Thần kinh',
    symptoms: [
      ['dau dau', '0.95'],
      ['chong mat', '0.88'],
      ['te tay chan', '0.84'],
    ],
  },
  {
    code: 'ENT',
    label: 'Tai Mũi Họng',
    symptoms: [
      ['dau tai', '0.9'],
      ['u tai', '0.86'],
      ['dau hong', '0.88'],
    ],
  },
  {
    code: 'OB_GYN',
    label: 'Sản phụ khoa',
    symptoms: [
      ['dau vung chau', '0.9'],
      ['roi loan kinh nguyet', '0.92'],
      ['buon non', '0.58'],
    ],
  },
  {
    code: 'ORTHOPEDICS',
    label: 'Cơ xương khớp',
    symptoms: [
      ['dau khop', '0.92'],
      ['dau lung duoi', '0.88'],
      ['han che van dong', '0.86'],
    ],
  },
  {
    code: 'OPHTHALMOLOGY',
    label: 'Mắt',
    symptoms: [
      ['dau mat', '0.9'],
      ['do mat', '0.86'],
      ['nhin mo', '0.88'],
    ],
  },
  {
    code: 'GASTROENTEROLOGY',
    label: 'Tiêu hóa',
    symptoms: [
      ['dau bung', '0.94'],
      ['tieu chay', '0.88'],
      ['buon non', '0.86'],
    ],
  },
  {
    code: 'DENTISTRY',
    label: 'Răng Hàm Mặt',
    symptoms: [
      ['dau rang', '0.92'],
      ['sung nuou', '0.9'],
    ],
  },
  {
    code: 'UROLOGY',
    label: 'Tiết niệu',
    symptoms: [
      ['tieu buot', '0.92'],
      ['tieu rat', '0.9'],
      ['dau vung than', '0.88'],
    ],
  },
  {
    code: 'ENDOCRINOLOGY',
    label: 'Nội tiết',
    symptoms: [
      ['khat nhieu', '0.86'],
      ['sut can', '0.78'],
      ['met moi', '0.66'],
    ],
  },
  {
    code: 'PSYCHIATRY',
    label: 'Tâm thần',
    symptoms: [
      ['lo au', '0.92'],
      ['cang thang', '0.88'],
      ['mat ngu', '0.84'],
    ],
  },
  {
    code: 'ONCOLOGY',
    label: 'Ung bướu',
    symptoms: [
      ['giam can khong ro nguyen nhan', '0.84'],
      ['noi hach', '0.86'],
      ['met moi', '0.58'],
    ],
  },
  {
    code: 'EMERGENCY',
    label: 'Cấp cứu',
    symptoms: [
      ['mat y thuc', '0.95'],
      ['co giat', '0.92'],
      ['moi tim tai', '0.9'],
    ],
  },
] as const;

const doctorGivenNames = [
  'An',
  'Bình',
  'Chi',
  'Dũng',
  'Giang',
  'Hạnh',
  'Khải',
  'Linh',
  'Minh',
  'Ngọc',
  'Phong',
  'Trang',
] as const;

const doctorFamilyNames = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Mai',
  'Vũ',
  'Huỳnh',
] as const;

const generatedDoctors = specialtyDoctorProfiles.flatMap(
  (specialty, specialtyIndex) =>
    doctorLocations.flatMap((location, locationIndex) =>
      location.districts.map((district, districtIndex) => {
        const doctorIndex = locationIndex * location.districts.length + districtIndex;
        const nameIndex = (specialtyIndex + doctorIndex) % doctorGivenNames.length;
        const rating = (4.35 + ((specialtyIndex + doctorIndex) % 7) * 0.07).toFixed(1);

        return {
          email: `bs.${specialty.code.toLowerCase()}.${location.city.toLowerCase()}.${districtIndex + 1}@example.com`,
          fullName: `Bác sĩ ${doctorFamilyNames[nameIndex]} ${doctorGivenNames[nameIndex]}`,
          academicTitle:
            doctorIndex % 3 === 0
              ? 'Bác sĩ Chuyên khoa II'
              : doctorIndex % 3 === 1
                ? 'Thạc sĩ Bác sĩ'
                : 'Bác sĩ Chuyên khoa I',
          specialtyCode: specialty.code,
          experienceYears: 6 + ((specialtyIndex + doctorIndex) % 18),
          workplace: `${doctorIndex % 2 === 0 ? 'Bệnh viện' : 'Phòng khám'} ${specialty.label} ${location.cityLabel}`,
          address: `${district}, ${location.cityLabel}`,
          city: location.city,
          phoneNumber: `09${String(20000000 + specialtyIndex * 1000 + doctorIndex).padStart(8, '0')}`,
          workingTime:
            doctorIndex % 2 === 0
              ? 'Mon-Fri 08:00-17:00'
              : 'Mon-Sat 09:00-18:00',
          consultationType:
            doctorIndex % 2 === 0
              ? [ConsultationType.OFFLINE, ConsultationType.ONLINE]
              : [ConsultationType.OFFLINE],
          rating,
          symptoms: specialty.symptoms,
        };
      }),
    ),
);

async function seedUsers() {
  const password = await bcrypt.hash('Password123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      fullName: 'System Admin',
      role: UserRole.ADMIN,
      password,
      phoneNumber: '0900000000',
      address: 'Quận 1, TP.HCM',
    },
    create: {
      fullName: 'System Admin',
      email: 'admin@example.com',
      password,
      role: UserRole.ADMIN,
      gender: UserGender.UNKNOWN,
      phoneNumber: '0900000000',
      address: 'Quận 1, TP.HCM',
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {
      fullName: 'Demo User',
      role: UserRole.USER,
      password,
      phoneNumber: '0900000001',
      address: 'Quận 5, TP.HCM',
    },
    create: {
      fullName: 'Demo User',
      email: 'user@example.com',
      password,
      role: UserRole.USER,
      gender: UserGender.UNKNOWN,
      phoneNumber: '0900000001',
      address: 'Quận 5, TP.HCM',
    },
  });
}

async function seedSpecialties() {
  for (const [code, name, description] of specialties) {
    await prisma.specialty.upsert({
      where: { code },
      update: { name, description },
      create: { code, name, description },
    });
  }
}

async function seedSymptoms() {
  for (const [normalizedName, name, description] of symptoms) {
    await prisma.symptom.upsert({
      where: { normalizedName },
      update: { name, description },
      create: { normalizedName, name, description },
    });
  }
}

async function seedDoctors() {
  for (const doctor of [...doctors, ...generatedDoctors]) {
    const specialty = await prisma.specialty.findUniqueOrThrow({
      where: { code: doctor.specialtyCode },
    });

    const existingDoctor = await prisma.doctor.findFirst({
      where: { email: doctor.email },
    });

    const savedDoctor = existingDoctor
      ? await prisma.doctor.update({
          where: { id: existingDoctor.id },
          data: {
            fullName: doctor.fullName,
            academicTitle: doctor.academicTitle,
            specialtyId: specialty.id,
            experienceYears: doctor.experienceYears,
            workplace: doctor.workplace,
            address: doctor.address,
            city: doctor.city,
            phoneNumber: doctor.phoneNumber,
            workingTime: doctor.workingTime,
            consultationType: [...doctor.consultationType],
            rating: doctor.rating,
            status: 'ACTIVE',
          },
        })
      : await prisma.doctor.create({
          data: {
            email: doctor.email,
            fullName: doctor.fullName,
            academicTitle: doctor.academicTitle,
            specialtyId: specialty.id,
            experienceYears: doctor.experienceYears,
            workplace: doctor.workplace,
            address: doctor.address,
            city: doctor.city,
            phoneNumber: doctor.phoneNumber,
            workingTime: doctor.workingTime,
            consultationType: [...doctor.consultationType],
            rating: doctor.rating,
            status: 'ACTIVE',
          },
        });

    for (const [normalizedName, expertiseScore] of doctor.symptoms) {
      const symptom = await prisma.symptom.findUniqueOrThrow({
        where: { normalizedName },
      });

      await prisma.doctorExpertise.upsert({
        where: {
          doctorId_symptomId: {
            doctorId: savedDoctor.id,
            symptomId: symptom.id,
          },
        },
        update: { expertiseScore },
        create: {
          doctorId: savedDoctor.id,
          symptomId: symptom.id,
          expertiseScore,
        },
      });
    }
  }
}

async function main() {
  await seedUsers();
  await seedSpecialties();
  await seedSymptoms();
  await seedDoctors();

  const [userCount, specialtyCount, symptomCount, doctorCount, expertiseCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.specialty.count(),
      prisma.symptom.count(),
      prisma.doctor.count(),
      prisma.doctorExpertise.count(),
    ]);

  console.log({
    users: userCount,
    specialties: specialtyCount,
    symptoms: symptomCount,
    doctors: doctorCount,
    doctorExpertise: expertiseCount,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
