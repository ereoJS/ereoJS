export default function FormsIndexPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">@ereo/forms Test Suite</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Interactive test pages for the @ereo/forms package. Each page tests different form scenarios.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <a href="/forms/login" className="card hover:border-primary-500 transition-colors">
            <h2 className="text-xl font-semibold mb-2">Login Form</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Basic useForm + useField with email/password validation.</p>
          </a>
          <a href="/forms/register" className="card hover:border-primary-500 transition-colors">
            <h2 className="text-xl font-semibold mb-2">Registration Form</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Cross-field validation, password matching, compose validators.</p>
          </a>
          <a href="/forms/dynamic" className="card hover:border-primary-500 transition-colors">
            <h2 className="text-xl font-semibold mb-2">Dynamic Fields</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">useFieldArray with add/remove/swap/reorder operations.</p>
          </a>
          <a href="/forms/wizard" className="card hover:border-primary-500 transition-colors">
            <h2 className="text-xl font-semibold mb-2">Multi-step Wizard</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">createWizard with step validation and progress tracking.</p>
          </a>
          <a href="/forms/shadcn" className="card hover:border-primary-500 transition-colors">
            <h2 className="text-xl font-semibold mb-2">shadcn/ui Style</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Custom components mimicking shadcn Input, Select, Checkbox, Switch.</p>
          </a>
        </div>
      </div>
    </div>
  );
}
