import { getAuth } from '@ereo/auth';

export async function action({ context }: { context: any }) {
  try {
    const auth = getAuth(context);
    await auth.signOut();
  } catch {
    // Already signed out
  }

  return new Response(null, {
    status: 303,
    headers: { Location: '/' },
  });
}

export default function LogoutPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <p className="text-gray-500">Signing out...</p>
    </div>
  );
}