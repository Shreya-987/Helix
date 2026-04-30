/**
 * NominationForm component tests (SUBTASK-7).
 *
 * Tests verify:
 *  - All three submission type radio options render
 *  - Supervisor fields appear only when "Nomination Approved by Supervisor" is selected
 *  - Form validation prevents submission without required fields
 *  - Successful submission shows confirmation
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NominationForm from "./NominationForm";
import * as api from "../services/api";
import { SubmissionType } from "../types/nomination";

jest.mock("../services/api");
const mockCreateNomination = api.createNomination as jest.MockedFunction<
  typeof api.createNomination
>;
const mockLookupSupervisor = api.lookupSupervisor as jest.MockedFunction<
  typeof api.lookupSupervisor
>;

function setup() {
  const user = userEvent.setup();
  const view = render(<NominationForm />);
  return { user, ...view };
}

describe("NominationForm – Submission Type (SUBTASK-7)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("renders all three submission type radio buttons", () => {
    setup();
    expect(screen.getByLabelText("Self-Nomination")).toBeInTheDocument();
    expect(screen.getByLabelText("Manager-Nomination")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Nomination Approved by Supervisor")
    ).toBeInTheDocument();
  });

  it("defaults to Self-Nomination", () => {
    setup();
    expect(screen.getByLabelText("Self-Nomination")).toBeChecked();
  });

  it("does NOT show supervisor fields for Self-Nomination", () => {
    setup();
    expect(
      screen.queryByTestId("nominee-global-id")
    ).not.toBeInTheDocument();
  });

  it("shows supervisor fields when Nomination Approved by Supervisor is selected", async () => {
    const { user } = setup();
    await user.click(
      screen.getByLabelText("Nomination Approved by Supervisor")
    );
    expect(screen.getByTestId("nominee-global-id")).toBeInTheDocument();
  });

  it("hides supervisor fields again when switching back to Self-Nomination", async () => {
    const { user } = setup();
    await user.click(
      screen.getByLabelText("Nomination Approved by Supervisor")
    );
    await user.click(screen.getByLabelText("Self-Nomination"));
    expect(
      screen.queryByTestId("nominee-global-id")
    ).not.toBeInTheDocument();
  });

  it("auto-populates supervisor name from Workday lookup", async () => {
    mockLookupSupervisor.mockResolvedValue({
      global_id: "SUP-001",
      name: "Alice Manager",
    });

    const { user } = setup();
    await user.click(
      screen.getByLabelText("Nomination Approved by Supervisor")
    );
    await user.type(screen.getByTestId("nominee-global-id"), "EMP-999");

    await waitFor(() =>
      expect(screen.getByTestId("supervisor-info-banner")).toBeInTheDocument()
    );
    expect(screen.getByText(/Alice Manager/)).toBeInTheDocument();
  });

  it("shows warning when supervisor not found in Workday", async () => {
    mockLookupSupervisor.mockResolvedValue(null);

    const { user } = setup();
    await user.click(
      screen.getByLabelText("Nomination Approved by Supervisor")
    );
    await user.type(screen.getByTestId("nominee-global-id"), "UNKNOWN");

    await waitFor(() =>
      expect(screen.getByTestId("supervisor-not-found")).toBeInTheDocument()
    );
  });

  it("shows validation error when nominee_name is empty on submit", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("submit-button"));
    expect(await screen.findByText("Nominee name is required.")).toBeInTheDocument();
  });

  it("shows success message after successful submission", async () => {
    const nomination = {
      id: "some-uuid",
      nominee_name: "Jane Doe",
      nominee_email: "jane@example.com",
      submission_type: SubmissionType.SELF_NOMINATION,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockCreateNomination.mockResolvedValue(nomination);

    const { user } = setup();
    // Use fireEvent.change for reliable state update in JSDOM
    fireEvent.change(screen.getByTestId("nominee-name"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByTestId("nominee-email"), {
      target: { value: "jane@example.com" },
    });
    await user.click(screen.getByTestId("submit-button"));

    // Verify the API was called
    await waitFor(() =>
      expect(mockCreateNomination).toHaveBeenCalledTimes(1)
    );

    await waitFor(() =>
      expect(
        screen.getAllByText(/submitted successfully/i).length
      ).toBeGreaterThan(0)
    );
  });
});
