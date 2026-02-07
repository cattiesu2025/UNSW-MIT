import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container, Grid, Box, TextField, Button, Typography, Card, CardContent, IconButton, Chip, Alert, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import defaultThumbnail from '../assets/InitialHouse.webp';
import JsonUpload from '../components/JsonUpload.jsx';

function CreateListing() {
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [postcode, setPostcode] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [amenities, setAmenities] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [images, setImages] = useState([]);
  const [uploadError, setUploadError] = useState('');

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

  const handleSubmit = async () => {
    setCreating(true);
    setError('');

    if (!title.trim() || !price) {
      setError('Title and price are required');
      return;
    }

    const thumbnail = images[0] || defaultThumbnail;

    const body = {
      title: title.trim(),
      price: Number(price),
      thumbnail: thumbnail,
      address: {
        street: street.trim(),
        city: city.trim(),
        state: stateField.trim(),
        postcode: postcode.trim(),
      },
      metadata: {
        propertyType: propertyType.trim(),
        bathrooms: Number(bathrooms) || 0,
        bedrooms: Number(bedrooms) || 0,
        beds: Number(bedrooms) || 0,
        amenities: amenities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        youtubeUrl: youtubeUrl.trim(),
        images: images,
      },
    };

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5005/listings/new', body, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setTitle('');
      setStreet('');
      setCity('');
      setStateField('');
      setPostcode('');
      setPrice('');
      setPropertyType('');
      setBedrooms('');
      setBathrooms('');
      setError('');
      setImages([]);

      setCreating(false);
      navigate('/my-listings');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create listing');
      setCreating(false);
    }
  };

  const validateListingJson = (data) => {
    const errors = [];

    if (typeof data.title !== 'string' || !data.title.trim()) {
      errors.push('Missing or invalid "title".');
    }
    if (typeof data.price !== 'number' || data.price <= 0) {
      errors.push('Missing or invalid "price".');
    }
    if (!data.address || typeof data.address !== 'object') {
      errors.push('Missing "address" object.');
    } else {
      const { street, city, state, postcode } = data.address;
      if (!street || !city || !state || !postcode) {
        errors.push('Address must include street, city, state and postcode.');
      }
    }
    if (!data.metadata || typeof data.metadata !== 'object') {
      errors.push('Missing "metadata" object.');
    } else {
      const { bedrooms, bathrooms, images } = data.metadata;
      if (typeof bedrooms !== 'number' || bedrooms <= 0) {
        errors.push('metadata.bedrooms must be a positive number.');
      }
      if (typeof bathrooms !== 'number' || bathrooms <= 0) {
        errors.push('metadata.bathrooms must be a positive number.');
      }
      if (!Array.isArray(images) || images.length === 0) {
        errors.push('metadata.images must be a non-empty array of image URLs.');
      }
    }

    return errors;
  };

  const handleJsonData = (data) => {
    setUploadError('');

    const errors = validateListingJson(data);
    if (errors.length > 0) {
      setUploadError(errors.join(' '));
      return;
    }

    const addr = data.address || {};
    const meta = data.metadata || {};

    setTitle(data.title ?? '');
    setPrice(data.price != null ? String(data.price) : '');
    setStreet(addr.street ?? '');
    setCity(addr.city ?? '');
    setStateField(addr.state ?? '');
    setPostcode(addr.postcode ?? '');

    setPropertyType(meta.propertyType ?? '');
    setBedrooms(meta.bedrooms != null ? String(meta.bedrooms) : '');
    setBathrooms(meta.bathrooms != null ? String(meta.bathrooms) : '');
    setAmenities(
      Array.isArray(meta.amenities) ? meta.amenities.join(', ') : ''
    );
    setYoutubeUrl(meta.youtubeUrl ?? '');

    let mergedImages = [];
    if (data.thumbnail) {
      mergedImages.push(data.thumbnail);
    }

    if (Array.isArray(meta.images)) {
      mergedImages = mergedImages.concat(
        meta.images.filter((url) => url && !mergedImages.includes(url))
      );
    }

    setImages(mergedImages);
  };

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Create Listing
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
                inputProps={{ 'data-cy': 'create-title' }} 
              />
              <TextField
                label="Price per night"
                fullWidth
                type="number"
                margin="dense"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                data-cy="create-price"
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
                data-cy="create-street"
              />
              <TextField
                label="City"
                fullWidth
                margin="dense"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                data-cy="create-city"
              />
              <TextField
                label="State"
                fullWidth
                margin="dense"
                value={stateField}
                onChange={(e) => setStateField(e.target.value)}
                data-cy="create-state"
              />
              <TextField
                label="Postcode"
                fullWidth
                margin="dense"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                data-cy="create-postcode"
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" sx={{ mb: 1 }}>
                Details
              </Typography>
              <TextField
                label="Type"
                fullWidth
                margin="dense"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                data-cy="create-type"
              />
              <TextField
                label="Bedrooms (beds)"
                type="number"
                margin="dense"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                data-cy="create-bedrooms"
              />
              <TextField
                label="Bathrooms"
                type="number"
                margin="dense"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                data-cy="create-bathrooms"
              />
              <TextField
                label="Amenities (comma separated)"
                fullWidth
                margin="dense"
                value={amenities}
                onChange={(e) => setAmenities(e.target.value)}
                data-cy="create-amenities"
              />

              <TextField
                label="YouTube embedded URL (optional)"
                fullWidth
                margin="dense"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                helperText="e.g. https://www.youtube.com/embed/VIDEO_ID"
                data-cy="create-youtube"
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

              <Button component="label" variant="outlined" size="small" data-cy="create-add-images">
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
                      data-cy="create-image-preview"
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
                        data-cy="create-image-delete"
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

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" sx={{ mb: 1 }}>
                Listing Upload (optional)
              </Typography>
              <JsonUpload
                onUpload={handleJsonData}
                onError={(msg) => setUploadError(msg)}
                error={uploadError}
              />

            </CardContent>
          </Card>

          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Button
              onClick={() => navigate('/my-listings')}
              sx={{ mr: 1 }}
              disabled={creating}
              data-cy="create-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={creating}
              data-cy="create-submit"
            >
              {creating ? 'Createing...' : 'Create Listing'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default CreateListing;
