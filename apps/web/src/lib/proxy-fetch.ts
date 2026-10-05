import type {
  ProxyForwardRequestDto,
  ProxyResponseDto,
} from '@webapi-tester/shared';
import { api } from './api.js';

export async function proxyForward(
  dto: ProxyForwardRequestDto,
  accessToken: string,
): Promise<ProxyResponseDto> {
  return api<ProxyResponseDto>('/proxy/forward', {
    method: 'POST',
    body: dto,
    accessToken,
  });
}
