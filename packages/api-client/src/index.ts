export * as auth from "#api/auth";
export type {
  LoginResult,
  MfaPosture,
  ResetResult,
  SecondFactor,
  SessionInfo,
  SsoReturn,
  TotpEnrollment,
} from "#api/auth";
export {
  type AppEnvironment,
  type LogLevel,
  type PublicConfig,
  publicConfigFrom,
} from "#api/config";
export type { Edge } from "#api/edge/types";
export {
  ApiError,
  type ErrorExtensions,
  GatewayUnreachableError,
  type GraphQLErrorItem,
  GraphQLRequestError,
  isRefusal,
  legacyCode,
} from "#api/errors";
export {
  GatewayClient,
  type GatewayOptions,
  readCookie,
  type RequestOptions,
  type TypedDocument,
} from "#api/gateway";
export * from "#api/generated/graphql";
export { createLogger, type LogFields, type Logger, setLogFormat, setLogLevel } from "#api/log";
export {
  bootstrapAdmin,
  confirmEmailCode,
  fetchSetupState,
  type FirstAdmin,
  requestEmailCode,
  seedBuiltins,
  type SetupProblem,
} from "#api/setup";
export {
  beginStepUpPasskey,
  sendStepUpEmail,
  stepUp,
  type StepUpProof,
  type StepUpResult,
} from "#api/stepUp";
export { createCredential, getAssertion, passkeysSupported } from "#api/webauthn";
