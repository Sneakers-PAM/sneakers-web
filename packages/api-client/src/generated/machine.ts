export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type FieldMappingInput = {
  from: Scalars["String"]["input"];
  to: Scalars["String"]["input"];
};

export type GeneratedSecret = {
  generatedValue?: Maybe<Scalars["String"]["output"]>;
  secret: SecretSummary;
};

export type MachineConnection = {
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  port: Scalars["Int"]["output"];
  protocol: Scalars["String"]["output"];
  targetCount: Scalars["Int"]["output"];
  useTls: Scalars["Boolean"]["output"];
};

export type MachinePrincipal = {
  kind: Scalars["String"]["output"];
  principalId: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
};

export type MachineTarget = {
  connectionId: Scalars["ID"]["output"];
  description: Scalars["String"]["output"];
  domain: Scalars["String"]["output"];
  hostname: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  kind: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  ownerUserId: Scalars["String"]["output"];
  realm: Scalars["String"]["output"];
  secretCount: Scalars["Int"]["output"];
  sshHostKeys: Array<Scalars["String"]["output"]>;
};

export type MachineTargetInput = {
  connectionId: Scalars["ID"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  domain?: InputMaybe<Scalars["String"]["input"]>;
  hostname: Scalars["String"]["input"];
  id?: InputMaybe<Scalars["ID"]["input"]>;
  kind?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  realm?: InputMaybe<Scalars["String"]["input"]>;
  sshHostKeys?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

export type Mutation = {
  changeSecretTypeForPrincipal: TypeChangedSecret;
  createFolderForPrincipal: PrincipalFolder;
  createSecretForPrincipal: SecretSummary;
  generateSecretForPrincipal: GeneratedSecret;
  moveSecretForPrincipal: SecretSummary;
  prepareSecretUse: SecretUse;
  redeemSecretUse: RedeemedSecretUse;
  renameFolderForPrincipal: PrincipalFolder;
  renameSecretForPrincipal: SecretSummary;
  requestSecretCheck: Scalars["Int"]["output"];
  revealSecretFieldForPrincipal: Scalars["String"]["output"];
  saveTargetForPrincipal: MachineTarget;
  setSecretAutomationForPrincipal: SecretSummary;
  setSecretTargetForPrincipal: SecretSummary;
  updateSecretFieldsForPrincipal: UpdatedSecretFields;
};

export type MutationChangeSecretTypeForPrincipalArgs = {
  fieldMapping?: InputMaybe<Array<FieldMappingInput>>;
  fields?: InputMaybe<Array<SecretFieldInput>>;
  id: Scalars["ID"]["input"];
  newTypeId: Scalars["ID"]["input"];
};

export type MutationCreateFolderForPrincipalArgs = {
  name: Scalars["String"]["input"];
  parentId: Scalars["ID"]["input"];
};

export type MutationCreateSecretForPrincipalArgs = {
  disableHeartbeat?: InputMaybe<Scalars["Boolean"]["input"]>;
  disableRotation?: InputMaybe<Scalars["Boolean"]["input"]>;
  fields: Array<SecretFieldInput>;
  folderId: Scalars["ID"]["input"];
  name: Scalars["String"]["input"];
  targetId?: InputMaybe<Scalars["ID"]["input"]>;
  typeId: Scalars["ID"]["input"];
};

export type MutationGenerateSecretForPrincipalArgs = {
  disableHeartbeat?: InputMaybe<Scalars["Boolean"]["input"]>;
  disableRotation?: InputMaybe<Scalars["Boolean"]["input"]>;
  fields: Array<SecretFieldInput>;
  folderId: Scalars["ID"]["input"];
  name: Scalars["String"]["input"];
  policyId?: InputMaybe<Scalars["ID"]["input"]>;
  returnValue?: InputMaybe<Scalars["Boolean"]["input"]>;
  targetId?: InputMaybe<Scalars["ID"]["input"]>;
  typeId: Scalars["ID"]["input"];
};

export type MutationMoveSecretForPrincipalArgs = {
  destFolderId: Scalars["ID"]["input"];
  id: Scalars["ID"]["input"];
};

export type MutationPrepareSecretUseArgs = {
  argv?: InputMaybe<Array<Scalars["String"]["input"]>>;
  clientLabel?: InputMaybe<Scalars["String"]["input"]>;
  fieldKey: Scalars["String"]["input"];
  purpose?: InputMaybe<Scalars["String"]["input"]>;
  reveal?: InputMaybe<Scalars["Boolean"]["input"]>;
  runId?: InputMaybe<Scalars["String"]["input"]>;
  secretId: Scalars["ID"]["input"];
};

export type MutationRedeemSecretUseArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRenameFolderForPrincipalArgs = {
  id: Scalars["ID"]["input"];
  name: Scalars["String"]["input"];
};

export type MutationRenameSecretForPrincipalArgs = {
  id: Scalars["ID"]["input"];
  name: Scalars["String"]["input"];
};

export type MutationRequestSecretCheckArgs = {
  secretId: Scalars["ID"]["input"];
};

export type MutationRevealSecretFieldForPrincipalArgs = {
  fieldKey: Scalars["String"]["input"];
  id: Scalars["ID"]["input"];
};

export type MutationSaveTargetForPrincipalArgs = {
  input: MachineTargetInput;
};

export type MutationSetSecretAutomationForPrincipalArgs = {
  disableHeartbeat: Scalars["Boolean"]["input"];
  disableRotation: Scalars["Boolean"]["input"];
  secretId: Scalars["ID"]["input"];
};

export type MutationSetSecretTargetForPrincipalArgs = {
  secretId: Scalars["ID"]["input"];
  targetId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type MutationUpdateSecretFieldsForPrincipalArgs = {
  fields: Array<SecretFieldInput>;
  id: Scalars["ID"]["input"];
};

export type PrincipalFolder = {
  canAuthor: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  parentId?: Maybe<Scalars["ID"]["output"]>;
  path: Scalars["String"]["output"];
};

export type Query = {
  connectionsForPrincipal: Array<MachineConnection>;
  findSecretsForPrincipal: Array<SecretSummary>;
  foldersForPrincipal: Array<PrincipalFolder>;
  machineHealth: Scalars["Boolean"]["output"];
  machineWhoami: MachinePrincipal;
  secretCheckStatus: SecretCheckStatus;
  secretTypes: Array<SecretTypeSummary>;
  secretUse: SecretUse;
  secretUseRun: Array<SecretUse>;
  targetsForPrincipal: Array<MachineTarget>;
};

export type QueryFindSecretsForPrincipalArgs = {
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  typeId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type QueryFoldersForPrincipalArgs = {
  parentId?: InputMaybe<Scalars["ID"]["input"]>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySecretCheckStatusArgs = {
  secretId: Scalars["ID"]["input"];
};

export type QuerySecretUseArgs = {
  id: Scalars["ID"]["input"];
};

export type QuerySecretUseRunArgs = {
  runId: Scalars["String"]["input"];
};

export type QueryTargetsForPrincipalArgs = {
  connectionId?: InputMaybe<Scalars["ID"]["input"]>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type RedeemedSecretUse = {
  use: SecretUse;
  value: Scalars["String"]["output"];
};

export type SecretCheckStatus = {
  checkedAtUnix: Scalars["Int"]["output"];
  detail: Scalars["String"]["output"];
  pending: Scalars["Boolean"]["output"];
  result: Scalars["String"]["output"];
};

export type SecretFieldInput = {
  key: Scalars["String"]["input"];
  value: Scalars["String"]["input"];
};

export type SecretSummary = {
  folderId: Scalars["ID"]["output"];
  heartbeatOptOut: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  rotationOptOut: Scalars["Boolean"]["output"];
  targetId?: Maybe<Scalars["ID"]["output"]>;
  typeId: Scalars["ID"]["output"];
};

export type SecretTypeField = {
  key: Scalars["String"]["output"];
  kind: Scalars["String"]["output"];
  label: Scalars["String"]["output"];
  required: Scalars["Boolean"]["output"];
  sensitive: Scalars["Boolean"]["output"];
};

export type SecretTypeSummary = {
  fields: Array<SecretTypeField>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type SecretUse = {
  approvalUrl: Scalars["String"]["output"];
  argv: Array<Scalars["String"]["output"]>;
  confirm: Scalars["Boolean"]["output"];
  expiresAtUnix: Scalars["Int"]["output"];
  fieldKey: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  reveal: Scalars["Boolean"]["output"];
  runId?: Maybe<Scalars["String"]["output"]>;
  secretId: Scalars["ID"]["output"];
  secretName: Scalars["String"]["output"];
  state: Scalars["String"]["output"];
};

export type TypeChangeAutomation = {
  heartbeat: TypeChangeHeartbeat;
  rotation: TypeChangeRotation;
  target: TypeChangeTarget;
};

export type TypeChangeHeartbeat = "NONE" | "NO_TARGET" | "OFF" | "ON";

export type TypeChangeRotation = "NONE" | "OFF" | "ON";

export type TypeChangeTarget = "ATTACHED" | "NONE" | "NOT_SUPPORTED";

export type TypeChangedSecret = {
  automation: TypeChangeAutomation;
  fieldKeys: Array<Scalars["String"]["output"]>;
  movedToNotesKeys: Array<Scalars["String"]["output"]>;
  secret: SecretSummary;
};

export type UpdatedSecretFields = {
  changedFieldKeys: Array<Scalars["String"]["output"]>;
  secret: SecretSummary;
};
