import { apiRequest } from './http';

export interface Province {
  code: number;
  name: string;
  divisionType: string;
  codename: string;
}

export interface Commune extends Province {
  provinceCode: number;
}

export function listProvinces() {
  return apiRequest<Province[]>('/administrative-units/provinces');
}

export function listCommunes(provinceCode: number) {
  return apiRequest<Commune[]>(
    `/administrative-units/communes?provinceCode=${provinceCode}`,
  );
}
