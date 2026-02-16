interface ErrorPageProps {
  error: Error;
}

export default function ErrorPage({ error }: ErrorPageProps) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <a href="/" className="btn btn-primary">
          Go Home
        </a>
      </div>
    </div>
  );
}