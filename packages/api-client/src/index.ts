export interface ApiHealthResponse {
  application: string;
  status: string;
  environment: string;
  version: string;
}

export const DEFAULT_LOCAL_API_URL = "http://127.0.0.1:8000";
