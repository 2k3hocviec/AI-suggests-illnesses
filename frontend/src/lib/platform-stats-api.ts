import { API_BASE_URL } from './http';

export interface PlatformStats {
  trustedUsers: number;
  doctors: number;
  specialties: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/platform-stats`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Unable to load platform stats');
    }

    return (await response.json()) as PlatformStats;
  } catch {
    return {
      trustedUsers: 0,
      doctors: 0,
      specialties: 0,
    };
  }
}
