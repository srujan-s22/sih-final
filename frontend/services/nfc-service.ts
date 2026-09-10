import { apiClient } from "./api-client";
import {
  NfcProvisionResponse,
  NfcRevokeResponse,
  HouseholdNfcStatusResponse,
  NfcConfirmRotationResponse,
  NfcCancelRotationResponse,
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
   * Initiates rotation for an existing household NFC credential (e.g. lost/damaged card).
   * Generates a pending credential without invalidating the active card until confirmed.
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
   * Confirms successful physical NFC card write during rotation.
   * Atomically invalidates old active credential and activates the pending credential.
   */
  public async confirmRotateNfc(
    householdId: string,
    nfcId: string,
    version: number,
    reason?: string
  ): Promise<ApiResult<NfcConfirmRotationResponse>> {
    return apiClient.post<NfcConfirmRotationResponse>(
      `/api/v1/asha/households/${encodeURIComponent(householdId)}/nfc/rotate/confirm`,
      { nfcId, version, reason }
    );
  }

  /**
   * Cancels a pending rotation when physical write fails or ASHA leaves the workflow.
   * Ensures the existing active credential remains completely valid.
   */
  public async cancelRotateNfc(
    householdId: string,
    nfcId?: string,
    reason?: string
  ): Promise<ApiResult<NfcCancelRotationResponse>> {
    return apiClient.post<NfcCancelRotationResponse>(
      `/api/v1/asha/households/${encodeURIComponent(householdId)}/nfc/rotate/cancel`,
      { nfcId, reason }
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
