import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithInterceptor } from "../baseQuery";
import { CACHE_TAGS } from "./types";

export const baseApi = createApi({
  reducerPath: "baseApi",
  baseQuery: baseQueryWithInterceptor(""),
  tagTypes: Object.values(CACHE_TAGS) as string[],
  endpoints: () => ({}),
});

export { baseApi as api };
