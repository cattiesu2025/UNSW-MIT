export function getAverageRating(listing) {
  const reviews = listing.reviews || [];
  if (!reviews.length) return 0;

  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return sum / reviews.length;
}

