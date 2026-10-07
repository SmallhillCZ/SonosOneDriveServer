export class GraphAuth {
  constructor(
    readonly householdId: string,
    readonly accessToken: string,
    readonly refreshToken: string,
  ) {}
}

export interface TokenPair {
  authToken: string;
  privateKey: string;
  userInfo?: { userIdHashCode: string };
}
