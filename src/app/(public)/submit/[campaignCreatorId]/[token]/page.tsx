"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Upload, Loader2 } from "lucide-react";

export default function ContentSubmissionPage() {
  const params = useParams();
  const campaignCreatorId = params.campaignCreatorId as string;
  const token = params.token as string;

  const [contentUrl, setContentUrl] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [submissionType, setSubmissionType] = useState<"draft" | "final">(
    "draft"
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contentUrl && !captionText) {
      setError("Please provide a content URL or caption text.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/content-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignCreatorId,
          token,
          contentUrl: contentUrl.trim() || null,
          captionText: captionText.trim() || null,
          submissionType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <CheckCircle className="size-16 text-success mx-auto" />
          <h1 className="text-2xl font-semibold">Content Submitted!</h1>
          <p className="text-muted-foreground">
            Your content has been submitted for review. The brand will review it
            and get back to you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Upload className="size-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-semibold">Submit Your Content</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share your content for brand review
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Content URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Content URL (Instagram post/reel link)
            </label>
            <input
              type="url"
              placeholder="https://instagram.com/reel/..."
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Caption Text</label>
            <textarea
              placeholder="Paste your caption here..."
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              rows={5}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Submission Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Submission Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={submissionType === "draft"}
                  onChange={() => setSubmissionType("draft")}
                  className="accent-primary"
                />
                Draft — for review before posting
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={submissionType === "final"}
                  onChange={() => setSubmissionType("final")}
                  className="accent-primary"
                />
                Final — already posted live
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit for Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
