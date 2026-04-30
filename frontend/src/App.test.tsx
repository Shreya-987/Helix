import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders nomination portal heading', () => {
  render(<App />);
  expect(screen.getByText(/Nomination Portal/i)).toBeInTheDocument();
});
