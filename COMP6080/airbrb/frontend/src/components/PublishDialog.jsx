import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';

function PublishDialog({ open, onClose, listingId, initialAvailability = [], onPublished }) {
  // ranges: [{ start: '2024-05-01', end: '2024-05-03' }, ...]
  const [ranges, setRanges] = useState([]);
  const [error, setError] = useState('');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${
    String(today.getMonth() + 1).padStart(2, '0')
  }-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (open) {
      if (initialAvailability.length > 0 && initialAvailability[0].start) {
        setRanges(initialAvailability);
      } else {
        setRanges([{ start: '', end: '' }]);
      }
      setError('');
    }
  }, [open, initialAvailability]);

  const updateRange = (index, key, value) => {
    setRanges((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const addRange = () => {
    setRanges((prev) => [...prev, { start: '', end: '' }]);
  };

  const removeRange = (index) => {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    const cleaned = ranges
      .map((r) => ({
        start: r.start?.trim(),
        end: r.end?.trim(),
      }))
      .filter((r) => r.start && r.end);

    if (cleaned.length === 0) {
      setError('Please provide at least one valid availability range');
      return;
    }

    for (let i = 0; i < cleaned.length; i += 1) {
      const { start, end } = cleaned[i];
      const startDate = new Date(start);
      const endDate = new Date(end);
    
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        setError(`Range ${i + 1}: invalid date.`);
        return;
      }

      if (startDate > endDate) {
        setError(`Range ${i + 1}: start date must be before or equal to end date.`);
        return;
      }
    }

    const sorted = [...cleaned].sort(
      (a, b) => new Date(a.start) - new Date(b.start)
    );
    
    for (let i = 1; i < sorted.length; i += 1) {
      const prevEnd = new Date(sorted[i - 1].end);
      const curStart = new Date(sorted[i].start);
      if (curStart <= prevEnd) {
        setError(
          `Range ${i} and range ${i + 1} overlap. Please adjust the dates.`
        );
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5005/listings/publish/${listingId}`,
        { availability: cleaned },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (onPublished) onPublished();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to publish listing');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Publish Listing</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Add one or more date ranges when this listing is available for bookings.
        </Typography>

        {error && (
          <Typography sx={{ mb: 1, color: 'red' }}>{error}</Typography>
        )}

        {ranges.map((range, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1.5,
            }}
          >
            <TextField
              label="Start date"
              type="date"
              value={range.start}
              onChange={(e) => updateRange(index, 'start', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: todayStr, 'data-cy': 'publish-start' }}
              fullWidth
            />
            <TextField
              label="End date"
              type="date"
              value={range.end}
              onChange={(e) => updateRange(index, 'end', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: todayStr, 'data-cy': 'publish-end' }}
              fullWidth
            />
            <IconButton
              aria-label="delete range"
              onClick={() => removeRange(index)}
              disabled={ranges.length === 1}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        ))}

        <Button variant="outlined" onClick={addRange}>
          + Add date range
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handlePublish} data-cy="publish-confirm">
          Publish
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PublishDialog;
