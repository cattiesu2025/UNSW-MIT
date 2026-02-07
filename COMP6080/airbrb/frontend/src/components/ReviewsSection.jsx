import dayjs from 'dayjs';
import {
  Card, CardContent, Box, Typography, Rating, Tooltip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';

function ReviewsSection({
  avgRating,
  reviews,
  ratingBreakdown = {},
  ratingPercentages = {},
  onStarSelect,
}) {
  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>
                    Reviews (
          <StarIcon
            fontSize="small"
            sx={{
              color: '#ffb400',
              verticalAlign: '-2px',
            }}
          />
          {avgRating ? avgRating.toFixed(1) : '0'} · {reviews.length} reviews )
        </Typography>

        {reviews.length === 0 && (
          <Typography variant="body2" color="text.secondary">
                        No reviews yet.
          </Typography>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {[1, 2, 3, 4, 5].map((value) => {
              const count = ratingBreakdown[value] || 0;
              const percent = ratingPercentages[value] || '0.0';
              return (
                <Tooltip
                  key={value}
                  arrow
                  placement="top"
                  title={`${value}★: ${count} (${percent}%)`}
                >
                  <span
                    onClick={() => {
                      if (!count) return;
                      onStarSelect && onStarSelect(value);
                    }}
                    style={{
                      display: 'inline-flex',
                      cursor: count ? 'pointer' : 'default',
                    }}
                  >
                    <StarIcon
                      fontSize="small"
                      sx={{
                        color:
                                                    value <= Math.round(avgRating)
                                                      ? '#ffb400'
                                                      : 'rgba(0,0,0,0.26)',
                      }}
                    />
                  </span>
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        {reviews.map((r, idx) => (
          <Box key={idx} sx={{ mb: 2 }} data-testid="review-item">
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {r.author} · {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')}
              </Typography>
              <Rating value={r.rating} readOnly size="small" />
            </Box>
            <Typography variant="body2">{r.comment}</Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export default ReviewsSection;
