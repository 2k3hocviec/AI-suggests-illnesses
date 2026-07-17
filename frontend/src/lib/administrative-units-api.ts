import { apiRequest } from './http';

export interface Province {
  code: number;
  name: string;
  divisionType: string;
  codename: string;
}

export interface District extends Province {
  provinceCode: number;
}

export interface Ward extends Province {
  districtCode: number;
  provinceCode: number;
}

export function listProvinces() {
  return apiRequest<Province[]>('/administrative-units/provinces');
}

export function listDistricts(provinceCode: number) {
  return apiRequest<District[]>(
    `/administrative-units/districts?provinceCode=${provinceCode}`,
  );
}

export function listWards(districtCode: number) {
  return apiRequest<Ward[]>(
    `/administrative-units/wards?districtCode=${districtCode}`,
  );
}
