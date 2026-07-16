"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  District,
  listDistricts,
  listProvinces,
  listWards,
  Province,
  Ward,
} from "@/lib/administrative-units-api";
import { AuthUser, getMe, updateProfile } from "@/lib/auth-api";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ProfileFormState {
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  streetAddress: string;
  provinceCode: number;
  districtCode: number;
  wardCode: number;
}

const emptyForm: ProfileFormState = {
  fullName: "",
  email: "",
  phoneNumber: "",
  dateOfBirth: "",
  gender: "UNKNOWN",
  streetAddress: "",
  provinceCode: 0,
  districtCode: 0,
  wardCode: 0,
};

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      setMessage(null);

      try {
        const [profile, provinceList] = await Promise.all([
          getMe(),
          listProvinces(),
        ]);

        if (cancelled) {
          return;
        }

        setProvinces(provinceList);
        setForm(toFormState(profile));
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải thông tin người dùng.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !form.provinceCode) {
      setDistricts([]);
      return;
    }

    listDistricts(form.provinceCode)
      .then(setDistricts)
      .catch(() => setError("Không thể tải danh sách quận/huyện."));
  }, [form.provinceCode, open]);

  useEffect(() => {
    if (!open || !form.districtCode) {
      setWards([]);
      return;
    }

    listWards(form.districtCode)
      .then(setWards)
      .catch(() => setError("Không thể tải danh sách xã/phường."));
  }, [form.districtCode, open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updatedProfile = await updateProfile({
        ...form,
        dateOfBirth: form.dateOfBirth || undefined,
      });
      setForm(toFormState(updatedProfile));
      setMessage("Đã cập nhật thông tin cá nhân.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể cập nhật thông tin.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
      <div className="max-h-full w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Thông tin người dùng
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Cập nhật thông tin cá nhân và địa chỉ tư vấn.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(100vh-9rem)] overflow-y-auto px-5 py-4"
        >
          {isLoading ? (
            <p className="py-8 text-sm text-slate-500">
              Đang tải thông tin...
            </p>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileInput
                  label="Họ và tên"
                  value={form.fullName}
                  onChange={(value) => updateField("fullName", value)}
                  required
                />
                <ProfileInput
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                  required
                />
                <ProfileInput
                  label="Số điện thoại"
                  value={form.phoneNumber}
                  onChange={(value) => updateField("phoneNumber", value)}
                />
                <ProfileInput
                  label="Ngày sinh"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(value) => updateField("dateOfBirth", value)}
                />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    Giới tính
                  </span>
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      updateField(
                        "gender",
                        event.target.value as ProfileFormState["gender"],
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                    <option value="UNKNOWN">Chưa cập nhật</option>
                  </select>
                </label>
                <ProfileInput
                  label="Số nhà và tên đường"
                  value={form.streetAddress}
                  onChange={(value) => updateField("streetAddress", value)}
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ProfileSelect
                  label="Tỉnh/thành"
                  value={form.provinceCode}
                  options={provinces}
                  onChange={(value) => {
                    setForm((current) => ({
                      ...current,
                      provinceCode: value,
                      districtCode: 0,
                      wardCode: 0,
                    }));
                    setWards([]);
                  }}
                />
                <ProfileSelect
                  label="Quận/huyện"
                  value={form.districtCode}
                  options={districts}
                  disabled={!form.provinceCode}
                  onChange={(value) => {
                    setForm((current) => ({
                      ...current,
                      districtCode: value,
                      wardCode: 0,
                    }));
                  }}
                />
                <ProfileSelect
                  label="Xã/phường"
                  value={form.wardCode}
                  options={wards}
                  disabled={!form.districtCode}
                  onChange={(value) => updateField("wardCode", value)}
                />
              </div>

              {message ? (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {error}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading || isSaving}
              className="h-9 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  function updateField<Key extends keyof ProfileFormState>(
    field: Key,
    value: ProfileFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }
}

function ProfileInput({
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function ProfileSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  options: Array<{ code: number; name: string }>;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        required
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
      >
        <option value={0}>{label}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function toFormState(profile: AuthUser): ProfileFormState {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phoneNumber: profile.phoneNumber ?? "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
    gender: profile.gender as ProfileFormState["gender"],
    streetAddress: profile.streetAddress ?? "",
    provinceCode: profile.provinceCode ?? 0,
    districtCode: profile.districtCode ?? 0,
    wardCode: profile.wardCode ?? 0,
  };
}
