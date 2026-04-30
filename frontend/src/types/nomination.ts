/** Submission types matching the backend SubmissionType enum. */
export enum SubmissionType {
  SELF_NOMINATION = "Self-Nomination",
  MANAGER_NOMINATION = "Manager-Nomination",
  SUPERVISOR_APPROVED = "Nomination Approved by Supervisor",
}

export interface SupervisorInfo {
  global_id: string;
  name: string;
  email?: string;
}

export interface NominationCreate {
  nominee_name: string;
  nominee_email: string;
  submission_type: SubmissionType;
  notes?: string;
}

export interface NominationRead extends NominationCreate {
  id: string;
  supervisor_global_id?: string;
  supervisor_name?: string;
  created_at: string;
  updated_at: string;
}
