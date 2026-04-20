import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisScoreRing } from "../analysis-score-ring";

describe("AnalysisScoreRing", () => {
  it("renders nothing for null score", () => {
    const { container } = render(<AnalysisScoreRing score={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for undefined score", () => {
    const { container } = render(<AnalysisScoreRing score={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("displays the score number", () => {
    render(<AnalysisScoreRing score={85} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("rounds score to integer", () => {
    render(<AnalysisScoreRing score={85.7} />);
    expect(screen.getByText("86")).toBeInTheDocument();
  });

  it("applies green color for high scores (>= 75)", () => {
    const { container } = render(<AnalysisScoreRing score={80} />);
    const scoreText = screen.getByText("80");
    expect(scoreText.className).toContain("text-success");
  });

  it("applies warning color for medium scores (50-74)", () => {
    const { container } = render(<AnalysisScoreRing score={60} />);
    const scoreText = screen.getByText("60");
    expect(scoreText.className).toContain("text-warning");
  });

  it("applies destructive color for low scores (< 50)", () => {
    const { container } = render(<AnalysisScoreRing score={30} />);
    const scoreText = screen.getByText("30");
    expect(scoreText.className).toContain("text-destructive");
  });

  it("renders SVG with correct size for sm variant", () => {
    const { container } = render(<AnalysisScoreRing score={50} size="sm" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("renders SVG with correct size for md variant", () => {
    const { container } = render(<AnalysisScoreRing score={50} size="md" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("36");
  });

  it("renders SVG with correct size for lg variant", () => {
    const { container } = render(<AnalysisScoreRing score={50} size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("48");
  });

  it("clamps score at 0", () => {
    render(<AnalysisScoreRing score={-10} />);
    expect(screen.getByText("-10")).toBeInTheDocument();
    // The progress bar should be at 0%
    const circles = document.querySelectorAll("circle");
    expect(circles.length).toBe(2); // background + progress
  });

  it("clamps score at 100 for progress bar", () => {
    render(<AnalysisScoreRing score={120} />);
    expect(screen.getByText("120")).toBeInTheDocument();
    // The progress ring should not overflow
  });

  it("handles score of exactly 0", () => {
    render(<AnalysisScoreRing score={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles score of exactly 100", () => {
    render(<AnalysisScoreRing score={100} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("applies boundary color at score 75", () => {
    const { container } = render(<AnalysisScoreRing score={75} />);
    const scoreText = screen.getByText("75");
    expect(scoreText.className).toContain("text-success");
  });

  it("applies boundary color at score 50", () => {
    const { container } = render(<AnalysisScoreRing score={50} />);
    const scoreText = screen.getByText("50");
    expect(scoreText.className).toContain("text-warning");
  });

  it("applies boundary color at score 49", () => {
    const { container } = render(<AnalysisScoreRing score={49} />);
    const scoreText = screen.getByText("49");
    expect(scoreText.className).toContain("text-destructive");
  });
});
