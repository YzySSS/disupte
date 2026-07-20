import assert from 'node:assert/strict';
import test from 'node:test';
import { exitCurrentPage } from '../src/exit-page.mjs';

function fakeWindow(overrides = {}) {
  const calls = [];
  const browserWindow = {
    closed: false,
    close() {
      calls.push('close');
    },
    setTimeout(callback) {
      calls.push('timeout');
      callback();
    },
    history: {
      length: 2,
      back() {
        calls.push('back');
      },
    },
    location: {
      replace(value) {
        calls.push(`replace:${value}`);
      },
    },
    ...overrides,
  };
  return { browserWindow, calls };
}

test('uses Douyin mini-program navigation when the host provides it', () => {
  const { browserWindow, calls } = fakeWindow({
    tt: {
      miniProgram: {
        navigateBack(options) {
          calls.push(`douyin:${options.delta}`);
        },
      },
    },
  });

  exitCurrentPage(browserWindow);
  assert.deepEqual(calls, ['douyin:1']);
});

test('falls back to browser history when script window closing is blocked', () => {
  const { browserWindow, calls } = fakeWindow();
  exitCurrentPage(browserWindow);
  assert.deepEqual(calls, ['close', 'timeout', 'back']);
});

test('clears a directly opened page when there is no browser history', () => {
  const { browserWindow, calls } = fakeWindow();
  browserWindow.history.length = 1;
  exitCurrentPage(browserWindow);
  assert.deepEqual(calls, ['close', 'timeout', 'replace:about:blank']);
});

test('does not navigate after the browser successfully closes the window', () => {
  const { browserWindow, calls } = fakeWindow({
    close() {
      calls.push('close');
      browserWindow.closed = true;
    },
  });
  exitCurrentPage(browserWindow);
  assert.deepEqual(calls, ['close', 'timeout']);
});

test('uses the browser fallback when Douyin navigation reports failure', () => {
  const { browserWindow, calls } = fakeWindow({
    tt: {
      miniProgram: {
        navigateBack(options) {
          calls.push('douyin-failed');
          options.fail();
        },
      },
    },
  });

  exitCurrentPage(browserWindow);
  assert.deepEqual(calls, ['douyin-failed', 'close', 'timeout', 'back']);
});
