import { runAllTests, type TestSuite, type TestResult } from '../lib/run-tests';

export async function loader() {
  const suites = await runAllTests();
  const totalTests = suites.reduce((sum, s) => sum + s.results.length, 0);
  const passedTests = suites.reduce((sum, s) => sum + s.results.filter(r => r.passed).length, 0);
  const failedTests = totalTests - passedTests;
  return { suites, totalTests, passedTests, failedTests, timestamp: new Date().toISOString() };
}

type LoaderData = {
  suites: TestSuite[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  timestamp: string;
};

export default function TestDashboard({ loaderData }: { loaderData: LoaderData }) {
  const { suites, totalTests, passedTests, failedTests, timestamp } = loaderData;
  const allPassed = failedTests === 0;

  return (
    <>
      <h1>ServerFnConfig Test Dashboard</h1>
      <p className="subtitle">
        Testing: rate limiting, auth, cache headers, CORS headers, custom middleware, combined config, createServerBlock
      </p>

      <div className="summary">
        <div className="summary-item">
          <div className="summary-value blue">{totalTests}</div>
          <div className="summary-label">Total Tests</div>
        </div>
        <div className="summary-item">
          <div className="summary-value green">{passedTests}</div>
          <div className="summary-label">Passed</div>
        </div>
        <div className="summary-item">
          <div className={`summary-value ${failedTests > 0 ? 'red' : 'green'}`}>{failedTests}</div>
          <div className="summary-label">Failed</div>
        </div>
        <div className="summary-item">
          <div className={`summary-value ${allPassed ? 'green' : 'red'}`}>
            {allPassed ? 'PASS' : 'FAIL'}
          </div>
          <div className="summary-label">Status</div>
        </div>
      </div>

      <div className="reload-form">
        <a href="/" className="btn">Re-run All Tests</a>
      </div>

      {suites.map((suite, si) => {
        const suitePassed = suite.results.every(r => r.passed);
        return (
          <div key={si} className="suite">
            <div className="suite-header">
              <span className="suite-name">{suite.name}</span>
              <span className={`suite-badge ${suitePassed ? 'pass' : 'fail'}`}>
                {suitePassed ? 'PASS' : 'FAIL'} ({suite.results.filter(r => r.passed).length}/{suite.results.length})
              </span>
            </div>
            {suite.results.map((test, ti) => (
              <div key={ti} className="test">
                <span className={`test-icon ${test.passed ? 'pass' : 'fail'}`}>
                  {test.passed ? '\u2713' : '\u2717'}
                </span>
                <div>
                  <div className="test-name">{test.name}</div>
                  <div className="test-details">{test.details}</div>
                  {test.error && <div className="test-error">Error: {test.error}</div>}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="timestamp">Ran at {timestamp}</div>
    </>
  );
}
