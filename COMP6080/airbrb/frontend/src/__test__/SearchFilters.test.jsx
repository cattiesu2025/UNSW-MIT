import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilters from '../components/SearchFilters.jsx';

const makeProps = (overrides = {}) => ({
  searchWhere: '',
  setSearchWhere: vi.fn(),
  checkIn: null,
  setCheckIn: vi.fn(),
  checkOut: null,
  setCheckOut: vi.fn(),
  priceMin: 0,
  priceMax: 1000,
  setPriceMin: vi.fn(),
  setPriceMax: vi.fn(),
  bedroomsMin: 0,
  bedroomsMax: 10,
  setBedroomsMin: vi.fn(),
  setBedroomsMax: vi.fn(),
  ratingOrder: '',
  setRatingOrder: vi.fn(),
  onSearch: vi.fn(),
  ...overrides,
});

describe('SearchFilters Component', () => {
  it('updates "Where" input and calls setSearchWhere', () => {
    const setSearchWhere = vi.fn();
    const props = makeProps({ setSearchWhere });

    render(<SearchFilters {...props} />);

    const whereInput = screen.getByTestId('search-where-input');

    fireEvent.change(whereInput, { target: { value: 'Sydney' } });

    expect(setSearchWhere).toHaveBeenCalledWith('Sydney');
  });

  it('calls onSearch when search button is clicked', () => {
    const onSearch = vi.fn();
    const props = makeProps({ onSearch });

    render(<SearchFilters {...props} />);

    const searchButton = screen.getByRole('button', { name: /search/i });

    fireEvent.click(searchButton);

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('changes rating order when user selects "Highest first"', async () => {
    const setRatingOrder = vi.fn();
    const props = makeProps({ ratingOrder: '', setRatingOrder });

    render(<SearchFilters {...props} />);

    const ratingSelect = screen.getByLabelText(/rating/i);

    fireEvent.mouseDown(ratingSelect);

    const option = await screen.findByRole('option', { name: /highest first/i });

    fireEvent.click(option);

    expect(setRatingOrder).toHaveBeenCalledWith('ratingDesc');
  });
});
