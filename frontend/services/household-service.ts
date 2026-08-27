import { apiClient } from "./api-client";
import {
  Household,
  Member,
  CreateHouseholdInput,
  UpdateHouseholdInput,
  CreateMemberInput,
  UpdateMemberInput,
} from "@shared/types/household";
import { ApiResult } from "@shared/types/api";

export const householdService = {
  /**
   * Retrieves current authenticated citizen's household and members
   */
  async getHousehold(): Promise<ApiResult<{ household: Household; members: Member[] } | null>> {
    return apiClient.get<{ household: Household; members: Member[] } | null>("/api/v1/households/me");
  },

  /**
   * Creates or resolves existing household for authenticated citizen
   */
  async createHousehold(
    data: CreateHouseholdInput
  ): Promise<ApiResult<{ household: Household; isNew: boolean }>> {
    return apiClient.post<{ household: Household; isNew: boolean }>("/api/v1/households", data);
  },

  /**
   * Updates household demographic details
   */
  async updateHousehold(
    data: UpdateHouseholdInput
  ): Promise<ApiResult<{ household: Household }>> {
    return apiClient.patch<{ household: Household }>("/api/v1/households/me", data);
  },

  /**
   * Lists all members of citizen's household
   */
  async getMembers(): Promise<ApiResult<{ members: Member[] }>> {
    return apiClient.get<{ members: Member[] }>("/api/v1/households/me/members");
  },

  /**
   * Adds a new member to the household
   */
  async addMember(
    data: CreateMemberInput
  ): Promise<ApiResult<{ member: Member }>> {
    return apiClient.post<{ member: Member }>("/api/v1/households/me/members", data);
  },

  /**
   * Updates an existing household member
   */
  async updateMember(
    memberId: string,
    data: UpdateMemberInput
  ): Promise<ApiResult<{ member: Member }>> {
    return apiClient.patch<{ member: Member }>(`/api/v1/households/me/members/${memberId}`, data);
  },

  /**
   * Removes a member from the household
   */
  async deleteMember(
    memberId: string
  ): Promise<ApiResult<{ success: boolean; message: string }>> {
    return apiClient.delete<{ success: boolean; message: string }>(`/api/v1/households/me/members/${memberId}`);
  },
};
