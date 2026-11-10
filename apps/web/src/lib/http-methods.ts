import type { HttpMethod } from '@webapi-tester/shared';

// Kolor metody HTTP nawiązuje do konwencji stosowanych przez klienty API,
// dzięki czemu metoda rozpoznawana jest wizualnie bez czytania etykiety.
const METHOD_CLASSES: Record<HttpMethod, string> = {
  GET: 'bg-emerald-600 text-white',
  POST: 'bg-blue-600 text-white',
  PUT: 'bg-amber-500 text-white',
  PATCH: 'bg-violet-600 text-white',
  DELETE: 'bg-rose-600 text-white',
  OPTIONS: 'bg-slate-500 text-white',
  HEAD: 'bg-teal-600 text-white',
};

export function methodClass(method: HttpMethod): string {
  return METHOD_CLASSES[method];
}

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
];
