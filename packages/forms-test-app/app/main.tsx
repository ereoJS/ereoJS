import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import LoginFormPage from './routes/forms/login';
import RegisterFormPage from './routes/forms/register';
import DynamicFormPage from './routes/forms/dynamic';
import WizardFormPage from './routes/forms/wizard';
import ShadcnFormPage from './routes/forms/shadcn';

const routes: Record<string, React.ComponentType> = {
  '/': FormsHub,
  '/login': LoginFormPage,
  '/register': RegisterFormPage,
  '/dynamic': DynamicFormPage,
  '/wizard': WizardFormPage,
  '/shadcn': ShadcnFormPage,
};

function FormsHub() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">@ereo/forms Test App</h1>
        <p className="text-gray-600 mb-8">Interactive browser tests for the forms package</p>
        <div className="grid gap-4">
          {[
            { path: '/login', title: 'Login Form', desc: 'useForm, useField, useFormStatus, validators' },
            { path: '/register', title: 'Registration Form', desc: 'compose, matches, custom, pattern validators' },
            { path: '/dynamic', title: 'Dynamic Form', desc: 'useFieldArray with add/remove/swap/move' },
            { path: '/wizard', title: 'Multi-step Wizard', desc: 'useWizard, step validation, progress' },
            { path: '/shadcn', title: 'shadcn/ui Style', desc: 'Custom components: Input, Select, Checkbox, Switch, Radio' },
          ].map((item) => (
            <a
              key={item.path}
              href={`#${item.path}`}
              className="card hover:shadow-xl transition-shadow border border-gray-100"
            >
              <h2 className="text-xl font-semibold text-blue-600">{item.title}</h2>
              <p className="text-gray-500 text-sm mt-1">{item.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Nav() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-6">
        <a href="#/" className="font-bold text-lg flex items-center gap-2">
          <span className="text-xl">⬡</span> EreoJS Forms
        </a>
        <div className="flex gap-4 text-sm">
          {['Login', 'Register', 'Dynamic', 'Wizard', 'shadcn'].map((label) => (
            <a
              key={label}
              href={`#/${label.toLowerCase()}`}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const onHash = () => setPath(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const Page = routes[path] || FormsHub;

  return (
    <>
      <Nav />
      <Page />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
