import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

import {
  Container, Grid, Box, Card, CardContent, CardMedia, Typography, Chip, Stack,
  Divider, Button, Rating, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';

import ReviewsSection from '../components/ReviewsSection.jsx';
import CreateReviewDialog from '../components/CreateReviewDialog';
import defaultThumbnail from '../assets/InitialHouse.webp';

function ViewListing() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(0);
  const [address, setAddress] = useState('');
  const [type, setType] = useState('');
  const [bathrooms, setBathrooms] = useState(0);
  const [bedrooms, setBedrooms] = useState(0);
  const [amenities, setAmenities] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const todayStr = dayjs().format('YYYY-MM-DD');
  const [bookOk, setBookOk] = useState(false);
  const [bookErr, setBookErr] = useState('');
  const [bookingId, setBookingId] = useState(null);
  const [bookStatus, setBookStatus] = useState('');
  const [myListingBookings, setMyListingBookings] = useState([]);

  const [avgRating, setAvgRating] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });

  const [openReview, setOpenReview] = useState(false);

  const totalReviews = reviews.length;
  const ratingPercentages = useMemo(() => {
    if (!totalReviews) return { 1: '0.0', 2: '0.0', 3: '0.0', 4: '0.0', 5: '0.0' };
    const r = {};
    [1, 2, 3, 4, 5].forEach(s => {
      const c = ratingBreakdown[s] || 0;
      r[s] = ((c / totalReviews) * 100).toFixed(1);
    });
    return r;
  }, [ratingBreakdown, totalReviews]);

  const [openStarDialog, setOpenStarDialog] = useState(false);
  const [selectedStar, setSelectedStar] = useState(null);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [gallery, setGallery] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageDialogSrc, setImageDialogSrc] = useState('');

  const token = localStorage.getItem('token');
  const email = localStorage.getItem('email');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const res = await axios.get(`http://localhost:5005/listings/${id}`);
      const listingDetail = res.data.listing;

      setTitle(listingDetail.title);
      setPrice(listingDetail.price);

      const md = listingDetail.metadata || {};
      const imgs = md.images || [];
      const youtube = md.youtubeUrl || '';

      let galleryItems = [];

      if (youtube) {
        galleryItems.push({
          type: 'video',
          src: youtube,
        });
      }

      if (imgs.length > 0) {
        imgs.forEach((img) => {
          galleryItems.push({
            type: 'image',
            src: img,
          });
        });
      } else {
        galleryItems.push({
          type: 'image',
          src: defaultThumbnail,
        });
      }

      setGallery(galleryItems);
      setCurrentImageIndex(0);

      const addr = listingDetail.address || {};
      setAddress(
        (addr.street || '') +
        ', ' +
        (addr.city || '') +
        ', ' +
        (addr.state || '')
      );

      setType(md.propertyType || '');
      setBathrooms(md.bathrooms || 0);
      setBedrooms(md.bedrooms || 0);
      setAmenities(md.amenities || []);
      setAvailability(listingDetail.availability || []);

      const revs = listingDetail.reviews || [];
      setReviews(revs);

      if (revs.length > 0) {
        const total = revs.reduce((sum, r) => sum + (r.rating || 0), 0);
        setAvgRating(total / revs.length);

        const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        revs.forEach((r) => {
          const s = r.rating || 0;
          if (breakdown[s] !== undefined) {
            breakdown[s] += 1;
          }
        });
        setRatingBreakdown(breakdown);
      } else {
        setAvgRating(0);
        setRatingBreakdown({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load listing details.');
      setLoading(false);
      navigate('/homes');
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchBookDetail();
  }, [id]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;

    const start = dayjs(checkIn);
    const end = dayjs(checkOut);

    if (!end.isAfter(start)) return 0;

    return end.startOf('day').diff(start.startOf('day'), 'day');
  }, [checkIn, checkOut]);

  const totalPrice = useMemo(() => nights * price, [nights, price]);

  const handleBooking = async (id) => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (totalPrice <= 0) {
      setBookErr('Please choose correct time range.');
      return;
    }

    if (!isWithinAvailability(checkIn, checkOut)) {
      setBookErr('Selected dates are not within the available time range.');
      return;
    }

    const body = {
      dateRange: { start: checkIn, end: checkOut },
      totalPrice,
    }
    try {
      const res = await axios.post(
        `http://localhost:5005/bookings/new/${id}`,
        body,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 200) {
        setBookOk(true);
        setBookErr('');
        fetchBookDetail();
      }
    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        if (status === 400) setBookErr(data.error || 'Invalid input');
        else if (status === 403) {
          setBookErr(data.error || 'Invalid token');
          navigate('/login');
        } else setBookErr(data.error || 'Unexpected error');
      } else setBookErr('Network error');
    }
  };

  const fetchBookDetail = async () => {
    if (!token || !email) {
      return;
    }

    try {
      const res = await axios.get('http://localhost:5005/bookings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allBookings = res.data.bookings;

      const myBookingsForThisListing = allBookings.filter(
        (b) => b.owner === email && String(b.listingId) === String(id)
      );
      myBookingsForThisListing.sort((a, b) => {
        const aDate = new Date(a.dateRange?.start || a.createdAt);
        const bDate = new Date(b.dateRange?.start || b.createdAt);
        return bDate - aDate;
      });
      setMyListingBookings(myBookingsForThisListing);

      const acceptedBooking = myBookingsForThisListing.find((b) => b.status === 'accepted');
      if (acceptedBooking) {
        setBookStatus(acceptedBooking.status);
        setBookingId(acceptedBooking.id);
      } else {
        setBookStatus('');
        setBookingId(null);
      }
    } catch (error) {
      console.error('Fetch book status error', error);
    }
  }

  function isWithinAvailability(startStr, endStr) {
    if (!startStr || !endStr) return false;

    const start = new Date(startStr);
    const end = new Date(endStr);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;

    return (availability || []).some((range) => {
      if (!range.start || !range.end) return false;
      const s = new Date(range.start);
      const e = new Date(range.end);
      if (Number.isNaN(s) || Number.isNaN(e)) return false;

      return s <= start && e >= end;
    });
  }

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>Loading listing...</Typography>
      </Container>
    );
  }

  return (
    <>
      <CreateReviewDialog
        open={openReview}
        onClose={() => setOpenReview(false)}
        listingId={id}
        bookingId={bookingId}
        onCreated={fetchDetail}
      />

      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0, bgcolor: 'black' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              maxHeight: '80vh',
              overflow: 'hidden',
            }}
          >
            {imageDialogSrc && (
              <img
                src={imageDialogSrc}
                alt="full"
                style={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openStarDialog} onClose={() => setOpenStarDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedStar}★ Reviews</DialogTitle>
        <DialogContent dividers>
          {reviews.filter((r) => r.rating === selectedStar).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No reviews with {selectedStar} stars.
            </Typography>
          ) : (
            reviews
              .filter((r) => r.rating === selectedStar)
              .map((r, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, }}>
                    <Typography variant="caption" color="text.secondary">
                      {r.author} · {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Typography>
                    <Rating value={r.rating} readOnly size="small" />
                  </Box>
                  <Typography variant="body2">{r.comment}</Typography>
                </Box>
              ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStarDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>


      <Container sx={{ mt: 4, mb: 6 }}>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {address}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Rating value={avgRating} precision={0.5} readOnly />
            <Typography variant="body2">
              {avgRating ? avgRating.toFixed(1) : 'No rating yet'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ({reviews.length} reviews)
            </Typography>
          </Stack>
        </Box>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              {gallery.length > 0 && (
                <>
                  {gallery[currentImageIndex].type === 'video' ? (
                    <CardMedia
                      component="iframe"
                      height="320"
                      src={gallery[currentImageIndex].src}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      sx={{ border: 0 }}
                    />
                  ) : (
                    <CardMedia
                      component="img"
                      height="320"
                      image={gallery[currentImageIndex].src}
                      alt={title}
                      onClick={() => {
                        const current = gallery[currentImageIndex];
                        if (current.type === 'image') {
                          setImageDialogSrc(current.src);
                          setImageDialogOpen(true);
                        }
                      }}
                    />
                  )}

                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      p: 1.5,
                      pt: 1,
                      overflowX: 'auto',
                    }}
                  >
                    {gallery.map((item, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        sx={{
                          width: 70,
                          height: 70,
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border:
                            idx === currentImageIndex
                              ? '2px solid #1976d2'
                              : '1px solid #ddd',
                          flex: '0 0 auto',
                        }}
                      >
                        {item.type === 'video' ? (
                          <img
                            src={`https://img.youtube.com/vi/${item.src.split("embed/")[1]}/0.jpg`}
                            alt="video-thumb"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <img
                            src={item.src}
                            alt={`thumb-${idx}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                </>
              )}

              <CardContent>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {type}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Bedrooms: {bedrooms} &nbsp;|&nbsp; Bathrooms: {bathrooms}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Amenities
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {amenities && amenities.length > 0 ? (
                    amenities.map((a, idx) => (
                      <Chip key={idx} label={a} size="small" sx={{ mb: 1 }} />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No amenities listed.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Reviews */}
            <ReviewsSection
              avgRating={avgRating}
              reviews={reviews}
              ratingBreakdown={ratingBreakdown}
              ratingPercentages={ratingPercentages}
              onStarSelect={(star) => {
                setSelectedStar(star);
                setOpenStarDialog(true);
              }}
            />

          </Grid>

          {/* Booking */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                p: 2.5,
                borderRadius: 3,
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                position: 'sticky',
                top: 88,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  ${price}
                  <Typography component="span" variant="body2" color="text.secondary"> / night</Typography>
                </Typography>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                Available time
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {(availability ?? []).length
                  ? availability.map((a, i) => (
                    <Chip
                      key={`${a.start}-${a.end}-${i}`}
                      size="small"
                      variant="outlined"
                      label={`${a.start} → ${a.end}`}
                    />
                  ))
                  : <Typography variant="body2" color="text.disabled">—</Typography>}
              </Box>

              {/* Check in / out */}
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <TextField
                  label="Check in"
                  type="date"
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    setBookErr('');
                  }}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: todayStr, 'data-cy': 'booking-start-date' }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Check out"
                  type="date"
                  value={checkOut}
                  onChange={(e) => {
                    setCheckOut(e.target.value);
                    setBookErr('');
                  }}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: todayStr, 'data-cy': 'booking-end-date' }}
                  fullWidth
                  size="small"
                />
              </Stack>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.25,
                  mb: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'grey.50',
                  fontWeight: 600,
                }}
              >
                <span>Total</span>
                <span>
                  {nights ? `${nights} ${nights === 1 ? 'night' : 'nights'}, $${totalPrice}` : '—'}
                </span>
              </Box>

              {bookErr ? (
                <Alert severity="error" sx={{ mb: 1.5 }}>{bookErr}</Alert>
              ) : (
                bookOk && <Alert severity="success" sx={{ mb: 1.5 }}>Book confirmed.</Alert>
              )}

              <Button
                fullWidth
                size="large"
                variant="contained"
                onClick={() => handleBooking(id)}
                disabled={!token}
                sx={{ borderRadius: 2, py: 1.1 }}
                data-cy="booking-submit"
              >
                MAKE A BOOKING
              </Button>

              {(token && (bookStatus === 'accepted')) && (
                <Button
                  fullWidth
                  size="large"
                  variant="outlined"
                  onClick={() => setOpenReview(true)}
                  sx={{ borderRadius: 2, py: 1.1, mt: 1, }}
                >
                  MAKE A REVIEW
                </Button>
              )}

              {!token && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block', textAlign: 'center' }}
                >
                  You need to be logged in to make a booking.
                </Typography>
              )}

              {token && myListingBookings.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Your booking history
                  </Typography>

                  <Stack spacing={1}>
                    {myListingBookings.map((b) => (
                      <Box
                        key={b.id}
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'grey.50',
                        }}
                      >
                        <Typography variant="body2">
                          {dayjs(b.dateRange.start).format('YYYY-MM-DD')}
                          {'  →  '}
                          {dayjs(b.dateRange.end).format('YYYY-MM-DD')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Status: {b.status} · Total: ${b.totalPrice}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}

export default ViewListing;
