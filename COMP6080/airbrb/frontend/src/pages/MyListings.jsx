import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import {
  Grid, Button, Card, CardContent, CardMedia, CardActions, Typography, Box, Rating, Chip,
  Collapse, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';

import PublishDialog from '../components/PublishDialog.jsx';
import { getAverageRating } from '../utils/rating';


function MyListings() {
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishListingId, setPublishListingId] = useState(null);
  const [publishAvailability, setPublishAvailability] = useState([]);

  const navigate = useNavigate();


  const [profitsOpen, setProfitsOpen] = useState(true);
  const [profitData, setProfitData] = useState(
    Array.from({ length: 31 }, (_, i) => ({ daysAgo: i, amount: 0 }))
  );

  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMyListings = async () => {
    setLoading(true);
    try {
      const email = localStorage.getItem('email');
      const token = localStorage.getItem('token');

      if (!email || !token) {
        setMyListings([]);
        setLoading(false);
        return;
      }

      const res = await axios.get('http://localhost:5005/listings');
      const allListings = res.data.listings || [];

      const mineMeta = allListings.filter((l) => l.owner === email);

      const detailPromises = mineMeta.map((meta) =>
        axios
          .get(`http://localhost:5005/listings/${meta.id}`)
          .then((r) => {
            const detail = r.data.listing;
            return {
              id: meta.id,
              ...detail,
            };
          })
      );

      const detailed = await Promise.all(detailPromises);
      setMyListings(detailed);
    } catch (err) {
      console.error('Failed to fetch my listings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyListings();
  }, []);

  useEffect(() => {
    if (myListings.length > 0) {
      fetchListingProfits();
    }
  }, [myListings]);

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5005/listings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMyListings();
    } catch (err) {
      console.error('Failed to delete listing', err);
    }
  };

  const handleCheckBeforeDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5005/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const hasPending = res.data.bookings.some(
        (b) => String(b.listingId) === String(id) && b.status === 'pending'
      );

      if (hasPending) {
        setErrorMsg('❌ Cannot delete: This listing has pending booking requests.');
        setSelectedId(null);
        setOpenConfirm(true);
        return;
      }

      setErrorMsg('');
      setSelectedId(id);
      setOpenConfirm(true);

    } catch (err) {
      console.error('Error checking bookings:', err);
    }
  };

  const handleEdit = (id) => {
    navigate(`/listings/${id}/edit`);
  };

  const handleCreate = () => {
    navigate(`/listings/create`);
  };

  const handleOpenPublish = (id, availability = []) => {
    setPublishListingId(id);
    setPublishAvailability(availability);
    setPublishOpen(true);
  };

  const handleClosePublish = () => {
    setPublishOpen(false);
    setPublishListingId(null);
    setPublishAvailability([]);
  };

  const handleUnpublish = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5005/listings/unpublish/${id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMyListings();
    } catch (err) {
      console.error('Failed to unpublish listing', err);
    }
  };

  const handleManage = (id) => {
    navigate(`/listings/${id}/manage`);
  }

  const fetchListingProfits = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      if (!myListings.length) return;

      const myListingIds = new Set(myListings.map((l) => String(l.id)));

      const res = await axios.get('http://localhost:5005/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const bookings = res.data.bookings || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const buckets = Array(31).fill(0);
      const MS_PER_DAY = 1000 * 60 * 60 * 24;

      bookings.forEach((b) => {
        if (b.status !== 'accepted') return;
        if (!myListingIds.has(String(b.listingId))) return;

        const start = new Date(b.dateRange.start);
        const end = new Date(b.dateRange.end);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const totalPrice = b.totalPrice || 0;
        if (!totalPrice) return;

        const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
        const perNight = totalPrice / nights;

        const d = new Date(start);
        while (d < end) {
          const diffDays =
            (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
          const daysAgo = Math.floor(diffDays);

          if (daysAgo >= 0 && daysAgo <= 30) {
            buckets[daysAgo] += perNight;
          }
          d.setDate(d.getDate() + 1);
        }
      });

      const series = buckets.map((amount, daysAgo) => ({
        daysAgo,
        amount,
      }));

      setProfitData(series);
    } catch (err) {
      console.error('Failed to fetch listing profits', err);
    }
  };


  return (
    <Box>

      <PublishDialog
        open={publishOpen}
        onClose={handleClosePublish}
        listingId={publishListingId}
        initialAvailability={publishAvailability}
        onPublished={fetchMyListings}
      />

      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>
          {errorMsg ? 'Cannot Delete Listing' : 'Confirm Delete'}
        </DialogTitle>

        <DialogContent dividers>
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {errorMsg
              ? errorMsg
              : 'Are you sure you want to delete this listing?\nThis action cannot be undone.'}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => {
            setOpenConfirm(false);
            setErrorMsg('');
          }}>
            {errorMsg ? 'Close' : 'Cancel'}
          </Button>

          {!errorMsg && (
            <Button
              color="error"
              variant="contained"
              onClick={async () => {
                await handleDelete(selectedId);
                setOpenConfirm(false);
              }}
            >
              Confirm
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>

        <Button
          variant="contained"
          onClick={() => handleCreate()}
          sx={{ mb: 2 }}
          data-cy="create-listing"
        >
          Create New Listing
        </Button>

        <Grid container spacing={3} alignItems="flex-start">
          <Grid size={12}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography variant="h6">Profits (last 30 days)</Typography>
                  <IconButton
                    size="small"
                    onClick={() => setProfitsOpen((open) => !open)}
                  >
                    {profitsOpen ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>

                <Collapse in={profitsOpen} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflowX: 'auto',
                      width: '100%',
                      background: '#fafafa',
                    }}
                  >
                    {(() => {
                      const maxAmount = Math.max(...profitData.map((d) => d.amount), 0) || 1;
                      const GRAPH_HEIGHT = 180;
                      const BAR_MAX_HEIGHT = GRAPH_HEIGHT - 22;
                      const today = new Date();
                      const series = [...profitData].sort(
                        (a, b) => b.daysAgo - a.daysAgo
                      );

                      return (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            height: GRAPH_HEIGHT + 40,
                            gap: 1,
                            pr: 2,
                          }}
                        >
                          <Box
                            sx={{
                              height: GRAPH_HEIGHT,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              mr: 1,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              ${maxAmount.toFixed(0)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              $0
                            </Typography>
                          </Box>

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-end',
                              height: GRAPH_HEIGHT,
                              gap: 0.7,
                              flexGrow: 1,
                            }}
                          >
                            {series.map(({ daysAgo, amount }) => {
                              const barHeight =
                                maxAmount > 0
                                  ? (amount / maxAmount) * BAR_MAX_HEIGHT
                                  : 0;

                              const date = new Date(today);
                              date.setDate(today.getDate() - daysAgo);
                              const label = `${date.getMonth() + 1}/${date.getDate()}`;

                              return (
                                <Box
                                  key={daysAgo}
                                  sx={{
                                    flex: 1,
                                    minWidth: 18,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    mx: 0.4,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      mb: 0.3,
                                      visibility: amount > 0 ? 'visible' : 'hidden',
                                      fontSize: '0.65rem',
                                    }}
                                  >
                                    ${amount.toFixed(0)}
                                  </Typography>

                                  {/* x axis */}
                                  <Box
                                    sx={{
                                      height: BAR_MAX_HEIGHT,
                                      display: 'flex',
                                      alignItems: 'flex-end',
                                      width: '100%',
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        height: barHeight,
                                        width: '100%',
                                        background: '#1976d2',
                                        borderRadius: '4px 4px 0 0',
                                        minHeight: amount > 0 ? 4 : 0,
                                      }}
                                      title={`${label}: $${amount.toFixed(2)}`}
                                    />
                                  </Box>

                                  <Typography
                                    variant="caption"
                                    sx={{ mt: 0.3, fontSize: '0.65rem' }}
                                  >
                                    {label}
                                  </Typography>
                                </Box>
                              );
                            })}

                          </Box>
                        </Box>
                      );
                    })()}
                  </Box>

                </Collapse>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={12}>
            {loading && (
              <Typography>Loading...</Typography>
            )}

            {!loading && myListings.length === 0 && (
              <Typography>You have no hosted listings yet.</Typography>
            )}

            {!loading && myListings.length > 0 && (
              <Grid container spacing={2}>
                {myListings.map((listing) => (
                  <Grid
                    key={listing.id}
                    size={{ xs: 12, md: 12, lg: 6 }}
                  >
                    <Card
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        borderRadius: 3,
                        boxShadow: 3,
                        overflow: 'hidden',
                      }}
                      data-cy="listing-card"
                    >
                      {/* left: thumbnail */}
                      <CardMedia
                        component="img"
                        sx={{
                          width: { xs: '100%', sm: 220 },
                          height: { xs: 200, sm: 180 },
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                        image={listing.thumbnail || listing.metadata?.images?.[0]}
                        alt={listing.title}
                        data-cy="listing-title"
                      />

                      {/* right: connent */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        <CardContent sx={{ pb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" sx={{ mb: 0.5 }}>
                              {listing.title}
                            </Typography>

                            {listing.published ? (
                              <Chip
                                label="Live"
                                color="success"
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                            ) : (
                              <Chip
                                label="Edit"
                                color="warning"
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                            )}
                          </Box>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 1 }}
                          >
                            {listing.address.street}, {listing.address.city}, {listing.address.state} {listing.address.postcode}
                            {' '} · {listing.metadata?.bedrooms} beds ·{' '}
                            {listing.metadata?.bathrooms} baths
                          </Typography>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Rating
                              size="small"
                              readOnly
                              precision={0.5}
                              value={getAverageRating(listing) || 0}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {getAverageRating(listing)
                                ? `${getAverageRating(listing).toFixed(1)} (${listing.reviews.length || 0})`
                                : 'No reviews yet'}
                            </Typography>
                          </Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            ${listing.price} / night
                          </Typography>
                        </CardContent>

                        <CardActions
                          sx={{
                            mt: 'auto',
                            px: 2,
                            pb: 2,
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >

                          <Box sx={{ display: 'flex', gap: { xs: 0.1, sm: 1 } }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleManage(listing.id)}
                              data-cy="listing-manage"
                            >
                              Manage
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleEdit(listing.id)}
                              data-cy="listing-edit"
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => handleCheckBeforeDelete(listing.id)}
                            >
                              Delete
                            </Button>
                            {listing.published ? (
                              <Button
                                size="small"
                                color="warning"
                                variant="outlined"
                                onClick={() => handleUnpublish(listing.id)}
                                data-cy="listing-unpublish"
                              >
                                Unpublish
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                color="success"
                                variant="contained"
                                onClick={() => handleOpenPublish(listing.id)}
                                data-cy="listing-publish"
                              >
                                Publish
                              </Button>
                            )}
                          </Box>
                        </CardActions>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Grid>

        </Grid>
      </Box>
    </Box>
  );

}

export default MyListings;
