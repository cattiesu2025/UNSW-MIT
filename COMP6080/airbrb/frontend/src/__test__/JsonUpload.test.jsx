import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import JsonUpload from '../components/JsonUpload.jsx';

function mockFileReader(resultText, shouldFail = false) {
  class MockFileReader {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    addEventListener(event, handler) {
      if (event === 'load') this.onload = handler;
      if (event === 'error') this.onerror = handler;
    }

    readAsText() {
      setTimeout(() => {
        if (shouldFail) {
          if (this.onerror) {
            this.onerror(new Error('read error'));
          }
        } else if (this.onload) {
          this.onload({ target: { result: resultText } });
        }
      }, 0);
    }
  }

  global.FileReader = MockFileReader;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('JsonUpload Component', () => {
  it('parses JSON file and calls onUpload', async () => {
    const data = { title: 'Test listing' };
    const onUpload = vi.fn();

    mockFileReader(JSON.stringify(data), false);

    const { container } = render(<JsonUpload onUpload={onUpload} />);

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    const file = new File(['dummy'], 'test.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalled();
    });
  });

  it('invalid JSON triggers onError', async () => {
    const onUpload = vi.fn();
    const onError = vi.fn();

    mockFileReader('{bad json', false);

    const { container } = render(
      <JsonUpload onUpload={onUpload} onError={onError} />
    );

    const input = container.querySelector('input[type="file"]');
    const file = new File(['dummy'], 'bad.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });
});
