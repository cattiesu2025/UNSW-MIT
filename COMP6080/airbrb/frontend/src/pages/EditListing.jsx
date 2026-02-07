import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Grid,
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [postcode, setPostcode] = useState('');
  const [type, setType] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [amenities, setAmenities] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [images, setImages] = useState([]);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');

        const res = await axios.get(`http://localhost:5005/listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = res.data.listing;

        setTitle(data.title || '');
        setPrice(data.price ?? '');

        const addr = data.address || {};
        setStreet(addr.street || '');
        setCity(addr.city || '');
        setStateField(addr.state || '');
        setPostcode(addr.postcode || '');

        const md = data.metadata || {};
        setType(md.propertyType || '');
        setBathrooms(md.bathrooms ?? '');
        setBedrooms(md.bedrooms ?? md.beds ?? '');
        setAmenities((md.amenities || []).join(', '));
        setYoutubeUrl(md.youtubeUrl || '');

        const existingImages =
          md.images && md.images.length
            ? md.images
            : (data.thumbnail ? [data.thumbnail] : []);
        setImages(existingImages);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load listing');
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
  
    const readers = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });
  
    Promise.all(readers).then((results) => {
      setImages((prev) => [...prev, ...results]);
    });
  };
  
  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };  

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const allImages = images;
      const thumbnailToSave = allImages[0] || '';

      const body = {
        title: title.trim(),
        price: Number(price),
        thumbnail: thumbnailToSave,
        address: {
          street: street.trim(),
          city: city.trim(),
          state: stateField.trim(),
          postcode: postcode.trim(),
        },
        metadata: {
          propertyType: type.trim(),
          bathrooms: Number(bathrooms) || 0,
          bedrooms: Number(bedrooms) || 0,
          beds: Number(bedrooms) || 0,
          amenities: amenities
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          youtubeUrl: youtubeUrl.trim(),
          images: allImages, 
        },
      };

      await axios.put(`http://localhost:5005/listings/${id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSaving(false);
      navigate('/my-listings');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update listing');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>Loading listing...</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Edit Listing
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Basic Info
              </Typography>
              <TextField
                label="Title"
                fullWidth
                margin="dense"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                inputProps={{ 'data-cy': 'edit-title' }}
              />
              <TextField
                label="Price per night"
                fullWidth
                type="number"
                margin="dense"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" sx={{ mb: 1 }}>
                Address
              </Typography>
              <TextField
                label="Street"
                fullWidth
                margin="dense"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <TextField
                label="City"
                fullWidth
                margin="dense"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <TextField
                label="State"
                fullWidth
                margin="dense"
                value={stateField}
                onChange={(e) => setStateField(e.target.value)}
              />
              <TextField
                label="Postcode"
                fullWidth
                margin="dense"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" sx={{ mb: 1 }}>
                Details
              </Typography>
              <TextField
                label="Type"
                fullWidth
                margin="dense"
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
              <TextField
                label="Bedrooms (beds)"
                type="number"
                margin="dense"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
              />
              <TextField
                label="Bathrooms"
                type="number"
                margin="dense"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
              />
              <TextField
                label="Amenities (comma separated)"
                fullWidth
                margin="dense"
                value={amenities}
                onChange={(e) => setAmenities(e.target.value)}
              />

              <TextField
                label="YouTube embedded URL (optional)"
                fullWidth
                margin="dense"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                helperText="e.g. https://www.youtube.com/embed/VIDEO_ID"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Images
              </Typography>

              <Button component="label" variant="outlined" size="small">
                Add Images
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  onChange={handleImagesChange}
                />
              </Button>

              {images.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  No images yet. You can upload one or more images.
                </Typography>
              )}

              {images.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {images.map((img, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        position: 'relative',
                        width: 110,
                        height: 110,
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={img}
                        alt={`preview-${idx}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveImage(idx)}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          bgcolor: 'rgba(0,0,0,0.4)',
                          color: 'white',
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                      {idx === 0 && (
                        <Chip
                          label="Thumbnail"
                          size="small"
                          sx={{
                            position: 'absolute',
                            bottom: 4,
                            left: 4,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            fontSize: 10,
                            height: 18,
                          }}
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                First image will be used as thumbnail.
              </Typography>
            </CardContent>
          </Card>

          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Button
              onClick={() => navigate('/my-listings')}
              sx={{ mr: 1 }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              data-cy="edit-submit"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default EditListing;
