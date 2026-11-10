import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_AGENT_URL,
  defaultAgentSettings,
  loadAgentSettings,
  loadForwardMode,
  saveAgentSettings,
  saveForwardMode,
} from './agent-settings.js';

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
}

beforeEach(() => {
  stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ustawienia agenta', () => {
  it('zwraca domyslny adres agenta, gdy nic nie zapisano', () => {
    expect(loadAgentSettings()).toEqual(defaultAgentSettings());
    expect(DEFAULT_AGENT_URL).toBe('http://127.0.0.1:3002');
  });

  it('odtwarza zapisany adres i klucz', () => {
    saveAgentSettings({ url: 'http://127.0.0.1:4000', key: 'abc' });
    expect(loadAgentSettings()).toEqual({
      url: 'http://127.0.0.1:4000',
      key: 'abc',
    });
  });

  it('upraszcza uszkodzone dane do ustawien domyslnych', () => {
    localStorage.setItem('webapi-tester.agent', 'to nie jest json');
    expect(loadAgentSettings()).toEqual(defaultAgentSettings());
  });

  it('pomija pusty zapisany adres', () => {
    localStorage.setItem(
      'webapi-tester.agent',
      JSON.stringify({ url: '', key: 'abc' }),
    );
    expect(loadAgentSettings().url).toBe(defaultAgentSettings().url);
  });
});

describe('tryb wysylania', () => {
  it('domyslnie wysyla automatycznie', () => {
    expect(loadForwardMode()).toBe('auto');
  });

  it('zapamietuje wybrany tryb', () => {
    saveForwardMode('direct');
    expect(loadForwardMode()).toBe('direct');
    saveForwardMode('agent');
    expect(loadForwardMode()).toBe('agent');
  });

  it('pomija nieznana wartosc i wraca do trybu automatycznego', () => {
    localStorage.setItem('webapi-tester.forward-mode', 'cos-innego');
    expect(loadForwardMode()).toBe('auto');
  });
});
