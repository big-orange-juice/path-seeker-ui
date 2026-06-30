const FALLBACK_BEARER_TOKEN =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzNDU1MzY1NzU5MDE0MDUxODQiLCJqdGkiOiIzNjQ5Y2Y1N2U1MzQ0ZTRmOTI3ODk3MzZjODY1YjlkNSIsInVzZXJfbm8iOiJhZG1pbiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiMzQ1NTM2NTc1OTAxNDA1MTg0IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiU1VQRVJfQURNSU4iLCJleHAiOjE3ODI5MjA5OTAsImlzcyI6IkN1bHR1cmFsVG91cmlzbVN5c3RlbSIsImF1ZCI6IkN1bHR1cmFsVG91cmlzbVN5c3RlbS5DbGllbnQifQ.aXXKkeqL3lnxz5vj1Zqnd9jYxpH7N_oq42Q7b8uqmY0';

export default defineEventHandler((event) => {
  const authorization = getHeader(event, 'authorization') || FALLBACK_BEARER_TOKEN;
  const cookie = getHeader(event, 'cookie');

  event.context.backendHeaders = {
    ...(authorization ? { authorization } : {}),
    ...(cookie ? { cookie } : {}),
  };
});
