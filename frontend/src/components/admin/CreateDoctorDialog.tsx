"use client";

import { useEffect, useState } from "react";
import { X, UserPlus } from "lucide-react";
import {
  Commune,
  listCommunes,
  listProvinces,
  Province,
} from "@/lib/administrative-units-api";
import {
  createDoctorAccount,
  CreateDoctorAccountInput,
  DoctorCreationOptions,
  getDoctorCreationOptions,
} from "@/lib/admin-api";

const initialForm: CreateDoctorAccountInput = {
  fullName: "",
  email: "",
  password: "",
  dateOfBirth: "",
  gender: "UNKNOWN",
  specialtyId: 0,
  academicTitle: "",
  experienceYears: 0,
  workplace: "",
  phoneNumber: "",
  streetAddress: "",
  provinceCode: 0,
  communeCode: 0,
  imageUrl: "",
  workingTime: "",
  description: "",
  consultationType: ["ONLINE"],
};

interface CreateDoctorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function CreateDoctorDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateDoctorDialogProps) {
  const [options, setOptions] = useState<DoctorCreationOptions | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [form, setForm] = useState<CreateDoctorAccountInput>(initialForm);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setForm(initialForm);
    setCommunes([]);
    setError(null);
    setSuccess(null);
    setIsLoadingOptions(true);

