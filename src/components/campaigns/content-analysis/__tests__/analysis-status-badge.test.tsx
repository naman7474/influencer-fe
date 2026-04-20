import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisStatusBadge } from "../analysis-status-badge";

describe("AnalysisStatusBadge", () => {
  it("renders nothing for null status", () => {
    const { container } = render(<AnalysisStatusBadge status={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for pending status", () => {
    const { container } = render(<AnalysisStatusBadge status="pending" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for undefined status", () => {
    const { container } = render(<AnalysisStatusBadge status={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows analyzing state for processing status", () => {
    render(<AnalysisStatusBadge status="processing" />);
    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
  });

  it("shows analyzing state for transcribing status", () => {
    render(<AnalysisStatusBadge status="transcribing" />);
    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
  });

  it("shows analyzing state for analyzing status", () => {
    render(<AnalysisStatusBadge status="analyzing" />);
    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
  });

  it("shows ready state for completed status", () => {
    render(<AnalysisStatusBadge status="completed" />);
    expect(screen.getByText("Analysis Ready")).toBeInTheDocument();
  });

  it("shows failed state for failed status", () => {
    render(<AnalysisStatusBadge status="failed" />);
    expect(screen.getByText("Analysis Failed")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <AnalysisStatusBadge status="completed" className="custom-class" />
    );
    const badge = container.querySelector("[data-slot='badge']");
    expect(badge?.className).toContain("custom-class");
  });
});
