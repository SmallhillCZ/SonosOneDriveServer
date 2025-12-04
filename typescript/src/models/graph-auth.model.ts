export class GraphAuth {
  householdId: string;
  deviceCode: string;
  refreshToken: string;

  constructor(householdId?: string, deviceCode?: string, refreshToken?: string) {
    this.householdId = householdId || null;
    this.deviceCode = deviceCode || null;
    this.refreshToken = refreshToken || null;
  }
}
