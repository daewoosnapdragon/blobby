// Shared postgres driver options (no server-only: also used by the integration test helper).
// date (oid 1082) stays a 'YYYY-MM-DD' string so Asia/Seoul date logic is never shifted by JS Date.
export const pgOptions = {
  prepare: false,
  types: {
    date: { to: 1082, from: [1082], serialize: (x: unknown) => x as string, parse: (x: string) => x },
  },
};
