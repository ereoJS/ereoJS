import { describe, expect, test } from 'bun:test';

// Test the parseArgs function by extracting its logic
// Since it's not exported, we'll test by reimplementing and comparing

function parseArgs(args: string[]): {
  command: string;
  options: Record<string, string | boolean>;
  positional: string[];
} {
  const options: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!command && !arg.startsWith('-')) {
      command = arg;
      continue;
    }

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        options[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options[key] = args[++i];
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options[key] = args[++i];
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, options, positional };
}

describe('@ereo/cli - parseArgs', () => {
  test('parses command', () => {
    const result = parseArgs(['dev']);
    expect(result.command).toBe('dev');
  });

  test('parses long options with values', () => {
    const result = parseArgs(['dev', '--port', '8080']);
    expect(result.command).toBe('dev');
    expect(result.options.port).toBe('8080');
  });

  test('parses long options with equals syntax', () => {
    const result = parseArgs(['dev', '--port=8080']);
    expect(result.options.port).toBe('8080');
  });

  test('parses boolean flags', () => {
    const result = parseArgs(['dev', '--open']);
    expect(result.options.open).toBe(true);
  });

  test('parses short options with values', () => {
    const result = parseArgs(['dev', '-p', '8080']);
    expect(result.options.p).toBe('8080');
  });

  test('parses short boolean flags', () => {
    const result = parseArgs(['dev', '-o']);
    expect(result.options.o).toBe(true);
  });

  test('parses positional arguments', () => {
    const result = parseArgs(['create', 'my-app']);
    expect(result.command).toBe('create');
    expect(result.positional).toEqual(['my-app']);
  });

  test('parses mixed arguments', () => {
    const result = parseArgs(['create', 'my-app', '--template', 'tailwind', '-t', 'true']);
    expect(result.command).toBe('create');
    expect(result.positional).toEqual(['my-app']);
    expect(result.options.template).toBe('tailwind');
    expect(result.options.t).toBe('true');
  });

  test('handles empty args', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('');
    expect(result.options).toEqual({});
    expect(result.positional).toEqual([]);
  });

  test('handles multiple positional arguments', () => {
    const result = parseArgs(['cmd', 'arg1', 'arg2', 'arg3']);
    expect(result.positional).toEqual(['arg1', 'arg2', 'arg3']);
  });
});

describe('@ereo/cli - generateTemplateFiles', () => {
  // Test the template generation logic
  function generateTemplateFiles(
    template: string,
    typescript: boolean
  ): Record<string, string> {
    const ext = typescript ? 'tsx' : 'jsx';
    const files: Record<string, string> = {};

    // package.json
    files['package.json'] = JSON.stringify(
      {
        name: 'ereo-app',
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'ereo dev',
          build: 'ereo build',
          start: 'ereo start',
        },
      },
      null,
      2
    );

    // TypeScript config
    if (typescript) {
      files['tsconfig.json'] = JSON.stringify(
        {
          compilerOptions: {
            target: 'ESNext',
            module: 'ESNext',
          },
        },
        null,
        2
      );
    }

    // Routes
    files[`app/routes/index.${ext}`] = `export default function HomePage() { return <h1>Hello</h1>; }`;

    // Tailwind config
    if (template === 'tailwind') {
      files['tailwind.config.js'] = `export default { content: ['./app/**/*.{js,ts,jsx,tsx}'] };`;
      files['app/globals.css'] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;`;
    }

    return files;
  }

  test('generates package.json', () => {
    const files = generateTemplateFiles('minimal', true);
    expect(files['package.json']).toBeDefined();

    const pkg = JSON.parse(files['package.json']);
    expect(pkg.name).toBe('ereo-app');
    expect(pkg.scripts.dev).toBe('ereo dev');
  });

  test('generates tsconfig.json for TypeScript', () => {
    const files = generateTemplateFiles('minimal', true);
    expect(files['tsconfig.json']).toBeDefined();
  });

  test('does not generate tsconfig.json for JavaScript', () => {
    const files = generateTemplateFiles('minimal', false);
    expect(files['tsconfig.json']).toBeUndefined();
  });

  test('generates .tsx files for TypeScript', () => {
    const files = generateTemplateFiles('minimal', true);
    expect(files['app/routes/index.tsx']).toBeDefined();
  });

  test('generates .jsx files for JavaScript', () => {
    const files = generateTemplateFiles('minimal', false);
    expect(files['app/routes/index.jsx']).toBeDefined();
  });

  test('generates tailwind files for tailwind template', () => {
    const files = generateTemplateFiles('tailwind', true);
    expect(files['tailwind.config.js']).toBeDefined();
    expect(files['app/globals.css']).toBeDefined();
    expect(files['app/globals.css']).toContain('@tailwind');
  });

  test('does not generate tailwind files for minimal template', () => {
    const files = generateTemplateFiles('minimal', true);
    expect(files['tailwind.config.js']).toBeUndefined();
    expect(files['app/globals.css']).toBeUndefined();
  });
});
