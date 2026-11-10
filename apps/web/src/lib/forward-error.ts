export type ForwardErrorKind =
  | 'config'
  | 'agent'
  | 'network'
  | 'direct'
  | 'cors';

export class ForwardError extends Error {
  constructor(
    message: string,
    public readonly kind: ForwardErrorKind,
    public readonly status?: number,
    public readonly details?: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'ForwardError';
  }

  get isNetwork(): boolean {
    return this.kind === 'network';
  }
}
