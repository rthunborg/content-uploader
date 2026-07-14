export type LoginState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const INITIAL_LOGIN_STATE: LoginState = {
  status: "idle",
  message: null,
};
