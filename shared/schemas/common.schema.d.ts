import { z } from "zod";
export declare const ErrorDetailSchema: any;
export declare const ApiErrorResponseSchema: any;
export type ApiErrorResponseDto = z.infer<typeof ApiErrorResponseSchema>;
