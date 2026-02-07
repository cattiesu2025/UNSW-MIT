import {
  Alert,
  Button,
  Rating,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

import axios from 'axios';
import { useState } from 'react';

function CreateReviewDialog( {open, onClose, listingId, bookingId, onCreated}) {
  const token = localStorage.getItem('token');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const handleReviewSubmit = async () => {
    const email = localStorage.getItem('email');
    const time = new Date().toISOString();

    const body = {
      review: {
        rating: rating,
        comment: comment,
        author: email,
        createdAt: time 
      }
    };

    try {
      await axios.put(
        `http://localhost:5005/listings/${listingId}/review/${bookingId}`,
        body,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      setRating(0);
      setComment('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>Post a review</DialogTitle>
      <DialogContent>
        <Rating
          value={rating}
          onChange={(e, v) => setRating(v)}
        />
        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder="Write your review..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          sx={{ mt: 1 }}
        />
        { error && (
          <Alert severity="error">{error}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          sx={{ mt: 1 }}
          onClick={handleReviewSubmit}
        >
                    Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateReviewDialog;