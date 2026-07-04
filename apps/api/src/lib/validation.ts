import { z } from "zod";

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(4, "아이디는 4자 이상이어야 합니다")
    .max(20, "아이디는 20자 이하여야 합니다")
    .regex(/^[a-zA-Z0-9_]+$/, "아이디는 영문/숫자/밑줄(_)만 사용할 수 있습니다"),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .max(72, "비밀번호는 72자 이하여야 합니다"), // bcrypt 72바이트 제한
});

export type Credentials = z.infer<typeof credentialsSchema>;
