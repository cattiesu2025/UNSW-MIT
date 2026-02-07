import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import ReviewsSection from '../components/ReviewsSection.jsx';

describe('ReviewsSection Component', () => {
  it('renders no reviews state', () => {
    render(
      <ReviewsSection
        avgRating={0}
        reviews={[]}
        ratingBreakdown={{}}
        ratingPercentages={{}}
      />
    );

    expect(screen.getByText(/0 reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
  });

  it('shows correct average rating', () => {
    const reviews = [
      { author: 'A', rating: 5, comment: 'good', createdAt: '2025-11-16T18:17:00Z' },
      { author: 'B', rating: 4, comment: 'ok', createdAt: '2025-11-16T18:18:00Z' },
      { author: 'C', rating: 5, comment: 'great', createdAt: '2025-11-14T20:52:00Z' },
    ];

    render(
      <ReviewsSection
        avgRating={4.6667}
        reviews={reviews}
        ratingBreakdown={{ 5: 2, 4: 1 }}
        ratingPercentages={{ 5: '66.7', 4: '33.3' }}
      />
    );

    expect(screen.getByText(/4.7/i)).toBeInTheDocument();
    expect(screen.getByText(/3 reviews/i)).toBeInTheDocument();
  });

  it('renders all review items', () => {
    const reviews = [
      { author: 'A', rating: 5, comment: 'a', createdAt: '2025-11-16T18:17:00Z' },
      { author: 'B', rating: 4, comment: 'b', createdAt: '2025-11-16T18:18:00Z' },
    ];

    render(
      <ReviewsSection
        avgRating={4.5}
        reviews={reviews}
        ratingBreakdown={{ 5: 1, 4: 1 }}
        ratingPercentages={{ 5: '50.0', 4: '50.0' }}
      />
    );

    const items = screen.getAllByTestId('review-item');
    expect(items.length).toBe(2);
  });
});
