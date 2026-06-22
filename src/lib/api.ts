export const API = {
  auth:      'https://functions.poehali.dev/3ae865d9-e3f4-4b01-be1f-cf61d7cdc1f4',
  profile:   'https://functions.poehali.dev/da158f8b-326a-4f53-9ac3-62977e5efc4e',
  pay:       'https://functions.poehali.dev/89d100fe-809c-48e7-8cf8-6eb1856ca955',
  useCredit: 'https://functions.poehali.dev/21088b38-7f95-4fe7-b0c9-280d5e75327e',
};

export const getSessionId = () => localStorage.getItem('session_id') || '';
export const setSessionId = (id: string) => localStorage.setItem('session_id', id);
export const clearSession = () => localStorage.removeItem('session_id');

export const authHeaders = () => ({ 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() });
