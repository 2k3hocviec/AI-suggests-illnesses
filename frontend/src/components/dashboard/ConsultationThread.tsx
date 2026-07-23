'use client';

import {
  Activity,
  AlertTriangle,
  Award,
  Bot,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Stethoscope,
  UserCircle,
  Video,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface ThreadMessage {
  id: number | string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

interface ConsultationThreadProps {
  messages: ThreadMessage[];
  isThinking?: boolean;
  isLoadingMessages?: boolean;
}

export function ConsultationThread({
  messages,
  isThinking = false,
  isLoadingMessages = false,
}: ConsultationThreadProps) {
  const threadRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isThinking]);

  return (
    <section
      ref={threadRef}
      className="chat-scrollbar min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 lg:px-10"
    >
      <div className="mx-auto flex min-w-0 w-full max-w-5xl flex-col gap-5">
        {isLoadingMessages ? (
          <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-600 shadow-sm">
            Đang tải phiên chat...
          </div>
        ) : null}

        {messages.map((message) => {
          const time = formatTime(message.createdAt);

          if (message.role === 'USER') {
            return (
              <div key={message.id} className="flex w-full min-w-0 justify-end gap-3 sm:gap-5">
                <div className="w-fit min-w-0 max-w-[76%]">
                  <div className="break-words rounded-bl-xl rounded-tl-xl rounded-tr-xl bg-[#073f87] px-4 py-3.5 text-sm leading-6 text-white shadow-sm lg:text-[15px]">
                    {message.content}
                  </div>
                  <p className="mt-2 text-right text-xs text-slate-600">
                    {time}
                  </p>
                </div>
                <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#073b83] shadow-sm ring-1 ring-slate-200 sm:flex">
                  <UserCircle className="h-6 w-6" />
                </div>
              </div>
            );
          }

          const isRecommendation = isStructuredRecommendation(message.content);

          return (
            <div key={message.id} className="flex w-full min-w-0 items-start gap-3 sm:gap-5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div
                className={
                  isRecommendation
                    ? 'min-w-0 flex-1'
                    : 'w-fit min-w-0 max-w-[76%]'
                }
              >
                <div
                  className={
                    isRecommendation
                      ? 'rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:p-5'
                      : 'whitespace-pre-line rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm leading-6 shadow-sm lg:text-[15px]'
                  }
                >
                  <AssistantContent content={message.content} />
                </div>
                <p className="mt-2 text-xs text-slate-600">{time}</p>
              </div>
            </div>
          );
        })}

        {isThinking ? (
          <div className="flex items-start gap-5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-600 shadow-sm">
              Đang phân tích triệu chứng...
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AssistantContent({ content }: { content: string }) {
  const recommendation = parseRecommendation(content);

  if (!recommendation) {
    return <p className="whitespace-pre-line text-slate-700">{content}</p>;
  }

  return <RecommendationResponse recommendation={recommendation} />;
}

interface SpecialtySummary {
  name: string;
  symptoms: string[];
}

interface DoctorRecommendation {
  id: number;
  name: string;
  score: number | null;
  fitLabel: string | null;
  specialty: string | null;
  experience: string | null;
  rating: string | null;
  workplace: string | null;
  address: string | null;
  distance: string | null;
  schedule: string | null;
  consultationType: string | null;
  phone: string | null;
  email: string | null;
  reason: string | null;
}

interface RecommendationData {
  symptoms: string[];
  specialties: SpecialtySummary[];
  doctors: DoctorRecommendation[];
  source: string | null;
  hasEmergencySignal: boolean;
  note: string;
}

function RecommendationResponse({
  recommendation,
}: {
  recommendation: RecommendationData;
}) {
  const [expandedDoctorId, setExpandedDoctorId] = useState<number | null>(
    null,
  );
  const primarySpecialty = recommendation.specialties[0]?.name ?? 'Phù hợp';

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        <SummaryCard
          icon={Activity}
          title="Triệu chứng"
          tone="blue"
          content={
            recommendation.symptoms.length ? (
              <div className="flex flex-wrap gap-2">
                {recommendation.symptoms.map((symptom) => (
                  <span
                    key={symptom}
                    className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-500">
                Chưa nhận diện rõ
              </span>
            )
          }
        />

        <SummaryCard
          icon={Stethoscope}
          title="Chuyên khoa"
          tone="green"
          content={
            <div className="space-y-1">
              {recommendation.specialties.length ? (
                recommendation.specialties.map((specialty) => (
                  <div key={specialty.name}>
                    <p className="text-base font-bold text-slate-900">
                      {specialty.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {specialty.symptoms.length
                        ? specialty.symptoms.join(', ')
                        : 'Theo triệu chứng đã cung cấp'}
                    </p>
                  </div>
                ))
              ) : (
                <span className="text-sm text-slate-500">
                  Cần thêm thông tin
                </span>
              )}
            </div>
          }
        />

        <SummaryCard
          icon={recommendation.hasEmergencySignal ? AlertTriangle : ShieldCheck}
          title="Lưu ý"
          tone={recommendation.hasEmergencySignal ? 'red' : 'amber'}
          content={
            <p className="text-sm leading-6 text-slate-600">
              {recommendation.hasEmergencySignal
                ? 'Có dấu hiệu cần xử trí sớm. Hãy đến cơ sở y tế gần nhất hoặc gọi cấp cứu nếu triệu chứng nặng lên.'
                : 'Chỉ mang tính tham khảo, không thay thế chẩn đoán bác sĩ.'}
            </p>
          }
        />
      </div>

      <div className="flex items-center gap-2 px-1 pt-1 text-sm font-semibold text-slate-600">
        <Stethoscope className="h-4 w-4 text-emerald-700" />
        {recommendation.doctors.length
          ? `${recommendation.doctors.length} bác sĩ phù hợp nhất`
          : recommendation.hasEmergencySignal
            ? 'Khuyến nghị xử trí khẩn cấp'
            : `Gợi ý chuyên khoa ${primarySpecialty}`}
      </div>

      {recommendation.doctors.length ? (
        <div className="space-y-3">
          <DoctorCard doctor={recommendation.doctors[0]} />

          {recommendation.doctors.slice(1).map((doctor) => {
            const isExpanded = expandedDoctorId === doctor.id;

            return (
              <div key={doctor.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDoctorId(isExpanded ? null : doctor.id)
                  }
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <DoctorAvatar name={doctor.name} muted />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-800">
                      {doctor.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {doctor.specialty ?? primarySpecialty}
                      {doctor.experience ? ` · ${doctor.experience}` : ''}
                    </span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-lg font-bold text-emerald-700">
                      {doctor.score !== null ? `${doctor.score}%` : '—'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {doctor.fitLabel ?? 'phù hợp'}
                    </span>
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>
                {isExpanded ? (
                  <div className="mt-3">
                    <DoctorCard doctor={doctor} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={
            recommendation.hasEmergencySignal
              ? 'rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-800'
              : 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600'
          }
        >
          {recommendation.hasEmergencySignal
            ? 'Không nên chờ gợi ý bác sĩ trên hệ thống. Hãy đến cơ sở y tế gần nhất hoặc gọi cấp cứu để được thăm khám kịp thời.'
            : 'Chưa có dữ liệu bác sĩ phù hợp trong hệ thống.'}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-1 pt-3 text-xs leading-5 text-slate-500">
        <ClipboardList className="h-4 w-4 shrink-0" />
        <span>{recommendation.note}</span>
        {recommendation.source ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
            Nguồn: {recommendation.source}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  tone,
  content,
}: {
  icon: typeof Activity;
  title: string;
  tone: 'blue' | 'green' | 'amber' | 'red';
  content: React.ReactNode;
}) {
  const styles = {
    blue: {
      border: 'border-blue-100',
      icon: 'text-blue-700',
      background: 'bg-blue-50/40',
    },
    green: {
      border: 'border-emerald-100',
      icon: 'text-emerald-700',
      background: 'bg-emerald-50/40',
    },
    amber: {
      border: 'border-amber-100',
      icon: 'text-amber-700',
      background: 'bg-amber-50/40',
    },
    red: {
      border: 'border-red-100',
      icon: 'text-red-700',
      background: 'bg-red-50/40',
    },
  }[tone];

  return (
    <section
      className={`min-h-[142px] min-w-0 max-w-full rounded-2xl border ${styles.border} ${styles.background} px-4 py-4`}
    >
      <div className={`mb-3 flex items-center gap-2 text-sm font-bold ${styles.icon}`}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {content}
    </section>
  );
}

function DoctorCard({ doctor }: { doctor: DoctorRecommendation }) {
  return (
    <article className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-start gap-3">
        <DoctorAvatar name={doctor.name} />
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-lg font-bold text-slate-950">{doctor.name}</h4>
          <p className="mt-1 text-sm text-slate-600">
            {doctor.specialty ?? 'Bác sĩ chuyên khoa'}
            {doctor.experience ? ` · ${doctor.experience}` : ''}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-emerald-700">
            {doctor.score !== null ? `${doctor.score}%` : '—'}
          </p>
          <p className="text-xs font-medium text-slate-500">
            {doctor.fitLabel ?? 'phù hợp'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DoctorInfo icon={Star} label="Đánh giá" value={doctor.rating} />
        <DoctorInfo
          icon={Building2}
          label="Nơi làm việc"
          value={doctor.workplace}
        />
        <DoctorInfo icon={MapPin} label="Địa chỉ" value={doctor.address} />
        {doctor.distance ? (
          <DoctorInfo
            icon={MapPin}
            label="Khoảng cách khu vực"
            value={doctor.distance}
          />
        ) : null}
        <DoctorInfo
          icon={Clock3}
          label="Giờ làm việc"
          value={doctor.schedule}
        />
        <DoctorInfo
          icon={Video}
          label="Hình thức"
          value={doctor.consultationType}
        />
        <DoctorInfo icon={Phone} label="Điện thoại" value={doctor.phone} />
        <DoctorInfo icon={Mail} label="Email" value={doctor.email} />
      </div>

      {doctor.reason ? (
        <div className="mt-4 flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm leading-5 text-emerald-800">
          <Award className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Lý do đề xuất:</strong> {doctor.reason}
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {doctor.phone && doctor.phone !== 'chưa cập nhật' ? (
          <a
            href={`tel:${doctor.phone.replace(/\s+/g, '')}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#073f87] px-3 text-sm font-semibold text-white transition hover:bg-[#052f66]"
          >
            <Phone className="h-4 w-4" />
            Gọi điện
          </a>
        ) : null}
        {doctor.email && doctor.email !== 'chưa cập nhật' ? (
          <a
            href={`mailto:${doctor.email}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Mail className="h-4 w-4" />
            Gửi email
          </a>
        ) : null}
      </div>

      {(!doctor.phone || doctor.phone === 'chưa cập nhật') &&
      (!doctor.email || doctor.email === 'chưa cập nhật') ? (
        <p className="mt-3 text-xs text-slate-500">
          Liên hệ: chưa cập nhật
        </p>
      ) : null}
    </article>
  );
}

function DoctorInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-slate-500">{label}</span>
        <span className="mt-0.5 block break-words font-medium text-slate-800">
          {value || 'chưa cập nhật'}
        </span>
      </span>
    </div>
  );
}

function DoctorAvatar({ name, muted = false }: { name: string; muted?: boolean }) {
  const initials = name
    .replace(/^Bác sĩ\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <span
      className={
        muted
          ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500'
          : 'flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-800'
      }
    >
      {initials || 'BS'}
    </span>
  );
}

function parseRecommendation(content: string): RecommendationData | null {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const groupedLines = lines.filter(
    (line) => /^o\s+/i.test(line) && line.includes(':'),
  );

  if (!groupedLines.length) {
    return null;
  }

  const specialties = groupedLines.map((line) => {
    const [name, ...symptomParts] = line.replace(/^o\s+/i, '').split(':');
    const symptoms = symptomParts
      .join(':')
      .split(',')
      .map((symptom) => symptom.trim())
      .filter(Boolean)
      .filter((symptom) => !/mô tả|mo ta/i.test(symptom));

    return { name: name.trim(), symptoms };
  });

  const symptoms = unique(specialties.flatMap((specialty) => specialty.symptoms));
  const source =
    lines
      .find((line) => /^Nguồn phân tích:/i.test(line))
      ?.replace(/^Nguồn phân tích:/i, '')
      .trim() ?? null;
  const hasEmergencySignal = /EMERGENCY|cấp cứu|cap cuu|cáº¥p cá»©u/i.test(
    content,
  );
  const doctors: DoctorRecommendation[] = [];
  let activeSpecialty: string | null = null;
  let currentDoctor: DoctorRecommendation | null = null;

  const pushCurrentDoctor = () => {
    if (currentDoctor) {
      doctors.push(currentDoctor);
      currentDoctor = null;
    }
  };

  lines.forEach((line, index) => {
    const specialtyHeader = line.match(/^Chuyên khoa:\s*(.+)$/i);
    if (specialtyHeader) {
      pushCurrentDoctor();
      activeSpecialty = specialtyHeader[1].trim();
      return;
    }

    const doctorHeader = line.match(/^\d+\.\s+(.+)$/);
    if (doctorHeader) {
      pushCurrentDoctor();
      currentDoctor = {
        id: index,
        name: doctorHeader[1].trim(),
        score: null,
        fitLabel: null,
        specialty: activeSpecialty,
        experience: null,
        rating: null,
        workplace: null,
        address: null,
        distance: null,
        schedule: null,
        consultationType: null,
        phone: null,
        email: null,
        reason: null,
      };
      return;
    }

    if (!currentDoctor) {
      return;
    }

    const scoreLine = line.match(/^Điểm phù hợp:\s*(.+)$/i);
    if (scoreLine) {
      const scoreMatch = scoreLine[1].match(/(\d+(?:\.\d+)?)%/);
      currentDoctor.score = scoreMatch ? Number(scoreMatch[1]) : null;
      currentDoctor.fitLabel = scoreLine[1]
        .replace(/\d+(?:\.\d+)?%\s*[—-]?\s*/i, '')
        .trim();
      return;
    }

    const reasonLine = line.match(/^Lý do đề xuất:\s*(.+)$/i);
    if (reasonLine) {
      currentDoctor.reason = reasonLine[1].trim();
      return;
    }

    if (!line.startsWith('•')) {
      return;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) {
      return;
    }

    const label = line.slice(1, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    const fields: Record<
      string,
      Exclude<keyof DoctorRecommendation, 'id' | 'score'>
    > = {
      'Chuyên khoa': 'specialty',
      'Kinh nghiệm': 'experience',
      'Đánh giá': 'rating',
      'Nơi làm việc': 'workplace',
      'Địa chỉ': 'address',
      'Khoảng cách khu vực': 'distance',
      'Thời gian làm việc': 'schedule',
      'Hình thức tư vấn': 'consultationType',
      'Điện thoại': 'phone',
      Email: 'email',
    };
    const field = fields[label];
    if (field) {
      currentDoctor[field] = value;
    }
  });

  pushCurrentDoctor();

  return {
    symptoms,
    specialties,
    doctors,
    source,
    hasEmergencySignal,
    note: hasEmergencySignal
      ? 'Các dấu hiệu cấp cứu cần được thăm khám trực tiếp, không thay thế hướng dẫn của nhân viên y tế.'
      : 'Thông tin chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ.',
  };
}

function isStructuredRecommendation(content: string) {
  return /(^|\n)o\s+.+:/i.test(content);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
