import axios, { AxiosInstance, AxiosError } from "axios";

const api: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// 응답 인터셉터: 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: boolean; message?: string }>) => {
    const data = error.response?.data;
    if (data?.error) {
      console.error("API Error:", data.message);
    }
    return Promise.reject(data || error);
  }
);

export default api;
