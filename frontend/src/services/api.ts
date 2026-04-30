import axios from "axios";
import {
  NominationCreate,
  NominationRead,
  SupervisorInfo,
} from "../types/nomination";

const BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

/** Create a new nomination. */
export async function createNomination(
  payload: NominationCreate,
  nomineeGlobalId?: string
): Promise<NominationRead> {
  const params = nomineeGlobalId
    ? { nominee_global_id: nomineeGlobalId }
    : undefined;
  const { data } = await api.post<NominationRead>("/nominations/", payload, {
    params,
  });
  return data;
}

/** Look up the supervisor for the given employee Global ID. */
export async function lookupSupervisor(
  employeeGlobalId: string
): Promise<SupervisorInfo | null> {
  try {
    const { data } = await api.get<SupervisorInfo>(
      "/nominations/supervisor/lookup",
      { params: { employee_global_id: employeeGlobalId } }
    );
    return data;
  } catch {
    return null;
  }
}

/** Fetch all nominations. */
export async function fetchNominations(): Promise<NominationRead[]> {
  const { data } = await api.get<NominationRead[]>("/nominations/");
  return data;
}
