import { useState } from 'react';
import {
  Box, Typography, Divider, IconButton, InputBase, FormControl,
  Select, MenuItem, Card, Stack, TextField, Button, InputAdornment, Collapse, 
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

import PriceRangeDropdown from './PriceRangeDropdown.jsx';
import BedroomRangeDropdown from './BedroomRangeDropdown.jsx';

function SearchFilters({
  searchWhere,
  setSearchWhere,
  checkIn,
  setCheckIn,
  checkOut,
  setCheckOut,
  priceMin,
  priceMax,
  setPriceMin,
  setPriceMax,
  bedroomsMin,
  bedroomsMax,
  setBedroomsMin,
  setBedroomsMax,
  ratingOrder,
  setRatingOrder,
  onSearch,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  
  return (
    <>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' }, 
          alignItems: 'center',
          borderRadius: '10px',
          boxShadow: 3,
          bgcolor: 'background.paper',
          px: 2,
          py: 1,
          maxWidth: 1000,
          mx: 'auto',
          mb: 2,
        }}
      >
        {/* Where */}
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Where
          </Typography>
          <InputBase
            placeholder="Search destinations"
            value={searchWhere}
            onChange={(e) => setSearchWhere(e.target.value)}
            sx={{
              fontSize: 14,
              mt: 0.2,
              width: '100%',
            }}
            inputProps={{ 'data-testid': 'search-where-input' }}
          />
        </Box>
        <Divider orientation="vertical" flexItem />

        {/* Check in */}
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Check in
          </Typography>
          <InputBase
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            sx={{
              fontSize: 14,
              mt: 0.2,
              width: '100%',
            }}
          />
        </Box>
        <Divider orientation="vertical" flexItem />

        {/* Check out */}
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Check out
          </Typography>
          <InputBase
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            sx={{
              fontSize: 14,
              mt: 0.2,
              width: '100%',
            }}
          />
        </Box>
        <Divider orientation="vertical" flexItem />

        {/* Price */}
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Price
          </Typography>
          <PriceRangeDropdown
            value={[
              priceMin === '' ? 0 : priceMin,
              priceMax === '' ? 1000 : priceMax,
            ]}
            onChange={(min, max) => {
              setPriceMin(min);
              setPriceMax(max);
            }}
          />
        </Box>
        <Divider orientation="vertical" flexItem />

        {/* Bedrooms */}
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Bedrooms
          </Typography>
          <BedroomRangeDropdown
            value={[
              bedroomsMin === '' ? 0 : bedroomsMin,
              bedroomsMax === '' ? 10 : bedroomsMax,
            ]}
            onChange={(min, max) => {
              setBedroomsMin(min);
              setBedroomsMax(max);
            }}
          />
        </Box>

        {/* Rating */}
        <Divider orientation="vertical" flexItem />
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Rating
          </Typography>

          <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
            <Select
              value={ratingOrder}
              onChange={(e) => setRatingOrder(e.target.value)}
              displayEmpty
              size="small"
              inputProps={{ 'aria-label': 'rating sort' }}
              data-testid="rating-select"
              sx={{
                minWidth: 100,
                height: 36,
                fontSize: '0.9rem',
                borderRadius: '12px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#ccc',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#999',
                },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    fontSize: '0.9rem',
                  },
                },
              }}
              renderValue={(selected) => {
                if (!selected) return 'None';
                if (selected === 'ratingDesc') return 'Highest first';
                if (selected === 'ratingAsc') return 'Lowest first';
                return selected;
              }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              <MenuItem value="ratingDesc">Highest first</MenuItem>
              <MenuItem value="ratingAsc">Lowest first</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <IconButton
          onClick={onSearch}
          data-testid="search-button"
          aria-label="Search"
          sx={{
            ml: 1,
            bgcolor: '#ff385c',
            color: 'white',
            '&:hover': { bgcolor: '#e31c5f' },
            width: 44,
            height: 44,
          }}
        >
          <SearchIcon data-testid="SearchIcon" />
        </IconButton>
      </Box>

      {/* ----------------- phone size ----------------- */}
      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          mb: 2,
          textAlign: 'center',
        }}
      >
        <Button
          variant="outlined"
          startIcon={<FilterAltIcon />}
          onClick={() => setMobileOpen(!mobileOpen)}
          sx={{
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            py: 1,
          }}
        >
          {mobileOpen ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      <Collapse in={mobileOpen}>
        <Card
          sx={{
            display: { xs: 'block', md: 'none' },
            mb: 2,
            borderRadius: 3,
            boxShadow: 3,
            px: 2,
            py: 2,
            mx: 1,
          }}
        >
          <Stack spacing={2}>
            {/* Where */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Where
              </Typography>
              <TextField
                placeholder="Search destinations"
                fullWidth
                size="small"
                value={searchWhere}
                onChange={(e) => setSearchWhere(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Check in/out */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Check in
              </Typography>
              <TextField
                type="date"
                fullWidth
                size="small"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Check out
              </Typography>
              <TextField
                type="date"
                fullWidth
                size="small"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            {/* Price */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Price
              </Typography>
              <PriceRangeDropdown
                value={[
                  priceMin === '' ? 0 : priceMin,
                  priceMax === '' ? 1000 : priceMax,
                ]}
                onChange={(min, max) => {
                  setPriceMin(min);
                  setPriceMax(max);
                }}
              />
            </Box>

            {/* Bedrooms */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Bedrooms
              </Typography>
              <BedroomRangeDropdown
                value={[
                  bedroomsMin === '' ? 0 : bedroomsMin,
                  bedroomsMax === '' ? 10 : bedroomsMax,
                ]}
                onChange={(min, max) => {
                  setBedroomsMin(min);
                  setBedroomsMax(max);
                }}
              />
            </Box>

            {/* Rating */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Rating
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={ratingOrder}
                  onChange={(e) => setRatingOrder(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  <MenuItem value="ratingDesc">Highest first</MenuItem>
                  <MenuItem value="ratingAsc">Lowest first</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Search Button */}
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                onSearch();
                setMobileOpen(false); 
              }}
              sx={{
                mt: 1,
                bgcolor: '#ff385c',
                '&:hover': { bgcolor: '#e31c5f' },
                fontWeight: 600,
                py: 1.2,
                borderRadius: 999,
                textTransform: 'none',
                fontSize: '1rem',
              }}
              startIcon={<SearchIcon />}
            >
              Search
            </Button>
          </Stack>
        </Card>
      </Collapse>
    </>
  );
}

export default SearchFilters;
