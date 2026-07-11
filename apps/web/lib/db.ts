// Postgres client boilerplate (e.g., pg-promise or similar mock)
export interface DBClient {
  query: (text: string, params?: any[]) => Promise<any>;
}

export const db: DBClient = {
  query: async (text: string, params?: any[]) => {
    console.log(`Executing query: ${text} with params:`, params);
    return [];
  },
};
