import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import axios from 'axios';
import {
  Grid, Card, CardContent, CardMedia, Typography, Box, Rating, Chip
} from '@mui/material';

import SearchFilters from '../components/SearchFilters.jsx';
import { getAverageRating } from '../utils/rating';

function isListingAvailableForRange(listing, startStr, endStr) {
  const ranges = listing.availability || [];
  if (!ranges.length) return false;

  const start = startStr ? new Date(startStr) : null;
  const end = endStr ? new Date(endStr) : null;

  return ranges.some((r) => {
    if (!r.start || !r.end) return false;
    const s = new Date(r.start);
    const e = new Date(r.end);

    if (start && !end) {
      return s <= start && e >= start;
    }

    if (!start && end) {
      return s <= end && e >= end;
    }

    if (start && end) {
      return s <= start && e >= end;
    }

    return true; 
  });
}



function Homes() {
  const currentUserEmail = localStorage.getItem('email') || null;

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filteredListings, setFilteredListings] = useState([]);
  const [searchWhere, setSearchWhere] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [bedroomsMin, setBedroomsMin] = useState('');
  const [bedroomsMax, setBedroomsMax] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [ratingOrder, setRatingOrder] = useState('');
  const [myBookings, setMyBookings] = useState([]);
  const navigate = useNavigate();

  const fetchListings = async () => {
    try {
      setLoading(true);

      const res = await axios.get('http://localhost:5005/listings');
      const allListings = res.data.listings || [];

      let myBkings = [];
      if (currentUserEmail) {
        const bres = await axios.get('http://localhost:5005/bookings', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        myBkings = bres.data.bookings.filter(
          (b) => b.owner === currentUserEmail && (b.status === 'pending' || b.status === 'accepted')
        );
      }
      setMyBookings(myBkings);

      const detailsPromises = allListings.map((l) =>
        axios
          .get(`http://localhost:5005/listings/${l.id}`)
          .then((r) => {
            return {
              id: l.id,
              ...r.data.listing,
            };
          })
      );

      const detailed = await Promise.all(detailsPromises);
      const priorityIds = myBkings.map((b) => String(b.listingId));
      const publicListings = detailed
        .filter((l) => l.published && (l.owner != currentUserEmail))
        .map((l) => ({
          ...l,
          priority: priorityIds.includes(String(l.id)), //
        }))
        .sort((a, b) => {
          if (a.priority && !b.priority) return -1;
          if (!a.priority && b.priority) return 1;
          return a.title.localeCompare(b.title);
        });
      setListings(publicListings);
      setFilteredListings(publicListings);

    } catch (error) {
      console.error('Failed to fetch listings', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchListings();
  }, []);

  const handleSearch = () => {
    let result = [...listings];

    if (searchWhere.trim() !== '') {
      const q = searchWhere.trim().toLowerCase();
      result = result.filter((l) => {
        const title = (l.title || '').toLowerCase();
        const city = (l.address?.city || '').toLowerCase();
        return title.includes(q) || city.includes(q);
      });
    }

    if (checkIn || checkOut) {
      result = result.filter((l) => isListingAvailableForRange(l, checkIn, checkOut));
    }

    if (priceMin !== '' || priceMax !== '') {
      const min = priceMin === '' ? 0 : Number(priceMin);
      const max = priceMax === '' ? Infinity : Number(priceMax);
      result = result.filter((l) => l.price >= min && l.price <= max);
    }

    if (bedroomsMin !== '' || bedroomsMax !== '') {
      const minBedrooms = bedroomsMin === '' ? 0 : Number(bedroomsMin);
      const maxBedrooms = bedroomsMax === '' ? Infinity : Number(bedroomsMax);

      result = result.filter((l) => {
        const bedrooms =
          l.metadata?.bedrooms ??
          l.metadata?.bedrooms ??
          0;
        return bedrooms >= minBedrooms && bedrooms <= maxBedrooms;
      });
    }

    if (ratingOrder === 'ratingAsc') {
      result.sort((a, b) => getAverageRating(a) - getAverageRating(b));
    } else if (ratingOrder === 'ratingDesc') {
      result.sort((a, b) => getAverageRating(b) - getAverageRating(a));
    }

    result.sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;

      if (ratingOrder === 'ratingAsc') {
        return getAverageRating(a) - getAverageRating(b);
      }
      if (ratingOrder === 'ratingDesc') {
        return getAverageRating(b) - getAverageRating(a);
      }

      return a.title.localeCompare(b.title);
    });

    setFilteredListings(result);
  };

  const listingDetail = (id) => {
    navigate(`/listings/${id}`);
  }

  return (
    <Box sx={{ p: 3 }}>
      <SearchFilters
        searchWhere={searchWhere}
        setSearchWhere={setSearchWhere}
        checkIn={checkIn}
        setCheckIn={setCheckIn}
        checkOut={checkOut}
        setCheckOut={setCheckOut}
        priceMin={priceMin}
        priceMax={priceMax}
        setPriceMin={setPriceMin}
        setPriceMax={setPriceMax}
        bedroomsMin={bedroomsMin}
        bedroomsMax={bedroomsMax}
        setBedroomsMin={setBedroomsMin}
        setBedroomsMax={setBedroomsMax}
        ratingOrder={ratingOrder}
        setRatingOrder={setRatingOrder}
        onSearch={handleSearch}
      />

      {loading && <p>loading...</p>}
      {!loading && filteredListings.length === 0 && <p>No listings match your filters.</p>}

      <Grid container spacing={3}>
        {filteredListings.map((listing) => {
          const {
            id,
            title,
            price,
            thumbnail,
            address = {},
            metadata = {},
            reviews = [],
          } = listing;

          const listingBookings = myBookings.filter(
            (b) => String(b.listingId) === String(listing.id)
          );
          let bookingStatus = null;
          if (listingBookings.some((b) => b.status === 'pending')) {
            bookingStatus = 'pending';
          } else if (listingBookings.some((b) => b.status === 'accepted')) {
            bookingStatus = 'accepted';
          }

          const propertyType = metadata.propertyType || 'N/A';
          const bedrooms = metadata.bedrooms ?? 'N/A';
          const bathrooms = metadata.bathrooms ?? 'N/A';

          const totalReviews = reviews.length;
          const avgRating =
            totalReviews === 0
              ? 0
              : reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews;

          const youtubeUrl = metadata.youtubeUrl?.trim();

          return (
            <Grid key={id} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  maxWidth: 345,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 3,
                }}
              >
                {youtubeUrl ? (
                  <Box
                    component="iframe"
                    src={youtubeUrl}
                    title={title}
                    sx={{
                      width: '100%',
                      height: 180,
                      border: 0,
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <CardMedia
                    component="img"
                    alt={title}
                    height="180"
                    image={thumbnail}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => listingDetail(id)}
                  />
                )}
                <CardContent
                  sx={{ flexGrow: 1, cursor: 'pointer' }}
                  onClick={() => listingDetail(id)}
                  data-cy="listing-card"
                >
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Typography variant="h6" component="div">
                      {title}
                    </Typography>
                    {bookingStatus && (
                      <Chip
                        label={bookingStatus === 'pending' ? "Pending" : "Accepted"}
                        color={bookingStatus === 'pending' ? "warning" : "success"}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                        }}
                      />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    {propertyType} • {bedrooms} bedrooms • {bathrooms} bathrooms
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    {address.street}, {address.city}, {address.state} {address.postcode}
                  </Typography>

                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Rating value={avgRating} readOnly precision={0.5} />
                    <Typography variant="body2" color="text.secondary">
                      {totalReviews} reviews
                    </Typography>
                  </Box>

                  <Typography sx={{ mt: 1, fontWeight: 600 }}>
                    ${price} / night
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  )
}

export default Homes;