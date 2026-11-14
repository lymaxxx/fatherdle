"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-[15px] font-semibold">Something went wrong.</p>
        <p className="text-xs text-muted break-words">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-full bg-lime text-[#121212] text-sm font-extrabold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
