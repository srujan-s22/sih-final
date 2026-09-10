import { apiClient } from "./api-client";
import {
  NfcProvisionResponse,
  NfcRevokeResponse,
  HouseholdNfcStatusResponse,
} from "@shared/types/nfc";
import { ApiResult } from "@shared/types/api";

export class NfcServiceClient {
  /**
   * Retrieves safe status metadata for a household's NFC tag.
   * Only accessible to authorized ASHA workers and Administrators.
   */
  public async getHouseholdNfcStatus(
    householdId: string
  ): Promise<ApiResult<HouseholdNfcStatusResponse>> {
    return apiClient.get<HouseholdNfcStatusResponse>(
      `/api/v1/asha/households/${encodeURIComponent(householdId)}/nfc`
    );
  }

  /**
   * Provisions a brand-new NFC credential for an authorized household.
   * Returns one-time token for writing to the physical NFC tag.
   */
  public async provisionNfc(
    householdId: string
  ): Promise<ApiResult<NfcProvisionResponse>> {
    return apiClient.post<NfcProvisionResponse>(
      `/api/v1/asha/households/${encodeURIComponent(householdId)}/nfc`
    );
  }

  /**
   * Rotates an existing household NFC credential (e.g. lost/damaged card).
   * Atomically invalidates old credential and returns a new raw token.
   */
  public async rotateNfc(
    householdId: string,
    reason?: string
  ): Promise<ApiResult<NfcProvisionResponse>> {
    return apiClient.post<NfcProvisionResponse>(
      `/api/v1/asha/households/${encodeURIComponent(householdId)}/nfc/rotate`,
      reason ? { reason } : {}
    );
  }

  /**
   * Explicitly revokes an active household NFC card.
   */
  public async revokeNfc(
    householdId: string,
    reason?: string
  ): Promise<ApiResult<NfcRevokeResponse>> {
    return apiClient.post<NfcRevokeResponse>(
      `/api/v1/asha/households/${encodeURIComponent(householdId)}/nfc/revoke`,
      reason ? { reason } : {}
    );
  }
}

export const nfcService = new NfcServiceClient();
