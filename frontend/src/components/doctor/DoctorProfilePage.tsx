'use client';

import { ArrowLeft, CalendarDays, Clock3, Mail, MapPin, MessageCircle, Phone, Star, Video } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { requestDoctorChat } from '@/lib/direct-chat-api';
import { DoctorProfile, getDoctorProfile } from '@/lib/doctors-api';

export function DoctorProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const doctorId = Number(params.id);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingChat, setIsRequestingChat] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      setError('Mã bác sĩ không hợp lệ.');
      setIsLoading(false);
      return;
    }

    getDoctorProfile(doctorId)
      .then(setDoctor)
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Không thể tải hồ sơ bác sĩ.',
        ),
      )
      .finally(() => setIsLoading(false));
  }, [doctorId]);

  async function handleRequestChat() {
    setIsRequestingChat(true);
    setError(null);
    setMessage(null);
    try {
      const result = await requestDoctorChat(doctorId);
      setMessage(
        result.created
          ? 'Đã gửi yêu cầu chat. Hãy chờ bác sĩ chấp nhận.'
          : 'Bạn đã có yêu cầu hoặc phiên chat với bác sĩ này.',
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể gửi yêu cầu chat.',
      );
    } finally {
      setIsRequestingChat(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>

        {isLoading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Đang tải hồ sơ bác sĩ...
          </div>
        ) : error && !doctor ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : doctor ? (
          <>
            <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="h-28 bg-gradient-to-r from-[#073f87] via-blue-700 to-emerald-500" />
              <div className="px-5 pb-6 sm:px-8">
                <div className="-mt-14 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-blue-100 text-3xl font-bold text-blue-800 shadow-md">
                      {doctor.imageUrl ? (
                        <img
                          src={doctor.imageUrl}
                          alt={`Ảnh đại diện của ${doctor.fullName}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(doctor.fullName) || 'BS'
                      )}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-semibold text-emerald-700">
                        {doctor.specialty.name}
                      </p>
                      <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
                        {doctor.academicTitle
                          ? `${doctor.academicTitle} ${doctor.fullName}`
                          : doctor.fullName}
                      </h1>
                      <p className="mt-2 text-sm text-slate-500">
                        {doctor.workplace ?? 'Chưa cập nhật nơi làm việc'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRequestChat()}
                      disabled={isRequestingChat}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {isRequestingChat ? 'Đang gửi...' : 'Yêu cầu chat'}
                    </button>
                  </div>
                </div>

                {message ? (
                  <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                    {error}
                  </p>
                ) : null}
              </div>
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Giới thiệu chuyên môn</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {doctor.description ?? 'Bác sĩ chưa cập nhật phần giới thiệu.'}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <DetailItem icon={CalendarDays} label="Kinh nghiệm" value={`${doctor.experienceYears} năm`} />
                  <DetailItem icon={Star} label="Đánh giá" value={doctor.rating ? `${doctor.rating}/5` : 'Chưa có đánh giá'} />
                  <DetailItem icon={Clock3} label="Thời gian làm việc" value={doctor.workingTime ?? 'Chưa cập nhật'} />
                  <DetailItem icon={Video} label="Hình thức tư vấn" value={formatConsultationType(doctor.consultationType)} />
                </div>
              </section>

              <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Thông tin liên hệ</h2>
                <div className="mt-4 space-y-4">
                  <DetailItem icon={MapPin} label="Địa chỉ" value={doctor.address ?? 'Chưa cập nhật'} />
                  <DetailItem icon={Phone} label="Điện thoại" value={doctor.phoneNumber ?? 'Chưa cập nhật'} />
                  <DetailItem icon={Mail} label="Email" value={doctor.email ?? 'Chưa cập nhật'} />
                </div>
                <div className="mt-6 rounded-xl bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">
                  Thông tin chỉ mang tính tham khảo. Người dùng nên trao đổi trực tiếp với bác sĩ để được tư vấn phù hợp.
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function formatConsultationType(types: DoctorProfile['consultationType']) {
  if (!types.length) {
    return 'Chưa cập nhật';
  }

  return types
    .map((type) => (type === 'ONLINE' ? 'Tư vấn online' : 'Khám trực tiếp'))
    .join(', ');
}

function getInitials(value: string) {
  return value
    .replace(/^Bác sĩ\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
