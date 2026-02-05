'use client';

import { useState } from 'react';

/**
 * Action handler for the contact form.
 * Runs on the server when the form is submitted.
 */
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  // Validate the form data
  const errors: Record<string, string> = {};

  if (!name || name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!email || !email.includes('@')) {
    errors.email = 'Please enter a valid email address';
  }
  if (!message || message.length < 10) {
    errors.message = 'Message must be at least 10 characters';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // In a real app, you would:
  // - Save to database
  // - Send email notification
  // - etc.

  console.log('Contact form submission:', { name, email, message });

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 500));

  return { success: true, message: 'Thank you for your message! We\'ll get back to you soon.' };
}

interface ContactPageProps {
  actionData?: {
    success: boolean;
    message?: string;
    errors?: Record<string, string>;
  };
}

export default function ContactPage({ actionData }: ContactPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true);
    // Form will be handled by the action
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Have a question or feedback? We'd love to hear from you.
        </p>

        {actionData?.success ? (
          <div className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-800 dark:text-green-200">{actionData.message}</p>
            </div>
          </div>
        ) : (
          <form method="POST" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="input"
                placeholder="Your name"
              />
              {actionData?.errors?.name && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="input"
                placeholder="you@example.com"
              />
              {actionData?.errors?.email && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="input"
                placeholder="Your message..."
              />
              {actionData?.errors?.message && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}