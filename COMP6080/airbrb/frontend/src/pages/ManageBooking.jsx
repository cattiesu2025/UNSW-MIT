import { useEffect, useMemo, useState } from 'react';
import {
  Box, Container, Typography, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Button, Chip, Stack, Divider, CircularProgress
} from '@mui/material';
import { useParams } from 'react-router-dom';
import axios from 'axios';

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  const d1 = new Date(a), d2 = new Date(b);
  return Math.max(0, Math.ceil((d2 - d1) / ms));
}

function overlapWithThisYear(start, end) {
  const year = new Date().getFullYear();
  const begin = new Date(`${year}-01-01T00:00:00`);
  const finish = new Date(`${year}-12-31T23:59:59`);
  const s = new Date(start);
  const e = new Date(end);
  const left = new Date(Math.max(s, begin));
  const right = new Date(Math.min(e, finish));
  return right > left ? daysBetween(left, right) : 0;
}

export default function ManageBooking() {
  const { id } = useParams();                     // listing id
  const [tab, setTab] = useState(0);              // 0: Requests 1: History 2: Stats
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(null); 
  const [bookings, setBookings] = useState([]); 
  const token = localStorage.getItem('token');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [detailRes, allBkRes] = await Promise.all([
          axios.get(`http://localhost:5005/listings/${id}`),
          axios.get('http://localhost:5005/bookings', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const detail = detailRes.data.listing || {};
        const mine = (allBkRes.data.bookings || []).filter(b => String(b.listingId) === String(id));

        setListing(detail);
        setBookings(mine);
      } catch (err) {
        console.error('Failed to fetch manage data', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  // ---- Actions ----
  const respond = async (bookingId, action) => {
    try {
      const url =
        action === 'accept'
          ? `http://localhost:5005/bookings/accept/${bookingId}`
          : `http://localhost:5005/bookings/decline/${bookingId}`;
      await axios.put(url, {}, { headers: { Authorization: `Bearer ${token}` } });
      const res = await axios.get('http://localhost:5005/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings((res.data.bookings || []).filter(b => String(b.listingId) === String(id)));
    } catch (err) {
      console.error('Failed to respond booking', err);
    }
  };

  // ---- Stats ----
  const price = listing?.price ?? 0;
  const createdAt = listing?.postedOn || listing?.createdAt || listing?.published || listing?.updatedAt;

  const { daysBookedThisYear, profitThisYear } = useMemo(() => {
    const accepted = bookings.filter(b => b.status === 'accepted');
    const days = accepted.reduce((sum, b) => sum + overlapWithThisYear(b.dateRange?.start, b.dateRange?.end), 0);
    const profit = accepted.reduce((sum, b) => {
      const nights = daysBetween(b.dateRange?.start, b.dateRange?.end);
      const useTotal = Number(b.totalPrice);
      return sum + (Number.isFinite(useTotal) ? useTotal : nights * Number(price || 0));
    }, 0);
    return { daysBookedThisYear: days, profitThisYear: profit };
  }, [bookings, price]);

  const daysOnline = useMemo(() => {
    if (!createdAt) return '-';
    const today = new Date();
    return daysBetween(createdAt, today);
  }, [createdAt]);

  // ---- Render ----
  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        Manage bookings — Listing #{id}
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Requests" />
        <Tab label="History" />
        <Tab label="Stats" />
      </Tabs>

      {/* Requests: pending */}
      {tab === 0 && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Guest</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell>Nights</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bookings.filter(b => b.status === 'pending').map(b => {
                  const start = b.dateRange.start.slice(0, 10);
                  const end = b.dateRange.end.slice(0, 10);
                  const nights = daysBetween(start, end);
                  return (
                    <TableRow key={b.id} hover data-cy="booking-row">
                      <TableCell data-cy="booking-guest">{b.owner || b.user || b.email || '—'}</TableCell>
                      <TableCell>
                        {start} → {end}
                      </TableCell>
                      <TableCell>{nights}</TableCell>
                      <TableCell align="center">
                        <Chip size="small" label="Pending" color="warning" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="contained" onClick={() => respond(b.id, 'accept')} data-cy="booking-accept">
                            Accept
                          </Button>
                          <Button size="small" color="error" onClick={() => respond(b.id, 'decline')}>
                            Deny
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {bookings.filter(b => b.status === 'pending').length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No pending requests.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* History */}
      {tab === 1 && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Guest</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell>Nights</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bookings.map(b => {
                  const start = b.dateRange.start.slice(0, 10);
                  const end = b.dateRange.end.slice(0, 10);
                  const nights = daysBetween(start, end);
                  const priceCell = Number.isFinite(Number(b.totalPrice))
                    ? `$${b.totalPrice}`
                    : `$${nights * Number(price || 0)}`;
                  return (
                    <TableRow key={b.id} hover>
                      <TableCell>{b.owner || b.user || b.email || '—'}</TableCell>
                      <TableCell>{start} → {end}</TableCell>
                      <TableCell>{nights}</TableCell>
                      <TableCell>
                        {b.status === 'accepted' && <Chip size="small" label="Accepted" color="success" />}
                        {b.status === 'denied' && <Chip size="small" label="Denied" color="error" />}
                        {b.status === 'pending' && <Chip size="small" label="Pending" color="warning" variant="outlined" />}
                      </TableCell>
                      <TableCell>{priceCell}</TableCell>
                    </TableRow>
                  );
                })}
                {bookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No bookings found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Stats*/}
      {tab === 2 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Listing summary</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} divider={<Divider flexItem orientation="vertical" />}>
            <Box>
              <Typography variant="body2" color="text.secondary">Online for</Typography>
              <Typography variant="h6">{typeof daysOnline === 'number' ? `${daysOnline} days` : '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Booked days this year</Typography>
              <Typography variant="h6">{daysBookedThisYear} days</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Profit this year</Typography>
              <Typography variant="h6">${profitThisYear}</Typography>
            </Box>
          </Stack>
        </Paper>
      )}
    </Container>
  );
}
