import { z } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  email: 'e-mail',
  password: 'hasło',
  currentPassword: 'obecne hasło',
  newPassword: 'nowe hasło',
  refreshToken: 'token odnowienia',
  url: 'adres URL',
  fileContent: 'zawartość pliku',
  name: 'nazwa',
  method: 'metoda',
  headers: 'nagłówki',
  body: 'ciało zapytania',
  bodyEncoding: 'kodowanie ciała',
  baseUrl: 'adres bazowy',
  status: 'kod statusu',
  durationMs: 'czas odpowiedzi',
};

const TYPE_LABELS: Record<string, string> = {
  string: 'tekst',
  number: 'liczba',
  boolean: 'wartość logiczna',
  array: 'lista',
  object: 'obiekt',
};

const STRING_VALIDATION_LABELS: Record<string, string> = {
  email: 'adres e-mail jest nieprawidłowy',
  url: 'adres URL jest nieprawidłowy',
};

function messageFor(issue: z.ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined'
        ? 'jest wymagane'
        : `oczekiwano ${TYPE_LABELS[issue.expected] ?? issue.expected}, otrzymano ${
            TYPE_LABELS[issue.received] ?? issue.received
          }`;
    case 'invalid_string': {
      const validation = String(issue.validation);
      return (
        STRING_VALIDATION_LABELS[validation] ?? 'wartość tekstowa jest nieprawidłowa'
      );
    }
    case 'too_small':
      return `musi mieć co najmniej ${issue.minimum} znaków`;
    case 'too_big':
      return `może mieć maksymalnie ${issue.maximum} znaków`;
    case 'invalid_enum_value':
      return `dozwolone wartości: ${issue.options.join(', ')}`;
    default:
      // refine() bez własnego komunikatu zostawia angielski domyślny tekst Zod.
      return issue.message;
  }
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map((s) => FIELD_LABELS[String(s)] ?? String(s));
      const prefix = path.length > 0 ? path.join('.') : 'body';
      return `${prefix}: ${messageFor(issue)}`;
    })
    .join('; ');
}