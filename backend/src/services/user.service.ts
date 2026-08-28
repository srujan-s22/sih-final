import { DecodedIdToken } from "firebase-admin/auth";
import { UserProfile, UserRole, ConsentSubmission, ConsentRecord } from "../../../shared/types/auth.js";
import { UserRepository } from "../repositories/user.repository.js";
import { CURRENT_CONSENT_VERSION, DEFAULT_USER_ROLE } from "../config/constants.js";

export class UserService {
  constructor(private userRepository: UserRepository) {}

  /**
   * Idempotently retrieves an existing user profile or creates a new one.
   * STRICT SECURITY RULE: If user already exists, their existing role (ASHA, ADMIN, CITIZEN)
   * is PRESERVED and NEVER reset or overwritten.
   */
  public async getOrCreateUser(
    token: DecodedIdToken,
    metadata?: { displayName?: string | null; phoneNumber?: string | null },
    assignedRole?: UserRole
  ): Promise<{ user: UserProfile; isNewUser: boolean; isConsentRequired: boolean }> {
    const existing = await this.userRepository.getUserById(token.uid);

    if (existing) {
      const updates: Partial<UserProfile> = {};
      if (metadata?.displayName && metadata.displayName !== existing.displayName) {
        updates.displayName = metadata.displayName;
      }
      if (metadata?.phoneNumber && metadata.phoneNumber !== existing.phoneNumber) {
        updates.phoneNumber = metadata.phoneNumber;
      }
      // If a verified privileged role was authorized, apply it
      if (assignedRole && (assignedRole === "ASHA" || assignedRole === "ADMIN") && existing.role !== assignedRole) {
        updates.role = assignedRole;
      }

      let user = existing;
      if (Object.keys(updates).length > 0) {
        const updated = await this.userRepository.updateUserProfile(token.uid, updates);
        if (updated) user = updated;
      }

      const isConsentRequired = this.isConsentRequired(user);
      return { user, isNewUser: false, isConsentRequired };
    }

    // Brand new user registration: Role is verified assignedRole or defaults to CITIZEN
    const now = new Date().toISOString();
    const newUser: UserProfile = {
      uid: token.uid,
      email: token.email || "",
      displayName: metadata?.displayName || token.name || null,
      phoneNumber: metadata?.phoneNumber || token.phone_number || null,
      role: assignedRole || DEFAULT_USER_ROLE,
      consentStatus: "pending",
      consentVersion: null,
      consentedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.userRepository.createUserProfile(newUser);
    return {
      user: created,
      isNewUser: true,
      isConsentRequired: true,
    };
  }

  /**
   * Retrieves user profile by UID
   */
  public async getUserProfile(uid: string): Promise<UserProfile | null> {
    return this.userRepository.getUserById(uid);
  }

  /**
   * Checks if user is required to give or renew consent
   */
  public isConsentRequired(user: UserProfile): boolean {
    if (user.consentStatus !== "accepted") {
      return true;
    }
    if (!user.consentVersion || user.consentVersion !== CURRENT_CONSENT_VERSION) {
      return true;
    }
    return false;
  }

  /**
   * Records user consent decision and appends an immutable audit entry to consent history
   */
  public async recordConsent(
    uid: string,
    submission: ConsentSubmission
  ): Promise<{ user: UserProfile; consentRecord: ConsentRecord }> {
    let user = await this.userRepository.getUserById(uid);
    if (!user) {
      // If user document does not exist yet, create default citizen profile first
      const now = new Date().toISOString();
      user = await this.userRepository.createUserProfile({
        uid,
        email: `${uid}@swasthyasetu.gov.in`,
        displayName: null,
        phoneNumber: null,
        role: DEFAULT_USER_ROLE,
        consentStatus: "pending",
        consentVersion: null,
        consentedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const now = new Date().toISOString();
    const consentStatus = submission.accepted ? "accepted" : "declined";

    // 1. Update current consent state on the user document
    const updatedUser = await this.userRepository.updateUserProfile(uid, {
      consentStatus,
      consentVersion: submission.consentVersion,
      consentedAt: submission.accepted ? now : null,
    });

    if (!updatedUser) {
      throw new Error("Failed to update user consent state.");
    }

    // 2. Append immutable historical consent record
    const consentRecord = await this.userRepository.recordConsentHistory(uid, {
      userId: uid,
      consentVersion: submission.consentVersion,
      accepted: submission.accepted,
      timestamp: now,
      method: submission.method || "web_portal",
    });

    return { user: updatedUser, consentRecord };
  }

  /**
   * Assigns a privileged role to a target user.
   * STRICT SECURITY RULE: The actor MUST be an authorized ADMIN.
   */
  public async assignRole(
    actorUid: string,
    targetUid: string,
    newRole: UserRole
  ): Promise<UserProfile> {
    const actor = await this.userRepository.getUserById(actorUid);
    if (!actor || actor.role !== "ADMIN") {
      throw new Error("Unauthorized: Only administrators can assign roles.");
    }

    const target = await this.userRepository.getUserById(targetUid);
    if (!target) {
      throw new Error(`Target user with UID '${targetUid}' not found.`);
    }

    const updated = await this.userRepository.updateUserProfile(targetUid, {
      role: newRole,
    });

    if (!updated) {
      throw new Error("Failed to update user role.");
    }

    return updated;
  }

  /**
   * Retrieves historical consent audit records for a user
   */
  public async getConsentHistory(uid: string): Promise<ConsentRecord[]> {
    return this.userRepository.getConsentHistory(uid);
  }
}