    Promise.all([getDoctorCreationOptions(), listProvinces()])
      .then(([doctorOptions, provinceList]) => {
        if (cancelled) {
          return;
        }

        setOptions(doctorOptions);
        setProvinces(provinceList);
        setForm((current) => ({
          ...current,
          specialtyId: current.specialtyId || doctorOptions.specialties[0]?.id || 0,
        }));
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải dữ liệu tạo tài khoản bác sĩ.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOptions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !form.provinceCode) {
      setCommunes([]);
      return;
    }

    setCommunes([]);
    setForm((current) =>
      current.communeCode
        ? { ...current, communeCode: 0 }
        : current,
    );

    listCommunes(form.provinceCode)
      .then(setCommunes)
      .catch(() => setError("Không thể tải danh sách xã/phường."));
  }, [form.provinceCode, isOpen]);



  if (!isOpen) {
    return null;
  }

  function updateField<K extends keyof CreateDoctorAccountInput>(
    field: K,
    value: CreateDoctorAccountInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleConsultationType(type: "ONLINE" | "OFFLINE") {
    setForm((current) => {
      const hasType = current.consultationType.includes(type);
      const nextTypes = hasType
        ? current.consultationType.filter((item) => item !== type)
        : [...current.consultationType, type];

      return {
        ...current,
        consultationType: nextTypes,
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.specialtyId) {
      setError("Vui lòng chọn chuyên khoa.");
      return;
    }

    if (!form.streetAddress.trim()) {
      setError("Vui lòng nhập địa chỉ chi tiết.");
      return;
    }

    if (!form.provinceCode || !form.communeCode) {
      setError("Vui lòng chọn đầy đủ tỉnh/thành và xã/phường.");
      return;
    }

    if (!form.consultationType.length) {
      setError("Vui lòng chọn ít nhất một hình thức tư vấn.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createDoctorAccount({
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        dateOfBirth: form.dateOfBirth || undefined,
        academicTitle: form.academicTitle?.trim() || undefined,
        workplace: form.workplace?.trim() || undefined,
        phoneNumber: form.phoneNumber?.trim() || undefined,
        streetAddress: form.streetAddress.trim(),
        imageUrl: form.imageUrl?.trim() || undefined,
        workingTime: form.workingTime?.trim() || undefined,
        description: form.description?.trim() || undefined,
        experienceYears: Number(form.experienceYears) || 0,
      });
      await onCreated();
      setSuccess("Đã tạo tài khoản và hồ sơ bác sĩ.");
      setForm(initialForm);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể tạo tài khoản bác sĩ.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-doctor-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="create-doctor-title" className="text-lg font-bold text-slate-900">
                Tạo tài khoản bác sĩ
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tạo tài khoản đăng nhập và hồ sơ bác sĩ đầy đủ thông tin chuyên môn, liên hệ, địa chỉ.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {success}
            </p>
          ) : null}

          <SectionTitle title="Thông tin tài khoản và cá nhân" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Họ và tên *">
              <input
                required
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className={inputClassName}
                placeholder="Nguyễn Văn A"
              />
            </FormField>
            <FormField label="Email đăng nhập *">
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={inputClassName}
                placeholder="bacsi@example.com"
              />
            </FormField>
            <FormField label="Mật khẩu *">
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                className={inputClassName}
                placeholder="Tối thiểu 6 ký tự"
              />
            </FormField>
            <FormField label="Ngày sinh">
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => updateField("dateOfBirth", event.target.value)}
                className={inputClassName}
              />
            </FormField>
            <FormField label="Giới tính">
              <select
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value as CreateDoctorAccountInput["gender"])}
                className={inputClassName}
              >
                <option value="UNKNOWN">Chưa cập nhật</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </FormField>
            <FormField label="Số điện thoại">
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(event) => updateField("phoneNumber", event.target.value)}
                className={inputClassName}
                placeholder="090..."
              />
            </FormField>
          </div>

          <SectionTitle title="Thông tin chuyên môn" className="mt-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Chuyên khoa *">
              <select
                required
                disabled={isLoadingOptions || !options}
                value={form.specialtyId || ""}
                onChange={(event) => updateField("specialtyId", Number(event.target.value))}
                className={inputClassName}
              >
                <option value="">
                  {isLoadingOptions ? "Đang tải..." : "Chọn chuyên khoa"}
                </option>
                {options?.specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Học hàm / chức danh">
              <input
                value={form.academicTitle}
                onChange={(event) => updateField("academicTitle", event.target.value)}
                className={inputClassName}
                placeholder="Bác sĩ Chuyên khoa I"
              />
            </FormField>
            <FormField label="Số năm kinh nghiệm">
              <input
                type="number"
                min={0}
                value={form.experienceYears}
                onChange={(event) => updateField("experienceYears", Number(event.target.value))}
                className={inputClassName}
              />
            </FormField>
            <FormField label="Nơi làm việc">
              <input
                value={form.workplace}
                onChange={(event) => updateField("workplace", event.target.value)}
                className={inputClassName}
                placeholder="Bệnh viện / phòng khám"
              />
            </FormField>
            <FormField label="Thời gian làm việc">
              <input
                value={form.workingTime}
                onChange={(event) => updateField("workingTime", event.target.value)}
                className={inputClassName}
                placeholder="Thứ Hai - Thứ Sáu, 08:00 - 17:00"
              />
            </FormField>
            <FormField label="Ảnh đại diện (URL)">
              <input
                type="url"
                value={form.imageUrl}
                onChange={(event) => updateField("imageUrl", event.target.value)}
                className={inputClassName}
                placeholder="https://..."
              />
            </FormField>
          </div>

          <SectionTitle title="Địa chỉ làm việc" className="mt-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Số nhà và tên đường *" className="lg:col-span-2">
              <input
                required
                value={form.streetAddress}
                onChange={(event) => updateField("streetAddress", event.target.value)}
                className={inputClassName}
                placeholder="Ví dụ: Số 12 Nguyễn Trãi"
              />
            </FormField>
            <FormField label="Tỉnh / thành phố *">
              <select
                required
                disabled={isLoadingOptions || !provinces.length}
                value={form.provinceCode || ""}
                onChange={(event) => updateField("provinceCode", Number(event.target.value))}
                className={inputClassName}
              >
                <option value="">Chọn tỉnh/thành</option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Xã / phường *">
              <select
                required
                disabled={!form.provinceCode || !communes.length}
                value={form.communeCode || ""}
                onChange={(event) => updateField("communeCode", Number(event.target.value))}
                className={inputClassName}
              >
                <option value="">Chọn xã/phường</option>
                {communes.map((commune) => (
                  <option key={commune.code} value={commune.code}>
                    {commune.name}
                  </option>
                ))}
              </select>
            </FormField>

          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Hình thức tư vấn *</p>
              <div className="flex flex-wrap gap-3">
                {(["ONLINE", "OFFLINE"] as const).map((type) => (
                  <label key={type} className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.consultationType.includes(type)}
                      onChange={() => toggleConsultationType(type)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    {type === "ONLINE" ? "Tư vấn online" : "Khám trực tiếp"}
                  </label>
                ))}
              </div>
            </div>
            <FormField label="Mô tả hồ sơ">
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                className={`${inputClassName} min-h-24 resize-y`}
                placeholder="Kinh nghiệm và lĩnh vực chuyên môn..."
              />
            </FormField>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingOptions}
              className="h-10 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang tạo..." : "Tạo tài khoản bác sĩ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClassName =
  "mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100";

function SectionTitle({ title, className = "" }: { title: string; className?: string }) {
  return (
    <h3 className={`mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-700 ${className}`}>
      {title}
    </h3>
  );
}

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-slate-700 ${className}`}>
      {label}
      {children}
    </label>
  );
}
