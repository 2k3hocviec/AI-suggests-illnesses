'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  Commune,
  listCommunes,
  listProvinces,
  Province,
} from '@/lib/administrative-units-api';
import {
  DoctorConsultationType,
  DoctorProfile,
  getMyDoctorProfile,
  updateMyDoctorProfile,
} from '@/lib/doctors-api';

interface DoctorProfileDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (profile: DoctorProfile) => void;
}

interface DoctorFormState {
  fullName: string;
  academicTitle: string;
  experienceYears: number;
  workplace: string;
  phoneNumber: string;
  streetAddress: string;
  provinceCode: number;
  communeCode: number;
  workingTime: string;
  description: string;
  consultationType: DoctorConsultationType[];
}

const emptyForm: DoctorFormState = {
  fullName: '',
  academicTitle: '',
  experienceYears: 0,
  workplace: '',
  phoneNumber: '',
  streetAddress: '',
  provinceCode: 0,
  communeCode: 0,
  workingTime: '',
  description: '',
  consultationType: ['ONLINE'],
};

const inputClassName =
  'mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100';

export function DoctorProfileDialog({
  open,
  onClose,
  onSaved,
}: DoctorProfileDialogProps) {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [form, setForm] = useState<DoctorFormState>(emptyForm);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setImageFile(null);
    setImagePreview(null);

    Promise.all([getMyDoctorProfile(), listProvinces()])
      .then(([nextProfile, provinceList]) => {
        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setForm(toFormState(nextProfile));
        setProvinces(provinceList);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Không thể tải hồ sơ bác sĩ.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !form.provinceCode) {
      setCommunes([]);
      return;
    }

    let cancelled = false;
    listCommunes(form.provinceCode)
      .then((items) => {
        if (!cancelled) {
          setCommunes(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Không thể tải danh sách xã/phường.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.provinceCode, open]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof DoctorFormState>(
    field: K,
    value: DoctorFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleConsultationType(type: DoctorConsultationType) {
    setForm((current) => {
      const hasType = current.consultationType.includes(type);
      return {
        ...current,
        consultationType: hasType
          ? current.consultationType.filter((item) => item !== type)
          : [...current.consultationType, type],
      };
    });
  }

  function handleImageChange(file: File | null) {
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Ảnh đại diện không được vượt quá 5 MB.');
      setImageFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    setError(null);
    setImageFile(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.fullName.trim() || !form.streetAddress.trim()) {
      setError('Vui lòng nhập họ tên và địa chỉ làm việc.');
      return;
    }

    if (!form.provinceCode || !form.communeCode) {
      setError('Vui lòng chọn đầy đủ tỉnh/thành và xã/phường.');
      return;
    }

    if (!form.consultationType.length) {
      setError('Vui lòng chọn ít nhất một hình thức tư vấn.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await updateMyDoctorProfile({
        ...form,
        fullName: form.fullName.trim(),
        academicTitle: form.academicTitle.trim(),
        workplace: form.workplace.trim(),
        phoneNumber: form.phoneNumber.trim(),
        streetAddress: form.streetAddress.trim(),
        workingTime: form.workingTime.trim(),
        description: form.description.trim(),
        imageFile,
      });
      setProfile(updatedProfile);
      setForm(toFormState(updatedProfile));
      setImageFile(null);
      setSuccess('Đã cập nhật hồ sơ bác sĩ.');
      onSaved?.(updatedProfile);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Không thể cập nhật hồ sơ bác sĩ.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const displayedImage = imagePreview ?? profile?.imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Quản lý hồ sơ bác sĩ
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Cập nhật thông tin sẽ được hiển thị trên thẻ đề xuất và trang hồ sơ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {success}
            </p>
          ) : null}

          {isLoading ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Đang tải hồ sơ...
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold text-blue-800 ring-4 ring-white">
                  {displayedImage ? (
                    <img
                      src={displayedImage}
                      alt={`Ảnh đại diện của ${form.fullName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(form.fullName) || 'BS'
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Ảnh đại diện chuyên nghiệp
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    JPG, PNG, WEBP hoặc GIF · tối đa 5 MB · lưu trên Cloudinary
                  </p>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) =>
                      handleImageChange(event.target.files?.[0] ?? null)
                    }
                    className="mt-3 block max-w-full text-xs text-slate-600"
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Họ và tên *">
                  <input
                    required
                    value={form.fullName}
                    onChange={(event) => updateField('fullName', event.target.value)}
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Chuyên khoa">
                  <input
                    disabled
                    value={profile?.specialty.name ?? ''}
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Học hàm / chức danh">
                  <input
                    value={form.academicTitle}
                    onChange={(event) =>
                      updateField('academicTitle', event.target.value)
                    }
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Số năm kinh nghiệm">
                  <input
                    type="number"
                    min={0}
                    value={form.experienceYears}
                    onChange={(event) =>
                      updateField('experienceYears', Number(event.target.value))
                    }
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Nơi làm việc">
                  <input
                    value={form.workplace}
                    onChange={(event) => updateField('workplace', event.target.value)}
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Số điện thoại">
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={(event) =>
                      updateField('phoneNumber', event.target.value)
                    }
                    className={inputClassName}
                  />
                </FormField>
                <FormField label="Thời gian làm việc">
                  <input
                    value={form.workingTime}
                    onChange={(event) =>
                      updateField('workingTime', event.target.value)
                    }
                    placeholder="Thứ Hai - Thứ Sáu, 08:00 - 17:00"
                    className={inputClassName}
                  />
                </FormField>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField label="Số nhà và tên đường *">
                  <input
                    required
                    value={form.streetAddress}
                    onChange={(event) =>
                      updateField('streetAddress', event.target.value)
                    }
                    className={inputClassName}
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Tỉnh / thành phố *">
                    <select
                      required
                      value={form.provinceCode || ''}
                      onChange={(event) => {
                        const provinceCode = Number(event.target.value);
                        setForm((current) => ({
                          ...current,
                          provinceCode,
                          communeCode: 0,
                        }));
                      }}
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
                      disabled={!form.provinceCode}
                      value={form.communeCode || ''}
                      onChange={(event) =>
                        updateField('communeCode', Number(event.target.value))
                      }
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
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Hình thức tư vấn *
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {(['ONLINE', 'OFFLINE'] as const).map((type) => (
                      <label key={type} className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={form.consultationType.includes(type)}
                          onChange={() => toggleConsultationType(type)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600"
                        />
                        {type === 'ONLINE' ? 'Tư vấn online' : 'Khám trực tiếp'}
                      </label>
                    ))}
                  </div>
                </div>
                <FormField label="Mô tả hồ sơ">
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateField('description', event.target.value)
                    }
                    className={`${inputClassName} min-h-28 resize-y py-2`}
                    placeholder="Kinh nghiệm, lĩnh vực chuyên môn, phương pháp tư vấn..."
                  />
                </FormField>
              </div>
            </>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isLoading || isSaving}
              className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function toFormState(profile: DoctorProfile): DoctorFormState {
  return {
    fullName: profile.fullName,
    academicTitle: profile.academicTitle ?? '',
    experienceYears: profile.experienceYears,
    workplace: profile.workplace ?? '',
    phoneNumber: profile.phoneNumber ?? '',
    streetAddress: profile.streetAddress ?? '',
    provinceCode: profile.provinceCode ?? 0,
    communeCode: profile.communeCode ?? 0,
    workingTime: profile.workingTime ?? '',
    description: profile.description ?? '',
    consultationType: profile.consultationType.length
      ? profile.consultationType
      : ['ONLINE'],
  };
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
